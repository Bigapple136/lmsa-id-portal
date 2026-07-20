const express = require('express')
const router = express.Router()
const multer = require('multer')
const { parse } = require('csv-parse/sync')
const JSZip = require('jszip')
const path = require('path')
const PDFDocument = require('pdfkit')
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { email, maxLength } = require('../middleware/validate')
const { signStudentToken, verifyStudentToken } = require('./qr')

const FRONTEND_URL = process.env.FRONTEND_URL

function requireFullAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }
  next()
}

// Lazy-load QR generator to avoid circular dep issues
function getQRGenerator() {
  return require('./qr').generateForStudent
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const ALLOWED_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_TEXT_LENGTH = 200
const MAX_NOTE_LENGTH = 1000

function validateYear(y) {
  return ALLOWED_YEARS.includes(y)
}
function validateTextLength(v, max = MAX_TEXT_LENGTH) {
  return !v || v.length <= max
}
function validateImageMime(m) {
  return ALLOWED_IMAGE_TYPES.includes(m)
}
function safeBasename(f) {
  return path.basename(f.replace(/\\/g, '/'))
}

function normaliseYearFolder(yearLevel) {
  return (yearLevel || 'unknown').toLowerCase().replace(/\s+/g, '-')
}

async function uploadPhoto(buffer, mimeType, studentId, yearLevel) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = normaliseYearFolder(yearLevel)
  const filePath = `photos/${folder}/${safeSid}.${ext}`
  const { error } = await supabase.storage
    .from('id-cards')
    .upload(filePath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(error.message)
  const {
    data: { publicUrl },
  } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

async function uploadSignature(buffer, studentId, yearLevel) {
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = normaliseYearFolder(yearLevel)
  const filePath = `signatures/${folder}/${safeSid}.png`
  const { error } = await supabase.storage
    .from('id-cards')
    .upload(filePath, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  const {
    data: { publicUrl },
  } = supabase.storage.from('id-cards').getPublicUrl(filePath)
  return publicUrl
}

async function migrateStudentFiles(studentId, oldYearLevel, newYearLevel) {
  if (oldYearLevel === newYearLevel) return
  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const oldFolder = normaliseYearFolder(oldYearLevel)
  const newFolder = normaliseYearFolder(newYearLevel)

  const oldPhotoPathJpg = `photos/${oldFolder}/${safeSid}.jpg`
  const oldPhotoPathPng = `photos/${oldFolder}/${safeSid}.png`
  const oldSigPath = `signatures/${oldFolder}/${safeSid}.png`

  let photoResult = null
  try {
    photoResult = await supabase.storage.from('id-cards').download(oldPhotoPathJpg)
  } catch {
    // ignore
  }
  let photoExt = 'jpg'
  if (!photoResult?.data) {
    try {
      photoResult = await supabase.storage.from('id-cards').download(oldPhotoPathPng)
      photoExt = 'png'
    } catch {
      // ignore
    }
  }

  if (photoResult?.data) {
    const buffer = Buffer.from(await photoResult.data.arrayBuffer())
    const newPath = `photos/${newFolder}/${safeSid}.${photoExt}`
    await supabase.storage.from('id-cards').upload(newPath, buffer, {
      contentType: photoExt === 'jpg' ? 'image/jpeg' : 'image/png',
      upsert: true,
    })
    const {
      data: { publicUrl },
    } = supabase.storage.from('id-cards').getPublicUrl(newPath)
    await supabase.storage.from('id-cards').remove([oldPhotoPathJpg, oldPhotoPathPng].filter(Boolean))
    await supabase.from('students').update({ photo_url: publicUrl }).eq('student_id', studentId)
  }

  const { data: sigData } = await supabase.storage
    .from('id-cards')
    .download(oldSigPath)
    .catch(() => null)
  if (sigData) {
    const buffer = Buffer.from(await sigData.arrayBuffer())
    const newPath = `signatures/${newFolder}/${safeSid}.png`
    await supabase.storage
      .from('id-cards')
      .upload(newPath, buffer, { contentType: 'image/png', upsert: true })
    const {
      data: { publicUrl },
    } = supabase.storage.from('id-cards').getPublicUrl(newPath)
    await supabase.storage.from('id-cards').remove([oldSigPath])
    await supabase.from('students').update({ signature_url: publicUrl }).eq('student_id', studentId)
  }
}

// ── PUBLIC ──
router.get('/lookup', async (req, res) => {
  const { student_id, full_name } = req.query
  if (!student_id || !full_name)
    return res.status(400).json({ found: false, error: 'Missing fields.' })
  if (!validateTextLength(student_id, 50) || !validateTextLength(full_name))
    return res.status(400).json({ found: false, error: 'Input too long.' })
  const safeId = student_id.trim().replace(/[%_]/g, (c) => `\\${c}`)
  const safeName = full_name.trim().replace(/[%_]/g, (c) => `\\${c}`)
  const { data, error } = await supabase
    .from('students')
    .select('student_id')
    .ilike('student_id', safeId)
    .ilike('full_name', safeName)
    .maybeSingle()
  if (error) return res.status(500).json({ found: false, error: 'Lookup failed.' })
  if (!data) return res.status(404).json({ found: false, error: 'No student found.' })
  const token = signStudentToken(data.student_id)
  res.json({ found: true, preview_url: `${FRONTEND_URL}/preview/${token}` })
})

router.get('/preview/:token', async (req, res) => {
  const studentId = verifyStudentToken(req.params.token)
  if (!studentId) return res.status(403).json({ error: 'Invalid or tampered link.' })
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'Failed to load student.' })
  if (!data) return res.status(404).json({ error: 'Student not found.' })
  res.json(data)
})

router.get('/preview-url/:studentId', requireAdmin, async (req, res) => {
  const sidErr = maxLength(req.params.studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })
  const token = signStudentToken(req.params.studentId)
  res.json({ url: `${FRONTEND_URL}/preview/${token}` })
})

