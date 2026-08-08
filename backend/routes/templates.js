const express = require('express')
const router = express.Router()
const multer = require('multer')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const logger = require('../logger')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// PUBLIC: get active templates for both sides
router.get('/active', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .in('side', ['front', 'back'])
    if (error) return res.status(500).json({ error: error.message })
    // Return as { front: {...}, back: {...} }
    const result = { front: null, back: null }
    if (data) {
      data.forEach((t) => {
        if (t.side === 'front' || t.side === 'back') result[t.side] = t
      })
    }
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Templates GET /active error')
    res.status(500).json({ error: 'Failed to load templates.' })
  }
})

// ADMIN: list all templates
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ADMIN: upload new template for a specific side
router.post('/', requireAdmin, requireFullAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
  if (!allowedTypes.includes(req.file.mimetype))
    return res.status(400).json({ error: 'Only PNG and JPG files are accepted.' })

  // Get side from query param (default 'front')
  const side = req.query.side === 'back' ? 'back' : 'front'

  const timestamp = Date.now()
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `template_${side}_${timestamp}_${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('templates')
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    })
  if (uploadError) return res.status(400).json({ error: uploadError.message })

  const {
    data: { publicUrl },
  } = supabase.storage.from('templates').getPublicUrl(storagePath)

  // Deactivate previous active template for this side
  await supabase.from('templates').update({ is_active: false }).eq('side', side).eq('is_active', true)

  const { data, error } = await supabase
    .from('templates')
    .insert({ file_name: req.file.originalname, file_url: publicUrl, is_active: true, side })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// ADMIN: set active template
router.put('/:id/activate', requireAdmin, requireFullAdmin, async (req, res) => {
  const { id } = req.params
  const { data: template, error: fetchError } = await supabase
    .from('templates')
    .select('side')
    .eq('id', id)
    .maybeSingle()
  if (fetchError || !template) return res.status(404).json({ error: 'Template not found.' })

  const side = template.side
  await supabase.from('templates').update({ is_active: false }).eq('side', side).eq('is_active', true)

  const { data, error } = await supabase
    .from('templates')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// ADMIN: delete template
router.delete('/:id', requireAdmin, requireFullAdmin, async (req, res) => {
  const { id } = req.params
  const { data: template } = await supabase.from('templates').select('*').eq('id', id).maybeSingle()
  if (!template) return res.status(404).json({ error: 'Template not found.' })

  // Delete from storage
  const path = template.file_url.split('/templates/').pop()
  if (path) await supabase.storage.from('templates').remove([path])

  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

module.exports = router