const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { verifyStudentToken } = require('./qr')

const ALLOWED_ACTIONS = ['confirmed', 'issue']
const MAX_NOTE_LENGTH = 1000

// ── PUBLIC: Student self-confirmation via signed token ──
router.post('/student', async (req, res) => {
  const { token, action, note } = req.body

  if (!token) return res.status(400).json({ error: 'Token is required.' })
  const studentId = verifyStudentToken(token)
  if (!studentId) return res.status(403).json({ error: 'Invalid or tampered token.' })

  const resolvedAction = action || 'confirmed'
  if (!ALLOWED_ACTIONS.includes(resolvedAction))
    return res.status(400).json({ error: 'action must be "confirmed" or "issue".' })
  if (note && note.length > MAX_NOTE_LENGTH)
    return res.status(400).json({ error: 'note is too long.' })

  const { data: student, error: lookupErr } = await supabase
    .from('students')
    .select('student_id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (lookupErr || !student) return res.status(404).json({ error: 'Student not found.' })

  const { error: confError } = await supabase
    .from('confirmations')
    .insert({ student_id: studentId, action: resolvedAction, note: note?.slice(0, MAX_NOTE_LENGTH) || null })
  if (confError) return res.status(400).json({ error: confError.message })

  const newStatus = resolvedAction === 'confirmed' ? 'confirmed' : 'issue'
  const { error: updateError } = await supabase
    .from('students')
    .update({ status: newStatus })
    .eq('student_id', studentId)
  if (updateError) return res.status(400).json({ error: updateError.message })

  res.json({ success: true, status: newStatus })
})

// ── ADMIN: confirmation with admin auth ──
router.post('/', requireAdmin, async (req, res) => {
  const { student_id, action, note } = req.body

  if (!student_id || !action)
    return res.status(400).json({ error: 'student_id and action are required.' })
  if (!ALLOWED_ACTIONS.includes(action))
    return res.status(400).json({ error: 'action must be "confirmed" or "issue".' })
  if (note && note.length > MAX_NOTE_LENGTH)
    return res.status(400).json({ error: 'note is too long.' })

  // Verify student exists before accepting confirmation
  const { data: student, error: lookupErr } = await supabase
    .from('students')
    .select('student_id')
    .eq('student_id', student_id)
    .maybeSingle()
  if (lookupErr || !student) return res.status(404).json({ error: 'Student not found.' })

  const { error: confError } = await supabase
    .from('confirmations')
    .insert({ student_id, action, note: note?.slice(0, MAX_NOTE_LENGTH) || null })
  if (confError) return res.status(400).json({ error: confError.message })

  const newStatus = action === 'confirmed' ? 'confirmed' : 'issue'
  const { error: updateError } = await supabase
    .from('students')
    .update({ status: newStatus })
    .eq('student_id', student_id)
  if (updateError) return res.status(400).json({ error: updateError.message })

  res.json({ success: true, status: newStatus })
})

module.exports = router
