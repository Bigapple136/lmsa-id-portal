const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const path = require('path')
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function requireFullAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }
  next()
}

const DEFAULT_FIELDS = {
  full_name:  { label: 'Full Name',  enabled: true,  locked: false },
  student_id: { label: 'Student ID', enabled: true,  locked: true  },
  year_level: { label: 'Level',      enabled: true,  locked: false },
  position:   { label: 'Position',   enabled: false, locked: false },
  signature:  { label: 'Signature',  enabled: false, locked: false },
}

const DEFAULT_QR_FIELDS = {
  programme:               { label: 'Programme',               enabled: true  },
  blood_type:               { label: 'Blood Type',              enabled: true  },
  student_email:           { label: 'Student Email',           enabled: false },
  emergency_contact_name:   { label: 'Emergency Contact Name',  enabled: true  },
  emergency_contact_phone:  { label: 'Emergency Contact Phone', enabled: true  },
}

const QR_COLUMN_META = {
  programme:               { header: 'programme',               width: 20, note: 'QR only. e.g. MBBS, Pharm.D', qr: true },
  blood_type:              { header: 'blood_type',              width: 12, note: 'QR only. e.g. O+, AB-', qr: true },
  student_email:          { header: 'student_email',          width: 28, note: 'QR only. Student email address.', qr: true },
  emergency_contact_name:  { header: 'emergency_contact_name', width: 28, note: 'QR only. Full name of emergency contact.', qr: true },
  emergency_contact_phone: { header: 'emergency_contact_phone',width: 22, note: 'QR only. e.g. +231 770 405785', qr: true },
}

const DEFAULT_LAYOUT = {
  photo:      { x:0.1271, y:0.1673, width:0.7458, height:0.3287, type:'image' },
  full_name:  { x:0.5,    y:0.5896, fontSize:0.0678, color:'#1A1A1A', bold:true,  textAlign:'center', type:'text' },
  student_id: { x:0.2441, y:0.6614, fontSize:0.0576, color:'#CC0000', bold:false, textAlign:'left',   type:'text' },
  position:   { x:0.0593, y:0.7231, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'left',   type:'text' },
  year_level: { x:0.0593, y:0.7749, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'left',   type:'text' },
  signature:  { x:0.5254, y:0.8386, width:0.3898, height:0.0896, type:'image' },
}

// ── PUBLIC reads ──
router.get('/fields', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle()
  res.json(data?.value || DEFAULT_FIELDS)
})

router.get('/qr-fields', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'qr_fields').maybeSingle()
  res.json(data?.value || DEFAULT_QR_FIELDS)
})

router.get('/layout', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_layout').maybeSingle()
  res.json(data?.value || DEFAULT_LAYOUT)
})

// ── ADMIN writes ──
router.put('/fields', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data, error } = await supabase.from('settings').upsert({ key: 'fields', value: req.body }).select('value').single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data.value)
})

router.put('/qr-fields', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'qr_fields', value: req.body, updated_at: new Date().toISOString() })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data.value)
})

router.put('/layout', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'card_layout', value: req.body, updated_at: new Date().toISOString() })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data.value)
})

// ── ADMIN downloads ──
router.get('/download-excel', requireAdmin, async (req, res) => {
  const templatePath = path.join(__dirname, '..', 'templates', 'student_form_template.xlsx')

  if (!fs.existsSync(templatePath)) {
    return res.status(500).json({ error: 'Template file not found. Run: node scripts/generate_template.js' })
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Student_Template.xlsx"')
  res.sendFile(templatePath)
})

router.get('/download-image-folder', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle()
  const fields = data?.value || DEFAULT_FIELDS
  const includeSignatures = fields.signature?.enabled === true

  const zip = new JSZip()
  const root = zip.folder('images').folder('idcard')
  const YEARS = ['year-1','year-2','year-3','year-4','year-5','year-6']
  const YEAR_LABELS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

  YEARS.forEach((yr, i) => {
    const folder = root.folder(yr)
    folder.file('README.txt',
      `LMSA ID Portal — ${YEAR_LABELS[i]} Photos\n${'─'.repeat(40)}\n\n` +
      `Name each photo after the student ID.\nExamples: AMD-2024-0001.jpg\n\n` +
      `Requirements: JPG or PNG · Passport style · Min 300×375 px\n`
    )
  })

  if (includeSignatures) {
    root.folder('signatures').file('README.txt',
      `LMSA ID Portal — Signatures\n${'─'.repeat(40)}\n\n` +
      `PNG only · Transparent background required · Named by student ID.\nExample: AMD-2024-0001.png\n`
    )
  }

  zip.file('HOW_TO_USE.txt',
    `LMSA ID Portal — Bulk Photo Package\n${'─'.repeat(40)}\n\n` +
    `1. Add photos to the correct year subfolder (named by student ID)\n` +
    (includeSignatures ? `2. Add signature PNGs to signatures/ folder\n3. ` : `2. `) +
    `Compress everything to ZIP and upload alongside your CSV in the portal.\n\nGoldWay · goldway.estone@outlook.com\n`
  )

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Image_Upload_Folder.zip"')
  res.send(buffer)
})

// ── Submission form toggle ──
router.get('/submission-form', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'submission_form').maybeSingle()
  res.json(data?.value || { enabled: false })
})

router.put('/submission-form', requireAdmin, requireFullAdmin, async (req, res) => {
  const { enabled } = req.body
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'submission_form', value: { enabled: enabled === true }, updated_at: new Date().toISOString() })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data.value)
})

async function getQRFields() {
  const { data } = await supabase.from('portal_settings')
    .select('value').eq('key', 'qr_fields').maybeSingle()
  return data?.value || DEFAULT_QR_FIELDS
}

module.exports = router
module.exports.getQRFields = getQRFields
