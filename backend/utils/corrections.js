// =============================================================================
// Self-service correction summaries
//
// The student preview page (frontend/src/pages/PreviewPage.jsx) lets a student
// fix their own record through PATCH /api/students/:id/self-correct. The
// correction is applied immediately — this is self-service, not an approval
// queue — so the notification to admins IS the review. It has to say which
// fields moved, or the admin has to open the record and diff it by hand.
//
// Before this module the notification read "…requested corrections to their
// details" no matter what the student changed, and a student had no way to say
// in their own words what looked wrong. Both are produced here from the
// submitted values compared against the stored row:
//
//   notifications.selfCorrection / notifications.photoIssue
//     One entry per admin-facing thing that happened, each with a
//     human-readable `message` that stands on its own in any text-only surface,
//     and `details` (JSONB) with the structured field list + the student's note
//     for the notification panel to render.
//   activityNote
//     The `confirmations.note` line, still in the "Name corrected to: X" form
//     that routes/analytics.js and older reads depend on.
//
// Field labels live here rather than being re-derived in the frontend, so the
// admin sees exactly the wording the notification was written with.
// =============================================================================

// Fields a student may self-correct, and how each is named in a sentence.
// full_name/year_level/position are card fields; the rest are QR-payload
// fields — the same set VALID_QR_FIELDS in routes/students.js accepts.
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

// The order an admin scans a card in. Also keeps the reported field order
// stable no matter what order the submitted JSON keys arrived in, which matters
// because the activity-log line is truncated at the far end.
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
 * @param {object} opts.student         current students row (select('*') — the
 *                                      stored value of each editable column is
 *                                      what makes "from → to" possible)
 * @param {object} [opts.corrections]    card-field patch { full_name, year_level, position }
 * @param {object} [opts.qrCorrections] QR-field patch (keys validated by the caller)
 * @param {boolean} [opts.photoIssue]   student reported the photo is wrong
 * @param {string}  [opts.studentNote]  sanitized free-text note from the student
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
      // change — don't tell an admin a field moved when it didn't.
      if (!valuesDiffer(current[key], to)) continue
      changes.push({ key, label, from: current[key] ?? null, to })
    }
  }
  changes.sort((a, b) => FIELD_ORDER.indexOf(a.key) - FIELD_ORDER.indexOf(b.key))

  // null means "nothing there" in both directions — the panel labels those
  // "not set"/"cleared" rather than showing an empty string.
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

  const fields = changes.map((c) => c.key)
  // A note attached to a photo report belongs to that report — emitting a second
  // "flagged a problem with their details" row for the same submission would just
  // be the same complaint twice, with less on it.
  const selfCorrectionWarranted = hasChanges || (hasNote && !hasPhotoIssue)
  let selfCorrection = null
  if (selfCorrectionWarranted) {
    const action = hasChanges
      ? `corrected their ${joinList(changes.map((c) => c.label))}`
      : 'flagged a problem with their details'
    const message = `${who} ${action}`
    selfCorrection = {
      type: 'self_correction',
      title: hasChanges ? 'Detail correction' : 'Detail issue reported',
      message,
      messageWithNote: withNote(message),
      student_id: current.student_id ?? null,
      details: {
        fields: fieldDetails,
        student_note: note || null,
        // Separate notifications, same submission — the student editor uses
        // this to mention the re-shoot even when opened from this row.
        photo_issue: false,
        photo_issue_reported: hasPhotoIssue,
      },
    }
  }

  let photoIssueNotice = null
  if (hasPhotoIssue) {
    const message = `${who} reported that the photo on their card is wrong`
    // The student's note belongs to whichever notification would otherwise say
    // least, and it must not be shown twice for one submission.
    const carriesNote = !selfCorrection
    photoIssueNotice = {
      type: 'photo_issue',
      title: 'Photo issue',
      message,
      messageWithNote: carriesNote ? withNote(message) : message,
      student_id: current.student_id ?? null,
      details: {
        fields: [],
        student_note: carriesNote ? note : null,
        photo_issue: true,
      },
    }
  }

  // Activity-log line. "X corrected to: Y" prefixes first, student note last:
  // the caller truncates this at MAX_NOTE_LENGTH, and the prefixes are what
  // routes/analytics.js matches on for rows written before confirmations had
  // `details`.
  const activityNote = [
    ...changes.map((c) => `${LOG_LABELS[c.key] || c.label} corrected to: ${c.to ?? '(blank)'}`),
    ...(hasPhotoIssue ? ['Student reported incorrect photo.'] : []),
    ...(hasNote ? [`Note from student: “${note}”`] : []),
  ].join(' | ')

  return {
    changes,
    fields,
    hasChanges,
    hasNote,
    hasPhotoIssue,
    // Nothing changed, no note, no photo report: not a correction at all, and
    // the student should hear that instead of a cheerful no-op.
    hasAnything: hasChanges || hasNote || hasPhotoIssue,
    who,
    summary: selfCorrection?.message ?? photoIssueNotice?.message ?? `${who} submitted a correction with no changes`,
    activityNote,
    notifications: {
      selfCorrection,
      photoIssue: photoIssueNotice,
    },
    // The row stored on confirmations — the authoritative "what this student
    // changed" record, independent of which notifications made it to the feed.
    details: {
      fields: fieldDetails,
      student_note: note || null,
      photo_issue: hasPhotoIssue,
    },
  }
}

module.exports = {
  CORRECTION_LABELS,
  LOG_LABELS,
  MAX_STUDENT_NOTE_LENGTH,
  buildCorrectionReport,
  joinList,
  sanitizeStudentNote,
}
