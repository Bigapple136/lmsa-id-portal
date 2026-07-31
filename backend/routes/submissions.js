const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const {
  required,
  maxLength,
  email,
  uuid,
  dateString,
  enumValue,
  firstError,
} = require('../middleware/validate')
const logger = require('../logger')

const ALLOWED_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']

// Public: Check submission status by token
router.get('/status', async (req, res) => {
  const { token } = req.query

  if (token) {
    const { data: submission, error } = await supabase
      .from('student_submissions')
      .select('status, full_name, student_id, updated_at, admin_notes')
      .eq('id', token)
      .maybeSingle()
    if (error || !submission) {
      return res.json({ found: false })
    }
    return res.json({
      found: true,
      status: submission.status,
      full_name: submission.full_name,
      student_id: submission.student_id,
      updated_at: submission.updated_at,
      admin_notes: submission.admin_notes,
    })
  }

  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'submission_form')
    .maybeSingle()
  const enabled = data?.value?.enabled === true
  res.json({ enabled })
})

// Public: Submit student data
router.post('/', async (req, res) => {
  const { data: settings } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'submission_form')
    .maybeSingle()
  if (!settings?.value?.enabled) {
    return res.status(403).json({ error: 'Submission form is currently disabled.' })
  }

  const {
    student_id,
    full_name,
    year_level,
    position,
    programme,
    blood_type,
    student_email,
    emergency_contact_name,
    emergency_contact_phone,
    date_of_birth,
    nationality,
    county_of_origin,
    current_address,
  } = req.body

  const err = firstError(
    required(student_id, 'student_id'),
    required(full_name, 'full_name'),
    required(year_level, 'year_level'),
    maxLength(student_id, 50, 'student_id'),
    maxLength(full_name, 200, 'full_name'),
    maxLength(position, 200, 'position'),
    maxLength(programme, 200, 'programme'),
    maxLength(blood_type, 20, 'blood_type'),
    maxLength(student_email, 200, 'student_email'),
    maxLength(emergency_contact_name, 200, 'emergency_contact_name'),
    maxLength(emergency_contact_phone, 30, 'emergency_contact_phone'),
    maxLength(nationality, 100, 'nationality'),
    maxLength(county_of_origin, 100, 'county_of_origin'),
    maxLength(current_address, 500, 'current_address'),
    enumValue(year_level, ALLOWED_YEARS, 'year_level'),
    student_email ? email(student_email) : null,
    date_of_birth ? dateString(date_of_birth, 'date_of_birth') : null,
  )
  if (err) return res.status(400).json({ error: err })

  const { data: existing } = await supabase
    .from('student_submissions')
    .select('id, status')
    .eq('student_id', student_id.trim())
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  if (existing) {
    const msg =
      existing.status === 'approved'
        ? 'A submission for this Student ID has already been approved. Contact your admin if updates are needed.'
        : 'A submission for this Student ID is already pending review. Please wait for admin approval.'
    return res.status(409).json({ error: msg })
  }

  const { data, error } = await supabase
    .from('student_submissions')
    .insert({
      student_id: student_id.trim(),
      full_name: full_name.trim(),
      year_level,
      position: position?.trim() || null,
      programme: programme?.trim() || null,
      blood_type: blood_type?.trim() || null,
      student_email: student_email?.trim() || null,
      emergency_contact_name: emergency_contact_name?.trim() || null,
      emergency_contact_phone: emergency_contact_phone?.trim() || null,
      date_of_birth: date_of_birth?.trim() || null,
      nationality: nationality?.trim() || null,
      county_of_origin: county_of_origin?.trim() || null,
      current_address: current_address?.trim() || null,
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  // Emit notification for admins
  supabase.from('notifications').insert({
    type: 'submission',
    title: 'New submission',
    message: `${full_name.trim()} (${student_id.trim()}) submitted their details`,
    student_id: student_id.trim(),
  }).then(() => {}).catch((err) => logger.warn({ err: err?.message }, 'Submission notification insert failed'))

  res.status(201).json({ id: data.id, message: 'Submission received. Awaiting admin review.' })
})

// Admin: List all submissions
router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query
  let query = supabase
    .from('student_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Admin: Approve submission
router.post('/:id/approve', requireAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Submission ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const { data: submission, error: fetchErr } = await supabase
    .from('student_submissions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (fetchErr) return res.status(500).json({ error: fetchErr.message })
  if (!submission) return res.status(404).json({ error: 'Submission not found.' })
  if (submission.status !== 'pending')
    return res.status(400).json({ error: `Submission already ${submission.status}.` })

  const [existingResult, exactNameResult, fuzzyNameResult] = await Promise.all([
    supabase
      .from('students')
      .select('student_id')
      .eq('student_id', submission.student_id)
      .maybeSingle(),
    supabase
      .from('students')
      .select('student_id, full_name')
      .ilike('full_name', submission.full_name.trim())
      .neq('student_id', submission.student_id)
      .limit(1),
    (() => {
      // Extract the surname (last word, ignoring suffixes like Jr./Sr./III)
      // and match against WHOLE-WORD surname, not substring.
      // This prevents false positives like matching "Doe" against "Doeman Smith".
      const name = submission.full_name.trim()
      let surname = null
      const SUFFIXES = /\b(Jr\.?|Sr\.?|II|III|IV|V|PhD|Ph\.D\.|Esq\.?)\s*$/i
      const COMMA = /^(.*?),\s+(.*)$/

      if (COMMA.test(name)) {
        // "Smith, John" → surname = "Smith"
        const [, last] = name.match(COMMA)
        surname = last?.trim() || null
      } else {
        const cleaned = name.replace(SUFFIXES, '').trim()
        const words = cleaned.split(/\s+/).filter(Boolean)
        if (words.length >= 1) surname = words[words.length - 1]
      }

      if (!surname || surname.length < 3) return Promise.resolve({ data: [] })

      // Escape SQL LIKE wildcards so a literal "%" or "_" in a name doesn't
      // act as a wildcard. We then wrap with word-boundary-ish matching: the
      // surname must appear as either the full last name, preceded by a space,
      // or after a comma — not as a substring inside another name.
      const escaped = surname.replace(/[%_\\]/g, (c) => `\\${c}`)
      // Match: surname is the full name, OR ends with " surname" (space-prefixed),
      // OR begins with "surname," (comma format). This avoids substring matches.
      const pattern = `% ${escaped}%`
      return supabase
        .from('students')
        .select('student_id, full_name')
        .ilike('full_name', pattern)
        .neq('student_id', submission.student_id)
        .limit(3)
    })(),
  ])

  if (existingResult?.data) {
    return res
      .status(409)
      .json({ error: `Student ID ${submission.student_id} already exists in the students table.` })
  }

  const nameMatches = []
  if (exactNameResult?.data?.length) nameMatches.push(...exactNameResult.data)
  if (fuzzyNameResult?.data?.length) nameMatches.push(...fuzzyNameResult.data)
  const uniqueMatches = [...new Map(nameMatches.map((m) => [m.student_id, m])).values()].filter(
    (m) => m.student_id !== submission.student_id,
  )

  const { data: student, error: insertErr } = await supabase
    .from('students')
    .insert({
      student_id: submission.student_id.trim(),
      full_name: submission.full_name.trim(),
      year_level: submission.year_level,
      position: submission.position?.trim() || null,
      programme: submission.programme?.trim() || null,
      blood_type: submission.blood_type?.trim() || null,
      student_email: submission.student_email?.trim() || null,
      emergency_contact_name: submission.emergency_contact_name?.trim() || null,
      emergency_contact_phone: submission.emergency_contact_phone?.trim() || null,
      date_of_birth: submission.date_of_birth?.trim() || null,
      nationality: submission.nationality?.trim() || null,
      county_of_origin: submission.county_of_origin?.trim() || null,
      current_address: submission.current_address?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr) return res.status(400).json({ error: insertErr.message })

  try {
    const { generateForStudent } = require('./qr')
    await generateForStudent(student)
  } catch (err) {
    logger.warn({ studentId: student.student_id, err: err.message }, 'Submission QR generation failed')
  }

  const { error: updateErr } = await supabase
    .from('student_submissions')
    .update({
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  const result = { student, message: 'Student approved and record created.' }
  if (uniqueMatches.length) {
    result.name_warning = `Similar name found for ${uniqueMatches.map((m) => `"${m.full_name}" (${m.student_id})`).join(', ')}. Verify this is not a duplicate.`
  }
  res.json(result)
})

// Admin: Reject submission
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Submission ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const { admin_notes } = req.body
  const notesErr = maxLength(admin_notes, 1000, 'admin_notes')
  if (notesErr) return res.status(400).json({ error: notesErr })

  const { data: submission, error: fetchErr } = await supabase
    .from('student_submissions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (fetchErr) return res.status(500).json({ error: fetchErr.message })
  if (!submission) return res.status(404).json({ error: 'Submission not found.' })
  if (submission.status !== 'pending')
    return res.status(400).json({ error: `Submission already ${submission.status}.` })

  const { error } = await supabase
    .from('student_submissions')
    .update({
      status: 'rejected',
      admin_notes: admin_notes?.trim() || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Submission rejected.' })
})

// Admin: Delete submission
router.delete('/:id', requireAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Submission ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const { error } = await supabase.from('student_submissions').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

module.exports = router