router.get('/:studentId', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', req.params.studentId)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'Failed to load student.' })
  if (!data) return res.status(404).json({ error: 'Student not found.' })
  res.json(data)
})

router.delete('/:studentId?', requireAdmin, requireFullAdmin, async (req, res) => {
  const studentId = req.params.studentId
  if (!studentId) return res.status(400).json({ error: 'student_id is required.' })
  const sidErr = maxLength(studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })

  const { data: student, error: fetchErr } = await supabase
    .from('students')
    .select('student_id, year_level')
    .eq('student_id', studentId)
    .maybeSingle()

  if (fetchErr) return res.status(500).json({ error: 'Failed to load student.' })
  if (!student) return res.status(404).json({ error: 'Student not found.' })

  const safeSid = studentId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const yearFolder = normaliseYearFolder(student.year_level)

  const filesToRemove = [
    `photos/${yearFolder}/${safeSid}.jpg`,
    `photos/${yearFolder}/${safeSid}.png`,
    `signatures/${yearFolder}/${safeSid}.png`,
    `qr-codes/${yearFolder}/${studentId}.png`,
  ]

  await Promise.allSettled([
    supabase.storage.from('id-cards').remove(filesToRemove.slice(0, 3)),
    supabase.storage.from('qr-codes').remove([filesToRemove[3]]),
  ])

  await supabase.from('confirmations').delete().eq('student_id', studentId)

  const { error: deleteErr } = await supabase.from('students').delete().eq('student_id', studentId)
  if (deleteErr) return res.status(500).json({ error: 'Failed to delete student.' })

  res.status(204).send()
})

