const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const rateLimit = require('express-rate-limit')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const { logAdminAction } = require('../auditLog')
const logger = require('../logger')
const { enqueueImport } = require('../queue')
const {
  createJob,
  getJob,
  getJobFilePath,
  setJobReady,
  setJobFailed,
  setJobProcessing,
} = require('../jobStore')

// Every table in sql/ must appear in TABLES or in EXCLUDED_TABLES —
// enforced by backend/tests/backup.test.js, so a future migration can't
// silently fall out of backups again. (This already happened twice:
// 2f9a943 backfilled five tables; correction_requests was added later
// and missed until this fix.)
const TABLES = [
  'students',
  'admins',
  'admin_role_logs',
  'portal_settings',
  'templates',
  'confirmations',
  'student_submissions',
  'correction_requests',
  'admin_actions',
  'layout_history',
  'notifications',
  'notification_reads',
  'qr_audit',
]

// Deliberate exclusions, each with its reason. qr_keys holds QR signing
// secrets in plaintext — including it in a downloadable zip would leak
// them to anyone who can open the file. Back the keys up separately via
// a secure channel (see docs/BACKUP.md).
const EXCLUDED_TABLES = {
  qr_keys:
    'Holds QR signing secrets in plaintext — must never ship in a downloadable zip. Back up separately (see docs/BACKUP.md).',
}

const STORAGE_BUCKETS = [
  { bucket: 'id-cards', folder: 'files/photos-and-signatures' },
  { bucket: 'qr-codes', folder: 'files/qr-codes' },
  { bucket: 'templates', folder: 'files/templates' },
]

// Each backup run fans out over the DB + storage, so it gets its own tight
// limiter. Applied ONLY to the queue/download-entry routes below — status
// polls hit GET /:jobId, which stays unlimited so a long backup's polling
// can never trip this.
const backupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many backup requests. Please try again later.' },
})

// Bounded-concurrency pool: run fn over items with at most `limit`
// in flight. Supabase round trips dominate backup time, so parallelism
// (not bigger pages) is what makes this fast.
async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker())
  await Promise.all(workers)
  return results
}

async function fetchTable(table) {
  const PAGE = 1000
  const rows = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').range(offset, offset + PAGE - 1)
    if (error) return { table, rows: null, error: error.message }
    rows.push(...(data || []))
    if ((data || []).length < PAGE) break
    offset += PAGE
  }
  return { table, rows, error: null }
}

// Recursively list every FILE path in a bucket (iterative — no deep
// recursion). Returns full paths like "photos/AMD-2024-0001.jpg".
async function listAllFiles(bucket) {
  const paths = []
  const stack = ['']
  while (stack.length > 0) {
    const prefix = stack.pop()
    let offset = 0
    for (;;) {
      const { data: items, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error || !items) {
        if (error) logger.warn({ bucket, prefix, err: error.message }, 'Failed to list backup folder')
        break
      }
      if (items.length === 0) break
      offset += items.length
      for (const item of items) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id === null) stack.push(itemPath)
        else paths.push(itemPath)
      }
      if (items.length < 1000) break
    }
  }
  return paths
}

async function downloadFile(bucket, itemPath) {
  const { data, error } = await supabase.storage.from(bucket).download(itemPath)
  if (error || !data) throw new Error(error?.message || 'empty file')
  return Buffer.from(await data.arrayBuffer())
}

// Already-compressed binaries gain ~nothing from DEFLATE and burn real CPU
// on photo-heavy backups — store them raw. JSON stays DEFLATEd.
const STORE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'zip', 'heic', 'mp4', 'mov'])
function zipOptionsFor(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return STORE_EXTENSIONS.has(ext) ? {} : { compression: 'DEFLATE' }
}

