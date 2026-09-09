import { describe, it, expect } from 'vitest'

const {
  CORRECTION_LABELS,
  MAX_STUDENT_NOTE_LENGTH,
  appliedActivityNoteFor,
  buildCorrectionReport,
  joinList,
  sanitizeStudentNote,
} = require('../utils/corrections')

const student = () => ({
  student_id: 'STU-001',
  full_name: 'Ama Serwah Boateng',
  year_level: '2nd Year',
  position: null,
  blood_type: 'O+',
  programme: 'Nursing',
  student_email: 'ama@example.test',
  emergency_contact_name: 'Kwame Boateng',
  emergency_contact_phone: '0244000111',
  date_of_birth: '2003-04-01',
  current_address: 'North Campus, Hall 4',
})

const report = (overrides = {}) => buildCorrectionReport({ student: student(), ...overrides })

describe('sanitizeStudentNote', () => {
  it('collapses the newlines and repeated spaces a textarea produces', () => {
    expect(sanitizeStudentNote('  my\n\tname  is   wrong \n ')).toBe('my name is wrong')
  })

  it('returns "" for anything that is not a usable string', () => {
    expect(sanitizeStudentNote(undefined)).toBe('')
    expect(sanitizeStudentNote(null)).toBe('')
    expect(sanitizeStudentNote('   ')).toBe('')
    expect(sanitizeStudentNote({ note: 'x' })).toBe('')
  })

  it('caps at the documented length', () => {
    expect(sanitizeStudentNote('x'.repeat(900))).toHaveLength(MAX_STUDENT_NOTE_LENGTH)
  })
})

describe('joinList', () => {
  it('reads as prose at every length', () => {
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a and b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c')
    expect(joinList([])).toBe('')
  })
})

describe('buildCorrectionReport — what counts as a request', () => {
  it('reports each field the student asked about, with the value they saw', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng', year_level: '3rd Year' } })
    expect(r.fields).toEqual(['full_name', 'year_level'])
    expect(r.changes[0]).toMatchObject({ from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' })
    // "asked to", not "corrected": nothing has happened to the record yet.
    expect(r.summary).toBe('Ama Serwah Boateng (STU-001) asked to correct their full name and year level')
  })

  it('ignores a submitted value that matches what is on the record', () => {
    const r = report({ corrections: { full_name: 'Ama Serwah Boateng' } })
    expect(r.hasChanges).toBe(false)
    expect(r.hasAnything).toBe(false)
  })

  it('treats padding as no difference, so the admin is not told about noise', () => {
    expect(report({ corrections: { full_name: '  Ama Serwah Boateng  ' } }).hasChanges).toBe(false)
  })

  it('keeps the card-field order an admin scans, regardless of submission order', () => {
    const r = report({
      corrections: { year_level: '3rd Year', full_name: 'Ama Serwaa Boateng' },
      qrCorrections: { emergency_contact_phone: '0209888777', blood_type: 'A+' },
    })
    expect(r.fields).toEqual(['full_name', 'year_level', 'blood_type', 'emergency_contact_phone'])
  })

  it('counts clearing a field as a request, and says so as "(blank)" in the log', () => {
    const r = report({ qrCorrections: { current_address: '' } })
    expect(r.changes).toEqual([{ key: 'current_address', label: 'current address', from: 'North Campus, Hall 4', to: null }])
    expect(r.updates).toEqual({ current_address: null })
    expect(r.requestActivityNote).toBe('Current address: North Campus, Hall 4 → (blank)')
  })

  it('produces exactly the patch approval will write', () => {
    const r = report({ corrections: { full_name: '  Ama Serwaa Boateng ' }, qrCorrections: { programme: 'Medicine' } })
    expect(r.updates).toEqual({ full_name: 'Ama Serwaa Boateng', programme: 'Medicine' })
  })

  it('ignores keys nobody owns', () => {
    expect(report({ corrections: { status: 'confirmed', role: 'admin' } }).hasChanges).toBe(false)
  })
})

describe('buildCorrectionReport — asking and applying are different events', () => {
  it('describes the ask as a before → after, not as a change made', () => {
    const r = report({ corrections: { year_level: '3rd Year' } })
    expect(r.requestActivityNote).toBe('Year: 2nd Year → 3rd Year')
    expect(r.appliedActivityNote).toBe('Year corrected to: 3rd Year')
  })

  it('keeps the "X corrected to: Y" prefix that routes/analytics.js counts for the applied row only', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    expect(r.appliedActivityNote).toContain('Name corrected to:')
    expect(r.requestActivityNote).not.toContain('corrected to:')
  })

  it('rebuilds the applied line from the subset an admin actually applied', () => {
    const applied = [{ key: 'full_name', label: 'full name', from: 'A', to: 'B' }]
    expect(appliedActivityNoteFor(applied, 'typo')).toBe('Name corrected to: B | Requested by student: “typo”')
    expect(appliedActivityNoteFor([], null)).toBe('')
  })

  it('is quoted last in the log line so truncation cannot eat a field', () => {
    const r = report({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      studentNote: 'x'.repeat(MAX_STUDENT_NOTE_LENGTH),
    })
    expect(r.requestActivityNote.startsWith('Name:')).toBe(true)
    expect(r.requestActivityNote).toContain('Note from student: “')
  })

  it('does not let a student talking about a name be counted as a correction', () => {
    const r = report({ studentNote: 'Name corrected to: somebody else' })
    expect(r.hasChanges).toBe(false)
    expect(r.details.fields).toEqual([])
  })
})

