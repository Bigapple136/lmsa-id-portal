// =============================================================================
// Correction-request summaries
//
// The student preview page (frontend/src/pages/PreviewPage.jsx) lets a student
// ask for their record to be fixed through PATCH /api/students/:id/self-correct.
// As of sql/016 that writes a `correction_requests` row, not the record: a signed
// preview token proves who the student is, it does not authorise them to move
// year level, change programme or rewrite an emergency contact. An admin approves
// or rejects, and only approval writes to `students`.
//
// This module turns what a student submitted into the three things the rest of the
// system needs, all computed against the stored row so nothing is trusted from the
// client:
//
//   fields / updates
//     Which key, from what, to what — the diff the admin queue renders, and the
//     patch approval applies. `from` is what the student saw, which is also what
//     approval compares the live record against before writing.
//   notifications
//     One entry per admin-facing thing in the submission, each with a
//     human-readable `message` that stands alone in any text-only surface, and
//     `details` (JSONB) for the panel.
//   requestActivityNote / appliedActivityNote
//     The student's `confirmations` line, in the two flavours the split created:
//     asking for a change and having it applied are different events, and
//     "X corrected to: Y" belongs to the latter (routes/analytics.js counts those).
//
// Field labels live here rather than being re-derived in the frontend, so the
// wording an admin reads in the feed, the queue and the log is one definition.
// =============================================================================

// Fields a student may ask to change, and how each is named in a sentence.
// full_name/year_level/position are card fields; the rest are QR-payload fields
// — the same set VALID_QR_FIELDS in routes/students.js accepts. Every one of
// these is gated by approval now; none of them is considered too sensitive to
// let a student *ask* about.
const CORRECTION_LABELS = {
  full_name: 'full name',
  year_level: 'year level',
  position: 'position',
  blood_type: 'blood type',
  programme: 'programme',
  student_email: 'email',
  emergency_contact_name: 'emergency contact name',
  emergency_contact_phone: 'emergency contact phone',
  date_of_birth: 'date of birth',
  nationality: 'nationality',
  county_of_origin: 'county of origin',
  current_address: 'current address',
}

// Sentence-case labels for the activity-log line; the lowercase ones above read
// oddly at the start of a fragment.
const LOG_LABELS = {
  full_name: 'Name',
  year_level: 'Year',
  position: 'Position',
  blood_type: 'Blood type',
  programme: 'Programme',
  student_email: 'Student email',
  emergency_contact_name: 'Emergency contact name',
  emergency_contact_phone: 'Emergency contact phone',
  date_of_birth: 'Date of birth',
  nationality: 'Nationality',
  county_of_origin: 'County of origin',
  current_address: 'Current address',
}

// The order an admin scans a card in. Also keeps the reported field order stable
// no matter what order the submitted JSON keys arrived in, which matters because
// the activity-log line is truncated at the far end.
const FIELD_ORDER = Object.keys(CORRECTION_LABELS)

const MAX_STUDENT_NOTE_LENGTH = 500

/** Collapse whitespace runs and cap length. Returns '' when there is no note. */
function sanitizeStudentNote(raw) {
  if (typeof raw !== 'string') return ''
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.slice(0, MAX_STUDENT_NOTE_LENGTH)
}