async function buildBackupZip() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const startedAt = new Date().toISOString()
  const zip = new JSZip()

  // ── Database tables (fetched in parallel, bounded) ──
  const tableResults = await mapPool(TABLES, 4, fetchTable)
  const manifestTables = {}
  for (const result of tableResults) {
    // Always write the file, even when the table is empty or failed: an
    // absent file must never be ambiguous between "empty" and "skipped".
    if (result.error) {
      logger.warn({ table: result.table, err: result.error }, 'Failed to fetch backup table')
      zip.file(
        `database/${result.table}.json`,
        JSON.stringify({ error: result.error }, null, 2),
        { compression: 'DEFLATE' },
      )
      manifestTables[result.table] = { rows: 0, error: result.error }
    } else {
      zip.file(`database/${result.table}.json`, JSON.stringify(result.rows, null, 2), {
        compression: 'DEFLATE',
      })
      manifestTables[result.table] = { rows: result.rows.length }
    }
  }

  // ── Storage buckets: list all three in parallel, then download every
  // file through one bounded pool (file downloads dominate backup time) ──
  const listings = await Promise.all(
    STORAGE_BUCKETS.map(async ({ bucket, folder }) => {
      try {
        return { bucket, folder, paths: await listAllFiles(bucket), error: null }
      } catch (err) {
        logger.warn({ bucket, err: err.message }, 'Exception listing backup bucket')
        return { bucket, folder, paths: [], error: err.message }
      }
    }),
  )
  const stats = {}
  for (const { bucket } of STORAGE_BUCKETS) stats[bucket] = { files: 0, bytes: 0, failed: 0 }
  const listingErrors = {}
  for (const l of listings) {
    if (l.error) listingErrors[l.bucket] = l.error
  }
  const allFiles = listings.flatMap((l) => l.paths.map((p) => ({ bucket: l.bucket, folder: l.folder, path: p })))
  const failedFiles = []
  await mapPool(allFiles, 8, async ({ bucket, folder, path: itemPath }) => {
    try {
      const buffer = await downloadFile(bucket, itemPath)
      // zip.file with a full path auto-creates intermediate folders.
      zip.file(`${folder}/${itemPath}`, buffer, zipOptionsFor(itemPath))
      stats[bucket].files += 1
      stats[bucket].bytes += buffer.length
    } catch (err) {
      stats[bucket].failed += 1
      // Cap the recorded list — a manifest with 10k failures helps nobody,
      // the per-bucket failed counts carry the signal.
      if (failedFiles.length < 50) failedFiles.push({ bucket, path: itemPath, error: err.message })
    }
  })
  const manifestStorage = {}
  for (const { bucket } of STORAGE_BUCKETS) {
    manifestStorage[bucket] = { ...stats[bucket] }
    if (listingErrors[bucket]) manifestStorage[bucket].error = listingErrors[bucket]
  }
  const totalFailed = Object.values(stats).reduce((n, s) => n + s.failed, 0)
  if (totalFailed > 0) logger.warn({ totalFailed }, 'Some backup files failed to download')

  // ── Manifest: makes the backup self-describing and partial failures
  // visible instead of silent ──
  const manifest = {
    generated_at: startedAt,
    completed_at: new Date().toISOString(),
    tables: manifestTables,
    storage: manifestStorage,
    failed_files: failedFiles,
    failed_files_truncated: totalFailed > failedFiles.length,
    excluded_tables: EXCLUDED_TABLES,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2), { compression: 'DEFLATE' })

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  return { buffer: zipBuffer, filename: `lmsa-backup-${timestamp}.zip`, manifest }
}

function summarizeManifest(manifest, filename, bytes) {
  const rows = Object.values(manifest.tables).reduce((n, t) => n + (t.rows || 0), 0)
  const files = Object.values(manifest.storage).reduce((n, s) => n + (s.files || 0), 0)
  const failed = Object.values(manifest.storage).reduce((n, s) => n + (s.failed || 0), 0)
  return { filename, bytes, tables: Object.keys(manifest.tables).length, rows, files, failedFiles: failed }
}

