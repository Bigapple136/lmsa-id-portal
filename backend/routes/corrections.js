// =============================================================================
// Correction requests — the review queue behind the student self-service flow
//
// A student files an ask through PATCH /api/students/:id/self-correct (public,
// signed preview token). Nothing reaches their record from that call. This router
// is where the record moves:
//
//   GET  /mine            the student's own requests + which one is open
//   POST /:id/withdraw    the student closes their own open request
//   GET  /                admin queue (student identity joined server-side)
//   POST /:id/approve     apply it — compare-and-set, then storage + QR follow-up
//   POST /:id/reject      close it with a reason the student can read
//
// Deliberate choices:
//   * Approving is a *conditional* write (see utils/correctionRequests.js). An
//     admin approving a request filed two weeks ago must not roll back whatever
//     the office changed since; `force` is their explicit override after being
//     shown the conflict.
//   * `requireAdmin`, not `requireFullAdmin`: reviewing corrections is the same
//     class of work as approving a submission in routes/submissions.js, which
//     support admins already do. Locking it to full admins would just push the
//     queue onto fewer people.
//   * Heavy work (moving photos/signature between year folders, re-issuing the QR)
//     is queued after the response, matching the admin student-edit route — an
//     admin clicking Approve should not wait on storage copies.
// =============================================================================

const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { maxLength, uuid } = require('../middleware/validate')
const { verifyStudentToken } = require('./qr')
const { logAdminAction } = require('../auditLog')
const logger = require('../logger')
const { enqueueImport } = require('../queue')
const { logStudentActivity } = require('../utils/notificationLog')
const {
  applyCorrectionRequest,
  rejectCorrectionRequest,
  withdrawCorrectionRequest,
  MAX_ADMIN_NOTE_LENGTH,
} = require('../utils/correctionRequests')

const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn']
const MAX_ACTIVITY_NOTE_LENGTH = 1000

function getQRGenerator() {
  return require('./qr').generateForStudent
}

// ── PUBLIC: a student's own requests, by signed token ──
router.get('/mine', async (req, res) => {
  const token = req.query.token
  if (!token) return res.status(401).json({ error: 'Token required.' })
  const studentId = await verifyStudentToken(token)
  if (!studentId) return res.status(403).json({ error: 'Invalid or expired token.' })

  const { data, error } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) {
    // sql/016 not applied yet: report "nothing open" rather than a 500, so the
    // preview page still loads for every student.
    logger.warn({ err: error.message, studentId }, 'correction_requests lookup failed')
    return res.json({ requests: [], open: null, unavailable: true })
  }

  const requests = data || []
  res.json({
    requests,
    open: requests.find((r) => r.status === 'pending') || null,
  })
})

