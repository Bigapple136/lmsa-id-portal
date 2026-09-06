const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const logger = require('../logger')
const { enqueueImport } = require('../queue')
const { createJob, getJob, setJobReady, setJobFailed, setJobProcessing } = require('../jobStore')

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
  const job = createJob({ type: 'backup', filename: `lmsa-backup-${Date.now()}.zip`, mimeType: 'application/zip' })

  res.json({
    queued: true,
    jobId: job.id,
    background: true,
    message: 'Backup queued — processing in background. Poll /api/backup/' + job.id + ' for status.',
  })

  enqueueImport(async () => {
    setJobProcessing(job.id)
    try {
      const { buffer, filename } = await buildBackupZip()
      setJobReady(job.id, { buffer, filename, mimeType: 'application/zip' })
    } catch (err) {
      setJobFailed(job.id, err)
    }
  })
})

// GET /api/backup/:jobId — check status or download when ready
router.get('/:jobId', requireAdmin, requireFullAdmin, async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Backup job not found or expired.' })
  if (job.status === 'ready' && job.buffer) {
    if (req.query.status === 'true') {
      return res.json({ status: 'ready', jobId: job.id, filename: job.filename, size: job.buffer.length, type: job.type })
    }
    res.setHeader('Content-Type', job.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
    return res.send(job.buffer)
  }
  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error || 'Backup failed' })
  }
  res.json({ status: job.status, jobId: job.id, message: 'Backup still processing...', type: job.type })
})

// GET /api/backup — legacy direct download, but also supports ?background=true for optimistic
router.get('/', requireAdmin, requireFullAdmin, async (req, res) => {
  if (req.query.background === 'true' || req.query.async === 'true') {
    const job = createJob({ type: 'backup', filename: `lmsa-backup-${Date.now()}.zip`, mimeType: 'application/zip' })

    res.json({
      queued: true,
      jobId: job.id,
      background: true,
      message: 'Backup queued — processing in background.',
    })

    enqueueImport(async () => {
      setJobProcessing(job.id)
      try {
        const { buffer, filename } = await buildBackupZip()
        setJobReady(job.id, { buffer, filename, mimeType: 'application/zip' })
      } catch (err) {
        setJobFailed(job.id, err)
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
