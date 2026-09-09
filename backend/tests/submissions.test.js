import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
const request = require('supertest')
const express = require('express')

const OLD_ENV = process.env

beforeAll(() => {
  // Dummy Supabase env so db.js can construct its client (same hermetic
  // pattern as qr.test.js) — the client itself is replaced with a mock below.
  process.env = {
    ...OLD_ENV,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
  }
})

afterAll(() => {
  process.env = OLD_ENV
})

// ── Regression tests for the public submission endpoint ──────────────────────
// Bug: admins deleted a student so they could resubmit the form, but the old
// *approved* submission row was left behind and the dedupe check kept
// rejecting the new submission with "already been approved".
// Fix: an approved submission only blocks resubmission while the student
// record it produced still exists; otherwise the stale row is cleaned up and
// the new submission is accepted.

// In-memory state the mock Supabase client reads from / writes to.
const state = {
  formEnabled: true,
  submissions: [], // rows in student_submissions
  students: [], // rows in students
  deletedSubmissionIds: [],
  insertedSubmissions: [],
}

function makeQuery(table) {
  const filters = { eq: {}, in: {} }
  let mode = 'select'
  let insertedRow = null

  const applyFilters = (rows) =>
    rows.filter(
      (r) =>
        Object.entries(filters.eq).every(([k, v]) => r[k] === v) &&
        Object.entries(filters.in).every(([k, vals]) => vals.includes(r[k])),
    )

  const resolve = () => {
    if (table === 'portal_settings') {
      return { data: state.formEnabled ? { value: { enabled: true } } : { value: { enabled: false } }, error: null }
    }
    if (mode === 'delete') {
      if (table === 'student_submissions') {
        const ids = filters.in.id || (filters.eq.id !== undefined ? [filters.eq.id] : null)
        const doomed = ids
          ? state.submissions.filter((s) => ids.includes(s.id))
          : applyFilters(state.submissions)
        state.deletedSubmissionIds.push(...doomed.map((s) => s.id))
        state.submissions = state.submissions.filter((s) => !doomed.includes(s))
      }
      return { data: null, error: null }
    }
    if (mode === 'insert') {
      if (table === 'student_submissions') {
        const row = { id: `new-${state.insertedSubmissions.length + 1}`, status: 'pending', ...insertedRow }
        state.insertedSubmissions.push(row)
        state.submissions.push(row)
        return { data: row, error: null }
      }
      return { data: insertedRow, error: null }
    }
    const source = table === 'students' ? state.students : state.submissions
    return { data: applyFilters(source), error: null }
  }

  const q = {
    select: () => q,
    order: () => q,
    limit: () => q,
    eq: (col, val) => ((filters.eq[col] = val), q),
    neq: () => q,
    ilike: () => q,
    in: (col, vals) => ((filters.in[col] = vals), q),
    insert: (row) => ((mode = 'insert'), (insertedRow = row), q),
    update: () => ((mode = 'update'), q),
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
  // The router captures `supabase` from require('../db') at load time, so we
  // patch the shared client's `from` method in place (CJS requires are not
  // intercepted by vi.mock in this codebase's test setup).
  const db = require('../db')
  db.supabase.from = (table) => makeQuery(table)

  const app = express()
  app.use(express.json())
  app.use('/api/submissions', require('../routes/submissions'))
  return app
}

const VALID_BODY = {
  student_id: 'STU-001',
  full_name: 'Jane Doe',
  year_level: '2nd Year',
}

describe('POST /api/submissions — resubmission after admin deletes records', () => {
  beforeEach(() => {
    state.formEnabled = true
    state.submissions = []
    state.students = []
    state.deletedSubmissionIds = []
    state.insertedSubmissions = []
  })

  it('accepts a fresh submission when nothing exists for the student', async () => {
    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(state.insertedSubmissions).toHaveLength(1)
  })

  it('rejects when a pending submission already exists', async () => {
    state.submissions = [{ id: 'sub-1', student_id: 'STU-001', status: 'pending' }]
    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/pending review/i)
  })

  it('rejects when approved AND the student record still exists', async () => {
    state.submissions = [{ id: 'sub-1', student_id: 'STU-001', status: 'approved' }]
    state.students = [{ student_id: 'STU-001' }]
    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already been approved/i)
  })

  it('allows resubmission when the approved submission is stale (student deleted by admin)', async () => {
    // Admin deleted the student record so the person can resubmit, but the
    // approved submission row lingered — this was the reported bug.
    state.submissions = [{ id: 'sub-1', student_id: 'STU-001', status: 'approved' }]
    state.students = [] // student record was deleted

    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(state.deletedSubmissionIds).toContain('sub-1') // stale row cleaned up
    expect(state.insertedSubmissions).toHaveLength(1)
  })

  it('handles multiple stale approved rows without crashing (maybeSingle regression)', async () => {
    state.submissions = [
      { id: 'sub-1', student_id: 'STU-001', status: 'approved' },
      { id: 'sub-2', student_id: 'STU-001', status: 'approved' },
    ]
    state.students = []

    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(state.deletedSubmissionIds).toEqual(expect.arrayContaining(['sub-1', 'sub-2']))
  })

  it('a pending row wins over stale approved rows (still 409 pending)', async () => {
    state.submissions = [
      { id: 'sub-1', student_id: 'STU-001', status: 'approved' },
      { id: 'sub-2', student_id: 'STU-001', status: 'pending' },
    ]
    state.students = []
    const res = await request(buildApp()).post('/api/submissions').send(VALID_BODY)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/pending review/i)
  })
})
