const crypto = require('crypto')
const logger = require('./logger')

// Generic in-memory job store for optimistic background exports
// Map<jobId, { status: 'queued'|'processing'|'ready'|'failed', buffer?: Buffer, filename, mimeType, createdAt, error, type }>
const jobs = new Map()
const TTL_MS = 1000 * 60 * 30 // 30 min

function cleanup() {
  const now = Date.now()
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > TTL_MS) {
      jobs.delete(id)
    }
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
  jobs.set(jobId, job)
  return job
}

function getJob(jobId) {
  return jobs.get(jobId)
}

function setJobReady(jobId, { buffer, filename, mimeType }) {
  const job = jobs.get(jobId)
  if (!job) return
  job.buffer = buffer
  if (filename) job.filename = filename
  if (mimeType) job.mimeType = mimeType
  job.status = 'ready'
  logger.info({ jobId, type: job.type, size: buffer?.length }, 'Background export job ready')
}

function setJobFailed(jobId, error) {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'failed'
  job.error = error?.message || String(error)
  logger.error({ jobId, type: job.type, err: job.error }, 'Background export job failed')
}

function setJobProcessing(jobId) {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'processing'
}

module.exports = { createJob, getJob, setJobReady, setJobFailed, setJobProcessing, jobs }
