// =============================================================================
// Correction-request lifecycle
//
// The student files an ask; an admin decides. Both halves live here so the
// rules cannot drift between the public endpoint (routes/students.js) and the
// admin queue (routes/corrections.js):
//
//   file → at most ONE open request per student, replacing the previous one
//   approve → compare-and-set against the value the student saw, so a change an
//     admin made in the meantime is never silently overwritten
//   reject / withdraw → close the request with a reason the student can read
//
// Every write here is deliberately separated by consequence: the request row is
// the state machine, `confirmations` is the student's history, `notifications` is
// the admin's feed. A failure in the latter two must never undo the former — the
// student's ask is the thing that must survive.
// =============================================================================

const { supabase } = require('../db')
const logger = require('../logger')
const { emitNotification, logStudentActivity } = require('./notificationLog')
const { appliedActivityNoteFor, CORRECTION_LABELS } = require('./corrections')

// confirmations.note and student_submissions.admin_notes are unbounded TEXT, but
// every other writer of those columns caps at 1000 (see routes/confirmations.js),
// so the correction paths match instead of inventing a second ceiling.
const MAX_ACTIVITY_NOTE_LENGTH = 1000
const MAX_ADMIN_NOTE_LENGTH = 1000

function isUniqueViolation(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message || '')
}

/**
 * Record what a self-correction submission means.
 *
 * Two different things can come out of one submission, and they are handled
 * differently on purpose:
 *
 *   a request to change field values → one `correction_requests` row, which an
 *     admin approves before the record moves. Filing again REPLACES the open one
 *     (the student is editing their ask, not queueing a duplicate) — the
 *     `correction_requests_one_open_per_student` partial unique index makes "at
 *     most one" true under concurrent submits, and the retry below is what turns
 *     that violation into the update the student meant.
 *   a photo report → no request row at all. There is nothing to approve: the
 *     student cannot upload a replacement, so this is a note to LMSA to arrange a
 *     re-shoot, and it takes effect on submit like it always has.
 *
 * Also downgrades a card from 'confirmed' once the student says it is wrong — a
 * record cannot be both confirmed and disputed — while leaving an admin-raised
 * 'issue'/'photo_issue' state alone, because that state is the office's, not the
 * student's to clear.
 */
async function fileCorrectionRequest({ student, studentId, report }) {
  const wantsFieldChanges = report.hasChanges || (report.hasNote && !report.hasPhotoIssue)
  let request = null

  if (wantsFieldChanges) {
    const row = {
      student_id: studentId,
      status: 'pending',
      fields: report.details.fields,
      student_note: report.details.student_note,
    }

    let inserted = await supabase.from('correction_requests').insert(row).select().maybeSingle()
    request = inserted.data
    if (isUniqueViolation(inserted.error)) {
      const { data: open } = await supabase
        .from('correction_requests')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'pending')
        .maybeSingle()
      if (open?.id) {
        const replaced = await supabase
          .from('correction_requests')
          .update({ ...row, reviewed_by: null, reviewed_at: null, admin_note: null })
          .eq('id', open.id)
          .select()
          .maybeSingle()
        request = replaced.data
        inserted = { error: replaced.error }
      }
    }
    if (inserted.error) {
      logger.error({ err: inserted.error.message, studentId }, 'Failed to file correction request')
      return { error: 'Could not save your correction request. Please try again.' }
    }
  }

  if (report.hasPhotoIssue) {
    await logStudentActivity({
      studentId,
      action: 'photo_issue',
      note: [
        'Student reported incorrect photo.',
        ...(report.hasNote ? [`Note from student: “${report.details.student_note}”`] : []),
      ].join(' | '),
    })
    await supabase.from('students').update({ status: 'photo_issue' }).eq('student_id', studentId)
  } else if (wantsFieldChanges && student.status === 'confirmed') {
    await supabase.from('students').update({ status: 'pending' }).eq('student_id', studentId)
  }

  if (request && report.requestActivityNote) {
    await logStudentActivity({
      studentId,
      action: 'correction_requested',
      note: report.requestActivityNote.slice(0, MAX_ACTIVITY_NOTE_LENGTH),
      details: { ...report.details, status: request.status },
    })
  }

  for (const notice of [report.notifications.correctionRequest, report.notifications.photoIssue]) {
    if (!notice) continue
    // The request's own id rides along so an admin clicking the notification lands
    // on that row in the queue rather than on a guess by student id.
    const details =
      request && notice === report.notifications.correctionRequest
        ? { ...(notice.details || {}), request_id: request.id }
        : notice.details
    emitNotification({
      type: notice.type,
      title: notice.title,
      message: notice.message,
      messageWithNote: notice.messageWithNote,
      studentId,
      details,
    }).catch((err) =>
      logger.warn({ err: err?.message, type: notice.type }, `${notice.type} notification failed`),
    )
  }

  return { request }
}

