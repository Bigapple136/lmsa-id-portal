const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const unzipper = require('unzipper')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const { logAdminAction } = require('../auditLog')
const logger = require('../logger')
const { enqueueImport } = require('../queue')
const {
  createJob,
  setJobReady,
  setJobFailed,
  setJobProcessing,
  setJobProgress,
} = require('../jobStore')
const {
  TABLES,
  STORAGE_BUCKETS,
  buildBackupZip,
  listAllFiles,
  mapPool,
} = require('./backup')

// Guided restore: upload a backup ZIP → review a live-vs-backup preview →
// type RESTORE to apply. Every step is full-admin-only and audit-logged.
//
// Safety rules (do not weaken these without a design review):
//  1. NOTHING is applied until POST /:id/apply with the exact confirm phrase,
//     and only after GET /:id/preview has been viewed.
//  2. Apply always snapshots the CURRENT live data first; if the snapshot
//     fails, the restore aborts before changing a single row.
//  3. Tables merge (upsert by primary key): backup rows overwrite same-key
//     live rows, live-only rows are NEVER deleted. There is no truncate.
//  4. Files merge (upload with upsert): backup files overwrite same-path
//     live files, live-only files are NEVER deleted.
//  5. qr_keys is never in backups and never touched by restore.
//  6. Every phase is idempotent — re-running apply after a partial failure
//     is safe and is the documented recovery path.

const CONFIRM_PHRASE = 'RESTORE'
const RESTORE_TTL_MS = 24 * 60 * 60 * 1000 // restore workspaces (incl. snapshots) live 24h
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1 GB compressed upload
const MAX_EXTRACTED_FILES = 50000 // zip-bomb guard: file count
const MAX_EXTRACTED_BYTES = 5 * 1024 * 1024 * 1024 // zip-bomb guard: uncompressed size
const UPSERT_BATCH = 500

// Parents before children so foreign keys resolve during the merge:
//  - admins before admin_role_logs / admin_actions / layout_history / student_submissions.reviewed_by
//  - students before confirmations / correction_requests
//  - notifications before notification_reads
// Must always be the same SET as backup TABLES — enforced in tests.
const RESTORE_TABLE_ORDER = [
  'portal_settings',
  'admins',
  'students',
  'templates',
  'notifications',
  'admin_actions',
  'admin_role_logs',
  'layout_history',
  'student_submissions',
  'confirmations',
  'correction_requests',
  'notification_reads',
  'qr_audit',
]

// Primary-key columns per table, from sql/. Used as upsert onConflict targets.
const TABLE_PK = {
  students: ['student_id'],
  admins: ['id'],
  admin_role_logs: ['id'],
  portal_settings: ['key'],
  templates: ['id'],
  confirmations: ['id'],
  student_submissions: ['id'],
  correction_requests: ['id'],
  admin_actions: ['id'],
  layout_history: ['id'],
  notifications: ['id'],
  notification_reads: ['notification_id', 'admin_id'],
  qr_audit: ['id'],
}

// LMSA_RESTORE_RATE_MAX exists so the test suite (which hammers these
// endpoints from one IP) can raise the ceiling; production uses 10.
const restoreLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.LMSA_RESTORE_RATE_MAX ? Number(process.env.LMSA_RESTORE_RATE_MAX) : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many restore requests. Please try again later.' },
})

// ── Workspace (staging) helpers ─────────────────────────────────────────────

function getRestoreDir() {
  return process.env.LMSA_RESTORE_DIR || path.join(os.tmpdir(), 'lmsa-restore')
}

function getUploadDir() {
  return process.env.LMSA_RESTORE_UPLOAD_DIR || path.join(os.tmpdir(), 'lmsa-restore-uploads')
}

function isValidRestoreId(id) {
  return typeof id === 'string' && /^[a-f0-9]{16}$/.test(id)
}

function workspacePath(id) {
  return path.join(getRestoreDir(), id)
}

function readRequest(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(workspacePath(id), 'request.json'), 'utf8'))
  } catch {
    return null
  }
}

