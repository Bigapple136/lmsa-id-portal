const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')
const { supabase } = require('../db')
const cache = require('../cache')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const {
  isBoolean,
  checkFieldsConfig,
  checkLayoutConfig,
} = require('../middleware/validate')

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

const DEFAULT_LAYOUT = {
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
    textAlign: 'left',
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
    textAlign: 'left',
    type: 'text',
    maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
}

// ── PUBLIC reads (cached, 5-minute TTL) ──
router.get('/fields', async (req, res) => {
  try {
    const cached = cache.get('settings:card_fields')
    if (cached) return res.json(cached)

    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_FIELDS
    cache.set('settings:card_fields', result, 300000)
    res.json(result)
  } catch (err) {
    console.error('[Settings] GET /fields error:', err)
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/qr-fields', async (req, res) => {
  try {
    const cached = cache.get('settings:qr_fields')
    if (cached) return res.json(cached)

    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'qr_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_QR_FIELDS
    cache.set('settings:qr_fields', result, 300000)
    res.json(result)
  } catch (err) {
    console.error('[Settings] GET /qr-fields error:', err)
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/layout', async (req, res) => {
  try {
    const cached = cache.get('settings:card_layout')
    if (cached) return res.json(cached)

    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_layout')
      .maybeSingle()
    const result = data?.value || DEFAULT_LAYOUT
    cache.set('settings:card_layout', result, 300000)
    res.json(result)
  } catch (err) {
    console.error('[Settings] GET /layout error:', err)
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
    cache.set('settings:card_fields', data.value, 300000)
    res.json(data.value)
  } catch (err) {
    console.error('[Settings] PUT /fields error:', err)
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
    cache.set('settings:qr_fields', data.value, 300000)
    res.json(data.value)
  } catch (err) {
    console.error('[Settings] PUT /qr-fields error:', err)
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

router.put('/layout', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const cfgErr = checkLayoutConfig(req.body)
    if (cfgErr) return res.status(400).json({ error: cfgErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'card_layout', value: req.body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    cache.set('settings:card_layout', data.value, 300000)
    res.json(data.value)
  } catch (err) {
    console.error('[Settings] PUT /layout error:', err)
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
    console.error('[Settings] download-excel error:', err)
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
    console.error('[Settings] download-image-folder error:', err)
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
    console.error('[Settings] PUT /submission-form error:', err)
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

async function getQRFields() {
  const cached = cache.get('settings:qr_fields')
  if (cached) return cached

  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'qr_fields')
    .maybeSingle()
  const result = data?.value || DEFAULT_QR_FIELDS
  cache.set('settings:qr_fields', result, 300000)
  return result
}

module.exports = router
module.exports.getQRFields = getQRFields