/** "a" / "a and b" / "a, b and c" — no Oxford comma, this reads as prose. */
function joinList(items) {
  const list = (items || []).filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

function valuesDiffer(from, to) {
  const a = from === null || from === undefined ? '' : String(from).trim()
  const b = to === null || to === undefined ? '' : String(to).trim()
  return a !== b
}

/**
 * Compare what the student submitted against the stored row and describe the
 * difference in every form the rest of the system needs.
 *
 * @param {object} opts
 * @param {object} opts.student          current students row (select('*') — the
 *                                       stored value of each editable column is
 *                                       what makes "from → to" possible)
 * @param {object} [opts.corrections]    card-field patch { full_name, year_level, position }
 * @param {object} [opts.qrCorrections]  QR-field patch (keys validated by the caller)
 * @param {boolean} [opts.photoIssue]    student reported the photo is wrong
 * @param {string}  [opts.studentNote]    sanitized free-text note from the student
 */
function buildCorrectionReport({
  student,
  corrections = {},
  qrCorrections = {},
  photoIssue = false,
  studentNote = '',
} = {}) {
  const current = student || {}
  const note = sanitizeStudentNote(studentNote)

  const changes = []
  for (const source of [corrections, qrCorrections]) {
    for (const [key, value] of Object.entries(source || {})) {
      const label = CORRECTION_LABELS[key]
      if (!label) continue // callers validate keys; unknowns are never reported
      if (value === undefined) continue
      const to = value === null ? null : String(value).trim() || null
      // Something that resolves to the value already on the record is not a
      // request at all — no row, no notification, no admin's time.
      if (!valuesDiffer(current[key], to)) continue
      changes.push({ key, label, from: current[key] ?? null, to })
    }
  }
  changes.sort((a, b) => FIELD_ORDER.indexOf(a.key) - FIELD_ORDER.indexOf(b.key))

  // null means "nothing there" in both directions; the UI labels those
  // "not set"/"cleared" instead of showing an empty string.
  const fieldDetails = changes.map(({ key, label, from, to }) => ({
    key,
    label,
    from: from ?? null,
    to: to ?? null,
  }))

  const hasChanges = changes.length > 0
  const hasNote = Boolean(note)
  const hasPhotoIssue = Boolean(photoIssue)
  const who = current.full_name
    ? `${current.full_name} (${current.student_id})`
    : current.student_id || 'A student'

  // `message` is what the panel headlines with; `messageWithNote` is the same
  // sentence with the student's own words folded in. The pair exists because the
  // note normally renders in its own block out of `details` — but if `details`
  // can't be stored (sql/015 not applied yet), the retry swaps in the longer
  // message so the note is never silently dropped.
  const withNote = (message) => (hasNote ? `${message} — note: “${note}”` : message)

  // A note attached to a photo report belongs to that report: emitting a second
  // "review my details" row for the same submission would be the same complaint
  // twice, with less on it.
  const requestWarranted = hasChanges || (hasNote && !hasPhotoIssue)
  let correctionRequest = null
  if (requestWarranted) {
    const action = hasChanges
      ? `asked to correct their ${joinList(changes.map((c) => c.label))}`
      : 'asked LMSA to review their details'
    const message = `${who} ${action}`
    correctionRequest = {
      // 'self_correction' stays the notification type: it is an existing value in
      // the notifications.type CHECK and the feed filter already reads
      // "Self-Corrections". Wording is cheap to fix; a CHECK constraint is not.
      type: 'self_correction',
      title: hasChanges ? 'Correction request' : 'Details query',
      message,
      messageWithNote: withNote(message),
      student_id: current.student_id ?? null,
      details: {
        fields: fieldDetails,
        student_note: note || null,
        // Separate notifications, same submission — the student editor uses this
        // to mention the re-shoot even when opened from this row.
        photo_issue: false,
        photo_issue_reported: hasPhotoIssue,
        status: 'pending',
      },
    }
  }

  let photoIssueNotice = null
  if (hasPhotoIssue) {
    const message = `${who} reported that the photo on their card is wrong`
    const carriesNote = !correctionRequest
    photoIssueNotice = {
      type: 'photo_issue',
      title: 'Photo issue',
      message,
      messageWithNote: carriesNote ? withNote(message) : message,
      student_id: current.student_id ?? null,
      details: {
        fields: [],
        student_note: carriesNote ? note : null,
        // A photo report is not an edit and needs no approval: the student has no
        // way to upload a replacement, so this still takes effect on submit.
        photo_issue: true,
      },
    }
  }

  // Both log lines put the field detail first and the student's words last: the
  // caller truncates at MAX_NOTE_LENGTH, and a truncated line must never lose
  // which field was involved.
  // The photo clause is deliberately absent: a photo report gets its own
  // 'photo_issue' row, and repeating it here would read as two reports.
  const requestActivityNote = [
    ...fieldDetails.map((c) => `${LOG_LABELS[c.key] || c.label}: ${c.from ?? '(not set)'} → ${c.to ?? '(blank)'}`),
    ...(hasNote ? [`Note from student: “${note}”`] : []),
  ].join(' | ')

  const appliedActivityNote = [
    ...fieldDetails.map((c) => `${LOG_LABELS[c.key] || c.label} corrected to: ${c.to ?? '(blank)'}`),
    ...(hasNote ? [`Requested by student: “${note}”`] : []),
  ].join(' | ')

  return {
    changes,
    fields: changes.map((c) => c.key),
    // The patch approval writes. Values are already trimmed; null clears.
    updates: changes.reduce((acc, c) => ({ ...acc, [c.key]: c.to ?? null }), {}),
    hasChanges,
    hasNote,
    hasPhotoIssue,
    // Nothing changed, no note, no photo report: not a correction at all, and the
    // student should hear that instead of getting a cheerful no-op.
    hasAnything: hasChanges || hasNote || hasPhotoIssue,
    who,
    summary:
      correctionRequest?.message ??
      photoIssueNotice?.message ??
      `${who} submitted a correction with no changes`,
    requestActivityNote,
    appliedActivityNote,
    notifications: {
      correctionRequest,
      photoIssue: photoIssueNotice,
    },
    // What is stored on the request row — the authoritative record of the ask,
    // independent of which notifications made it to the feed.
    details: {
      fields: fieldDetails,
      student_note: note || null,
      photo_issue: hasPhotoIssue,
    },
  }
}

/**
 * The "X corrected to: Y" line for an approval, rebuilt from the fields actually
 * applied at that moment. Kept separate from buildCorrectionReport because
 * approval can legitimately apply a narrowed subset (if some fields had since
 * moved and the admin chose to skip them), and because routes/analytics.js counts
 * exactly these prefixes for rows written before `details` existed.
 */
function appliedActivityNoteFor(fields, studentNote) {
  const list = Array.isArray(fields) ? fields : []
  return [
    ...list.map((f) => `${LOG_LABELS[f?.key] || f?.label || f?.key} corrected to: ${f?.to ?? '(blank)'}`),
    ...(studentNote ? [`Requested by student: “${studentNote}”`] : []),
  ].join(' | ')
}

module.exports = {
  CORRECTION_LABELS,
  LOG_LABELS,
  MAX_STUDENT_NOTE_LENGTH,
  appliedActivityNoteFor,
  buildCorrectionReport,
  joinList,
  sanitizeStudentNote,
}
