// =============================================================================
// QR signing-key store + rotatable verifier
//
// Replaces the single static QR_SIGNING_SECRET model with a DB-backed set of
// HMAC keys that can be rotated without invalidating already-issued tokens.
//
// Key states (see sql/006_qr_keys.sql):
//   active  — used to sign new tokens; accepted for verify
//   retired — not used to sign; still accepted for verify
//   revoked — not used to sign; rejected for verify (returns null)
//
// In production, signing REQUIRES a DB-sourced active key. The env var
// QR_SIGNING_SECRET remains only as a dev-only signing fallback when the
// qr_keys table is empty/unreachable AND NODE_ENV !== 'production'. This makes
// "forgot to seed the key table" a noisy startup/runtime failure in prod rather
// than a silent generator of unverifiable tokens.
//
// Cache: the key set is cached for 30s (qr_keys:all), shorter than a typical
// deploy, so rotation propagation can never lag a redeploy. The cache is
// invalidated on any rotation/revocation via invalidateQrKeysCache().
// =============================================================================

const crypto = require('crypto')
const { supabase } = require('./db')
const cache = require('./cache')
const logger = require('./logger')

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET
const SECRET_MIN_LEN = 32
const KEY_CACHE_TTL = 30_000 // 30s — see header comment
const KEY_CACHE_KEY = 'qr_keys:all'
const LEGACY_KID = 'k_legacy'

// ---- key store (DB, cached) ------------------------------------------------

/**
 * Returns the full key set ordered with active first. Each key:
 *   { kid, secret, status }
 * Active: exactly one (enforced by partial unique index). Retired/revoked:
 * zero or more, included so verify can dispatch by kid.
 */
async function getAllKeyRecords() {
  const cached = cache.get(KEY_CACHE_KEY)
  if (cached) return cached

  let records = null
  let queryError = null

  try {
    const { data, error } = await supabase
      .from('qr_keys')
      .select('kid, secret, status')
      .order('created_at', { ascending: false })
    if (error) throw error
    records = data
  } catch (err) {
    queryError = err
  }

  const isProd = process.env.NODE_ENV === 'production'

  // Fail closed in production: a transient DB failure must NOT silently mint
  // tokens signed with the env secret — those would fail verification once the
  // DB recovers (if the env secret differs from the stored k_legacy). Better to
  // reject the one in-flight request loudly than to generate unverifiable cards.
  if (queryError) {
    if (isProd) {
      throw new Error(`qr_keys lookup failed in production: ${queryError.message}`)
    }
    logger.warn({ err: queryError.message }, 'qr_keys lookup failed (dev fallback)')
  }

  // Dev-only fallback: if no DB key is available, synthesize k_legacy from the
  // env secret so the server keeps running in local dev without a seeded table.
  // In production we do NOT use the env secret for signing — see getActiveKey().
  if (!records?.length) {
    if (isProd) {
      throw new Error('No QR signing keys found in qr_keys (production refuses env fallback)')
    }
    records = QR_SIGNING_SECRET
      ? [{ kid: LEGACY_KID, secret: QR_SIGNING_SECRET, status: 'active' }]
      : []
  }

  cache.set(KEY_CACHE_KEY, records, KEY_CACHE_TTL)
  return records
}

/**
 * The active signing key. Throws in production if none exists (this would mean
 * the key table is empty AND no env fallback was available — a config error,
 * never a silent signing failure). In dev it falls back to the env seed.
 */
async function getActiveKey() {
  const records = await getAllKeyRecords()
  const active = records.find((r) => r.status === 'active')
  if (active) return active

  if (process.env.NODE_ENV === 'production') {
    throw new Error('No active QR signing key found in qr_keys (production refuses to sign with env fallback)')
  }
  // Dev fallback (shouldn't normally hit — getAllKeyRecords synthesizes it).
  if (QR_SIGNING_SECRET && QR_SIGNING_SECRET.length >= SECRET_MIN_LEN) {
    return { kid: LEGACY_KID, secret: QR_SIGNING_SECRET, status: 'active' }
  }
  throw new Error('No active QR signing key and no usable QR_SIGNING_SECRET env var')
}

function keyByKid(records, kid) {
  return records.find((r) => r.kid === kid) || null
}

/** Call after any rotation/revocation so verify dispatch picks up the new state */
function invalidateQrKeysCache() {
  cache.delete(KEY_CACHE_KEY)
}

// ---- audit logging --------------------------------------------------------

async function logQrAudit(action, actor, meta = {}) {
  try {
    const { error } = await supabase
      .from('qr_audit')
      .insert({
        action,
        actor,
        kid: meta.kid || null,
        old_kid: meta.old_kid || null,
        new_kid: meta.new_kid || null,
        reason: meta.reason || null,
        meta,
      })
    if (error) {
      logger.error({ err: error, action, actor }, 'Failed to write QR audit log')
    }
  } catch (err) {
    // Non-blocking: audit failure should not break the operation
    logger.error({ err, action, actor }, 'QR audit log write exception')
  }
}

