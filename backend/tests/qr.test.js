import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const OLD_ENV = process.env

beforeAll(() => {
  // Dev-fallback path in qr-keys.js synthesises k_legacy from QR_SIGNING_SECRET
  // when the qr_keys table is empty/unreachable. This keeps tests hermetic —
  // no Supabase / DB required. Why this is acceptable: the production path
  // (NODE_ENV=production) refuses to sign with the env fallback and would throw
  // here, which is the exact behaviour the verifier code asserts. Tests run
  // under the default (non-production) NODE_ENV so the fallback is exercised.
  process.env = {
    ...OLD_ENV,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    QR_SIGNING_SECRET: 'test-secret-that-is-long-enough-for-hmac',
  }
})

afterAll(() => {
  process.env = OLD_ENV
})

beforeEach(() => {
  vi.resetModules()
  // Each test begins with a cold in-process cache so key-state changes
  // between tests (e.g. active -> revoked) are visible to the verifier.
})

describe('QR module — v1 (legacy, current issuance)', () => {
  it('should sign and verify a v1 student token', async () => {
    const { signStudentToken, verifyStudentToken } = require('../routes/qr')
    const studentId = 'STU-2024-001'
    const token = signStudentToken(studentId)
    expect(token).toBeTruthy()
    expect(token).toContain('.')
    // v1 tokens have no version prefix
    expect(token.startsWith('v2.')).toBe(false)

    const decoded = await verifyStudentToken(token)
    expect(decoded).toBe(studentId)
  })

  it('should reject a tampered v1 token', async () => {
    const { signStudentToken, verifyStudentToken } = require('../routes/qr')
    const token = signStudentToken('STU-2024-001')
    const [payload] = token.split('.')
    const tampered = `${payload}.invalidsignature`
    expect(await verifyStudentToken(tampered)).toBeNull()
  })

  it('should return null for empty / null / undefined v1 tokens', async () => {
    const { verifyStudentToken } = require('../routes/qr')
    expect(await verifyStudentToken('')).toBeNull()
    expect(await verifyStudentToken(null)).toBeNull()
    expect(await verifyStudentToken(undefined)).toBeNull()
  })
})

describe('QR module — v2 (rotatable, verifier ready, issuer not yet flipped)', () => {
  it('should sign and verify a v2 token', async () => {
    const { signV2, verifyStudentToken } = require('../routes/qr')
    const studentId = 'AMD-2024-0001'
    const token = await signV2(studentId)
    expect(token.startsWith('v2.')).toBe(true)
    // v2 shape: v2.<claims>.<kid>.<sig>  -> 4 dot-separated parts
    expect(token.split('.')).toHaveLength(4)

    const decoded = await verifyStudentToken(token)
    expect(decoded).toBe(studentId)
  })

  it('the v2 token claims a kid matching the outer (signed) kid', async () => {
    const { signV2 } = require('../routes/qr')
    const token = await signV2('AMD-2024-0002')
    const [, claimsB64, outerKid] = token.split('.')
    const claims = JSON.parse(Buffer.from(claimsB64, 'base64url').toString())
    expect(claims.kid).toBe(outerKid)
    // In the env-fallback-only test path the active key is k_legacy.
    expect(claims.kid).toBe('k_legacy')
    expect(claims.sid).toBe('AMD-2024-0002')
    expect(claims.iat).toBeTypeOf('number')
    expect(claims.exp).toBeNull() // printed-card cohort: no expiry
  })

  it('honours a short ttlSec as exp on a v2 token', async () => {
    const { signV2, verifyStudentToken } = require('../routes/qr')
    const token = await signV2('AMD-2024-0003', { ttlSec: 60 })
    const claimsB64 = token.split('.')[1]
    const claims = JSON.parse(Buffer.from(claimsB64, 'base64url').toString())
    expect(claims.exp).toBeGreaterThan(claims.iat)
    expect(await verifyStudentToken(token)).toBe('AMD-2024-0003')
  })

  it('rejects an expired v2 token', async () => {
    const { signV2, verifyStudentToken } = require('../qr-keys')
    // Mint a token already expired by back-dating exp via raw claim injection
    // through signV2 with a negative ttl, then verify.
    const token = await signV2('AMD-2024-0004', { ttlSec: -10 })
    expect(await verifyStudentToken(token)).toBeNull()
  })

  it('rejects a tampered v2 signature', async () => {
    const { signV2, verifyStudentToken } = require('../routes/qr')
    const token = await signV2('AMD-2024-0005')
    const parts = token.split('.')
    parts[3] = 'A' + 'a'.repeat(40) // bogus sig (base64url-ish length)
    const tampered = parts.join('.')
    expect(await verifyStudentToken(tampered)).toBeNull()
  })

  it('rejects a v2 token whose outer kid is swapped (tampered-kid downgrade)', async () => {
    // Swap the outer kid to a non-existent key; the signature will no longer
    // match (outer kid is part of the MACed input), so verify must reject.
    const { signV2, verifyStudentToken } = require('../routes/qr')
    const token = await signV2('AMD-2024-0006')
    const parts = token.split('.')
    parts[2] = 'k_does_not_exist'
    const tampered = parts.join('.')
    expect(await verifyStudentToken(tampered)).toBeNull()
  })

  it('rejects a v2 token with malformed claims payload', async () => {
    const { verifyStudentToken, LEGACY_KID } = require('../qr-keys')
    // Build a syntactically-valid v2 framing around a non-JSON claims body,
    // signed with the legacy secret so the kid/sig machinery is reached.
    const crypto = require('crypto')
    const badClaimsB64 = Buffer.from('not-json-at-all').toString('base64url')
    const signedInput = `v2.${badClaimsB64}.${LEGACY_KID}`
    const secret = process.env.QR_SIGNING_SECRET
    const sig = crypto.createHmac('sha256', secret).update(signedInput).digest('base64url')
    const token = `${signedInput}.${sig}`
    expect(await verifyStudentToken(token)).toBeNull()
  })
})

describe('QR module — init defaults', () => {
  it('exposes the deterministic legacy key id', () => {
    const { LEGACY_KID } = require('../qr-keys')
    expect(LEGACY_KID).toBe('k_legacy')
  })
})
