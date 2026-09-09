import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
const request = require('supertest')
const express = require('express')

const OLD_ENV = process.env

beforeAll(() => {
  // Dummy Supabase env so db.js can construct its client, plus a signing secret
  // so qr-keys mints the dev k_legacy fallback — this route is public and gated
  // on a signed student token, so the test needs a real one.
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

// ── What this route is allowed to do ─────────────────────────────────────────
// It used to write the student's own record from a signed preview link: enough to
// move a student into another year level or rewrite their emergency contact with
// no human in the loop. The token identifies the student; it does not authorise
// them to edit enrollment data. So the contract now is: file a request, tell the
// admins what was asked, change nothing else (except the two things that are not
// edits — a photo report, and pulling a disputed card out of 'confirmed').

const { createDb, settle } = require('./helpers/inMemoryDb')
const db = createDb()

function buildApp() {
  // The routers capture `supabase` from require('../db') at load time, so patch
  // the shared client in place (CJS requires are not intercepted by vi.mock in
  // this codebase's test setup). The QR generator is resolved lazily by
  // students.js, so it can be stubbed directly.
  const dbModule = require('../db')
  dbModule.supabase.from = (table) => db.client.from(table)
  require('../routes/qr').generateForStudent = async () => ({ qr_url: 'https://test/qr.png' })

  const app = express()
  app.use(express.json())
  app.use('/api/students', require('../routes/students'))
  app.use('/api/corrections', require('../routes/corrections'))
  return app
}

const SEED_STUDENT = {
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
}

function seed(overrides = {}) {
  db.state.students = [{ ...SEED_STUDENT, ...overrides }]
  db.state.correction_requests = []
  db.state.confirmations = []
  db.state.notifications = []
  db.state.admin_actions = []
}

async function tokenFor(studentId) {
  const { signStudentToken } = require('../qr-keys')
  return signStudentToken(studentId)
}

async function selfCorrect(body) {
  const token = await tokenFor('STU-001')
  return request(buildApp())
    .patch(`/api/students/STU-001/self-correct?token=${encodeURIComponent(token)}`)
    .send(body)
}

// Migration-simulation flags are module state, so they are reset for every test in
// this file — a leak from one describe into the next reads as a phantom bug.
beforeEach(() => {
  db.state.missingDetailColumns = false
  db.state.missingRequestsTable = false
  seed()
})

describe('PATCH /api/students/:id/self-correct — requests, does not write', () => {

  it('leaves the student record exactly as it was', async () => {
    const res = await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng', year_level: '6th Year' },
      qr_corrections: { emergency_contact_phone: '0209888777' },
    })
    await settle()

    expect(res.status).toBe(200)
    expect(res.body.student.full_name).toBe('Ama Serwah Boateng')
    expect(db.state.students[0]).toMatchObject({
      full_name: 'Ama Serwah Boateng',
      year_level: '2nd Year',
      emergency_contact_phone: '0244000111',
    })
  })

  it('files one pending request carrying the diff and the note', async () => {
    await selfCorrect({
      corrections: { full_name: 'Ama Serwaa Boateng' },
      qr_corrections: { blood_type: 'A-' },
      student_note: 'my name is missing an a, and the blood group is wrong',
    })
    await settle()

    expect(db.state.correction_requests).toHaveLength(1)
    const [request] = db.state.correction_requests
    expect(request.status).toBe('pending')
    expect(request.student_id).toBe('STU-001')
    expect(request.fields).toEqual([
      { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
      { key: 'blood_type', label: 'blood type', from: 'O+', to: 'A-' },
    ])
    expect(request.student_note).toBe('my name is missing an a, and the blood group is wrong')
  })

  it('tells admins what was asked, not what was done', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    const [notice] = db.state.notifications
    expect(notice.type).toBe('self_correction')
    expect(notice.title).toBe('Correction request')
    expect(notice.message).toBe('Ama Serwah Boateng (STU-001) asked to correct their full name')
  })

  it('points the admin notification at the request it describes', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    const notice = db.state.notifications.find((n) => n.type === 'self_correction')
    expect(notice.details.request_id).toBe(db.state.correction_requests[0].id)
    expect(notice.details.fields).toHaveLength(1)
  })

  it('logs the ask as a request, and leaves self_corrected for the approval', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' }, student_note: 'typo' })
    await settle()

    const actions = db.state.confirmations.map((c) => c.action)
    expect(actions).toEqual(['correction_requested'])
    expect(db.state.confirmations[0].note).toBe(
      'Name: Ama Serwah Boateng → Ama Serwaa Boateng | Note from student: “typo”',
    )
  })

  it('replaces the open request when the student reports again', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa-Addo Boateng' } })
    await settle()

    expect(db.state.correction_requests).toHaveLength(1)
    expect(db.state.correction_requests[0].fields[0].to).toBe('Ama Serwaa-Addo Boateng')
  })

  it('pulls a card out of confirmed once the student disputes it', async () => {
    seed({ status: 'confirmed' })
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    expect(db.state.students[0].status).toBe('pending')
  })

  it('leaves an admin-raised issue state alone', async () => {
    seed({ status: 'issue' })
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    expect(db.state.students[0].status).toBe('issue')
  })

  it('still applies a photo report immediately, because it is not an edit', async () => {
    const res = await selfCorrect({ corrections: {}, photo_issue: true, student_note: 'that is my cousin' })
    await settle()

    expect(res.status).toBe(200)
    expect(db.state.students[0].status).toBe('photo_issue')
    expect(db.state.correction_requests).toHaveLength(0)
    expect(db.state.confirmations.map((c) => c.action)).toEqual(['photo_issue'])
    expect(db.state.confirmations[0].note).toBe(
      'Student reported incorrect photo. | Note from student: “that is my cousin”',
    )
    const [notice] = db.state.notifications
    expect(notice.type).toBe('photo_issue')
    expect(notice.details.student_note).toBe('that is my cousin')
  })

  it('rejects a submission that asks for nothing', async () => {
    const res = await selfCorrect({ corrections: { full_name: 'Ama Serwah Boateng' } })
    await settle()

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nothing to correct/i)
    expect(db.state.correction_requests).toHaveLength(0)
    expect(db.state.notifications).toHaveLength(0)
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

  it('rejects values the database would reject, with a readable message', async () => {
    const blood = await selfCorrect({ corrections: { full_name: 'X Y' }, qr_corrections: { blood_type: 'B' } })
    expect(blood.status).toBe(400)
    expect(blood.body.error).toMatch(/blood_type must be one of: A\+, A-/i)

    const year = await selfCorrect({ corrections: { year_level: '7th Year' } })
    expect(year.status).toBe(400)
    expect(year.body.error).toMatch(/invalid year_level/i)

    const dob = await selfCorrect({ corrections: { full_name: 'X Y' }, qr_corrections: { date_of_birth: '04/2003' } })
    expect(dob.status).toBe(400)
    expect(dob.body.error).toMatch(/YYYY-MM-DD/i)

    expect(db.state.correction_requests).toHaveLength(0)
  })

  it('refuses a token issued for a different student', async () => {
    const { signStudentToken } = require('../qr-keys')
    const forged = await signStudentToken('STU-999')
    const res = await request(buildApp())
      .patch('/api/students/STU-001/self-correct?token=' + encodeURIComponent(forged))
      .send({ corrections: { full_name: 'Somebody Else' } })

    expect(res.status).toBe(403)
    expect(db.state.correction_requests).toHaveLength(0)
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')
  })

  it('degrades to a prose notification when sql/015 is not applied', async () => {
    db.state.missingDetailColumns = true
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' }, student_note: 'missing an a' })
    await settle()

    expect(db.state.correction_requests).toHaveLength(1) // the request itself is safe
    expect(db.state.notifications).toHaveLength(1)
    const [notice] = db.state.notifications
    expect(notice.details).toBeUndefined()
    expect(notice.message).toContain('note: “missing an a”')
  })

  it('fails loudly rather than pretending success when sql/016 is not applied', async () => {
    db.state.missingRequestsTable = true
    const res = await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' } })
    await settle()

    expect(res.status).toBe(502)
    expect(res.body.error).toMatch(/could not save your correction request/i)
    // The whole point of gating: no request storage means no write to the record.
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')
  })
})

describe('GET /api/corrections/mine — the student can see their own ask', () => {
  it('returns the open request for the token holder', async () => {
    await selfCorrect({ corrections: { full_name: 'Ama Serwaa Boateng' }, student_note: 'typo' })
    await settle()

    const token = await tokenFor('STU-001')
    const res = await request(buildApp()).get(`/api/corrections/mine?token=${encodeURIComponent(token)}`)

    expect(res.status).toBe(200)
    expect(res.body.open.fields[0].to).toBe('Ama Serwaa Boateng')
    expect(res.body.requests).toHaveLength(1)
  })

  it('refuses an invalid token', async () => {
    const res = await request(buildApp()).get('/api/corrections/mine?token=garbage')
    expect(res.status).toBe(403)
  })

  it('reports nothing open when the table is missing, rather than breaking the page', async () => {
    db.state.missingRequestsTable = true
    const token = await tokenFor('STU-001')
    const res = await request(buildApp()).get(`/api/corrections/mine?token=${encodeURIComponent(token)}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ requests: [], open: null, unavailable: true })
  })
})