// Shared queue path for POST / and legacy GET /?background=true: persist
// the job, respond immediately, then build the zip on the import queue.
// The admin's identity is captured now so completion/failure can still be
// audit-logged from the background task, where there is no req.user.
async function queueBackupJob(req, res) {
  const job = createJob({ type: 'backup', filename: `lmsa-backup-${Date.now()}.zip`, mimeType: 'application/zip' })

  res.json({
    queued: true,
    jobId: job.id,
    background: true,
    message: 'Backup queued — processing in background. Poll /api/jobs/' + job.id + ' for status.',
  })

  const queuedBy = { id: req.user?.id || null, email: req.user?.email || null }
  await logAdminAction(req, 'backup_queued', { targetType: 'backup', targetId: job.id, details: {} })

  enqueueImport(async () => {
    setJobProcessing(job.id)
    try {
      const { buffer, filename, manifest } = await buildBackupZip()
      setJobReady(job.id, { buffer, filename, mimeType: 'application/zip' })
      await logAdminAction({ user: queuedBy }, 'backup_completed', {
        targetType: 'backup',
        targetId: job.id,
        details: summarizeManifest(manifest, filename, buffer.length),
      })
    } catch (err) {
      setJobFailed(job.id, err)
      await logAdminAction({ user: queuedBy }, 'backup_failed', {
        targetType: 'backup',
        targetId: job.id,
        details: { error: err.message },
      })
    }
  })
}

// POST /api/backup — queue a backup and return a jobId immediately.
// This is the canonical queue endpoint (a state-changing GET is legacy).
router.post('/', requireAdmin, requireFullAdmin, backupLimiter, async (req, res) => {
  await queueBackupJob(req, res)
})

// GET /api/backup/:jobId — check status (?status=true) or download when ready
router.get('/:jobId', requireAdmin, requireFullAdmin, async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Backup job not found or expired.' })
  if (job.status === 'ready') {
    if (req.query.status === 'true') {
      return res.json({
        status: 'ready',
        jobId: job.id,
        filename: job.filename,
        size: job.size || 0,
        type: job.type,
      })
    }
    const filePath = getJobFilePath(job.id)
    if (!filePath) return res.status(500).json({ error: 'Backup file is no longer available.' })
    await logAdminAction(req, 'backup_downloaded', {
      targetType: 'backup',
      targetId: job.id,
      details: { filename: job.filename, bytes: job.size || 0 },
    })
    res.setHeader('Content-Type', job.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
    return res.sendFile(filePath)
  }
  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error || 'Backup failed' })
  }
  res.json({ status: job.status, jobId: job.id, message: 'Backup still processing...', type: job.type })
})

// GET /api/backup — legacy direct download, but also supports
// ?background=true for optimistic queueing (kept for backwards
// compatibility; new callers should POST /api/backup instead).
router.get('/', requireAdmin, requireFullAdmin, backupLimiter, async (req, res) => {
  if (req.query.background === 'true' || req.query.async === 'true') {
    await queueBackupJob(req, res)
    return
  }

  try {
    const { buffer, filename, manifest } = await buildBackupZip()
    await logAdminAction(req, 'backup_downloaded', {
      targetType: 'backup',
      targetId: null,
      details: { ...summarizeManifest(manifest, filename, buffer.length), mode: 'direct' },
    })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to generate backup ZIP')
    res.status(500).json({ error: 'Failed to generate backup file.' })
  }
})

module.exports = router
// Exported for the schema-coverage guard in backend/tests/backup.test.js
module.exports.TABLES = TABLES
module.exports.EXCLUDED_TABLES = EXCLUDED_TABLES
// Exported for reuse by backend/routes/restore.js:
//  - buildBackupZip takes the pre-restore snapshot (never apply without one)
//  - STORAGE_BUCKETS / listAllFiles map backup folders back to live buckets
//  - mapPool is the shared bounded-concurrency helper
module.exports.STORAGE_BUCKETS = STORAGE_BUCKETS
module.exports.buildBackupZip = buildBackupZip
module.exports.listAllFiles = listAllFiles
module.exports.mapPool = mapPool
