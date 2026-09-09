import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
const request = require('supertest')
const express = require('express')

const OLD_ENV = process.env

beforeAll(() => {
  // Dummy Supabase env so db.js can construct its client, plus a signing secret
  // so qr-keys mints the dev k_legacy fallback — the self-correct route is
  // public and gated on a signed student token, and the test needs a real one.
  process.env = {
    ...OLD_ENV,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    QR_SIGNING_SECRET: 'test-signing-secret-at-least-32-chars-long',
    NODE_ENV: 'test',
  }
})

afterAll(() => {
  process.env = OLD_ENV
})

// ── The reported problem ─────────────────────────────────────────────────────
// A student using the self-service correction flow produced a notification that
// said only "STU-001 requested corrections to their details". The admin could
// not tell which details, or why — and the student had nowhere to explain.
// These tests pin the fix: the notification names the fields that actually
// changed, carries the before/after values and the student's own note, and the
// activity-log row keeps the wording the analytics endpoint parses.

const state = {
  students: [],
  notifications: [],
  confirmations: [],
  detailsColumnExists: true, // flip to false to simulate sql/015 not being applied
  insertErrors: [],
}

const MISSING_COLUMN_ERROR = {
  code: '42703',
  message: 'column "details" of relation "notifications" does not exist',
}

function makeQuery(table) {
  const filters = { eq: {}, in: {} }
  let mode = 'select'
  let payload = null

  const rowsFor = () =>
    ({
      students: state.students,
      notifications: state.notifications,
      confirmations: state.confirmations,
      qr_keys: [],
    })[table] || []

  const applyFilters = (rows) =>
    rows.filter((r) => Object.entries(filters.eq).every(([k, v]) => r[k] === v))

  const resolve = () => {
    if (mode === 'insert') {
      if (!state.detailsColumnExists && payload?.details !== undefined && table !== 'qr_keys') {
        state.insertErrors.push(MISSING_COLUMN_ERROR)
        return { data: null, error: { ...MISSING_COLUMN_ERROR, message: MISSING_COLUMN_ERROR.message.replace('notifications', table) } }
      }
      const row = { id: `${table}-${state.notifications.length + state.confirmations.length}`, ...payload }
      if (table === 'notifications') state.notifications.push(row)
      else if (table === 'confirmations') state.confirmations.push(row)
      return { data: row, error: null }
    }
    if (mode === 'update') {
      const targets = applyFilters(rowsFor(table))
      targets.forEach((row) => Object.assign(row, payload))
      return { data: targets, error: null }
    }
    return { data: applyFilters(rowsFor(table)), error: null }
  }

  const q = {
    select: () => q,
    order: () => q,
    limit: () => q,
    eq: (col, val) => ((filters.eq[col] = val), q),
    in: (col, vals) => ((filters.in[col] = vals), q),
    insert: (row) => ((mode = 'insert'), (payload = row), q),
    update: (row) => ((mode = 'update'), (payload = row), q),
    delete: () => ((mode = 'delete'), q),
    maybeSingle: async () => {
      const { data, error } = resolve()
      const rows = Array.isArray(data) ? data : data ? [data] : []
      return { data: rows[0] ?? null, error }
    },
    single: async () => {
      const { data, error } = resolve()
      const rows = Array.isArray(data) ? data : data ? [data] : []
      return { data: rows[0] ?? null, error }
    },
    then: (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(resolve()).catch(onRejected),
  }
  return q
}

function buildApp() {
  // The router captures `supabase` from require('../db') at load time, so patch
  // the shared client in place (CJS requires are not intercepted by vi.mock in
  // this codebase's test setup). Same for the QR generator, which students.js
  // resolves lazily through require('./qr').
  const db = require('../db')
  db.supabase.from = (table) => makeQuery(table)
  require('../routes/qr').generateForStudent = async () => ({ qr_url: 'https://test/qr.png' })

  const app = express()
  app.use(express.json())
  app.use('/api/students', require('../routes/students'))
  return app
}

async function tokenFor(studentId) {
  const { signStudentToken } = require('../qr-keys')
  return signStudentToken(studentId)
}

// Notification inserts are deliberately fire-and-forget in the route, so let
// those microtasks land before asserting on them.
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => {
    setImmediate(r)
  })
}

function seedStudent(overrides = {}) {
  state.students = [
    {
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
      nationality: 'Ghanaian',
      county_of_origin: 'Accra',
      current_address: 'North Campus, Hall 4',
      status: 'pending',
      ...overrides,
    },
  ]
}

async function selfCorrect(body) {
  const token = await tokenFor('STU-001')
  const app = buildApp()
  return request(app)
    .patch(`/api/students/STU-001/self-correct?token=${encodeURIComponent(token)}`)
    .send(body)
}

