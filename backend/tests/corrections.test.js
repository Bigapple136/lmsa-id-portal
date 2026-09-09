import { describe, it, expect } from 'vitest'

const {
  CORRECTION_LABELS,
  MAX_STUDENT_NOTE_LENGTH,
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

describe('buildCorrectionReport — what counts as a correction', () => {
  it('reports each field the student actually moved, with its before value', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng', year_level: '3rd Year' } })
    expect(r.fields).toEqual(['full_name', 'year_level'])
    expect(r.changes[0]).toMatchObject({ from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' })
    expect(r.summary).toBe('Ama Serwah Boateng (STU-001) corrected their full name and year level')
  })

  it('ignores a submitted value that matches what is on the record', () => {
    const r = report({ corrections: { full_name: 'Ama Serwah Boateng' } })
    expect(r.hasChanges).toBe(false)
    expect(r.hasAnything).toBe(false)
  })

  it('treats padding as no difference, so the admin is not told about noise', () => {
    const r = report({ corrections: { full_name: '  Ama Serwah Boateng  ' } })
    expect(r.hasChanges).toBe(false)
  })

  it('keeps the card-field order an admin scans, regardless of submission order', () => {
    const r = report({
      corrections: { year_level: '3rd Year', full_name: 'Ama Serwaa Boateng' },
      qrCorrections: { emergency_contact_phone: '0209888777', blood_type: 'A+' },
    })
    expect(r.fields).toEqual(['full_name', 'year_level', 'blood_type', 'emergency_contact_phone'])
  })

  it('counts clearing a field as a change, and says so as "(blank)" in the log', () => {
    const r = report({ qrCorrections: { current_address: '' } })
    expect(r.changes).toEqual([{ key: 'current_address', label: 'current address', from: 'North Campus, Hall 4', to: null }])
    expect(r.details.fields[0].to).toBe(null)
    expect(r.activityNote).toBe('Current address corrected to: (blank)')
  })

  it('ignores keys nobody owns', () => {
    const r = report({ corrections: { status: 'confirmed', role: 'admin' } })
    expect(r.hasChanges).toBe(false)
  })
})

describe('buildCorrectionReport — the student note', () => {
  it('is quoted last in the activity log so truncation cannot eat a field prefix', () => {
    const r = report({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      studentNote: 'x'.repeat(MAX_STUDENT_NOTE_LENGTH),
    })
    expect(r.activityNote.startsWith('Name corrected to:')).toBe(true)
    expect(r.activityNote).toContain('Note from student: “')
  })

  it('does not let a student talking about a name be counted as a name correction', () => {
    // routes/analytics.js falls back to matching "Name corrected to:" in the note
    // text only for rows without `details`; a structured row is authoritative.
    const r = report({ studentNote: 'Name corrected to: somebody else' })
    expect(r.hasChanges).toBe(false)
    expect(r.details.fields).toEqual([])
  })

  it('standalone, it still warrants a notification — that is the complaint itself', () => {
    const r = report({ studentNote: 'the card has my brother' })
    expect(r.notifications.selfCorrection.title).toBe('Detail issue reported')
    expect(r.notifications.selfCorrection.message).toBe(
      'Ama Serwah Boateng (STU-001) flagged a problem with their details',
    )
    expect(r.notifications.photoIssue).toBe(null)
  })

  it('travels on the photo notification when a photo report is all there is', () => {
    const r = report({ photoIssue: true, studentNote: 'that is not my photo' })
    expect(r.notifications.selfCorrection).toBe(null)
    expect(r.notifications.photoIssue.details.student_note).toBe('that is not my photo')
    expect(r.notifications.photoIssue.messageWithNote).toContain('“that is not my photo”')
  })

  it('is shown once when both notifications go out', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' }, photoIssue: true, studentNote: 'wrong name, wrong photo' })
    expect(r.notifications.selfCorrection.details.student_note).toBe('wrong name, wrong photo')
    expect(r.notifications.photoIssue.details.student_note).toBe(null)
    expect(r.notifications.photoIssue.message).not.toContain('wrong name, wrong photo')
  })

  it('only appears inside `message` when there is nothing else to render it', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' }, studentNote: 'missing an a' })
    expect(r.notifications.selfCorrection.message).toBe(
      'Ama Serwah Boateng (STU-001) corrected their full name',
    )
    expect(r.notifications.selfCorrection.messageWithNote).toBe(
      'Ama Serwah Boateng (STU-001) corrected their full name — note: “missing an a”',
    )
  })
})

describe('buildCorrectionReport — photo reports', () => {
  it('says what happened instead of reusing the generic detail-correction line', () => {
    const r = report({ photoIssue: true })
    expect(r.notifications.photoIssue.message).toBe(
      'Ama Serwah Boateng (STU-001) reported that the photo on their card is wrong',
    )
  })

  it('pairs with the correction notification without absorbing it', () => {
    const r = report({ corrections: { full_name: 'Ama Serwaa Boateng' }, photoIssue: true })
    expect(r.notifications.selfCorrection.message).toContain('corrected their full name')
    expect(r.notifications.photoIssue).not.toBe(null)
    // ...and still cross-references it, so an admin who opens the student from
    // either notification learns a re-shoot is needed too.
    expect(r.notifications.selfCorrection.details.photo_issue_reported).toBe(true)
    expect(report({ corrections: { full_name: 'Ama Serwaa Boateng' } }).notifications.selfCorrection.details.photo_issue_reported).toBe(false)
  })
})

describe('buildCorrectionReport — wording shared with the rest of the app', () => {
  it('labels every field a student can self-correct, lowercase for mid-sentence use', () => {
    const keys = Object.keys(CORRECTION_LABELS)
    expect(keys.length).toBeGreaterThan(9)
    for (const [key, label] of Object.entries(CORRECTION_LABELS)) {
      expect(label, key).toBe(label.toLowerCase())
      expect(label.length, key).toBeGreaterThan(0)
    }
  })

  it('falls back to the student id when a record has no name to show', () => {
    const r = buildCorrectionReport({ student: { student_id: 'STU-042' }, corrections: { year_level: '4th Year' } })
    expect(r.notifications.selfCorrection.message).toBe('STU-042 corrected their year level')
  })
})
