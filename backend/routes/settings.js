const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const {
  isBoolean,
  checkFieldsConfig,
  checkLayoutConfig,
} = require('../middleware/validate')
const logger = require('../logger')

const DEFAULT_FIELDS = {
  full_name: { label: 'Full Name', enabled: true, locked: false },
  student_id: { label: 'Student ID', enabled: true, locked: true },
  year_level: { label: 'Level', enabled: true, locked: false },
  position: { label: 'Position', enabled: false, locked: false },
  signature: { label: 'Signature', enabled: false, locked: false },
}

const DEFAULT_QR_FIELDS = {
  programme: { label: 'Programme', enabled: true },
  blood_type: { label: 'Blood Type', enabled: true },
  student_email: { label: 'Student Email', enabled: false },
  emergency_contact_name: { label: 'Emergency Contact Name', enabled: true },
  emergency_contact_phone: { label: 'Emergency Contact Phone', enabled: true },
  date_of_birth: { label: 'Date of Birth', enabled: true },
  nationality: { label: 'Nationality', enabled: true },
  county_of_origin: { label: 'County of Origin', enabled: true },
  current_address: { label: 'Current Address', enabled: true },
}

// Which side each card field is printed on. 'both' means it appears on the
// back layout (qr is shared). Kept in sync with frontend/src/lib/layoutConstants.js
// FRONT_FIELDS / BACK_FIELDS.
const DEFAULT_FIELD_SIDES = {
  photo: 'front',
  full_name: 'front',
  student_id: 'front',
  year_level: 'front',
  position: 'front',
  signature: 'front',
  qr: 'both',
  blood_type: 'back',
  emergency_contact_phone: 'back',
  issue_date: 'back',
  valid_until: 'back',
}

