const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const crypto = require('crypto')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const logger = require('../logger')
const { enqueueImport } = require('../queue')

const TABLES = [
  'students',
  'admins',
  'admin_role_logs',
  'portal_settings',
  'templates',
  'confirmations',
  'student_submissions',
  'admin_actions',
  'layout_history',
  'notifications',
  'notification_reads',
  'qr_audit',
]

const STORAGE_BUCKETS = [
  { bucket: 'id-cards', folder: 'files/photos-and-signatures' },
  { bucket: 'qr-codes', folder: 'files/qr-codes' },
  { bucket: 'templates', folder: 'files/templates' },
]

// In-memory backup job store for optimistic UX
const backupJobs = new Map()
const BACKUP_TTL_MS = 1000 * 60 * 30 // 30 min

function cleanupOldJobs() {
  const now = Date.now()
  for (const [id, job] of backupJobs.entries()) {
    if (now - job.createdAt > BACKUP_TTL_MS) {
      backupJobs.delete(id)
    }
  }
}

async function buildBackupZip() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zip = new JSZip()
  const dbFolder = zip.folder('database')

  for (const table of TABLES) {
    try {
      const PAGE = 1000
      let offset = 0
      let allRows = []
      let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from(table).select('*').range(offset, offset + PAGE - 1)
        if (error) {
          logger.warn({ table, err: error.message }, 'Failed to fetch backup table')
          dbFolder.file(`${table}.json`, JSON.stringify({ error: error.message }, null, 2))
          break
        }
        allRows = allRows.concat(data || [])
        hasMore = (data || []).length === PAGE
        offset += PAGE
      }
      if (allRows.length > 0 || offset > 0) {
        dbFolder.file(`${table}.json`, JSON.stringify(allRows, null, 2))
      }
    } catch (err) {
      logger.warn({ table, err: err.message }, 'Exception fetching backup table')
      dbFolder.file(`${table}.json`, JSON.stringify({ error: err.message }, null, 2))
    }
  }

  for (const { bucket, folder } of STORAGE_BUCKETS) {
    try {
      const bucketFolder = zip.folder(folder)

      async function downloadFolder(path, dest) {
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data: items, error } = await supabase.storage.from(bucket).list(path, {
            limit: 1000,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          })
          if (error || !items) break
          hasMore = items.length === 1000
          offset += items.length

          for (const item of items) {
            const itemPath = path ? `${path}/${item.name}` : item.name
            if (item.id === null) {
              const subFolder = dest.folder(item.name)
              await downloadFolder(itemPath, subFolder)
            } else {
              try {
                const { data: fileData, error: dlErr } = await supabase.storage
                  .from(bucket)
                  .download(itemPath)
                if (dlErr || !fileData) continue
                const buffer = Buffer.from(await fileData.arrayBuffer())
                dest.file(item.name, buffer)
              } catch (err) {
                logger.warn({ bucket, path: itemPath, err: err.message }, 'Failed to download backup file')
              }
            }
          }
        }
      }

      await downloadFolder('', bucketFolder)
    } catch (err) {
      logger.warn({ bucket, err: err.message }, 'Exception processing backup bucket')
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { buffer: zipBuffer, filename: `lmsa-backup-${timestamp}.zip` }
}

// POST /api/backup — optimistic: queue backup and return jobId immediately
router.post('/', requireAdmin, requireFullAdmin, async (req, res) => {
  cleanupOldJobs()
  const jobId = crypto.randomBytes(8).toString('hex')
  backupJobs.set(jobId, { status: 'queued', createdAt: Date.now(), filename: `lmsa-backup-${jobId}.zip` })

  res.json({
    queued: true,
    jobId,
    background: true,
    message: 'Backup queued — processing in background. Poll /api/backup/' + jobId + ' for status.',
  })

  enqueueImport(async () => {
    const job = backupJobs.get(jobId)
    if (!job) return
    job.status = 'processing'
    try {
      const { buffer, filename } = await buildBackupZip()
      job.buffer = buffer
      job.filename = filename
      job.status = 'ready'
      logger.info({ jobId, size: buffer.length }, 'Background backup completed')
    } catch (err) {
      logger.error({ err: err.message, jobId }, 'Background backup failed')
      job.status = 'failed'
      job.error = err.message
    }
  })
})

// GET /api/backup/:jobId — check status or download when ready
router.get('/:jobId', requireAdmin, requireFullAdmin, async (req, res) => {
  const job = backupJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Backup job not found or expired.' })
  if (job.status === 'ready' && job.buffer) {
    if (req.query.status === 'true') {
      return res.json({ status: 'ready', jobId: req.params.jobId, filename: job.filename, size: job.buffer.length })
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
    return res.send(job.buffer)
  }
  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error || 'Backup failed' })
  }
  res.json({ status: job.status, jobId: req.params.jobId, message: 'Backup still processing...' })
})

// GET /api/backup — legacy direct download, but also supports ?background=true for optimistic
router.get('/', requireAdmin, requireFullAdmin, async (req, res) => {
  if (req.query.background === 'true' || req.query.async === 'true') {
    cleanupOldJobs()
    const jobId = crypto.randomBytes(8).toString('hex')
    backupJobs.set(jobId, { status: 'queued', createdAt: Date.now(), filename: `lmsa-backup-${jobId}.zip` })

    res.json({
      queued: true,
      jobId,
      background: true,
      message: 'Backup queued — processing in background.',
    })

    enqueueImport(async () => {
      const job = backupJobs.get(jobId)
      if (!job) return
      job.status = 'processing'
      try {
        const { buffer, filename } = await buildBackupZip()
        job.buffer = buffer
        job.filename = filename
        job.status = 'ready'
        logger.info({ jobId, size: buffer.length }, 'Background backup (GET) completed')
      } catch (err) {
        logger.error({ err: err.message, jobId }, 'Background backup (GET) failed')
        job.status = 'failed'
        job.error = err.message
      }
    })
    return
  }

  try {
    const { buffer, filename } = await buildBackupZip()
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to generate backup ZIP')
    res.status(500).json({ error: 'Failed to generate backup file.' })
  }
})

module.exports = router
