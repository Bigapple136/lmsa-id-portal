const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const JSZip = require('jszip')

// ── Build the payload encoded into the QR ──
function buildPayload(student) {
  return JSON.stringify({
    id: student.student_id,
    name: student.full_name,
    level: student.year_level,
    programme: student.programme || '',
    position: student.position || '',
    email: student.student_email || '',
    blood_type: student.blood_type || '',
    emergency_contact: student.emergency_contact_name || '',
    emergency_phone: student.emergency_contact_phone || '',
    issued_by: 'LMSA — A.M. Dogliotti College of Medicine',
  })
}

// ── Generate QR PNG buffer ──
async function generateQRBuffer(student) {
  const payload = buildPayload(student)
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  })
  return buffer
}

// ── Upload QR PNG to Supabase Storage ──
async function uploadQR(buffer, student) {
  const yearFolder = (student.year_level || 'unknown')
    .toLowerCase().replace(/\s+/g, '-')
  const path = `${yearFolder}/${student.student_id}.png`

  const { error } = await supabase.storage
    .from('qr-codes')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('qr-codes').getPublicUrl(path)
  return publicUrl
}

// ── Save QR URL back to student record ──
async function saveQRUrl(studentId, url) {
  await supabase.from('students')
    .update({ qr_url: url })
    .eq('student_id', studentId)
}

// ── Generate QR for a single student (called internally + from route) ──
async function generateForStudent(student) {
  const buffer = await generateQRBuffer(student)
  const url = await uploadQR(buffer, student)
  await saveQRUrl(student.student_id, url)
  return url
}

// POST /api/qr/generate/:studentId — generate/regenerate for one student
router.post('/generate/:studentId', requireAdmin, async (req, res) => {
  const { data: student, error } = await supabase
    .from('students').select('*')
    .eq('student_id', req.params.studentId).maybeSingle()

  if (error || !student)
    return res.status(404).json({ error: 'Student not found.' })

  try {
    const url = await generateForStudent(student)
    res.json({ qr_url: url, student_id: student.student_id })
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed: ' + err.message })
  }
})

// POST /api/qr/generate-all — bulk generate for all students missing a QR
router.post('/generate-all', requireAdmin, async (req, res) => {
  const { force } = req.body // if true, regenerate even if qr_url exists

  const query = supabase.from('students').select('*')
  if (!force) query.is('qr_url', null) // only missing ones by default

  const { data: students, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length) return res.json({ generated: 0, message: 'All students already have QR codes.' })

  let generated = 0, failed = 0
  for (const student of students) {
    try {
      await generateForStudent(student)
      generated++
    } catch {
      failed++
    }
  }

  res.json({ generated, failed, total: students.length })
})

// GET /api/qr/export — download all QR codes as a ZIP organised by year level
router.get('/export', requireAdmin, async (req, res) => {
  const { data: students, error } = await supabase
    .from('students').select('student_id, full_name, year_level, qr_url')
    .not('qr_url', 'is', null)
    .order('year_level')

  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length)
    return res.status(404).json({ error: 'No QR codes generated yet. Generate them first.' })

  const zip = new JSZip()
  const root = zip.folder('qr-codes')

  // Fetch each QR image and add to ZIP under correct year subfolder
  for (const s of students) {
    try {
      const resp = await fetch(s.qr_url)
      if (!resp.ok) continue
      const buffer = Buffer.from(await resp.arrayBuffer())
      const yearFolder = (s.year_level || 'unknown')
        .toLowerCase().replace(/\s+/g, '-')
      root.folder(yearFolder).file(`${s.student_id}.png`, buffer)
    } catch { /* skip failed fetch */ }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_QR_Codes.zip"')
  res.send(zipBuffer)
})

// Export generateForStudent so students.js can call it automatically
module.exports = router
module.exports.generateForStudent = generateForStudent