// ── PUBLIC: withdraw an open request ──
// Students need this: while a request is open their card cannot be confirmed (it
// is disputed), so withdrawing is how they back out of a request they no longer
// want without waiting on an admin.
router.post('/:id/withdraw', async (req, res) => {
  const idErr = uuid(req.params.id, 'Request ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const token = req.query.token || req.body?.token
  if (!token) return res.status(401).json({ error: 'Token required.' })
  const studentId = await verifyStudentToken(token)
  if (!studentId) return res.status(403).json({ error: 'Invalid or expired token.' })

  const { data: request, error: findErr } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (findErr) return res.status(500).json({ error: 'Failed to load request.' })
  if (!request) return res.status(404).json({ error: 'Request not found.' })

  const { error } = await withdrawCorrectionRequest({ request, studentId })
  if (error) return res.status(400).json({ error })

  const { data: updated } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  res.json({ request: updated })
})

// ── ADMIN: the queue ──
router.get('/', requireAdmin, async (req, res) => {
  const status = req.query.status || 'pending'
  if (status !== 'all' && !STATUSES.includes(status))
    return res.status(400).json({ error: `status must be one of: ${[...STATUSES, 'all'].join(', ')}` })

  const limit = Math.min(parseInt(req.query.limit) || 100, 200)

  let query = supabase
    .from('correction_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') query = query.eq('status', status)

  const { data: requests, error, count } = await query
  if (error) {
    logger.warn({ err: error.message }, 'corrections queue lookup failed')
    return res.status(500).json({ error: 'Failed to load correction requests.' })
  }

  const rows = requests || []

  // Student identity is joined here rather than through a PostgREST embed: the FK
  // points at students(student_id), a non-PK-of-the-relation target whose embed
  // shape (object vs array) is not worth depending on for a name in a list.
  const ids = [...new Set(rows.map((r) => r.student_id))]
  let studentMap = new Map()
  if (ids.length) {
    const { data: students } = await supabase
      .from('students')
      .select('student_id, full_name, year_level, programme, status')
      .in('student_id', ids)
    studentMap = new Map((students || []).map((s) => [s.student_id, s]))
  }

  let pendingCount = count
  if (status !== 'pending') {
    const { count: pc } = await supabase
      .from('correction_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    pendingCount = pc || 0
  }

  res.json({
    requests: rows.map((r) => ({ ...r, student: studentMap.get(r.student_id) || null })),
    total: count || 0,
    pending_count: pendingCount,
  })
})

// ── ADMIN: approve (apply the requested values) ──
router.post('/:id/approve', requireAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Request ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const force = req.body?.force === true || req.body?.force === 'true'
  const note = req.body?.note
  if (note !== undefined && note !== null && typeof note !== 'string')
    return res.status(400).json({ error: 'note must be text.' })
  const noteErr = maxLength(note, MAX_ADMIN_NOTE_LENGTH, 'note')
  if (noteErr) return res.status(400).json({ error: noteErr })

  const { data: request, error: findErr } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (findErr) return res.status(500).json({ error: 'Failed to load request.' })
  if (!request) return res.status(404).json({ error: 'Request not found.' })
  if (request.status !== 'pending')
    return res.status(400).json({ error: `This request was already ${request.status}.` })

  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', request.student_id)
    .maybeSingle()
  if (studentErr) return res.status(500).json({ error: 'Failed to load student.' })
  if (!student) {
    // The record was deleted after the request was filed; close it so it stops
    // occupying the queue.
    await supabase
      .from('correction_requests')
      .update({ status: 'rejected', admin_note: 'Student record no longer exists.', reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', request.id)
    return res.status(410).json({ error: 'This student record no longer exists — the request was closed.' })
  }

  const result = await applyCorrectionRequest({ request, student, force, adminId: req.user.id })

  if (result.conflicts?.length) {
    return res.status(409).json({
      error: `The record changed since this was requested: ${result.conflicts
        .map((f) => f.label)
        .join(', ')}. Approving now would overwrite that change.`,
      conflicts: result.conflicts.map((f) => ({
        key: f.key,
        label: f.label,
        requested: f.to ?? null,
        current: student[f.key] ?? null,
      })),
    })
  }
  if (result.stale) {
    return res.status(409).json({ error: 'The record changed while this was being approved. Reload the queue and check it again.' })
  }
  if (result.error) return res.status(400).json({ error: result.error })

  const { data: updated } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', request.student_id)
    .maybeSingle()

  // The student's history records the correction as applied — this is the row
  // routes/analytics.js counts, and the "X corrected to: Y" wording is what that
  // endpoint still matches on for pre-sql/015 rows.
  await logStudentActivity({
    studentId: request.student_id,
    action: 'self_corrected',
    note: result.activityNote.slice(0, MAX_ACTIVITY_NOTE_LENGTH),
    details: {
      fields: result.appliedFields,
      student_note: request.student_note || null,
      applied_via: 'correction_request',
      request_id: request.id,
    },
  })

  await logAdminAction(req, 'correction_approve', {
    targetType: 'student',
    targetId: request.student_id,
    details: {
      request_id: request.id,
      fields: result.appliedFields.map((f) => f.key),
      forced: force === true,
      note: note || null,
    },
  })

  const { data: approved } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', request.id)
    .maybeSingle()

  res.json({ student: updated, request: approved })

  enqueueImport(async () => {
    if (result.yearLevelChanged && updated) {
      try {
        const { migrateStudentFiles } = require('./students')
        await migrateStudentFiles(request.student_id, result.oldYearLevel, result.newYearLevel)
      } catch (err) {
        logger.warn({ studentId: request.student_id, err: err.message }, 'Correction approve: file migration failed')
      }
      try {
        const { deleteQRFile } = require('./qr')
        await deleteQRFile(request.student_id, result.oldYearLevel)
      } catch (err) {
        logger.warn({ studentId: request.student_id, err: err.message }, 'Correction approve: QR deletion failed')
      }
    }
    if (updated) {
      try {
        await getQRGenerator()(updated)
      } catch (err) {
        logger.warn({ studentId: request.student_id, err: err.message }, 'Correction approve: QR regeneration failed')
      }
    }
  })
})

// ── ADMIN: reject ──
// The note is not decoration: it is the only thing the student sees about why
// their name or year level stayed as it was, and it is stored on the request.
router.post('/:id/reject', requireAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Request ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const { note } = req.body || {}
  if (note !== undefined && note !== null && typeof note !== 'string')
    return res.status(400).json({ error: 'note must be text.' })
  const noteErr = maxLength(note, MAX_ADMIN_NOTE_LENGTH, 'note')
  if (noteErr) return res.status(400).json({ error: noteErr })

  const { data: request, error: findErr } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (findErr) return res.status(500).json({ error: 'Failed to load request.' })
  if (!request) return res.status(404).json({ error: 'Request not found.' })
  if (request.status !== 'pending')
    return res.status(400).json({ error: `This request was already ${request.status}.` })

  const { error } = await rejectCorrectionRequest({ request, adminId: req.user.id, note })
  if (error) return res.status(400).json({ error })

  await logAdminAction(req, 'correction_reject', {
    targetType: 'student',
    targetId: request.student_id,
    details: { request_id: request.id, fields: (request.fields || []).map((f) => f?.key), note: note || null },
  })

  const { data: updated } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', request.id)
    .maybeSingle()
  res.json({ request: updated })
})

module.exports = router
