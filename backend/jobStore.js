const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const logger = require('./logger')

// Filesystem-backed job store for optimistic background exports/backups.
// Map<jobId, { status: 'queued'|'processing'|'ready'|'failed', filename, mimeType, createdAt, size?, error?, type }>
//
// WHY FILES INSTEAD OF MEMORY: production runs behind `node cluster.js`
// (see Dockerfile CMD) with up to 4 workers, and each request lands on ANY
// worker. An in-memory Map meant a job queued on worker A was invisible
// when the status poll / download landed on worker B — background
// downloads randomly 404'd with "Job not found or expired". All cluster
// workers share the container filesystem, so persisting job metadata +
// payloads to a temp dir makes every job visible to every worker with no
// new infrastructure. As a bonus, result files now stream from disk
// (res.sendFile) instead of sitting in the Node heap.
//
// Layout: <JOB_DIR>/<jobId>.json  (metadata, written atomically via rename)
//         <JOB_DIR>/<jobId>.bin   (payload, present once status=ready)
//
// LIMIT: this fixes multi-WORKER visibility, not multi-INSTANCE. If the
// backend ever scales to 2+ hosts, jobs need sticky sessions or shared
// storage — see docs/BACKUP.md ("Scaling caveat").

function getJobDir() {
  return process.env.LMSA_JOB_DIR || path.join(os.tmpdir(), 'lmsa-jobs')
}

function ensureJobDir() {
  const dir = getJobDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const TTL_MS = 1000 * 60 * 30 // 30 min

// Job IDs are 16 hex chars (8 random bytes). Strict validation doubles as
// path-traversal protection, since the id becomes part of a file path.
function isValidJobId(jobId) {
  return typeof jobId === 'string' && /^[a-f0-9]{16}$/.test(jobId)
}

function metaPath(jobId) {
  return path.join(getJobDir(), `${jobId}.json`)
}

function payloadPath(jobId) {
  return path.join(getJobDir(), `${jobId}.bin`)
}

function writeMetaAtomic(jobId, meta) {
  const dir = ensureJobDir()
  const tmp = path.join(dir, `${jobId}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify(meta))
  fs.renameSync(tmp, metaPath(jobId))
}

function readMeta(jobId) {
  try {
    return JSON.parse(fs.readFileSync(metaPath(jobId), 'utf8'))
  } catch {
    return null
  }
}

function isExpired(meta) {
  return !meta || typeof meta.createdAt !== 'number' || Date.now() - meta.createdAt > TTL_MS
}

function deleteJobFiles(jobId) {
  for (const p of [metaPath(jobId), payloadPath(jobId)]) {
    try {
      fs.unlinkSync(p)
    } catch {
      // Already gone — fine.
    }
  }
}

function cleanup() {
  try {
    const dir = getJobDir()
    if (!fs.existsSync(dir)) return
    const now = Date.now()
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (name.endsWith('.tmp')) {
        // Orphaned atomic-write temp file from a crashed worker.
        try {
          if (now - fs.statSync(full).mtimeMs > TTL_MS) fs.unlinkSync(full)
        } catch {
          // Ignore.
        }
        continue
      }
      if (!name.endsWith('.json')) continue
      const jobId = name.slice(0, -'.json'.length)
      if (!isValidJobId(jobId)) continue
      let meta = null
      try {
        meta = JSON.parse(fs.readFileSync(full, 'utf8'))
      } catch {
        // Corrupt meta — drop it and its payload.
      }
      if (!meta || isExpired(meta)) deleteJobFiles(jobId)
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Job cleanup failed')
  }
}

function createJob({ type, filename, mimeType }) {
  cleanup()
  const jobId = crypto.randomBytes(8).toString('hex')
  const job = {
    id: jobId,
    type: type || 'export',
    status: 'queued',
    filename: filename || `${type || 'export'}-${jobId}.zip`,
    mimeType: mimeType || 'application/zip',
    createdAt: Date.now(),
  }
  writeMetaAtomic(jobId, job)
  return { ...job }
}

// Returns a copy of the job metadata (never the payload — callers that
// serve the download use getJobFilePath + res.sendFile so multi-hundred-MB
// zips stream from disk instead of loading into the heap).
function getJob(jobId) {
  if (!isValidJobId(jobId)) return undefined
  const meta = readMeta(jobId)
  if (!meta) return undefined
  if (isExpired(meta)) {
    deleteJobFiles(jobId)
    return undefined
  }
  return { ...meta }
}

// Absolute path to a ready job's payload, or null when there is nothing
// to download (unknown/expired id, not ready yet, or file missing).
function getJobFilePath(jobId) {
  if (!isValidJobId(jobId)) return null
  const meta = readMeta(jobId)
  if (!meta || isExpired(meta) || meta.status !== 'ready') return null
  const full = payloadPath(jobId)
  try {
    if (!fs.statSync(full).isFile()) return null
  } catch {
    return null
  }
  return full
}

function setJobReady(jobId, { buffer, filename, mimeType }) {
  if (!isValidJobId(jobId)) return
  const meta = readMeta(jobId)
  if (!meta || isExpired(meta)) return
  try {
    ensureJobDir()
    if (buffer) fs.writeFileSync(payloadPath(jobId), buffer)
    meta.status = 'ready'
    if (filename) meta.filename = filename
    if (mimeType) meta.mimeType = mimeType
    try {
      meta.size = fs.statSync(payloadPath(jobId)).size
    } catch {
      meta.size = buffer?.length || 0
    }
    writeMetaAtomic(jobId, meta)
    logger.info({ jobId, type: meta.type, size: meta.size }, 'Background export job ready')
  } catch (err) {
    logger.error({ jobId, err: err.message }, 'Failed to persist job payload')
    meta.status = 'failed'
    meta.error = 'Failed to store result file.'
    try {
      writeMetaAtomic(jobId, meta)
    } catch {
      // Best effort.
    }
  }
}

function setJobFailed(jobId, error) {
  if (!isValidJobId(jobId)) return
  const meta = readMeta(jobId)
  if (!meta || isExpired(meta)) return
  meta.status = 'failed'
  meta.error = error?.message || String(error)
  try {
    payloadPath(jobId)
    try {
      fs.unlinkSync(payloadPath(jobId))
    } catch {
      // No payload — fine.
    }
    writeMetaAtomic(jobId, meta)
  } catch {
    // Best effort.
  }
  logger.error({ jobId, type: meta.type, err: meta.error }, 'Background export job failed')
}

function setJobProcessing(jobId) {
  if (!isValidJobId(jobId)) return
  const meta = readMeta(jobId)
  if (!meta || isExpired(meta)) return
  meta.status = 'processing'
  try {
    writeMetaAtomic(jobId, meta)
  } catch {
    // Best effort.
  }
}

function deleteJob(jobId) {
  if (!isValidJobId(jobId)) return
  deleteJobFiles(jobId)
}

module.exports = {
  createJob,
  getJob,
  getJobFilePath,
  setJobReady,
  setJobFailed,
  setJobProcessing,
  deleteJob,
  cleanup,
}