describe('PATCH /api/students/:id/self-correct — what admins are told', () => {
  beforeEach(() => {
    state.students = []
    state.notifications = []
    state.confirmations = []
    state.detailsColumnExists = true
    state.insertErrors = []
    seedStudent()
  })

  it('names every field the student corrected, in the notification', async () => {
    const res = await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng', year_level: '3rd Year' },
      qr_corrections: { emergency_contact_phone: '0209888777' },
    })
    await settle()

    expect(res.status).toBe(200)
    expect(state.notifications).toHaveLength(1)
    const [notice] = state.notifications
    expect(notice.type).toBe('self_correction')
    expect(notice.message).toBe(
      'Ama Serwah Boateng (STU-001) corrected their full name, year level and emergency contact phone',
    )
  })

  it('carries structured before/after values so the panel can show them', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    const [notice] = state.notifications
    expect(notice.student_id).toBe('STU-001')
    expect(notice.details.fields).toEqual([
      { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
    ])
  })

  it('records the student note in the notification and the activity log', async () => {
    await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      student_note: 'my middle name was spelled wrong on the register',
    })
    await settle()

    const [notice] = state.notifications
    expect(notice.details.student_note).toBe('my middle name was spelled wrong on the register')

    const [log] = state.confirmations
    expect(log.action).toBe('self_corrected')
    // Field prefixes first and last-not-first: routes/analytics.js matches on
    // "Name corrected to:", and the note is what gets truncated if this is long.
    expect(log.note).toBe(
      'Name corrected to: Ama Serwaa Boateng | Note from student: “my middle name was spelled wrong on the register”',
    )
    expect(log.details.fields.map((f) => f.key)).toEqual(['full_name'])
  })

  it('does not claim a change the student did not actually make', async () => {
    const res = await selfCorrect({
      corrections: { full_name: 'Ama Serwah Boateng', year_level: '3rd Year' },
    })
    await settle()

    expect(res.status).toBe(200)
    expect(state.notifications[0].message).toBe('Ama Serwah Boateng (STU-001) corrected their year level')
    expect(res.body.year_level).toBe('3rd Year')
  })

  it('rejects a submission that changes nothing and explains why', async () => {
    const res = await selfCorrect({ corrections: { full_name: 'Ama Serwah Boateng' } })
    await settle()

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nothing to correct/i)
    expect(state.notifications).toHaveLength(0)
    expect(state.confirmations).toHaveLength(0)
  })

  it('notifies on a note alone, so "something is wrong" still reaches an admin', async () => {
    const res = await selfCorrect({ student_note: 'the name on my card is not mine' })
    await settle()

    expect(res.status).toBe(200)
    expect(state.notifications[0].title).toBe('Detail issue reported')
    expect(state.notifications[0].message).toBe(
      'Ama Serwah Boateng (STU-001) flagged a problem with their details',
    )
    expect(state.notifications[0].details.fields).toEqual([])
  })

  it('emits a separate notification for a photo report so it is not swallowed', async () => {
    const res = await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      photo_issue: true,
    })
    await settle()

    expect(res.status).toBe(200)
    const types = state.notifications.map((n) => n.type).sort()
    expect(types).toEqual(['photo_issue', 'self_correction'])
    const photo = state.notifications.find((n) => n.type === 'photo_issue')
    expect(photo.message).toBe('Ama Serwah Boateng (STU-001) reported that the photo on their card is wrong')
    // The note belongs to exactly one notification, so it is read once.
    expect(photo.details.student_note).toBe(null)
    expect(state.notifications.find((n) => n.type === 'self_correction').details.student_note).toBe(null)
    expect(state.students[0].status).toBe('photo_issue')
  })

  it('keeps the note visible on a photo-only report', async () => {
    await selfCorrect({ photo_issue: true, student_note: 'this is my cousin' })
    await settle()

    expect(state.notifications).toHaveLength(1) // no duplicate self_correction row
    const [photo] = state.notifications
    expect(photo.type).toBe('photo_issue')
    expect(photo.details.student_note).toBe('this is my cousin')
  })

  it('falls back to a self-sufficient message when details cannot be stored', async () => {
    state.detailsColumnExists = false
    await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      student_note: 'my name is missing an a',
    })
    await settle()

    // The notification must survive the missing column, note and all.
    expect(state.insertErrors.length).toBeGreaterThan(0)
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].message).toContain('note: “my name is missing an a”')
    expect(state.notifications[0].details).toBeUndefined()
  })

  it('rejects an over-long student note instead of truncating silently', async () => {
    const res = await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' }, student_note: 'x'.repeat(501) })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/student_note must be 500 characters or fewer/i)
  })

  it('rejects a non-string student note', async () => {
    const res = await selfCorrect({ student_note: { text: 'nope' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/must be text/i)
  })

  it('rejects a blood type the database would reject, with a readable message', async () => {
    const res = await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' }, qr_corrections: { blood_type: 'B' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/blood_type must be one of: A\+, A-/i)
    expect(state.notifications).toHaveLength(0)
  })

  it('still refuses a token issued for a different student', async () => {
    const { signStudentToken } = require('../qr-keys')
    const token = await signStudentToken('STU-999')
    const res = await request(buildApp()).patch('/api/students/STU-001/self-correct?token=' + token).send({
      corrections: { full_name: 'Hacked' },
    })
    expect(res.status).toBe(403)
    expect(state.students[0].full_name).toBe('Ama Serwah Boateng')
  })
})
