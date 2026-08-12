const express = require('express')
const router = express.Router()
const multer = require('multer')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const logger = require('../logger')
const { detectZonesFromBuffer } = require('../utils/detectZones')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// Layout field defaults matching frontend/src/lib/layoutConstants.js
const CALIBRATED_LAYOUT_FRONT = {
  photo: { x: 0.1271, y: 0.1673, width: 0.7458, height: 0.3287, type: 'image' },
  full_name: {
    x: 0.5, y: 0.5896, fontSize: 0.0678, color: '#1A1A1A', bold: true,
    textAlign: 'center', type: 'text', maxWidth: 0.88,
  },
  student_id: {
    x: 0.2441, y: 0.6614, fontSize: 0.0576, color: '#CC0000', bold: false,
    textAlign: 'center', type: 'text', maxWidth: 0.5,
  },
  position: {
    x: 0.5, y: 0.7231, fontSize: 0.0508, color: '#1A1A1A', bold: true,
    textAlign: 'center', type: 'text', maxWidth: 0.7,
  },
  year_level: {
    x: 0.0593, y: 0.7749, fontSize: 0.0508, color: '#1A1A1A', bold: true,
    textAlign: 'center', type: 'text', maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

const CALIBRATED_LAYOUT_BACK = {
  qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
  blood_type: {
    x: 0.5, y: 0.15, fontSize: 0.05, color: '#CC0000', bold: true,
    textAlign: 'center', type: 'text', maxWidth: 0.8,
  },
  emergency_contact_phone: {
    x: 0.5, y: 0.34, fontSize: 0.04, color: '#1A1A1A', bold: false,
    textAlign: 'center', type: 'text', maxWidth: 0.8,
  },
  issue_date: {
    x: 0.5, y: 0.58, fontSize: 0.04, color: '#1A1A1A', bold: false,
    textAlign: 'center', type: 'text', maxWidth: 0.8,
  },
  valid_until: {
    x: 0.5, y: 0.66, fontSize: 0.04, color: '#1A1A1A', bold: false,
    textAlign: 'center', type: 'text', maxWidth: 0.8,
  },
}

/**
 * Generate suggested layout from detected zones using canonical heuristics.
 * @param {Array} zones - Array of { left, top, right, bottom, width, height }
 * @param {'front'|'back'} side - Template side
 * @returns {Object} Layout object mapping field names to position/style
 */
function generateSuggestedLayout(zones, side) {
  if (!zones || zones.length === 0) return null

  // Sort zones by area descending
  const sorted = zones
    .map(z => ({ ...z, area: z.width * z.height }))
    .sort((a, b) => b.area - a.area)

  const layout = {}
  const used = new Set()

  if (side === 'front') {
    // Largest zone → photo
    if (sorted[0]) {
      layout.photo = zoneToImageLayout(sorted[0])
      used.add(0)
    }

    // Find QR zone: small square (aspect ~1:1) in bottom portion
    let qrIdx = -1
    for (let i = 1; i < sorted.length; i++) {
      const z = sorted[i]
      const aspect = z.width / z.height
      const isSquare = aspect > 0.7 && aspect < 1.4
      const isBottom = z.top > 0.6
      const isSmall = z.area < 0.1
      if (isSquare && isBottom && isSmall) {
        qrIdx = i
        break
      }
    }
    if (qrIdx >= 0) {
      layout.qr = zoneToImageLayout(sorted[qrIdx])
      used.add(qrIdx)
    }

    // Remaining zones → text fields by vertical position (top to bottom)
    const textFields = ['full_name', 'student_id', 'position', 'year_level', 'signature']
    const remaining = sorted
      .map((z, i) => ({ ...z, origIdx: i }))
      .filter(z => !used.has(z.origIdx))
      .sort((a, b) => a.top - b.top)

    remaining.forEach((z, i) => {
      if (textFields[i]) {
        layout[textFields[i]] = zoneToTextLayout(z, textFields[i])
      }
    })
  } else {
    // Back side
    // Largest zone → qr
    if (sorted[0]) {
      layout.qr = zoneToImageLayout(sorted[0])
      used.add(0)
    }

    // Remaining → text fields by vertical position
    const textFields = ['blood_type', 'emergency_contact_phone', 'issue_date', 'valid_until']
    const remaining = sorted
      .map((z, i) => ({ ...z, origIdx: i }))
      .filter(z => !used.has(z.origIdx))
      .sort((a, b) => a.top - b.top)

    remaining.forEach((z, i) => {
      if (textFields[i]) {
        layout[textFields[i]] = zoneToTextLayout(z, textFields[i])
      }
    })
  }

  return layout
}

function zoneToImageLayout(z) {
  // Image fields render from their top-left corner in CardCanvas, so store the
  // box's top-left (not its center) to match the frontend layout mapper.
  return {
    type: 'image',
    x: z.left,
    y: z.top,
    width: z.width,
    height: z.height,
  }
}

function zoneToTextLayout(z, field) {
  // Estimate font size based on zone dimensions
  const aspect = 1 // Will be adjusted by frontend
  const charEstimates = {
    full_name: 18, student_id: 16, year_level: 14, position: 20,
    blood_type: 6, emergency_contact_phone: 12, issue_date: 10, valid_until: 10,
    signature: 20,
  }
  const chars = charEstimates[field] || 12
  const fontSize = Math.min(z.width / (chars * 0.62), z.height * aspect * 0.8, 0.12)

  return {
    type: 'text',
    x: z.left + z.width / 2,
    y: z.top + z.height / 2,
    fontSize,
    textAlign: 'center',
    maxWidth: z.width,
    color: '#1A1A1A',
    bold: field === 'full_name' || field === 'position' || field === 'blood_type',
  }
}

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

  // Run zone detection on the uploaded image (full resolution)
  let zones = null
  let suggestedLayout = null
  try {
    const detection = await detectZonesFromBuffer(req.file.buffer)
    zones = detection.zones
    suggestedLayout = generateSuggestedLayout(zones, side)
  } catch (detectErr) {
    logger.warn({ err: detectErr }, 'Zone detection failed on upload, continuing without')
  }

  // Deactivate previous active template for this side
  await supabase.from('templates').update({ is_active: false }).eq('side', side).eq('is_active', true)

  const insertData = {
    file_name: req.file.originalname,
    file_url: publicUrl,
    is_active: true,
    side,
  }
  if (zones) insertData[`zones_${side}`] = zones
  if (suggestedLayout) insertData[`suggested_layout_${side}`] = suggestedLayout

  const { data, error } = await supabase
    .from('templates')
    .insert(insertData)
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
    .select('side, file_url, zones_front, zones_back, suggested_layout_front, suggested_layout_back')
    .eq('id', id)
    .maybeSingle()
  if (fetchError || !template) return res.status(404).json({ error: 'Template not found.' })

  const side = template.side
  await supabase.from('templates').update({ is_active: false }).eq('side', side).eq('is_active', true)

  const { data: updated, error } = await supabase
    .from('templates')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })

  // If zones/suggested layout missing, run detection now
  let zones = template[`zones_${side}`] || null
  let suggestedLayout = template[`suggested_layout_${side}`] || null

  if (!zones || !suggestedLayout) {
    try {
      // Download image from storage URL
      const response = await fetch(template.file_url)
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        const detection = await detectZonesFromBuffer(buffer)
        zones = detection.zones
        suggestedLayout = generateSuggestedLayout(zones, side)

        // Store detected data
        await supabase.from('templates').update({
          [`zones_${side}`]: zones,
          [`suggested_layout_${side}`]: suggestedLayout,
        }).eq('id', id)
      }
    } catch (detectErr) {
      logger.warn({ err: detectErr }, 'Zone detection failed on activate')
    }
  }

  res.json({
    template: updated,
    suggestedLayout: suggestedLayout ? { front: side === 'front' ? suggestedLayout : null, back: side === 'back' ? suggestedLayout : null } : null,
    zones: zones ? { front: side === 'front' ? zones : null, back: side === 'back' ? zones : null } : null,
  })
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