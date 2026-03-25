const express = require('express')
const router = express.Router()
const multer = require('multer')
const { parse } = require('csv-parse/sync')
const JSZip = require('jszip')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
})

// ── Validation constants ──
const ALLOWED_YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/jpg','image/png']
const MAX_TEXT_LENGTH = 200
const MAX_NOTE_LENGTH = 1000

function validateYear(year) {
  return ALLOWED_YEARS.includes(year)
}

function validateTextLength(value, max = MAX_TEXT_LENGTH) {
  return !value || value.length <= max
}

function validateImageMime(mimetype) {
  return ALLOWED_IMAGE_TYPES.includes(mimetype)
}

// Safe filename: strip any path traversal, keep only the base filename
function safeBasename(filename) {
  return path.basename(filename.replace(/\\/g, '/'))
}

// ── Storage helpers ──
async function uploadPhoto(buffer, mimeType, studentId) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = `photos/${safeSid}_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('id-cards').upload(filePath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

async function uploadSignature(buffer, studentId) {
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = `signatures/${safeSid}_${Date.now()}.png`
  const { error } = await supabase.storage
    .from('id-cards').upload(filePath, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

// ── PUBLIC: student lookup ──
router.get('/lookup', async (req, res) => {
  const { student_id, full_name } = req.query
  if (!student_id || !full_name)
    return res.status(400).json({ found: false, error: 'Missing student_id or full_name.' })
  if (!validateTextLength(student_id, 50) || !validateTextLength(full_name))
    return res.status(400).json({ found: false, error: 'Input too long.' })

  const { data, error } = await supabase
    .from('students').select('student_id')
    .ilike('student_id', student_id.trim())
    .ilike('full_name', full_name.trim())
    .maybeSingle()
  if (error) return res.status(500).json({ found: false, error: 'Lookup failed.' })
  res.json({ found: !!data })
})

// ── PUBLIC: get one student (preview page) ──
router.get('/:studentId', async (req, res) => {
  const { data, error } = await supabase
    .from('students').select('*')
    .eq('student_id', req.params.studentId).maybeSingle()
  if (error) return res.status(500).json({ error: 'Failed to load student.' })
  if (!data) return res.status(404).json({ error: 'Student not found.' })
  res.json(data)
})

// ── ADMIN: list all students ──
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── ADMIN: add single student ──
router.post('/', requireAdmin, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 }
]), async (req, res) => {
  const { student_id, full_name, year_level, position } = req.body

  if (!student_id || !full_name || !year_level)
    return res.status(400).json({ error: 'student_id, full_name, and year_level are required.' })
  if (!validateYear(year_level))
    return res.status(400).json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
  if (!validateTextLength(student_id, 50))
    return res.status(400).json({ error: 'student_id is too long.' })
  if (!validateTextLength(full_name))
    return res.status(400).json({ error: 'full_name is too long.' })
  if (!validateTextLength(position))
    return res.status(400).json({ error: 'position is too long.' })

  // Validate file types
  if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
    return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
  if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
    return res.status(400).json({ error: 'Signature must be PNG.' })

  let photo_url = null, signature_url = null
  const sid = student_id.trim()

  if (req.files?.photo?.[0]) {
    try { photo_url = await uploadPhoto(req.files.photo[0].buffer, req.files.photo[0].mimetype, sid) }
    catch (err) { return res.status(400).json({ error: 'Photo upload failed: ' + err.message }) }
  }
  if (req.files?.signature?.[0]) {
    try { signature_url = await uploadSignature(req.files.signature[0].buffer, sid) }
    catch (err) { return res.status(400).json({ error: 'Signature upload failed: ' + err.message }) }
  }

  const { data, error } = await supabase.from('students')
    .insert({
      student_id: sid,
      full_name: full_name.trim(),
      year_level,
      position: position?.trim() || null,
      photo_url,
      signature_url
    })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// ── ADMIN: CSV + ZIP bulk upload ──
router.post('/bulk', requireAdmin, upload.fields([
  { name: 'csv', maxCount: 1 },
  { name: 'zip', maxCount: 1 }
]), async (req, res) => {
  const csvFile = req.files?.csv?.[0]
  const zipFile = req.files?.zip?.[0]
  if (!csvFile) return res.status(400).json({ error: 'No CSV file uploaded.' })

  let records
  try {
    records = parse(csvFile.buffer.toString('utf-8'), {
      columns: true, skip_empty_lines: true, trim: true
    })
  } catch (err) {
    return res.status(400).json({ error: 'Invalid CSV format: ' + err.message })
  }
  if (!records.length) return res.status(400).json({ error: 'CSV file is empty.' })

  const required = ['student_id', 'full_name', 'year_level']
  const missing = required.filter(col => !(col in records[0]))
  if (missing.length)
    return res.status(400).json({ error: `Missing CSV columns: ${missing.join(', ')}` })

  const photoMap = {}, signatureMap = {}

  if (zipFile) {
    try {
      const zip = await JSZip.loadAsync(zipFile.buffer)
      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue

        // Path traversal protection — use only the base filename
        const base = safeBasename(filename)
        const nameNoExt = base.replace(/\.(jpg|jpeg|png)$/i, '')
        const ext = base.match(/\.(jpg|jpeg|png)$/i)?.[1]?.toLowerCase()
        if (!ext) continue

        // Detect signatures folder
        const normalised = filename.replace(/\\/g, '/').toLowerCase()
        const isSignature = normalised.includes('/signatures/') || normalised.startsWith('signatures/')

        const buffer = await file.async('nodebuffer')
        if (isSignature) {
          signatureMap[nameNoExt] = buffer
        } else {
          photoMap[nameNoExt] = { buffer, mimeType: ext === 'png' ? 'image/png' : 'image/jpeg' }
        }
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid ZIP file: ' + err.message })
    }
  }

  const rows = []
  for (const r of records) {
    const sid = r.student_id.trim()

    // Skip rows with invalid year_level silently — log but don't fail whole batch
    if (r.year_level && !validateYear(r.year_level.trim())) {
      console.warn(`Bulk upload: invalid year_level "${r.year_level}" for student ${sid} — skipped.`)
      continue
    }

    let photo_url = null, signature_url = null
    if (photoMap[sid]) {
      try { photo_url = await uploadPhoto(photoMap[sid].buffer, photoMap[sid].mimeType, sid) }
      catch { /* skip photo silently */ }
    }
    if (signatureMap[sid]) {
      try { signature_url = await uploadSignature(signatureMap[sid], sid) }
      catch { /* skip signature silently */ }
    }

    rows.push({
      student_id: sid.slice(0, 50),
      full_name: r.full_name.trim().slice(0, MAX_TEXT_LENGTH),
      year_level: r.year_level.trim(),
      position: r.position?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      photo_url,
      signature_url,
    })
  }

  if (!rows.length)
    return res.status(400).json({ error: 'No valid student rows found in CSV.' })

  const { data, error } = await supabase
    .from('students').upsert(rows, { onConflict: 'student_id' }).select()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ inserted: data.length, records: data })
})

// ── ADMIN: edit student ──
router.patch('/:studentId', requireAdmin, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 }
]), async (req, res) => {
  const { full_name, year_level, position } = req.body

  if (year_level && !validateYear(year_level))
    return res.status(400).json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
  if (!validateTextLength(full_name))
    return res.status(400).json({ error: 'full_name is too long.' })
  if (!validateTextLength(position))
    return res.status(400).json({ error: 'position is too long.' })
  if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
    return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
  if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
    return res.status(400).json({ error: 'Signature must be PNG.' })

  const updates = { status: 'pending' }
  if (full_name) updates.full_name = full_name.trim()
  if (year_level) updates.year_level = year_level
  if (position !== undefined) updates.position = position?.trim() || null

  if (req.files?.photo?.[0]) {
    try { updates.photo_url = await uploadPhoto(req.files.photo[0].buffer, req.files.photo[0].mimetype, req.params.studentId) }
    catch (err) { return res.status(400).json({ error: 'Photo upload failed: ' + err.message }) }
  }
  if (req.files?.signature?.[0]) {
    try { updates.signature_url = await uploadSignature(req.files.signature[0].buffer, req.params.studentId) }
    catch (err) { return res.status(400).json({ error: 'Signature upload failed: ' + err.message }) }
  }

  const { data, error } = await supabase
    .from('students').update(updates)
    .eq('student_id', req.params.studentId).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// ── PUBLIC: student self-correction ──
router.patch('/:studentId/self-correct', async (req, res) => {
  const { corrections, photo_issue } = req.body
  const studentId = req.params.studentId

  // Verify the student actually exists before accepting any correction
  const { data: student, error: lookupErr } = await supabase
    .from('students').select('student_id, status')
    .eq('student_id', studentId).maybeSingle()
  if (lookupErr || !student)
    return res.status(404).json({ error: 'Student not found.' })

  // Validate corrections
  if (corrections?.year_level && !validateYear(corrections.year_level))
    return res.status(400).json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
  if (corrections?.full_name && !validateTextLength(corrections.full_name))
    return res.status(400).json({ error: 'full_name is too long.' })
  if (corrections?.position && !validateTextLength(corrections.position))
    return res.status(400).json({ error: 'position is too long.' })

  const updates = { status: 'pending' }
  const notes = []

  if (corrections?.full_name) {
    updates.full_name = corrections.full_name.trim()
    notes.push(`Name corrected to: ${corrections.full_name.trim()}`)
  }
  if (corrections?.year_level) {
    updates.year_level = corrections.year_level
    notes.push(`Year corrected to: ${corrections.year_level}`)
  }
  if (corrections?.position !== undefined) {
    updates.position = corrections.position?.trim() || null
    notes.push(`Position corrected to: ${corrections.position}`)
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase.from('students')
      .update(updates).eq('student_id', studentId)
    if (error) return res.status(400).json({ error: error.message })
  }

  if (photo_issue) {
    await supabase.from('confirmations').insert({
      student_id: studentId,
      action: 'photo_issue',
      note: 'Student reported incorrect photo. Admin action required.'
    })
    await supabase.from('students').update({ status: 'photo_issue' })
      .eq('student_id', studentId)
  }

  if (notes.length) {
    await supabase.from('confirmations').insert({
      student_id: studentId,
      action: 'self_corrected',
      note: notes.join(' | ').slice(0, MAX_NOTE_LENGTH)
    })
  }

  const { data, error } = await supabase.from('students')
    .select('*').eq('student_id', studentId).single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

module.exports = router
