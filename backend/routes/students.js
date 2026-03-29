const express = require('express')
const router = express.Router()
const multer = require('multer')
const { parse } = require('csv-parse/sync')
const JSZip = require('jszip')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')
const { signStudentToken, verifyStudentToken } = require('./qr')

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://lmsa-id-portal.onrender.com'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Lazy-load QR generator to avoid circular dep issues
function getQRGenerator() {
  return require('./qr').generateForStudent
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

const ALLOWED_YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/jpg','image/png']
const MAX_TEXT_LENGTH = 200
const MAX_NOTE_LENGTH = 1000

function validateYear(y) { return ALLOWED_YEARS.includes(y) }
function validateTextLength(v, max = MAX_TEXT_LENGTH) { return !v || v.length <= max }
function validateImageMime(m) { return ALLOWED_IMAGE_TYPES.includes(m) }
function safeBasename(f) { return path.basename(f.replace(/\\/g, '/')) }

function normaliseYearFolder(yearLevel) {
  return (yearLevel || 'unknown').toLowerCase().replace(/\s+/g, '-')
}

async function uploadPhoto(buffer, mimeType, studentId, yearLevel) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = normaliseYearFolder(yearLevel)
  const filePath = `photos/${folder}/${safeSid}.${ext}`
  const { error } = await supabase.storage.from('id-cards').upload(filePath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

async function uploadSignature(buffer, studentId, yearLevel) {
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = normaliseYearFolder(yearLevel)
  const filePath = `signatures/${folder}/${safeSid}.png`
  const { error } = await supabase.storage.from('id-cards').upload(filePath, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

async function migrateStudentFiles(studentId, oldYearLevel, newYearLevel) {
  if (oldYearLevel === newYearLevel) return
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const oldFolder = normaliseYearFolder(oldYearLevel)
  const newFolder = normaliseYearFolder(newYearLevel)

  const oldPhotoPath = `photos/${oldFolder}/${safeSid}.jpg`
  const oldPhotoPathPng = `photos/${oldFolder}/${safeSid}.png`
  const oldSigPath = `signatures/${oldFolder}/${safeSid}.png`

  const { data: photoData, error: photoErr } = await supabase.storage
    .from('id-cards').download(oldPhotoPath).catch(() => null)
    || await supabase.storage.from('id-cards').download(oldPhotoPathPng).catch(() => null)

  if (photoData) {
    const buffer = Buffer.from(await photoData.arrayBuffer())
    const ext = oldPhotoPath ? 'jpg' : 'png'
    const newPath = `photos/${newFolder}/${safeSid}.${ext}`
    await supabase.storage.from('id-cards').upload(newPath, buffer, {
      contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png', upsert: true
    })
    const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(newPath)
    await supabase.storage.from('id-cards').remove([oldPhotoPath, oldPhotoPathPng].filter(Boolean))
    await supabase.from('students').update({ photo_url: publicUrl }).eq('student_id', studentId)
  }

  const { data: sigData } = await supabase.storage.from('id-cards').download(oldSigPath).catch(() => null)
  if (sigData) {
    const buffer = Buffer.from(await sigData.arrayBuffer())
    const newPath = `signatures/${newFolder}/${safeSid}.png`
    await supabase.storage.from('id-cards').upload(newPath, buffer, { contentType: 'image/png', upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(newPath)
    await supabase.storage.from('id-cards').remove([oldSigPath])
    await supabase.from('students').update({ signature_url: publicUrl }).eq('student_id', studentId)
  }
}

// ── PUBLIC ──
router.get('/lookup', async (req, res) => {
  const { student_id, full_name } = req.query
  if (!student_id || !full_name) return res.status(400).json({ found: false, error: 'Missing fields.' })
  if (!validateTextLength(student_id, 50) || !validateTextLength(full_name)) return res.status(400).json({ found: false, error: 'Input too long.' })
  const { data, error } = await supabase.from('students').select('student_id').ilike('student_id', student_id.trim()).ilike('full_name', full_name.trim()).maybeSingle()
  if (error) return res.status(500).json({ found: false, error: 'Lookup failed.' })
  if (!data) return res.status(404).json({ found: false, error: 'No student found.' })
  const token = signStudentToken(data.student_id)
  res.json({ found: true, preview_url: `${FRONTEND_URL}/preview/${token}` })
})

router.get('/preview/:token', async (req, res) => {
  const studentId = verifyStudentToken(req.params.token)
  if (!studentId) return res.status(403).json({ error: 'Invalid or tampered link.' })
  const { data, error } = await supabase.from('students').select('*').eq('student_id', studentId).maybeSingle()
  if (error) return res.status(500).json({ error: 'Failed to load student.' })
  if (!data) return res.status(404).json({ error: 'Student not found.' })
  res.json(data)
})

router.get('/preview-url/:studentId', requireAdmin, async (req, res) => {
  const token = signStudentToken(req.params.studentId)
  res.json({ url: `${FRONTEND_URL}/preview/${token}` })
})

router.get('/:studentId', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('students').select('*').eq('student_id', req.params.studentId).maybeSingle()
  if (error) return res.status(500).json({ error: 'Failed to load student.' })
  if (!data) return res.status(404).json({ error: 'Student not found.' })
  res.json(data)
})

// ── ADMIN: list all ──
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── ADMIN: add single student ──
router.post('/', requireAdmin, upload.fields([
  { name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }
]), async (req, res) => {
  const { student_id, full_name, year_level, position, blood_type,
          emergency_contact_name, emergency_contact_phone, student_email, programme } = req.body

  if (!student_id || !full_name || !year_level)
    return res.status(400).json({ error: 'student_id, full_name, and year_level are required.' })
  if (!validateYear(year_level))
    return res.status(400).json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
  if (!validateTextLength(student_id, 50) || !validateTextLength(full_name) || !validateTextLength(position) || !validateTextLength(programme))
    return res.status(400).json({ error: 'A field value is too long.' })
  if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
    return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
  if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
    return res.status(400).json({ error: 'Signature must be PNG.' })

  const sid = student_id.trim()
  let photo_url = null, signature_url = null
  if (req.files?.photo?.[0]) { try { photo_url = await uploadPhoto(req.files.photo[0].buffer, req.files.photo[0].mimetype, sid, year_level) } catch (err) { return res.status(400).json({ error: 'Photo upload failed: ' + err.message }) } }
  if (req.files?.signature?.[0]) { try { signature_url = await uploadSignature(req.files.signature[0].buffer, sid, year_level) } catch (err) { return res.status(400).json({ error: 'Signature upload failed: ' + err.message }) } }

  const { data, error } = await supabase.from('students').insert({
    student_id: sid, full_name: full_name.trim(), year_level,
    position: position?.trim() || null, photo_url, signature_url,
    blood_type: blood_type?.trim() || null,
    emergency_contact_name: emergency_contact_name?.trim() || null,
    emergency_contact_phone: emergency_contact_phone?.trim() || null,
    student_email: student_email?.trim() || null,
    programme: programme?.trim() || null,
  }).select().single()
  if (error) return res.status(400).json({ error: error.message })

  // Auto-generate QR
  try { await getQRGenerator()(data) } catch { /* non-fatal */ }

  res.status(201).json(data)
})

// ── ADMIN: bulk CSV + ZIP ──
router.post('/bulk', requireAdmin, upload.fields([
  { name: 'csv', maxCount: 1 }, { name: 'zip', maxCount: 1 }
]), async (req, res) => {
  const csvFile = req.files?.csv?.[0]
  const zipFile = req.files?.zip?.[0]
  if (!csvFile) return res.status(400).json({ error: 'No CSV file uploaded.' })

  let records
  try { records = parse(csvFile.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true }) }
  catch (err) { return res.status(400).json({ error: 'Invalid CSV: ' + err.message }) }
  if (!records.length) return res.status(400).json({ error: 'CSV is empty.' })

  const required = ['student_id', 'full_name', 'year_level']
  const missing = required.filter(c => !(c in records[0]))
  if (missing.length) return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` })

  const photoMap = {}, signatureMap = {}
  if (zipFile) {
    try {
      const zip = await JSZip.loadAsync(zipFile.buffer)
      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue
        const base = safeBasename(filename)
        const nameNoExt = base.replace(/\.(jpg|jpeg|png)$/i, '')
        const ext = base.match(/\.(jpg|jpeg|png)$/i)?.[1]?.toLowerCase()
        if (!ext) continue
        const normalised = filename.replace(/\\/g, '/').toLowerCase()
        const buffer = await file.async('nodebuffer')
        if (normalised.includes('/signatures/') || normalised.startsWith('signatures/')) {
          signatureMap[nameNoExt] = buffer
        } else {
          photoMap[nameNoExt] = { buffer, mimeType: ext === 'png' ? 'image/png' : 'image/jpeg' }
        }
      }
    } catch (err) { return res.status(400).json({ error: 'Invalid ZIP: ' + err.message }) }
  }

  const rows = []
  for (const r of records) {
    const sid = r.student_id.trim()
    if (r.year_level && !validateYear(r.year_level.trim())) { console.warn(`Invalid year_level for ${sid} — skipped`); continue }
    let photo_url = null, signature_url = null
    if (photoMap[sid]) { try { photo_url = await uploadPhoto(photoMap[sid].buffer, photoMap[sid].mimeType, sid, r.year_level?.trim()) } catch {} }
    if (signatureMap[sid]) { try { signature_url = await uploadSignature(signatureMap[sid], sid, r.year_level?.trim()) } catch {} }
    rows.push({
      student_id: sid.slice(0, 50), full_name: r.full_name.trim().slice(0, MAX_TEXT_LENGTH),
      year_level: r.year_level.trim(), position: r.position?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      photo_url, signature_url,
      blood_type: r.blood_type?.trim() || null,
      emergency_contact_name: r.emergency_contact_name?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      emergency_contact_phone: r.emergency_contact_phone?.trim().slice(0, 30) || null,
      student_email: r.student_email?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      programme: r.programme?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    })
  }
  if (!rows.length) return res.status(400).json({ error: 'No valid rows found.' })

  const { data, error } = await supabase.from('students').upsert(rows, { onConflict: 'student_id' }).select()
  if (error) return res.status(400).json({ error: error.message })

  // Auto-generate QR for each upserted student
  const qrGen = getQRGenerator()
  for (const student of data) { try { await qrGen(student) } catch {} }

  res.json({ inserted: data.length, records: data })
})

// ── ADMIN: edit student ──
router.patch('/:studentId', requireAdmin, upload.fields([
  { name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }
]), async (req, res) => {
  const { full_name, year_level, position, blood_type,
          emergency_contact_name, emergency_contact_phone, student_email, programme } = req.body

  if (year_level && !validateYear(year_level)) return res.status(400).json({ error: `Invalid year_level.` })
  if (!validateTextLength(full_name) || !validateTextLength(position) || !validateTextLength(programme))
    return res.status(400).json({ error: 'A field value is too long.' })
  if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
    return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
  if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
    return res.status(400).json({ error: 'Signature must be PNG.' })

  // Get current record to compare year_level
  const { data: current, error: currentErr } = await supabase
    .from('students').select('student_id, year_level, photo_url, signature_url')
    .eq('student_id', req.params.studentId).maybeSingle()
  if (currentErr || !current) return res.status(404).json({ error: 'Student not found.' })

  const oldYearLevel = current.year_level
  const newYearLevel = year_level || oldYearLevel
  const yearLevelChanged = year_level && year_level !== oldYearLevel

  const updates = { status: 'pending' }
  if (full_name) updates.full_name = full_name.trim()
  if (year_level) updates.year_level = year_level
  if (position !== undefined) updates.position = position?.trim() || null
  if (blood_type !== undefined) updates.blood_type = blood_type?.trim() || null
  if (emergency_contact_name !== undefined) updates.emergency_contact_name = emergency_contact_name?.trim() || null
  if (emergency_contact_phone !== undefined) updates.emergency_contact_phone = emergency_contact_phone?.trim() || null
  if (student_email !== undefined) updates.student_email = student_email?.trim() || null
  if (programme !== undefined) updates.programme = programme?.trim() || null

  if (req.files?.photo?.[0]) {
    try { updates.photo_url = await uploadPhoto(req.files.photo[0].buffer, req.files.photo[0].mimetype, req.params.studentId, newYearLevel) }
    catch (err) { return res.status(400).json({ error: 'Photo upload failed: ' + err.message }) }
  }
  if (req.files?.signature?.[0]) {
    try { updates.signature_url = await uploadSignature(req.files.signature[0].buffer, req.params.studentId, newYearLevel) }
    catch (err) { return res.status(400).json({ error: 'Signature upload failed: ' + err.message }) }
  }

  const { data, error } = await supabase.from('students').update(updates).eq('student_id', req.params.studentId).select().single()
  if (error) return res.status(400).json({ error: error.message })

  // Handle year level change — migrate files and QR
  if (yearLevelChanged) {
    try { await migrateStudentFiles(req.params.studentId, oldYearLevel, newYearLevel) } catch {}
    try {
      const { deleteQRFile } = require('./qr')
      await deleteQRFile(req.params.studentId, oldYearLevel)
    } catch {}
  }

  // Regenerate QR after edit
  try { await getQRGenerator()(data) } catch {}

  res.json(data)
})

// ── PUBLIC: self-correct ──
router.patch('/:studentId/self-correct', async (req, res) => {
  const { corrections, qr_corrections, photo_issue } = req.body
  const studentId = req.params.studentId

  const { data: student, error: lookupErr } = await supabase.from('students').select('student_id, status').eq('student_id', studentId).maybeSingle()
  if (lookupErr || !student) return res.status(404).json({ error: 'Student not found.' })

  if (corrections?.year_level && !validateYear(corrections.year_level)) return res.status(400).json({ error: 'Invalid year_level.' })
  if (corrections?.full_name && !validateTextLength(corrections.full_name)) return res.status(400).json({ error: 'full_name too long.' })
  if (corrections?.position && !validateTextLength(corrections.position)) return res.status(400).json({ error: 'position too long.' })

  const VALID_QR_FIELDS = ['blood_type', 'programme', 'email', 'emergency_contact_name', 'emergency_contact_phone']
  if (qr_corrections) {
    for (const key of Object.keys(qr_corrections)) {
      if (!VALID_QR_FIELDS.includes(key)) return res.status(400).json({ error: `Invalid QR field: ${key}` })
      if (!validateTextLength(String(qr_corrections[key]), 200)) return res.status(400).json({ error: `${key} too long.` })
    }
  }

  const updates = { status: 'pending' }
  const notes = []
  if (corrections?.full_name) { updates.full_name = corrections.full_name.trim(); notes.push(`Name corrected to: ${corrections.full_name.trim()}`) }
  if (corrections?.year_level) { updates.year_level = corrections.year_level; notes.push(`Year corrected to: ${corrections.year_level}`) }
  if (corrections?.position !== undefined) { updates.position = corrections.position?.trim() || null; notes.push(`Position corrected to: ${corrections.position}`) }

  if (qr_corrections) {
    for (const [key, value] of Object.entries(qr_corrections)) {
      updates[key] = String(value).trim()
      notes.push(`${key} corrected to: ${String(value).trim()}`)
    }
  }

  const hasUpdates = Object.keys(updates).some(k => k !== 'status')
  if (hasUpdates) {
    const { error } = await supabase.from('students').update(updates).eq('student_id', studentId)
    if (error) return res.status(400).json({ error: error.message })
  }

  if (photo_issue) {
    await supabase.from('confirmations').insert({ student_id: studentId, action: 'photo_issue', note: 'Student reported incorrect photo.' })
    await supabase.from('students').update({ status: 'photo_issue' }).eq('student_id', studentId)
  }

  if (notes.length) {
    await supabase.from('confirmations').insert({ student_id: studentId, action: 'self_corrected', note: notes.join(' | ').slice(0, MAX_NOTE_LENGTH) })
    const { data: updated } = await supabase.from('students').select('*').eq('student_id', studentId).single()
    if (updated) { try { await getQRGenerator()(updated) } catch {} }
  }

  const { data, error } = await supabase.from('students').select('*').eq('student_id', studentId).single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

module.exports = router