const DEFAULT_LAYOUT_FRONT = {
  photo: { x: 0.1271, y: 0.1673, width: 0.7458, height: 0.3287, type: 'image' },
  full_name: {
    x: 0.5,
    y: 0.5896,
    fontSize: 0.0678,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.88,
  },
  student_id: {
    x: 0.2441,
    y: 0.6614,
    fontSize: 0.0576,
    color: '#CC0000',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  position: {
    x: 0.5,
    y: 0.7231,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.7,
  },
  year_level: {
    x: 0.0593,
    y: 0.7749,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

// Keep in sync with frontend/src/lib/layoutConstants.js

const DEFAULT_LAYOUT_BACK = {
  qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
  blood_type: {
    x: 0.5,
    y: 0.15,
    fontSize: 0.05,
    color: '#CC0000',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  emergency_contact_phone: {
    x: 0.5,
    y: 0.34,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  issue_date: {
    x: 0.5,
    y: 0.58,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  valid_until: {
    x: 0.5,
    y: 0.66,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
}

// ── PUBLIC reads ──
// Note: these settings are NOT cached in-process. With multiple cluster
// workers each holding their own MemoryCache, a write handled by one worker
// never invalidates the others, so a refresh could read a stale value for up
// to the TTL. These are single-row PK lookups on a low-traffic table — read
// them fresh so admin saves persist immediately.
router.get('/fields', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_FIELDS
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /fields error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/qr-fields', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'qr_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_QR_FIELDS
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /qr-fields error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

// Which side each field is printed on (front / back / both)
router.get('/field-sides', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_field_sides')
      .maybeSingle()
    const result = data?.value || DEFAULT_FIELD_SIDES
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /field-sides error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/layout', async (req, res) => {
  try {
    const [{ data: frontData }, { data: backData }] = await Promise.all([
      supabase.from('portal_settings').select('value').eq('key', 'card_layout_front').maybeSingle(),
      supabase.from('portal_settings').select('value').eq('key', 'card_layout_back').maybeSingle(),
    ])
    // Backward compatibility: if only card_layout exists, use it as front
    // NOTE: maybeSingle() returns { data: { value } }, so the value is at
    // .data.value, NOT .value.
    const legacyData = !frontData?.data?.value && !backData?.data?.value
      ? await supabase.from('portal_settings').select('value').eq('key', 'card_layout').maybeSingle()
      : { data: null }

    let frontLayout = frontData?.data?.value
    let backLayout = backData?.data?.value

    // Lazy migration: if legacy layout exists but front/back don't, migrate it
    if (legacyData?.data?.value && (!frontLayout || !backLayout)) {
      frontLayout = legacyData.data.value
      backLayout = backLayout || DEFAULT_LAYOUT_BACK

      // Async migration: write front/back, then delete legacy (fire-and-forget)
      supabase.from('portal_settings').upsert([
        { key: 'card_layout_front', value: frontLayout, updated_at: new Date().toISOString() },
        { key: 'card_layout_back', value: backLayout, updated_at: new Date().toISOString() },
      ]).then(() => {
        supabase.from('portal_settings').delete().eq('key', 'card_layout')
      }).catch(() => { /* ignore migration errors */ })
    }

    const result = {
      front: frontLayout || DEFAULT_LAYOUT_FRONT,
      back: backLayout || DEFAULT_LAYOUT_BACK,
    }
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /layout error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

// ── ADMIN writes ──
router.put('/fields', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const cfgErr = checkFieldsConfig(req.body)
    if (cfgErr) return res.status(400).json({ error: cfgErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'card_fields', value: req.body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /fields error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

router.put('/qr-fields', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const cfgErr = checkFieldsConfig(req.body)
    if (cfgErr) return res.status(400).json({ error: cfgErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'qr_fields', value: req.body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /qr-fields error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// Persist which side each field is printed on
router.put('/field-sides', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const sides = req.body
    if (!sides || typeof sides !== 'object') {
      return res.status(400).json({ error: 'Invalid field-sides payload.' })
    }
    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'card_field_sides', value: sides, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /field-sides error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

router.put('/layout', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    // Accept both old format (flat layout) and new format { front, back }
    const { front, back } = req.body
    const isNewFormat = front !== undefined || back !== undefined

    // Validate front layout
    if (front !== undefined) {
      const cfgErr = checkLayoutConfig(front)
      if (cfgErr) return res.status(400).json({ error: `Front layout: ${cfgErr}` })
    }
    // Validate back layout
    if (back !== undefined) {
      const cfgErr = checkLayoutConfig(back)
      if (cfgErr) return res.status(400).json({ error: `Back layout: ${cfgErr}` })
    }

    // If old format (flat), treat as front only
    const frontLayout = isNewFormat ? front : req.body
    const backLayout = isNewFormat ? back : undefined

    const updates = []
    if (frontLayout !== undefined) {
      updates.push(
        supabase
          .from('portal_settings')
          .upsert({ key: 'card_layout_front', value: frontLayout, updated_at: new Date().toISOString() })
          .select()
          .single(),
      )
    }
    if (backLayout !== undefined) {
      updates.push(
        supabase
          .from('portal_settings')
          .upsert({ key: 'card_layout_back', value: backLayout, updated_at: new Date().toISOString() })
          .select()
          .single(),
      )
    }

    const results = await Promise.all(updates)
    for (const { error } of results) {
      if (error) return res.status(400).json({ error: error.message })
    }

    const savedFront = results[0]?.data?.value
    const savedBack = results[1]?.data?.value

    const result = { front: savedFront, back: savedBack }
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /layout error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// ── ADMIN downloads ──
router.get('/download-excel', requireAdmin, async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'student_form_template.xlsx')

    try {
      await fs.promises.access(templatePath)
    } catch {
      return res
        .status(500)
        .json({ error: 'Template file not found. Run: node scripts/generate_template.js' })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Student_Template.xlsx"')
    res.sendFile(templatePath)
  } catch (err) {
    logger.error({ err }, 'Settings download-excel error')
    res.status(500).json({ error: 'Failed to download template.' })
  }
})

router.get('/download-image-folder', requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_fields')
      .maybeSingle()
    const fields = data?.value || DEFAULT_FIELDS
    const includeSignatures = fields.signature?.enabled === true

    const zip = new JSZip()
    const root = zip.folder('images').folder('idcard')
    const YEARS = ['year-1', 'year-2', 'year-3', 'year-4', 'year-5', 'year-6']
    const YEAR_LABELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']

    YEARS.forEach((yr, i) => {
      const folder = root.folder(yr)
      folder.file(
        'README.txt',
        `LMSA ID Portal — ${YEAR_LABELS[i]} Photos\n${'─'.repeat(40)}\n\n` +
          `Name each photo after the student ID.\nExamples: AMD-2024-0001.jpg\n\n` +
          `Requirements: JPG or PNG · Passport style · Min 300×375 px\n`,
      )
    })

    if (includeSignatures) {
      root
        .folder('signatures')
        .file(
          'README.txt',
          `LMSA ID Portal — Signatures\n${'─'.repeat(40)}\n\n` +
            `PNG only · Transparent background required · Named by student ID.\nExample: AMD-2024-0001.png\n`,
        )
    }

    zip.file(
      'HOW_TO_USE.txt',
      `LMSA ID Portal — Bulk Photo Package\n${'─'.repeat(40)}\n\n` +
        `1. Add photos to the correct year subfolder (named by student ID)\n` +
        (includeSignatures ? `2. Add signature PNGs to signatures/ folder\n3. ` : `2. `) +
        `Compress everything to ZIP and upload alongside your CSV in the portal.\n\nGoldWay · goldway.estone@outlook.com\n`,
    )

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Image_Upload_Folder.zip"')
    res.send(buffer)
  } catch (err) {
    logger.error({ err }, 'Settings download-image-folder error')
    res.status(500).json({ error: 'Failed to generate ZIP.' })
  }
})

// ── Submission form toggle ──
router.get('/submission-form', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'submission_form')
    .maybeSingle()
  res.json(data?.value || { enabled: false })
})

router.put('/submission-form', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const boolErr = isBoolean(req.body.enabled, 'enabled')
    if (boolErr) return res.status(400).json({ error: boolErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({
        key: 'submission_form',
        value: { enabled: req.body.enabled === true },
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /submission-form error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

async function getQRFields() {
  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'qr_fields')
    .maybeSingle()
  return data?.value || DEFAULT_QR_FIELDS
}

module.exports = router
module.exports.getQRFields = getQRFields