function writeRequest(id, meta) {
  const dir = workspacePath(id)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `request.${process.pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify(meta))
  fs.renameSync(tmp, path.join(dir, 'request.json'))
}

function removeWorkspace(id) {
  try {
    fs.rmSync(workspacePath(id), { recursive: true, force: true })
  } catch {
    // Best effort.
  }
}

// Returns the workspace meta, or null when the id is invalid, unknown, or
// expired (expired workspaces are removed so a stale preview can never be
// applied against data it no longer describes).
function getWorkspace(id) {
  if (!isValidRestoreId(id)) return null
  const meta = readRequest(id)
  if (!meta) return null
  if (typeof meta.createdAt !== 'number' || Date.now() - meta.createdAt > RESTORE_TTL_MS) {
    removeWorkspace(id)
    return null
  }
  return meta
}

function sweepExpired() {
  try {
    const dir = getRestoreDir()
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!isValidRestoreId(name)) continue
        const meta = readRequest(name)
        if (!meta || Date.now() - meta.createdAt > RESTORE_TTL_MS) removeWorkspace(name)
      }
    }
    // Abandoned raw uploads (e.g. validation rejected them mid-flight).
    const uploads = getUploadDir()
    if (fs.existsSync(uploads)) {
      const now = Date.now()
      for (const name of fs.readdirSync(uploads)) {
        const full = path.join(uploads, name)
        try {
          if (now - fs.statSync(full).mtimeMs > 60 * 60 * 1000) fs.unlinkSync(full)
        } catch {
          // Ignore.
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Restore sweep failed')
  }
}

// ── Upload handling ─────────────────────────────────────────────────────────

const upload = multer({
  // Disk, not memory: a photo-heavy backup can be hundreds of MB and must
  // never sit in the Node heap.
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        fs.mkdirSync(getUploadDir(), { recursive: true })
        cb(null, getUploadDir())
      } catch (err) {
        cb(err)
      }
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.zip`)
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.zip$/i.test(file.originalname || '')) return cb(null, true)
    cb(new Error('Only .zip backup files are accepted.'))
  },
})

// Streaming extraction — the ZIP is never fully loaded into memory.
// Throws on zip-slip paths, file-count and uncompressed-size caps.
async function extractZip(zipPath, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true })
  const archive = await unzipper.Open.file(zipPath)
  const base = path.normalize(destDir + path.sep)
  let count = 0
  let bytes = 0
  for (const entry of archive.files) {
    const target = path.normalize(path.join(destDir, entry.path))
    if (!target.startsWith(base)) {
      throw new Error(`Unsafe entry in backup zip: ${entry.path}`)
    }
    if (entry.type === 'Directory') {
      await fs.promises.mkdir(target, { recursive: true })
      continue
    }
    count += 1
    if (count > MAX_EXTRACTED_FILES) throw new Error('Backup zip contains too many files.')
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await new Promise((resolve, reject) => {
      entry
        .stream()
        .on('error', reject)
        .pipe(fs.createWriteStream(target))
        .on('error', reject)
        .on('finish', resolve)
    })
    bytes += (await fs.promises.stat(target)).size
    if (bytes > MAX_EXTRACTED_BYTES) throw new Error('Backup zip is too large once extracted.')
  }
  return { files: count, bytes }
}

// Pure validation of the manifest — unit-tested. Anything failing here is
// "not a LIMSA backup", never a partial restore.
function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, error: 'Not a LIMSA backup: manifest.json is missing or invalid.' }
  }
  if (typeof manifest.generated_at !== 'string' || !manifest.generated_at) {
    return { ok: false, error: 'Not a LIMSA backup: manifest.json has no generated_at.' }
  }
  if (!manifest.tables || typeof manifest.tables !== 'object') {
    return { ok: false, error: 'Not a LIMSA backup: manifest.json has no tables section.' }
  }
  return { ok: true, generatedAt: manifest.generated_at }
}

function walkFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const stack = [dir]
  while (stack.length > 0) {
    const cur = stack.pop()
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) stack.push(full)
      else out.push(full)
    }
  }
  return out
}

