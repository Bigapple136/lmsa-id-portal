import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
const request = require('supertest')
const express = require('express')
const crypto = require('node:crypto')

const OLD_ENV = process.env

beforeAll(() => {
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

// ── The half of the flow that writes ─────────────────────────────────────────
// routes/corrections.js is the only place a student's ask becomes a change to
// their record, so the tests here are about what it refuses as much as what it
// applies: approving a stale request must not roll back another admin's edit, a
// key nobody offered the student must not be writable, and the student's own
// card state must follow the disagreement rather than lie about it.

const { createDb, settle } = require('./helpers/inMemoryDb')
const db = createDb()

// Jobs the approve handler defers (storage moves, QR re-issue). Patched before
// the router is loaded because it captures `enqueueImport` by destructuring.
let queued = []

const ADMIN = { Authorization: 'Bearer admin-token' }

function buildApp() {
  const dbModule = require('../db')
  dbModule.supabase.from = (table) => db.client.from(table)
  dbModule.supabase.auth.getUser = db.client.auth.getUser

  const queue = require('../queue')
  queue.enqueueImport = async (fn) => {
    queued.push(fn)
    return 'job-1'
  }

  const app = express()
  app.use(express.json())
  // Both halves mounted, the way index.js does it: what the student files is what
  // the queue shows, and what approval consumes.
  app.use('/api/students', require('../routes/students'))
  app.use('/api/confirmations', require('../routes/confirmations'))
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

let openRequest = null

function seed(overrides = {}) {
  db.state.students = [{ ...SEED_STUDENT, ...(overrides.student || {}) }]
  openRequest = {
    id: crypto.randomUUID(),
    student_id: 'STU-001',
    status: 'pending',
    fields: [
      { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
      { key: 'blood_type', label: 'blood type', from: 'O+', to: 'A-' },
    ],
    student_note: 'my name is missing an a, and the blood group is wrong',
    admin_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-09-01T09:00:00.000Z',
    updated_at: '2026-09-01T09:00:00.000Z',
    ...(overrides.request || {}),
  }
  db.state.correction_requests = [openRequest]
  db.state.confirmations = []
  db.state.notifications = []
  db.state.admin_actions = []
  db.state.missingDetailColumns = false
  db.state.missingRequestsTable = false
  db.state.failUpdate = null
}

const approve = (id = openRequest.id, body = {}, auth = ADMIN) =>
  request(buildApp()).post(`/api/corrections/${id}/approve`).set(auth).send(body)

const queue = (query = '', auth = ADMIN) =>
  request(buildApp()).get(`/api/corrections${query}`).set(auth)

/** Run whatever the approve handler pushed onto the import queue. */
async function drainQueue() {
  await settle()
  const jobs = queued
  queued = []
  for (const job of jobs) await job()
  await settle()
}

beforeEach(() => {
  queued = []
  seed()
})

describe('GET /api/corrections — the queue', () => {
  it('lists pending requests with the student attached', async () => {
    const res = await queue()
    expect(res.status).toBe(200)
    expect(res.body.requests).toHaveLength(1)
    expect(res.body.requests[0]).toMatchObject({
      status: 'pending',
      student_note: 'my name is missing an a, and the blood group is wrong',
      student: { student_id: 'STU-001', full_name: 'Ama Serwah Boateng', year_level: '2nd Year' },
    })
    expect(res.body.total).toBe(1)
    expect(res.body.pending_count).toBe(1)
  })

  it('filters by status but still counts what is waiting', async () => {
    seed({ request: { status: 'approved' } })
    db.state.correction_requests.push({
      ...openRequest,
      id: crypto.randomUUID(),
      status: 'pending',
      created_at: '2026-09-02T09:00:00.000Z',
    })

    const res = await queue('?status=approved')
    expect(res.body.requests.map((r) => r.status)).toEqual(['approved'])
    expect(res.body.pending_count).toBe(1)
  })

  it('refuses a status it cannot honour', async () => {
    const res = await queue('?status=spam')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/status must be one of/)
  })

  it('refuses callers who are not admins', async () => {
    expect((await queue('', {})).status).toBe(401)
    expect((await queue('', { Authorization: 'Bearer nope' })).status).toBe(401)
  })

  it('reports a failed lookup instead of an empty queue', async () => {
    // sql/016 not applied. "No corrections pending" would be a lie that silently
    // costs students their requests, so the tab has to show an error.
    db.state.missingRequestsTable = true
    const res = await queue()
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to load correction requests.')
  })
})

describe('POST /api/corrections/:id/approve', () => {
  it('applies exactly what was asked, and closes the request', async () => {
    const res = await approve()
    await drainQueue()

    expect(res.status).toBe(200)
    expect(db.state.students[0]).toMatchObject({
      full_name: 'Ama Serwaa Boateng',
      blood_type: 'A-',
      programme: 'Nursing',
    })
    expect(db.state.correction_requests[0]).toMatchObject({
      status: 'approved',
      reviewed_by: 'admin-1',
    })
    expect(db.state.correction_requests[0].reviewed_at).toBeTruthy()
  })

  it('records the correction as applied once the record actually moved', async () => {
    await approve()
    await drainQueue()

    expect(db.state.confirmations.map((c) => c.action)).toEqual(['self_corrected'])
    expect(db.state.confirmations[0].note).toBe(
      'Name corrected to: Ama Serwaa Boateng | Blood type corrected to: A- | Requested by student: “my name is missing an a, and the blood group is wrong”',
    )
    expect(db.state.confirmations[0].details).toMatchObject({ applied_via: 'correction_request' })
    expect(db.state.admin_actions.map((a) => a.action)).toEqual(['correction_approve'])
  })

  it('reopens a confirmed card, because it is now wrong', async () => {
    seed({ student: { status: 'confirmed' } })
    await approve()
    await drainQueue()
    expect(db.state.students[0].status).toBe('pending')
  })

  it('leaves an issue state the office raised alone', async () => {
    seed({ student: { status: 'issue' } })
    await approve()
    await drainQueue()
    expect(db.state.students[0].status).toBe('issue')
  })

  it('refuses to overwrite a change made after the student asked', async () => {
    // The office renamed her on the roster while the request sat.
    db.state.students[0].full_name = 'Ama Serwah Awudi'

    const res = await approve()
    await drainQueue()

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/The record changed since this was requested: full name/)
    expect(res.body.conflicts).toEqual([
      {
        key: 'full_name',
        label: 'full name',
        requested: 'Ama Serwaa Boateng',
        current: 'Ama Serwah Awudi',
      },
    ])
    // The other field is left for the same decision rather than half-applied.
    expect(db.state.students[0].blood_type).toBe('O+')
    expect(db.state.correction_requests[0].status).toBe('pending')
  })

  it('applies it anyway when the admin says so', async () => {
    db.state.students[0].full_name = 'Ama Serwah Awudi'

    const res = await approve(openRequest.id, { force: true, note: 'registrar agreed' })
    await drainQueue()

    expect(res.status).toBe(200)
    expect(db.state.students[0].full_name).toBe('Ama Serwaa Boateng')
    expect(db.state.admin_actions[0].details).toMatchObject({ forced: true, note: 'registrar agreed' })
  })

  it('will not write a column the student was never offered', async () => {
    seed({
      student: { status: 'confirmed' },
      request: {
        fields: [
          { key: 'student_id', label: 'student id', from: 'STU-001', to: 'STU-777' },
          { key: 'status', label: 'status', from: 'confirmed', to: 'confirmed' },
          { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
        ],
      },
    })

    const res = await approve()
    await drainQueue()

    expect(res.status).toBe(200)
    expect(db.state.students[0].student_id).toBe('STU-001')
    // 'confirmed' is not preserved: the student disputed the card, so the
    // approval drops it back to pending and waits for them to re-confirm.
    expect(db.state.students[0].status).toBe('pending')
    expect(db.state.students[0].full_name).toBe('Ama Serwaa Boateng')
  })

  it('closes the request when the student record is gone', async () => {
    db.state.students = []

    const res = await approve()
    expect(res.status).toBe(410)
    expect(res.body.error).toMatch(/no longer exists/)
    expect(db.state.correction_requests[0]).toMatchObject({
      status: 'rejected',
      admin_note: 'Student record no longer exists.',
    })
  })

  it('refuses to approve the same request twice', async () => {
    await approve()
    await drainQueue()
    const again = await approve()
    expect(again.status).toBe(400)
    expect(again.body.error).toBe('This request was already approved.')
  })

  it('refuses a hand-written request with nothing in it', async () => {
    seed({ request: { fields: [] } })
    const res = await approve()
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('This request has no field changes to apply.')
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')
  })

  it('surfaces a rejected value instead of reporting success', async () => {
    // 'X+' is not in the blood_type CHECK list; the database gets the final say.
    db.state.failUpdate = {
      table: 'students',
      field: 'blood_type',
      value: 'A-',
      message: 'new row violates check constraint "students_blood_type_check"',
    }

    const res = await approve()
    await drainQueue()
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/check constraint/)
    expect(db.state.correction_requests[0].status).toBe('pending')
  })

  it('moves the files and re-issues the card when the year level changed', async () => {
    const students = require('../routes/students')
    const qr = require('../routes/qr')
    const calls = []
    students.migrateStudentFiles = async (id, from, to) => calls.push(['migrate', id, from, to])
    qr.deleteQRFile = async (id, year) => calls.push(['delete', id, year])
    qr.generateForStudent = async (student) => calls.push(['generate', student.year_level])

    seed({
      request: { fields: [{ key: 'year_level', label: 'year level', from: '2nd Year', to: '3rd Year' }] },
    })

    const res = await approve()
    await drainQueue()

    expect(res.status).toBe(200)
    expect(calls).toEqual([
      ['migrate', 'STU-001', '2nd Year', '3rd Year'],
      ['delete', 'STU-001', '2nd Year'],
      ['generate', '3rd Year'],
    ])
  })

  it('re-issues the card without touching folders for a name-only change', async () => {
    const students = require('../routes/students')
    const qr = require('../routes/qr')
    const calls = []
    students.migrateStudentFiles = async () => calls.push('migrate')
    qr.deleteQRFile = async () => calls.push('delete')
    qr.generateForStudent = async () => calls.push('generate')

    seed({ request: { fields: [{ key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' }] } })
    await approve()
    await drainQueue()

    expect(calls).toEqual(['generate'])
  })

  it('keeps working when the storage follow-up fails', async () => {
    // An approved correction is a committed fact; a locked PNG is not worth
    // telling the admin the approval failed.
    const qr = require('../routes/qr')
    qr.generateForStudent = async () => {
      throw new Error('ENOENT: storage unreachable')
    }
    const res = await approve()
    await drainQueue()
    expect(res.status).toBe(200)
    expect(db.state.correction_requests[0].status).toBe('approved')
  })
})

describe('POST /api/corrections/:id/reject', () => {
  const reject = (body) =>
    request(buildApp()).post(`/api/corrections/${openRequest.id}/reject`).set(ADMIN).send(body)

  it('stores the reason and changes nothing about the record', async () => {
    const res = await reject({ note: 'registrar says the card is right — bring your ID to the office' })
    await settle()

    expect(res.status).toBe(200)
    expect(db.state.correction_requests[0]).toMatchObject({
      status: 'rejected',
      reviewed_by: 'admin-1',
      admin_note: 'registrar says the card is right — bring your ID to the office',
    })
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')
    expect(db.state.confirmations).toHaveLength(0)
    expect(db.state.admin_actions.map((a) => a.action)).toEqual(['correction_reject'])
  })

  it('lets a rejection stand without a note', async () => {
    const res = await reject({})
    expect(res.status).toBe(200)
    expect(db.state.correction_requests[0].status).toBe('rejected')
  })

  it('rejects an over-long or non-string note', async () => {
    const tooLong = await reject({ note: 'x'.repeat(1001) })
    expect(tooLong.status).toBe(400)

    const wrongType = await reject({ note: { text: 'no' } })
    expect(wrongType.status).toBe(400)
    expect(db.state.correction_requests[0].status).toBe('pending')
  })

  it('refuses to reject what is already approved', async () => {
    await approve()
    await drainQueue()
    const res = await reject({ note: 'too late' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('This request was already approved.')
  })
})

describe('POST /api/corrections/:id/withdraw — the student backing out', () => {
  async function tokenFor(studentId) {
    const { signStudentToken } = require('../qr-keys')
    return signStudentToken(studentId)
  }

  const withdraw = (id, token) =>
    request(buildApp()).post(`/api/corrections/${id}/withdraw?token=${encodeURIComponent(token)}`)

  it('closes the student’s own open request', async () => {
    const res = await withdraw(openRequest.id, await tokenFor('STU-001'))
    expect(res.status).toBe(200)
    expect(db.state.correction_requests[0]).toMatchObject({ status: 'withdrawn', reviewed_by: null })
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')
  })

  it('will not let one student close another’s request', async () => {
    const res = await withdraw(openRequest.id, await tokenFor('STU-999'))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/another student/)
    expect(db.state.correction_requests[0].status).toBe('pending')
  })

  it('will not undo a decision', async () => {
    seed({ request: { status: 'approved' } })
    const res = await withdraw(openRequest.id, await tokenFor('STU-001'))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('This request was already approved.')
  })

  it('needs a token, and a real one', async () => {
    expect((await withdraw(openRequest.id, '')).status).toBe(401)
    expect((await withdraw(openRequest.id, 'garbage')).status).toBe(403)
  })

  it('answers 404 for a request that does not exist', async () => {
    const res = await withdraw(crypto.randomUUID(), await tokenFor('STU-001'))
    expect(res.status).toBe(404)
  })
})

describe('the Confirm lock — a disputed card is not a confirmed one', () => {
  async function confirmCard(action, token) {
    return request(buildApp())
      .post('/api/confirmations/student')
      .send({ token, action })
  }

  it('refuses to confirm while a request is under review', async () => {
    const { signStudentToken } = require('../qr-keys')
    const res = await confirmCard('confirmed', await signStudentToken('STU-001'))

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/waiting for review/)
    expect(db.state.students[0].status).toBe('pending')
    expect(db.state.confirmations).toHaveLength(0)
  })

  it('still lets the student report an issue while a request is open', async () => {
    const { signStudentToken } = require('../qr-keys')
    const res = await confirmCard('issue', await signStudentToken('STU-001'))
    expect(res.status).toBe(200)
    expect(db.state.students[0].status).toBe('issue')
  })

  it('unlocks once an admin has decided', async () => {
    const { signStudentToken } = require('../qr-keys')
    const token = await signStudentToken('STU-001')

    await approve()
    await drainQueue()
    const res = await confirmCard('confirmed', token)
    expect(res.status).toBe(200)
    expect(db.state.students[0].status).toBe('confirmed')
  })

  it('unlocks when the student withdraws instead', async () => {
    const { signStudentToken } = require('../qr-keys')
    await request(buildApp())
      .post(`/api/corrections/${openRequest.id}/withdraw?token=${encodeURIComponent(await signStudentToken('STU-001'))}`)
    const res = await confirmCard('confirmed', await signStudentToken('STU-001'))
    expect(res.status).toBe(200)
  })

  it('does not depend on the requests table existing', async () => {
    // sql/016 not applied: the lock has to step aside rather than turn every
    // confirmation into a 500.
    db.state.missingRequestsTable = true
    const { signStudentToken } = require('../qr-keys')
    const res = await confirmCard('confirmed', await signStudentToken('STU-001'))
    expect(res.status).toBe(200)
    expect(db.state.students[0].status).toBe('confirmed')
  })
})

describe('the whole ask → decide path', () => {
  it('leaves the record, the request and the history agreeing', async () => {
    const { signStudentToken } = require('../qr-keys')
    const token = await signStudentToken('STU-001')

    const filed = await request(buildApp())
      .patch(`/api/students/STU-001/self-correct?token=${encodeURIComponent(token)}`)
      .send({ corrections: { full_name: 'Ama Serwaa Boateng' }, student_note: 'missing an a' })
    await settle()
    expect(filed.status).toBe(200)
    expect(db.state.students[0].full_name).toBe('Ama Serwah Boateng')

    const list = await queue()
    expect(list.body.requests).toHaveLength(1)
    const [row] = list.body.requests
    expect(row).toMatchObject({ status: 'pending', student_note: 'missing an a' })
    expect(row.fields).toEqual([{ key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' }])

    const applied = await approve(row.id)
    await drainQueue()
    expect(applied.status).toBe(200)
    expect(applied.body.student.full_name).toBe('Ama Serwaa Boateng')
    expect(db.state.correction_requests[0].status).toBe('approved')
    expect(db.state.confirmations.map((c) => c.action)).toEqual(['correction_requested', 'self_corrected'])

    // Nothing left in the queue, and the student sees a resolved request.
    expect((await queue()).body.requests).toHaveLength(0)
    const mine = await request(buildApp()).get(`/api/corrections/mine?token=${encodeURIComponent(token)}`)
    expect(mine.body.open).toBe(null)
    expect(mine.body.requests[0]).toMatchObject({ status: 'approved' })
  })
})