/**
 * Apply an approved request to the student's record.
 *
 * The write is a compare-and-set: each field is only updated if it still holds
 * the value the student saw when they asked. Without that, approving a two-week-
 * old request silently rolls back whatever an admin changed in between — the
 * exact class of bug gating is supposed to remove. `force` is the admin's explicit
 * "apply it anyway", after they have been shown what moved.
 */
async function applyCorrectionRequest({ request, student, force = false, adminId = null }) {
  // The keys are re-checked against the requestable set on the way out, not just
  // on the way in: a row filed by an older build (or edited directly) must not be
  // able to turn an approval into a write to `status`, `student_id`, or any other
  // column the student was never offered.
  const fields = (Array.isArray(request.fields) ? request.fields : [])
    .filter((f) => f?.key && Object.prototype.hasOwnProperty.call(CORRECTION_LABELS, f.key))
    .map((f) => ({ ...f, label: f.label || CORRECTION_LABELS[f.key] }))
  if (!fields.length) return { error: 'This request has no field changes to apply.' }

  const updates = {}
  for (const f of fields) updates[f.key] = f.to ?? null

  // A corrected card has to be re-confirmed by the student.
  if (student.status === 'confirmed') updates.status = 'pending'

  const matchesCurrent = (f) => {
    const stored = student[f.key]
    const expected = f.from === null || f.from === undefined ? '' : String(f.from).trim()
    return (stored === null || stored === undefined ? '' : String(stored).trim()) === expected
  }

  const conflicts = fields.filter((f) => !matchesCurrent(f))
  if (conflicts.length && !force) return { conflicts, error: null }

  let query = supabase.from('students').update(updates).eq('student_id', request.student_id)
  if (!force) {
    // Guarded so a concurrent edit lands as "0 rows" (handled below) rather than
    // as an overwrite. With `force` the admin has already seen the diff, so the
    // guard is dropped deliberately.
    for (const f of fields) {
      query =
        f.from === null || f.from === undefined
          ? query.is(f.key, null)
          : query.eq(f.key, String(f.from).trim())
    }
  }
  query = query.select('student_id')

  const { data: written, error } = await query
  if (error) return { error: error.message }

  if (!force && !written?.length) {
    // Someone edited the record between the read above and this write. Re-read
    // and report, rather than retrying blind — the admin decides.
    const { data: fresh } = await supabase.from('students').select('*').eq('student_id', request.student_id).maybeSingle()
    return { stale: true, student: fresh, error: null }
  }

  await markRequestReviewed({ request, status: 'approved', adminId, adminNote: null })

  const yearField = fields.find((f) => f.key === 'year_level')
  return {
    appliedFields: fields,
    // The route carries the follow-up work that touches storage: photos/signature
    // move between year folders and the QR payload has to be re-issued.
    yearLevelChanged: Boolean(yearField),
    oldYearLevel: student.year_level,
    newYearLevel: yearField ? yearField.to ?? null : student.year_level,
    activityNote: appliedActivityNoteFor(fields, request.student_note),
  }
}

async function markRequestReviewed({ request, status, adminId, adminNote }) {
  const patch = {
    status,
    reviewed_by: adminId || null,
    reviewed_at: new Date().toISOString(),
  }
  if (adminNote !== undefined && adminNote !== null) {
    patch.admin_note = String(adminNote).slice(0, MAX_ADMIN_NOTE_LENGTH)
  }
  const { error } = await supabase.from('correction_requests').update(patch).eq('id', request.id)
  if (error) logger.error({ err: error.message, requestId: request.id }, `Failed to mark request ${status}`)
  return { error }
}

/** Close a request without applying it. The reason is what the student reads. */
async function rejectCorrectionRequest({ request, adminId, note }) {
  const clean = typeof note === 'string' ? note.replace(/\s+/g, ' ').trim() : ''
  const { error } = await markRequestReviewed({
    request,
    status: 'rejected',
    adminId,
    adminNote: clean || null,
  })
  if (error) return { error: error.message }
  return {}
}

/** The student closes their own open request — only their own, only while open. */
async function withdrawCorrectionRequest({ request, studentId }) {
  if (!request) return { error: 'Request not found.' }
  if (request.student_id !== studentId) return { error: 'This request belongs to another student.' }
  if (request.status !== 'pending')
    return { error: `This request was already ${request.status}.` }
  const { error } = await markRequestReviewed({
    request,
    status: 'withdrawn',
    adminId: null,
    adminNote: null,
  })
  if (error) return { error: error.message }
  return {}
}

module.exports = {
  fileCorrectionRequest,
  applyCorrectionRequest,
  rejectCorrectionRequest,
  withdrawCorrectionRequest,
  markRequestReviewed,
  MAX_ADMIN_NOTE_LENGTH,
}