describe('buildCorrectionReport — the student note', () => {
  it('standalone, it still reaches an admin — that is the complaint itself', () => {
    const r = report({ studentNote: 'the name on my card is not mine' })
    expect(r.notifications.correctionRequest.title).toBe('Details query')
    expect(r.notifications.correctionRequest.message).toBe(
      'Ama Serwah Boateng (STU-001) asked LMSA to review their details',
    )
    expect(r.notifications.photoIssue).toBe(null)
  })

  it('travels on the photo notification when a photo report is all there is', () => {
    const r = report({ photoIssue: true, studentNote: 'that is not my photo' })
    expect(r.notifications.correctionRequest).toBe(null)
    expect(r.notifications.photoIssue.details.student_note).toBe('that is not my photo')
    expect(r.notifications.photoIssue.messageWithNote).toContain('“that is not my photo”')
  })

  it('is shown once when both notifications go out', () => {
    const r = report({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      photoIssue: true,
      studentNote: 'wrong name, wrong photo',
    })
    expect(r.notifications.correctionRequest.details.student_note).toBe('wrong name, wrong photo')
    expect(r.notifications.photoIssue.details.student_note).toBe(null)
    expect(r.notifications.photoIssue.message).not.toContain('wrong name, wrong photo')
  })

  it('only appears inside `message` when there is nothing else to render it', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' }, studentNote: 'missing an a' })
    expect(r.notifications.correctionRequest.message).toBe(
      'Ama Serwah Boateng (STU-001) asked to correct their full name',
    )
    expect(r.notifications.correctionRequest.messageWithNote).toBe(
      'Ama Serwah Boateng (STU-001) asked to correct their full name — note: “missing an a”',
    )
  })
})

describe('buildCorrectionReport — what the request carries', () => {
  it('marks itself pending, which is what the admin queue and the student see', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    expect(r.notifications.correctionRequest.details.status).toBe('pending')
  })

  it('says what happened for a photo report instead of reusing the detail line', () => {
    const r = report({ photoIssue: true })
    expect(r.notifications.photoIssue.message).toBe(
      'Ama Serwah Boateng (STU-001) reported that the photo on their card is wrong',
    )
  })

  it('pairs with the photo notification without absorbing it', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' }, photoIssue: true })
    expect(r.notifications.correctionRequest.message).toContain('asked to correct their full name')
    expect(r.notifications.photoIssue).not.toBe(null)
    // ...and still cross-references it, so an admin who opens the student from
    // either notification learns a re-shoot is needed too.
    expect(r.notifications.correctionRequest.details.photo_issue_reported).toBe(true)
    expect(report({ corrections: { full_name: 'Ama Serwaa Boateng' } }).notifications.correctionRequest.details.photo_issue_reported).toBe(false)
  })

  it('labels every requestable field, lowercase for mid-sentence use', () => {
    const keys = Object.keys(CORRECTION_LABELS)
    expect(keys.length).toBeGreaterThan(9)
    for (const [key, label] of Object.entries(CORRECTION_LABELS)) {
      expect(label, key).toBe(label.toLowerCase())
      expect(label.length, key).toBeGreaterThan(0)
    }
  })

  it('falls back to the student id when a record has no name to show', () => {
    const r = buildCorrectionReport({ student: { student_id: 'STU-042' }, corrections: { year_level: '4th Year' } })
    expect(r.notifications.correctionRequest.message).toBe('STU-042 asked to correct their year level')
  })
})