// Reads the extracted tree (small JSON summaries only — row data stays on
// disk until apply) into a per-table / per-bucket plan.
function summarizeExtracted(extractedDir) {
  const tables = {}
  const warnings = []
  for (const table of TABLES) {
    const file = path.join(extractedDir, 'database', `${table}.json`)
    if (!fs.existsSync(file)) {
      tables[table] = { status: 'missing' }
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      tables[table] = { status: 'error', error: 'could not be parsed as JSON' }
      continue
    }
    if (Array.isArray(parsed)) {
      tables[table] = { status: 'ok', rows: parsed.length }
    } else if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
      tables[table] = { status: 'error', error: parsed.error }
    } else {
      tables[table] = { status: 'error', error: 'unexpected format (expected an array of rows)' }
    }
  }
  const errorTables = Object.entries(tables).filter(([, t]) => t.status === 'error')
  if (errorTables.length > 0) {
    warnings.push(
      `${errorTables.length} table(s) had errors when the backup was taken and will be skipped: ` +
        errorTables.map(([t]) => t).join(', '),
    )
  }
  const files = {}
  let totalFiles = 0
  for (const { bucket, folder } of STORAGE_BUCKETS) {
    const count = walkFiles(path.join(extractedDir, folder)).length
    files[bucket] = { count }
    totalFiles += count
  }
  const filesRoot = path.join(extractedDir, 'files')
  if (fs.existsSync(filesRoot)) {
    const known = new Set(STORAGE_BUCKETS.map(({ folder }) => folder.split('/')[1]))
    for (const name of fs.readdirSync(filesRoot)) {
      if (!known.has(name)) warnings.push(`Unknown folder "files/${name}" in backup will be ignored.`)
    }
  }
  const totalRows = Object.values(tables).reduce((n, t) => n + (t.rows || 0), 0)
  return { tables, files, warnings, totalRows, totalFiles }
}

// POST /api/restore/upload — validate a backup ZIP and stage it for review.
// Nothing is written to the live database or live buckets here.
router.post('/upload', requireAdmin, requireFullAdmin, restoreLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Attach the backup .zip as "file".' })
  sweepExpired()
  const restoreId = crypto.randomBytes(8).toString('hex')
  const dir = workspacePath(restoreId)
  const extractedDir = path.join(dir, 'extracted')
  try {
    await extractZip(req.file.path, extractedDir)
  } catch (err) {
    try {
      fs.unlinkSync(req.file.path)
    } catch {
      // Ignore.
    }
    removeWorkspace(restoreId)
    return res.status(400).json({ error: err.message || 'Could not read the backup zip.' })
  }
  try {
    fs.unlinkSync(req.file.path)
  } catch {
    // Ignore — the sweep reaps strays.
  }

  let manifest = null
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(extractedDir, 'manifest.json'), 'utf8'))
  } catch {
    // Falls through to the manifest check below.
  }
  const valid = validateBackupManifest(manifest)
  if (!valid.ok) {
    removeWorkspace(restoreId)
    return res.status(400).json({ error: valid.error })
  }
  const summary = summarizeExtracted(extractedDir)
  writeRequest(restoreId, {
    id: restoreId,
    createdAt: Date.now(),
    uploadedBy: { id: req.user?.id || null, email: req.user?.email || null },
    backupGeneratedAt: valid.generatedAt,
    backupCompletedAt: manifest.completed_at || null,
    summary,
    previewedAt: null,
    appliedJobIds: [],
  })
  await logAdminAction(req, 'restore_uploaded', {
    targetType: 'restore',
    targetId: restoreId,
    details: {
      backupGeneratedAt: valid.generatedAt,
      tables: Object.values(summary.tables).filter((t) => t.status === 'ok').length,
      rows: summary.totalRows,
      files: summary.totalFiles,
    },
  })
  res.json({
    restoreId,
    backupGeneratedAt: valid.generatedAt,
    backupCompletedAt: manifest.completed_at || null,
    tables: summary.tables,
    files: summary.files,
    warnings: summary.warnings,
    totals: { rows: summary.totalRows, files: summary.totalFiles },
  })
})

// ── Preview ─────────────────────────────────────────────────────────────────

