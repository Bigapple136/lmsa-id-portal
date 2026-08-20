const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const logger = require('../logger')

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

router.get('/', requireAdmin, requireFullAdmin, async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zip = new JSZip()
  const dbFolder = zip.folder('database')

  // Export all tables with pagination
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

  // Export storage files
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

  try {
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lmsa-backup-${timestamp}.zip"`,
    )
    res.send(zipBuffer)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to generate backup ZIP')
    res.status(500).json({ error: 'Failed to generate backup file.' })
  }
})

module.exports = router