// ---- token format ----------------------------------------------------------
//
// v2:    v2.<claims-b64>.<kid>.<sig-b64>
//   claims (JSON, base64url): { sid, iat, exp?, kid }
//   sig = HMAC-SHA256(key.secret, `v2.<claims-b64>.<kid>`)
//   NOTE: the outer kid is part of the MACed input — prevents a tampered-kid
//   downgrade attack where an attacker swaps the outer kid to target a
//   different (e.g. retired/compromised) key.
//
// v1:    <payload-b64>.<sig-b64>     (the legacy format, signed by k_legacy)
//   payload = base64url(studentId); sig = HMAC-SHA256(k_legacy, payload)
//   Card-side — every currently printed card. Handled by the v1 shim, gated on
//   k_legacy being non-revoked. Pulling k_legacy revoked sunsets v1.
// ---------------------------------------------------------------------------

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const b64urlDecode = (str) => Buffer.from(str, 'base64url')

function constantTimeEqualSig(a, b) {
  const aBuf = Buffer.from(a, 'base64url')
  const bBuf = Buffer.from(b, 'base64url')
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

// ---- v1 (legacy) sign/verify — only exits to keep migration continuous ----

function signV1(studentId) {
  const payload = b64url(studentId)
  const sig = crypto.createHmac('sha256', QR_SIGNING_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyV1(token, legacyKey) {
  const [payload, sig] = (token || '').split('.')
  if (!payload || !sig) return null
  // k_legacy must be present and non-revoked for v1 to verify at all.
  if (!legacyKey || legacyKey.status === 'revoked') return null
  const expected = crypto
    .createHmac('sha256', legacyKey.secret)
    .update(payload)
    .digest('base64url')
  try {
    if (!constantTimeEqualSig(sig, expected)) return null
    return b64urlDecode(payload).toString()
  } catch {
    return null
  }
}

// ---- v2 sign/verify (rotatable) -------------------------------------------

/**
 * Sign a v2 token. The issuer flip (going live with v2 on printed cards) is a
 * deliberate, separate change — see Phase 2 of the design. Until then the
 * public signStudentToken() keeps signing v1 so this code path can be fully
 * exercised and tested in isolation.
 *
 * opts.ttlSec — optional token lifetime for short-lived digital links
 *               (preview/self-correct); printed cards omit it (exp = null).
 */
async function signV2(studentId, opts = {}) {
  const key = await getActiveKey()
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sid: studentId,
    iat: now,
    exp: opts.ttlSec ? now + opts.ttlSec : null,
    kid: key.kid,
  }
  const claimsB64 = b64url(JSON.stringify(claims))
  const signedInput = `v2.${claimsB64}.${key.kid}`
  const sig = crypto.createHmac('sha256', key.secret).update(signedInput).digest('base64url')
  return `${signedInput}.${sig}`
}

function verifyV2(token, records) {
  // v2.<claims-b64>.<kid>.<sig>
  const parts = (token || '').split('.')
  if (parts.length !== 4 || parts[0] !== 'v2') return null
  const [, claimsB64, outerKid, sig] = parts

  const key = keyByKid(records, outerKid)
  if (!key || key.status === 'revoked') return null

  // Sign the same input that the issuer signed — outer kid IS in the MAC input.
  const signedInput = `v2.${claimsB64}.${outerKid}`
  const expected = crypto
    .createHmac('sha256', key.secret)
    .update(signedInput)
    .digest('base64url')
  try {
    if (!constantTimeEqualSig(sig, expected)) return null
  } catch {
    return null
  }

  let claims
  try {
    claims = JSON.parse(b64urlDecode(claimsB64).toString())
  } catch {
    return null
  }
  // Inner/outer kid must match — a token can't claim a different key than the
  // one that signed it.
  if (claims.kid !== outerKid) return null
  if (typeof claims.sid !== 'string' || !claims.sid) return null
  if (claims.exp && Number(claims.exp) < Math.floor(Date.now() / 1000)) return null
  return claims.sid
}

// ---- public API (signature-compatible with the old qr.js exports) ---------
//
// Phase 2: signStudentToken now emits v2 (rotatable) tokens. verifyStudentToken
// already accepts both v1 (shim) and v2, so this is a one-way forward flip.
// Existing v1 cards keep verifying via the v1 shim.

async function signStudentToken(studentId, opts = {}) {
  // Phase 2: emit v2. opts.ttlSec is passed through for short-lived links
  // (preview/self-correct); printed cards omit it (exp = null).
  return signV2(studentId, opts)
}

async function verifyStudentToken(token) {
  const records = await getAllKeyRecords()
  const legacyKey = keyByKid(records, LEGACY_KID)

  // v1 shim — every currently-printed card. Gated on k_legacy not being revoked.
  if (!token || !token.startsWith('v2.')) {
    const sid = verifyV1(token, legacyKey)
    if (sid) logger.debug({ version: 'v1', kid: LEGACY_KID }, 'qr.verify ok')
    else if (token) logger.debug({ version: 'v1' }, 'qr.verify rejected')
    return sid
  }

  const sid = verifyV2(token, records)
  if (sid) logger.debug({ version: 'v2' }, 'qr.verify ok')
  else logger.debug({ version: 'v2' }, 'qr.verify rejected')
  return sid
}

module.exports = {
  // public — same surface the old qr.js exported
  signStudentToken,
  verifyStudentToken,
  // exposed for tests + the future Phase 2 issuer + admin rotation endpoints
  signV2,
  verifyV2,
  verifyV1,
  signV1,
  getActiveKey,
  getAllKeyRecords,
  invalidateQrKeysCache,
  logQrAudit,
  LEGACY_KID,
}
