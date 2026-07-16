const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')

function requireFullAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }
  next()
}

const TABLES = [
  'students',
  'admins',
  'admin_role_logs',
  'portal_settings',
  'templates',
  'confirmations',
  'student_submissions',
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

  // Export all tables
  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        console.warn(`[Backup] Failed to fetch table ${table}:`, error.message)
        dbFolder.file(`${table}.json`, JSON.stringify({ error: error.message }, null, 2))
      } else {
        dbFolder.file(`${table}.json`, JSON.stringify(data || [], null, 2))
      }
    } catch (err) {
      console.warn(`[Backup] Exception fetching table ${table}:`, err.message)
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
                console.warn(`[Backup] Failed to download ${bucket}/${itemPath}:`, err.message)
              }
            }
          }
        }
      }

      await downloadFolder('', bucketFolder)
    } catch (err) {
      console.warn(`[Backup] Exception processing bucket ${bucket}:`, err.message)
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
    console.error('[Backup] Failed to generate ZIP:', err.message)
    res.status(500).json({ error: 'Failed to generate backup file.' })
  }
})

module.exports = router