// GET /api/restore/:restoreId/preview — live-vs-backup diff. Read-only, but
// marks the session previewed, which apply requires.
router.get('/:restoreId/preview', requireAdmin, requireFullAdmin, async (req, res) => {
  const meta = getWorkspace(req.params.restoreId)
  if (!meta) {
    return res.status(404).json({ error: 'Restore session not found or expired. Upload the backup again.' })
  }
  const liveCounts = {}
  await mapPool(RESTORE_TABLE_ORDER, 4, async (table) => {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      liveCounts[table] = error ? { error: error.message } : { count: count ?? 0 }
    } catch (err) {
      liveCounts[table] = { error: err.message }
    }
  })
  const liveFiles = {}
  await Promise.all(
    STORAGE_BUCKETS.map(async ({ bucket }) => {
      try {
        liveFiles[bucket] = { count: (await listAllFiles(bucket)).length }
      } catch (err) {
        liveFiles[bucket] = { error: err.message }
      }
    }),
  )

  const tables = RESTORE_TABLE_ORDER.map((table) => {
    const plan = meta.summary.tables[table] || { status: 'missing' }
    const live = liveCounts[table] || {}
    if (plan.status === 'ok') {
      return { table, action: 'merge', backupRows: plan.rows, liveRows: live.count ?? null, liveError: live.error || null }
    }
    const reason =
      plan.status === 'error'
        ? `skipped: backup copy failed ("${plan.error}")`
        : 'skipped: not present in this backup (left untouched)'
    return {
      table,
      action: 'skip',
      reason,
      backupRows: 0,
      liveRows: live.count ?? null,
      liveError: live.error || null,
    }
  })
  const files = STORAGE_BUCKETS.map(({ bucket }) => ({
    bucket,
    backupFiles: meta.summary.files[bucket]?.count ?? 0,
    liveFiles: liveFiles[bucket]?.count ?? null,
    liveError: liveFiles[bucket]?.error || null,
  }))
  const warnings = [...meta.summary.warnings]
  if ((meta.summary.tables.admins?.rows || 0) > 0) {
    warnings.push(
      'Admin rows restore only for login accounts that still exist; rows for removed logins are skipped (never recreated).',
    )
  }
  warnings.push('QR signing keys are never in backups and are never touched by restore.')
  warnings.push('Applying first snapshots the CURRENT live data — the snapshot stays downloadable for 24 hours.')

  meta.previewedAt = Date.now()
  writeRequest(meta.id, meta)
  res.json({
    restoreId: meta.id,
    backupGeneratedAt: meta.backupGeneratedAt,
    tables,
    files,
    warnings,
  })
})

// ── Apply ───────────────────────────────────────────────────────────────────

function describePk(row, pk) {
  if (!row || typeof row !== 'object') return '(unreadable row)'
  return pk.map((k) => `${k}=${String(row[k])}`).join(',')
}

async function restoreTable(table, rows) {
  const pk = TABLE_PK[table]
  const result = { restored: 0, skipped: 0, errors: [] }
  const valid = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || pk.some((k) => row[k] === null || row[k] === undefined)) {
      result.skipped += 1
      if (result.errors.length < 20) {
        result.errors.push({ row: describePk(row, pk), error: 'missing primary key value' })
      }
      continue
    }
    valid.push(row)
  }
  for (let i = 0; i < valid.length; i += UPSERT_BATCH) {
    const batch = valid.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase.from(table).upsert(batch, { onConflict: pk.join(',') })
    if (!error) {
      result.restored += batch.length
      continue
    }
    // One bad row (e.g. a removed FK target) must not sink the other 499 —
    // retry row by row so everything salvageable still lands.
    logger.warn({ table, err: error.message }, 'Restore batch failed — retrying row by row')
    for (const row of batch) {
      const { error: rowErr } = await supabase.from(table).upsert([row], { onConflict: pk.join(',') })
      if (!rowErr) {
        result.restored += 1
      } else {
        result.skipped += 1
        if (result.errors.length < 20) {
          result.errors.push({ row: describePk(row, pk), error: rowErr.message })
        }
      }
    }
  }
  return result
}

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

function contentTypeFor(relPath) {
  const ext = (relPath.split('.').pop() || '').toLowerCase()
  return CONTENT_TYPES[ext] || 'application/octet-stream'
}

function collectRestoreFiles(extractedDir) {
  const out = []
  for (const { bucket, folder } of STORAGE_BUCKETS) {
    const base = path.join(extractedDir, folder)
    for (const absPath of walkFiles(base)) {
      out.push({ bucket, relPath: path.relative(base, absPath).split(path.sep).join('/'), absPath })
    }
  }
  return out
}

function snapshotPath(restoreId) {
  return path.join(workspacePath(restoreId), 'snapshot.zip')
}

