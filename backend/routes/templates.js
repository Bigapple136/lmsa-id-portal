const express = require('express')
const router = express.Router()
const multer = require('multer')
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')

function requireFullAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }
  next()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

// PUBLIC: get active template (needed by preview page + CardCanvas)
router.get('/active', async (req, res) => {
  const { data, error } = await supabase
    .from('templates').select('*')
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false })
    .limit(1).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'No active template found.' })
  res.json(data)
})

// ADMIN: list all templates
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('templates').select('*').order('uploaded_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ADMIN: upload new template
router.post('/', requireAdmin, requireFullAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
  if (!allowedTypes.includes(req.file.mimetype))
    return res.status(400).json({ error: 'Only PNG and JPG files are accepted.' })

  const timestamp = Date.now()
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `template_${timestamp}_${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('templates')
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype, upsert: false
    })
  if (uploadError) return res.status(400).json({ error: uploadError.message })

  const { data: { publicUrl } } = supabase.storage
    .from('templates').getPublicUrl(storagePath)

  await supabase.from('templates').update({ is_active: false }).eq('is_active', true)

  const { data, error } = await supabase.from('templates')
    .insert({ file_name: req.file.originalname, file_url: publicUrl, is_active: true })
    .select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

module.exports = router