// ── ADMIN: list all ──
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── ADMIN: add single student ──
router.post(
  '/',
  requireAdmin,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      student_id,
      full_name,
      year_level,
      position,
      blood_type,
      emergency_contact_name,
      emergency_contact_phone,
      student_email,
      programme,
      date_of_birth,
      nationality,
      county_of_origin,
      current_address,
    } = req.body

    if (!student_id || !full_name || !year_level)
      return res.status(400).json({ error: 'student_id, full_name, and year_level are required.' })
    if (!validateYear(year_level))
      return res
        .status(400)
        .json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
    if (
      !validateTextLength(student_id, 50) ||
      !validateTextLength(full_name) ||
      !validateTextLength(position) ||
      !validateTextLength(programme) ||
      !validateTextLength(nationality, 100) ||
      !validateTextLength(county_of_origin, 100) ||
      !validateTextLength(current_address, 500)
    )
      return res.status(400).json({ error: 'A field value is too long.' })
    const emailErr = student_email ? email(student_email) : null
    if (emailErr) return res.status(400).json({ error: emailErr })
    if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
      return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
    if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
      return res.status(400).json({ error: 'Signature must be PNG.' })

    const sid = student_id.trim()
    let photo_url = null,
      signature_url = null
    if (req.files?.photo?.[0]) {
      try {
        photo_url = await uploadPhoto(
          req.files.photo[0].buffer,
          req.files.photo[0].mimetype,
          sid,
          year_level,
        )
      } catch (err) {
        return res.status(400).json({ error: 'Photo upload failed: ' + err.message })
      }
    }
    if (req.files?.signature?.[0]) {
      try {
        signature_url = await uploadSignature(req.files.signature[0].buffer, sid, year_level)
      } catch (err) {
        return res.status(400).json({ error: 'Signature upload failed: ' + err.message })
      }
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        student_id: sid,
        full_name: full_name.trim(),
        year_level,
        position: position?.trim() || null,
        photo_url,
        signature_url,
        blood_type: blood_type?.trim() || null,
        emergency_contact_name: emergency_contact_name?.trim() || null,
        emergency_contact_phone: emergency_contact_phone?.trim() || null,
        student_email: student_email?.trim() || null,
        programme: programme?.trim() || null,
        date_of_birth: date_of_birth?.trim() || null,
        nationality: nationality?.trim() || null,
        county_of_origin: county_of_origin?.trim() || null,
        current_address: current_address?.trim() || null,
      })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })

    // Auto-generate QR
    try {
      await getQRGenerator()(data)
    } catch (err) {
      console.error('[QR] Auto-generate failed for', data.student_id, err.message)
    }

    res.status(201).json(data)
  },
)