async function runRestore(restoreId, jobId, actor, includeFiles) {
  setJobProcessing(jobId)
  const setProgress = (progress) => setJobProgress(jobId, { restoreId, ...progress })
  const warnings = []
  const tableResults = {}
  try {
    const meta = readRequest(restoreId)
    if (!meta) throw new Error('Restore session expired before the job ran — upload the backup again.')
    const extractedDir = path.join(workspacePath(restoreId), 'extracted')

    // Phase 1 — snapshot CURRENT live data. If this fails, abort before
    // changing a single row: a restore without a rollback is not a restore.
    setProgress({ phase: 'snapshot', label: 'Snapshotting current data…' })
    let snapshotBytes = 0
    try {
      const snap = await buildBackupZip()
      fs.writeFileSync(snapshotPath(restoreId), snap.buffer)
      snapshotBytes = snap.buffer.length
    } catch (err) {
      throw new Error(`Aborted before changing anything: pre-restore snapshot failed (${err.message})`)
    }

    // Phase 2 — tables, parents before children. Merge only: upsert by PK,
    // live-only rows are never deleted.
    const ordered = RESTORE_TABLE_ORDER.filter((t) => meta.summary.tables[t]?.status === 'ok')
    let done = 0
    for (const table of RESTORE_TABLE_ORDER) {
      if (meta.summary.tables[table]?.status !== 'ok') {
        tableResults[table] = { restored: 0, skipped: 0, status: 'skipped' }
        continue
      }
      setProgress({
        phase: 'tables',
        label: `Restoring ${table}… (${done + 1}/${ordered.length})`,
        tablesDone: done,
        tablesTotal: ordered.length,
        currentTable: table,
      })
      const rows = JSON.parse(fs.readFileSync(path.join(extractedDir, 'database', `${table}.json`), 'utf8'))
      tableResults[table] = { ...(await restoreTable(table, rows)), status: 'merged' }
      done += 1
    }
    setProgress({ phase: 'tables', label: 'Tables restored.', tablesDone: done, tablesTotal: ordered.length })

    // qr_audit.id is BIGSERIAL: explicit ids leave the sequence behind, so
    // advance it (sql/017). Older databases without the function keep
    // working — they just get a warning naming the migration to run.
    if ((tableResults.qr_audit?.restored || 0) > 0) {
      try {
        const { error } = await supabase.rpc('reset_qr_audit_sequence')
        if (error) throw new Error(error.message)
      } catch (err) {
        warnings.push(
          'qr_audit rows were restored but the id sequence could not be reset ' +
            `(${err.message}). Run sql/017_restore_sequence_reset.sql in Supabase, then re-apply.`,
        )
      }
    }

    // Phase 3 — files, same-path overwrite only, live-only files untouched.
    let fileResults = { skipped: true }
    if (includeFiles) {
      fileResults = { restored: 0, failed: 0, errors: [] }
      const allFiles = collectRestoreFiles(extractedDir)
      setProgress({ phase: 'files', label: 'Restoring files…', filesDone: 0, filesTotal: allFiles.length })
      let filesDone = 0
      await mapPool(allFiles, 8, async ({ bucket, relPath, absPath }) => {
        try {
          const buffer = await fs.promises.readFile(absPath)
          const { error } = await supabase.storage
            .from(bucket)
            .upload(relPath, buffer, { upsert: true, contentType: contentTypeFor(relPath) })
          if (error) throw new Error(error.message)
          fileResults.restored += 1
        } catch (err) {
          fileResults.failed += 1
          if (fileResults.errors.length < 50) {
            fileResults.errors.push({ bucket, path: relPath, error: err.message })
          }
        }
        filesDone += 1
        if (filesDone % 10 === 0 || filesDone === allFiles.length) {
          setProgress({
            phase: 'files',
            label: `Restoring files… (${filesDone}/${allFiles.length})`,
            filesDone,
            filesTotal: allFiles.length,
          })
        }
      })
    }

    const restoredRows = Object.values(tableResults).reduce((n, t) => n + (t.restored || 0), 0)
    const skippedRows = Object.values(tableResults).reduce((n, t) => n + (t.skipped || 0), 0)
    const result = {
      restoreId,
      backupGeneratedAt: meta.backupGeneratedAt,
      completedAt: new Date().toISOString(),
      snapshotBytes,
      tables: tableResults,
      files: fileResults,
      warnings,
      totals: {
        rowsRestored: restoredRows,
        rowsSkipped: skippedRows,
        filesRestored: fileResults.restored || 0,
        filesFailed: fileResults.failed || 0,
      },
    }
    fs.writeFileSync(path.join(workspacePath(restoreId), 'result.json'), JSON.stringify(result, null, 2))
    setJobReady(jobId, { result })
    await logAdminAction({ user: actor }, 'restore_completed', {
      targetType: 'restore',
      targetId: restoreId,
      details: { jobId, backupGeneratedAt: meta.backupGeneratedAt, ...result.totals, snapshotBytes },
    })
  } catch (err) {
    logger.error({ restoreId, jobId, err: err.message }, 'Restore failed')
    setJobFailed(jobId, err)
    await logAdminAction({ user: actor }, 'restore_failed', {
      targetType: 'restore',
      targetId: restoreId,
      details: { jobId, error: err.message },
    })
  }
}

// POST /api/restore/:restoreId/apply — queue the apply as a background job.
// Requires the exact confirm phrase AND a viewed preview.
router.post('/:restoreId/apply', requireAdmin, requireFullAdmin, restoreLimiter, async (req, res) => {
  const meta = getWorkspace(req.params.restoreId)
  if (!meta) {
    return res.status(404).json({ error: 'Restore session not found or expired. Upload the backup again.' })
  }
  if (!meta.previewedAt) {
    return res.status(400).json({ error: 'Review the preview before applying a restore.' })
  }
  if (req.body?.confirm !== CONFIRM_PHRASE) {
    return res.status(400).json({ error: `Type ${CONFIRM_PHRASE} to confirm this restore.` })
  }
  const includeFiles = req.body?.includeFiles !== false
  const job = createJob({ type: 'restore', filename: `restore-${meta.id}.json`, mimeType: 'application/json' })
  meta.appliedJobIds.push(job.id)
  writeRequest(meta.id, meta)

  res.json({
    queued: true,
    jobId: job.id,
    restoreId: meta.id,
    message: 'Restore queued — snapshotting current data first. Poll /api/jobs/' + job.id + ' for status.',
  })

  const actor = { id: req.user?.id || null, email: req.user?.email || null }
  await logAdminAction(req, 'restore_started', {
    targetType: 'restore',
    targetId: meta.id,
    details: { jobId: job.id, includeFiles, backupGeneratedAt: meta.backupGeneratedAt },
  })
  enqueueImport(async () => {
    await runRestore(meta.id, job.id, actor, includeFiles)
  })
})

// GET /api/restore/:restoreId/snapshot — download the pre-restore snapshot
// (available once apply has started; kept 24h with the workspace).
router.get('/:restoreId/snapshot', requireAdmin, requireFullAdmin, async (req, res) => {
  const meta = getWorkspace(req.params.restoreId)
  if (!meta) {
    return res.status(404).json({ error: 'Restore session not found or expired.' })
  }
  const file = snapshotPath(meta.id)
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Snapshot not available yet — it is taken when apply starts.' })
  }
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="lmsa-pre-restore-${meta.id}.zip"`)
  return res.sendFile(file)
})

// GET /api/restore/:restoreId/result — re-fetch the last apply result
// (outlives the 30-min job TTL; kept 24h with the workspace).
router.get('/:restoreId/result', requireAdmin, requireFullAdmin, async (req, res) => {
  const meta = getWorkspace(req.params.restoreId)
  if (!meta) {
    return res.status(404).json({ error: 'Restore session not found or expired.' })
  }
  try {
    const result = JSON.parse(fs.readFileSync(path.join(workspacePath(meta.id), 'result.json'), 'utf8'))
    return res.json(result)
  } catch {
    return res.status(404).json({ error: 'No completed restore for this session yet.' })
  }
})

// DELETE /api/restore/:restoreId — discard the staged upload + snapshot.
router.delete('/:restoreId', requireAdmin, requireFullAdmin, async (req, res) => {
  if (!isValidRestoreId(req.params.restoreId)) {
    return res.status(404).json({ error: 'Restore session not found.' })
  }
  const meta = readRequest(req.params.restoreId)
  removeWorkspace(req.params.restoreId)
  if (meta) {
    await logAdminAction(req, 'restore_discarded', { targetType: 'restore', targetId: meta.id, details: {} })
  }
  res.json({ discarded: true })
})

// Multer/file errors on this router become 4xx JSON, not 500s.
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Backup file is too large (max 1 GB).' })
  }
  if (err && /Only \.zip backup files are accepted/.test(err.message || '')) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

module.exports = router
module.exports.RESTORE_TABLE_ORDER = RESTORE_TABLE_ORDER
module.exports.TABLE_PK = TABLE_PK
module.exports.CONFIRM_PHRASE = CONFIRM_PHRASE
module.exports.validateBackupManifest = validateBackupManifest