// ── ADMIN: bulk CSV + ZIP ──
router.post(
  '/bulk',
  requireAdmin,
  upload.fields([
    { name: 'csv', maxCount: 1 },
    { name: 'zip', maxCount: 1 },
  ]),
  async (req, res) => {
    const csvFile = req.files?.csv?.[0]
    const zipFile = req.files?.zip?.[0]
    if (!csvFile) return res.status(400).json({ error: 'No CSV file uploaded.' })

    let records
    try {
      records = parse(csvFile.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    } catch (err) {
      return res.status(400).json({ error: 'Invalid CSV: ' + err.message })
    }
    if (!records.length) return res.status(400).json({ error: 'CSV is empty.' })

    const required = ['student_id', 'full_name', 'year_level']
    const missing = required.filter((c) => !(c in records[0]))
    if (missing.length)
      return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` })

    const photoMap = {},
      signatureMap = {}
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
      } catch (err) {
        return res.status(400).json({ error: 'Invalid ZIP: ' + err.message })
      }
    }

    const rows = []
    for (const r of records) {
      const sid = r.student_id?.trim()
      if (!sid) {
        console.warn('Skipping row with empty student_id')
        continue
      }
      if (r.year_level && !validateYear(r.year_level.trim())) {
        console.warn(`Invalid year_level for ${sid} — skipped`)
        continue
      }
      let photo_url = null,
        signature_url = null
      if (photoMap[sid]) {
        try {
          photo_url = await uploadPhoto(
            photoMap[sid].buffer,
            photoMap[sid].mimeType,
            sid,
            r.year_level?.trim(),
          )
        } catch (err) {
          console.warn('[Bulk] Photo upload failed for', sid, err.message)
        }
      }
      if (signatureMap[sid]) {
        try {
          signature_url = await uploadSignature(signatureMap[sid], sid, r.year_level?.trim())
        } catch (err) {
          console.warn('[Bulk] Signature upload failed for', sid, err.message)
        }
      }
      rows.push({
        student_id: sid.slice(0, 50),
        full_name: r.full_name.trim().slice(0, MAX_TEXT_LENGTH),
        year_level: r.year_level.trim(),
        position: r.position?.trim().slice(0, MAX_TEXT_LENGTH) || null,
        photo_url,
        signature_url,
        blood_type: r.blood_type?.trim() || null,
        emergency_contact_name: r.emergency_contact_name?.trim().slice(0, MAX_TEXT_LENGTH) || null,
        emergency_contact_phone: r.emergency_contact_phone?.trim().slice(0, 30) || null,
        student_email: r.student_email?.trim().slice(0, MAX_TEXT_LENGTH) || null,
        programme: r.programme?.trim().slice(0, MAX_TEXT_LENGTH) || null,
        date_of_birth: r.date_of_birth?.trim() || null,
        nationality: r.nationality?.trim().slice(0, 100) || null,
        county_of_origin: r.county_of_origin?.trim().slice(0, 100) || null,
        current_address: r.current_address?.trim().slice(0, 500) || null,
      })
    }
    if (!rows.length) return res.status(400).json({ error: 'No valid rows found.' })

    const seen = new Set()
    const deduped = []
    const totalProvided = rows.length
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!seen.has(rows[i].student_id)) {
        seen.add(rows[i].student_id)
        deduped.unshift(rows[i])
      }
    }
    const duplicatesSkipped = totalProvided - deduped.length

    const { data, error } = await supabase
      .from('students')
      .upsert(deduped, { onConflict: 'student_id' })
      .select()
    if (error) return res.status(400).json({ error: error.message })

    // Auto-generate QR for each upserted student
    const qrGen = getQRGenerator()
    for (const student of data) {
      try {
        await qrGen(student)
      } catch (err) {
        console.warn('[Bulk QR] Failed for', student.student_id, err.message)
      }
    }

    res.json({ inserted: data.length, records: data, duplicates_skipped: duplicatesSkipped })
  },
)

// ── ADMIN: edit student ──
router.patch(
  '/:studentId',
  requireAdmin,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  async (req, res) => {
    const sidErr = maxLength(req.params.studentId, 50, 'studentId')
    if (sidErr) return res.status(400).json({ error: sidErr })

    const {
      full_name,
      year_level,
      position,
      blood_type,
      emergency_contact_name,
      emergency_contact_phone,
      student_email,
      programme,
      date_of_birth,
      nationality,
      county_of_origin,
      current_address,
    } = req.body

    if (year_level && !validateYear(year_level))
      return res.status(400).json({ error: `Invalid year_level.` })
    if (
      !validateTextLength(full_name) ||
      !validateTextLength(position) ||
      !validateTextLength(programme) ||
      !validateTextLength(nationality, 100) ||
      !validateTextLength(county_of_origin, 100) ||
      !validateTextLength(current_address, 500)
    )
      return res.status(400).json({ error: 'A field value is too long.' })
    if (req.files?.photo?.[0] && !validateImageMime(req.files.photo[0].mimetype))
      return res.status(400).json({ error: 'Photo must be JPG or PNG.' })
    if (req.files?.signature?.[0] && req.files.signature[0].mimetype !== 'image/png')
      return res.status(400).json({ error: 'Signature must be PNG.' })

    // Get current record to compare year_level
    const { data: current, error: currentErr } = await supabase
      .from('students')
      .select('student_id, year_level, photo_url, signature_url')
      .eq('student_id', req.params.studentId)
      .maybeSingle()
    if (currentErr || !current) return res.status(404).json({ error: 'Student not found.' })

    const oldYearLevel = current.year_level
    const newYearLevel = year_level || oldYearLevel
    const yearLevelChanged = year_level && year_level !== oldYearLevel

    const updates = {}
    if (full_name) updates.full_name = full_name.trim()
    if (year_level) updates.year_level = year_level
    if (position !== undefined) updates.position = position?.trim() || null
    if (blood_type !== undefined) updates.blood_type = blood_type?.trim() || null
    if (emergency_contact_name !== undefined)
      updates.emergency_contact_name = emergency_contact_name?.trim() || null
    if (emergency_contact_phone !== undefined)
      updates.emergency_contact_phone = emergency_contact_phone?.trim() || null
    if (student_email !== undefined) updates.student_email = student_email?.trim() || null
    if (programme !== undefined) updates.programme = programme?.trim() || null
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth?.trim() || null
    if (nationality !== undefined) updates.nationality = nationality?.trim() || null
    if (county_of_origin !== undefined) updates.county_of_origin = county_of_origin?.trim() || null
    if (current_address !== undefined) updates.current_address = current_address?.trim() || null

    const identityFields = ['full_name', 'year_level', 'photo_url', 'signature_url']
    const identityChanged = Object.keys(updates).some((k) => identityFields.includes(k))
    if (req.files?.photo?.[0]) {
      identityChanged = true
    }
    if (identityChanged) updates.status = 'pending'

    if (req.files?.photo?.[0]) {
      try {
        updates.photo_url = await uploadPhoto(
          req.files.photo[0].buffer,
          req.files.photo[0].mimetype,
          req.params.studentId,
          newYearLevel,
        )
      } catch (err) {
        return res.status(400).json({ error: 'Photo upload failed: ' + err.message })
      }
    }
    if (req.files?.signature?.[0]) {
      try {
        updates.signature_url = await uploadSignature(
          req.files.signature[0].buffer,
          req.params.studentId,
          newYearLevel,
        )
      } catch (err) {
        return res.status(400).json({ error: 'Signature upload failed: ' + err.message })
      }
    }

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('student_id', req.params.studentId)
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })

    // Handle year level change — migrate files and QR
    if (yearLevelChanged) {
      try {
        await migrateStudentFiles(req.params.studentId, oldYearLevel, newYearLevel)
      } catch (err) {
        console.warn('[Migrate] File migration failed for', req.params.studentId, err.message)
      }
      try {
        const { deleteQRFile } = require('./qr')
        await deleteQRFile(req.params.studentId, oldYearLevel)
      } catch (err) {
        console.warn('[Migrate] QR deletion failed for', req.params.studentId, err.message)
      }
    }

    // Regenerate QR after edit
    try {
      await getQRGenerator()(data)
    } catch (err) {
      console.warn('[QR] Regenerate failed for', data.student_id, err.message)
    }

    res.json(data)
  },
)

// ── PUBLIC: self-correct ──
router.patch('/:studentId/self-correct', async (req, res) => {
  const sidErr = maxLength(req.params.studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })

  const token = req.query.token || req.body?.token
  if (!token) return res.status(401).json({ error: 'Token required.' })
  const tokenStudentId = verifyStudentToken(token)
  if (!tokenStudentId || tokenStudentId !== req.params.studentId) {
    return res.status(403).json({ error: 'Invalid or expired token.' })
  }

  const { corrections, qr_corrections, photo_issue } = req.body
  const studentId = req.params.studentId

  const { data: student, error: lookupErr } = await supabase
    .from('students')
    .select('student_id, status')
    .eq('student_id', studentId)
    .maybeSingle()
  if (lookupErr || !student) return res.status(404).json({ error: 'Student not found.' })

  if (corrections?.year_level && !validateYear(corrections.year_level))
    return res.status(400).json({ error: 'Invalid year_level.' })
  if (corrections?.full_name && !validateTextLength(corrections.full_name))
    return res.status(400).json({ error: 'full_name too long.' })
  if (corrections?.position && !validateTextLength(corrections.position))
    return res.status(400).json({ error: 'position too long.' })

  const VALID_QR_FIELDS = [
    'blood_type',
    'programme',
    'student_email',
    'emergency_contact_name',
    'emergency_contact_phone',
    'date_of_birth',
    'nationality',
    'county_of_origin',
    'current_address',
  ]
  if (qr_corrections) {
    for (const key of Object.keys(qr_corrections)) {
      if (!VALID_QR_FIELDS.includes(key))
        return res.status(400).json({ error: `Invalid QR field: ${key}` })
      if (!validateTextLength(String(qr_corrections[key]), 200))
        return res.status(400).json({ error: `${key} too long.` })
    }
  }

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

  if (qr_corrections) {
    for (const [key, value] of Object.entries(qr_corrections)) {
      updates[key] = String(value).trim()
      notes.push(`${key} corrected to: ${String(value).trim()}`)
    }
  }

  const hasUpdates = Object.keys(updates).some((k) => k !== 'status')
  if (hasUpdates) {
    const { error } = await supabase.from('students').update(updates).eq('student_id', studentId)
    if (error) return res.status(400).json({ error: error.message })
  }

  if (photo_issue) {
    await supabase
      .from('confirmations')
      .insert({
        student_id: studentId,
        action: 'photo_issue',
        note: 'Student reported incorrect photo.',
      })
    await supabase.from('students').update({ status: 'photo_issue' }).eq('student_id', studentId)
  }

  if (notes.length) {
    await supabase
      .from('confirmations')
      .insert({
        student_id: studentId,
        action: 'self_corrected',
        note: notes.join(' | ').slice(0, MAX_NOTE_LENGTH),
      })
    const { data: updated } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .single()
    if (updated) {
      try {
        await getQRGenerator()(updated)
      } catch (err) {
        console.warn('[Self-correct QR] Failed for', updated.student_id, err.message)
      }
    }
  }

  // Emit notification for admins
  if (photo_issue) {
    supabase.from('notifications').insert({
      type: 'photo_issue',
      title: 'Photo issue',
      message: `${studentId} reported an incorrect photo`,
      student_id: studentId,
    }).then(() => {}).catch(() => {})
  } else if (notes.length) {
    supabase.from('notifications').insert({
      type: 'self_correction',
      title: 'Detail correction',
      message: `${studentId} requested corrections to their details`,
      student_id: studentId,
    }).then(() => {}).catch(() => {})
  }

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', studentId)
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// ── ADMIN: export photoshoot roster as PDF ──
router.get('/export/photoshoot', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .order('year_level')
    .order('full_name')
  if (error) return res.status(500).json({ error: error.message })
  if (!data?.length) return res.status(404).json({ error: 'No students found.' })

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Photoshoot_Roster.pdf"')
  doc.pipe(res)

  const L = 50,
    R = 562,
    W = 512
  const colNum = 25,
    colName = 187,
    colId = 130,
    colSign = W - colNum - colName - colId
  const rowH = 64,
    signH = 55

  function header() {
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LMSA ID Card Photoshoot Roster', L, null, { align: 'center', width: W })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666')
      .text(
        `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        { align: 'center', width: W },
      )
      .fillColor('#000')
    doc.moveDown(1.2)
  }

  function tableHeader(y) {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#444')
    let x = L
    doc.text('#', x, y + 6, { width: colNum, align: 'center' })
    x += colNum
    doc.text('Name', x, y + 6, { width: colName, align: 'left' })
    x += colName
    doc.text('Student ID', x, y + 6, { width: colId, align: 'left' })
    x += colId
    doc.text('Signature', x + 4, y + 6, { width: colSign - 8, align: 'center' })
    doc.fillColor('#000')
    x = L
    const yy = y + 22
    doc.moveTo(x, yy).lineTo(R, yy).stroke('#ccc')
  }

  function studentRow(student, idx, y) {
    let x = L
    doc.fontSize(9).font('Helvetica').fillColor('#000')
    doc.text(String(idx + 1), x, y + 6, { width: colNum, align: 'center' })
    x += colNum
    doc.text(student.full_name, x, y + 6, { width: colName, align: 'left' })
    x += colName
    doc.text(student.student_id, x, y + 6, { width: colId, align: 'left' })
    x += colId

    const signLeft = x + 4,
      signTop = y + 6,
      signW = colSign - 8
    doc.rect(signLeft, signTop, signW, signH).stroke('#999')
    doc.fillColor('#000')

    const ly = y + rowH - 1
    doc.moveTo(L, ly).lineTo(R, ly).stroke('#eee')
  }

  let yPos
  function startPage() {
    doc.addPage()
    header()
    yPos = doc.y + 6
    tableHeader(yPos)
    yPos += 26
  }

  header()
  yPos = doc.y + 6

  const yearOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
  const grouped = {}
  for (const s of data) {
    if (!grouped[s.year_level]) grouped[s.year_level] = []
    grouped[s.year_level].push(s)
  }

  for (const year of yearOrder) {
    const students = grouped[year]
    if (!students?.length) continue

    if (yPos + 30 > 700) startPage()

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E3A5A')
    doc.text(`${year} — ${students.length} student(s)`, L, yPos)
    yPos += 18

    if (yPos + 30 > 700) {
      tableHeader(doc.y)
      doc.y += 26
      yPos = doc.y
    } else {
      tableHeader(yPos)
      yPos += 26
    }

    for (let i = 0; i < students.length; i++) {
      if (yPos + rowH > 730) {
        startPage()
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E3A5A')
        doc.text(`${year} — ${students.length} student(s) (continued)`, L, yPos)
        yPos += 18
        tableHeader(yPos)
        yPos += 26
      }
      studentRow(students[i], i, yPos)
      yPos += rowH
    }
    yPos += 6
  }

  doc.end()
})

module.exports = router
