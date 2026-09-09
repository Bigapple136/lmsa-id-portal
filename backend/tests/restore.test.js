import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
const request = require('supertest')
const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const JSZip = require('jszip')

const OLD_ENV = process.env

// Dummy Supabase env so db.js can construct its client at require time.
// Every Supabase call below is intercepted by the mock in beforeAll.
process.env = {
  ...OLD_ENV,
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
  // One IP fires dozens of upload/apply calls across this file — raise the
  // restore rate ceiling so the limiter never trips under test.
  LMSA_RESTORE_RATE_MAX: '1000',
}

afterAll(() => {
  process.env = OLD_ENV
})

// ── Pure unit tests: order, keys, manifest validation ────────────────────────

describe('restore plan', () => {
  it('covers exactly the backed-up tables, in FK-safe order', () => {
    const { TABLES } = require('../routes/backup')
    const { RESTORE_TABLE_ORDER, TABLE_PK } = require('../routes/restore')
    expect([...RESTORE_TABLE_ORDER].sort()).toEqual([...TABLES].sort())
    // Every table has a primary-key entry for the upsert onConflict target.
    for (const table of TABLES) {
      expect(TABLE_PK[table], `missing PK for ${table}`).toBeTruthy()
    }
    // Spot-check the ordering constraints the FK graph requires.
    const idx = (t) => RESTORE_TABLE_ORDER.indexOf(t)
    expect(idx('admins')).toBeLessThan(idx('admin_role_logs'))
    expect(idx('admins')).toBeLessThan(idx('admin_actions'))
    expect(idx('students')).toBeLessThan(idx('confirmations'))
    expect(idx('students')).toBeLessThan(idx('correction_requests'))
    expect(idx('notifications')).toBeLessThan(idx('notification_reads'))
  })

  it('validates manifests strictly', () => {
    const { validateBackupManifest } = require('../routes/restore')
    expect(validateBackupManifest(null).ok).toBe(false)
    expect(validateBackupManifest({}).ok).toBe(false)
    expect(validateBackupManifest({ tables: {} }).ok).toBe(false)
    expect(validateBackupManifest({ generated_at: 'x' }).ok).toBe(false)
    expect(validateBackupManifest({ generated_at: '2026-09-01T00:00:00.000Z', tables: {} })).toMatchObject({
      ok: true,
      generatedAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

// ── HTTP tests with a mocked Supabase ────────────────────────────────────────

describe('restore endpoints', () => {
  let app
  const state = {
    adminRecord: { id: 'admin-1', role: 'admin' },
    actions: [],
    liveCounts: {},
    upserts: [],
    uploads: [],
    rpcCalls: [],
    rpcError: null,
    failBatchTables: new Set(),
    failRows: new Set(), // `${table}:${pk-values}` failing even single-row upserts
  }

  function resetState() {
    state.adminRecord = { id: 'admin-1', role: 'admin' }
    state.actions = []
    state.liveCounts = {}
    state.upserts = []
    state.uploads = []
    state.rpcCalls = []
    state.rpcError = null
    state.failBatchTables = new Set()
    state.failRows = new Set()
  }

  beforeAll(() => {
    const db = require('../db')
    db.supabase.auth.getUser = async (token) => {
      if (token === 'valid-token') {
        return { data: { user: { id: 'admin-1', email: 'admin@test' } }, error: null }
      }
      return { data: { user: null }, error: new Error('invalid') }
    }
    db.supabase.from = (table) => {
      if (table === 'admins') {
        return {
          // Auth uses .select().eq().maybeSingle(); the pre-restore
          // snapshot scan uses .select().range(). Support both shapes.
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.adminRecord, error: null }) }),
            range: async () => ({ data: [], error: null }),
          }),
        }
      }
      if (table === 'admin_actions') {
        return {
          insert: async (row) => {
            state.actions.push(row)
            return { error: null }
          },
          // The pre-restore snapshot scans this table too.
          select: () => ({ range: async () => ({ data: [], error: null }) }),
        }
      }
      return {
        select: (cols, opts) => {
          // Preview head-counts.
          if (opts?.head) {
            return Promise.resolve({ count: state.liveCounts[table] ?? 0, error: null })
          }
          // Snapshot table scans (empty live DB in tests).
          return { range: async () => ({ data: [], error: null }) }
        },
        upsert: async (rows, { onConflict } = {}) => {
          state.upserts.push({ table, rowCount: rows.length, onConflict })
          if (rows.length > 1 && state.failBatchTables.has(table)) {
            return { error: new Error('batch boom') }
          }
          if (rows.length === 1) {
            const key = `${table}:${JSON.stringify(rows[0])}`
            if ([...state.failRows].some((k) => key.includes(k))) {
              return { error: new Error('row rejected') }
            }
          }
          return { error: null }
        },
      }
    }
    db.supabase.storage = {
      from: (bucket) => ({
        list: async () => ({ data: [], error: null }),
        upload: async (relPath, buffer, opts) => {
          state.uploads.push({ bucket, path: relPath, bytes: buffer.length, upsert: opts?.upsert })
          return { error: null }
        },
        download: async () => ({ data: null, error: new Error('empty in tests') }),
      }),
    }
    db.supabase.rpc = async (fn) => {
      state.rpcCalls.push(fn)
      if (state.rpcError) return { data: null, error: new Error(state.rpcError) }
      return { data: 3, error: null }
    }

    app = express()
    app.use(express.json())
    app.use('/api/restore', require('../routes/restore'))
    app.use('/api/jobs', require('../routes/jobs'))
  })

  beforeEach(() => {
    resetState()
    process.env.LMSA_RESTORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lmsa-restore-test-'))
    process.env.LMSA_RESTORE_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lmsa-restore-up-test-'))
    process.env.LMSA_JOB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lmsa-jobs-test-'))
  })

  afterAll(() => {
    delete process.env.LMSA_RESTORE_DIR
    delete process.env.LMSA_RESTORE_UPLOAD_DIR
    delete process.env.LMSA_JOB_DIR
  })

  function freshJobStore() {
    vi.resetModules()
    return require('../jobStore')
  }

  async function buildZip({ tables = {}, files = {}, manifest = true, manifestTables = null } = {}) {
    const zip = new JSZip()
    if (manifest) {
      zip.file(
        'manifest.json',
        JSON.stringify({
          generated_at: '2026-09-01T00:00:00.000Z',
          completed_at: '2026-09-01T00:01:00.000Z',
          tables: manifestTables || {},
          storage: {},
          excluded_tables: { qr_keys: 'secrets' },
        }),
      )
    }
    for (const [table, rows] of Object.entries(tables)) {
      zip.file(`database/${table}.json`, JSON.stringify(rows))
    }
    for (const [relPath, content] of Object.entries(files)) {
      zip.file(`files/${relPath}`, content)
    }
    return zip.generateAsync({ type: 'nodebuffer' })
  }

  const auth = (req) => req.set('Authorization', 'Bearer valid-token')

  async function uploadBackup(buffer, filename = 'lmsa-backup-test.zip') {
    return auth(request(app).post('/api/restore/upload').attach('file', buffer, filename))
  }

  async function waitForJob(jobId, timeoutMs = 15000) {
    const store = freshJobStore()
    const start = Date.now()
    for (;;) {
      const job = store.getJob(jobId)
      if (job && (job.status === 'ready' || job.status === 'failed')) return job
      if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for job ' + jobId)
      await new Promise((r) => {
        setTimeout(r, 50)
      })
    }
  }

  const MINI_TABLES = {
    students: [
      { student_id: 'STU-1', full_name: 'Ama Boateng', year_level: '2nd Year' },
      { student_id: 'STU-2', full_name: 'Kofi Mensah', year_level: '3rd Year' },
    ],
    portal_settings: [{ key: 'card_fields', value: {} }],
    confirmations: [{ id: 'c1', student_id: 'STU-1', action: 'confirmed' }],
    qr_audit: [{ id: 7, action: 'rotate', actor: 'a@test' }],
  }
  const MINI_FILES = {
    'photos-and-signatures/STU-1.jpg': Buffer.from('fake-jpg'),
    'qr-codes/STU-1.png': Buffer.from('fake-png'),
  }

  it('rejects non-zip uploads', async () => {
    const res = await uploadBackup(Buffer.from('not a zip'), 'evil.txt')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/\.zip/)
  })

  it('rejects zips that are not LIMSA backups', async () => {
    const zip = await buildZip({ manifest: false, tables: MINI_TABLES })
    const res = await uploadBackup(zip)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Not a LIMSA backup/)
  })

  it('stages a valid backup and summarizes it without touching live data', async () => {
    const zip = await buildZip({
      tables: { ...MINI_TABLES, notifications: { error: 'boom at backup time' } },
      files: MINI_FILES,
    })
    const res = await uploadBackup(zip)
    expect(res.status).toBe(200)
    expect(res.body.restoreId).toMatch(/^[a-f0-9]{16}$/)
    expect(res.body.backupGeneratedAt).toBe('2026-09-01T00:00:00.000Z')
    expect(res.body.tables.students).toEqual({ status: 'ok', rows: 2 })
    expect(res.body.tables.notifications).toMatchObject({ status: 'error' })
    expect(res.body.tables.confirmations).toEqual({ status: 'ok', rows: 1 })
    expect(res.body.tables.templates).toEqual({ status: 'missing' })
    expect(res.body.files['id-cards']).toEqual({ count: 1 })
    expect(res.body.files['qr-codes']).toEqual({ count: 1 })
    expect(res.body.totals).toEqual({ rows: 5, files: 2 })
    expect(res.body.warnings.join(' ')).toMatch(/notifications/)
    // Nothing written to live Supabase during staging.
    expect(state.upserts).toEqual([])
    expect(state.uploads).toEqual([])
    expect(state.actions.map((a) => a.action)).toEqual(['restore_uploaded'])
  })

  it('previews live-vs-backup diffs and marks the session reviewed', async () => {
    state.liveCounts = { students: 10, portal_settings: 4 }
    const zip = await buildZip({ tables: MINI_TABLES, files: MINI_FILES })
    const up = await uploadBackup(zip)
    const res = await auth(request(app).get(`/api/restore/${up.body.restoreId}/preview`))
    expect(res.status).toBe(200)
    const byTable = Object.fromEntries(res.body.tables.map((t) => [t.table, t]))
    expect(byTable.students).toMatchObject({ action: 'merge', backupRows: 2, liveRows: 10 })
    expect(byTable.templates.action).toBe('skip')
    expect(res.body.files.find((f) => f.bucket === 'id-cards')).toMatchObject({ backupFiles: 1, liveFiles: 0 })
    expect(res.body.warnings.join(' ')).toMatch(/QR signing keys/)
  })

  it('404s unknown, malformed, and expired sessions', async () => {
    expect((await auth(request(app).get('/api/restore/0123456789abcdef/preview'))).status).toBe(404)
    expect((await auth(request(app).get('/api/restore/../x/preview'))).status).toBe(404)

    const zip = await buildZip({ tables: MINI_TABLES })
    const up = await uploadBackup(zip)
    // Age the workspace past the 24h TTL.
    const metaPath = path.join(process.env.LMSA_RESTORE_DIR, up.body.restoreId, 'request.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    meta.createdAt = Date.now() - 25 * 60 * 60 * 1000
    fs.writeFileSync(metaPath, JSON.stringify(meta))
    expect((await auth(request(app).get(`/api/restore/${up.body.restoreId}/preview`))).status).toBe(404)
    expect(fs.existsSync(path.join(process.env.LMSA_RESTORE_DIR, up.body.restoreId))).toBe(false)
  })

  it('refuses to apply before preview and without the exact confirm phrase', async () => {
    const zip = await buildZip({ tables: MINI_TABLES })
    const up = await uploadBackup(zip)
    const id = up.body.restoreId

    const noPreview = await auth(request(app).post(`/api/restore/${id}/apply`).send({ confirm: 'RESTORE' }))
    expect(noPreview.status).toBe(400)
    expect(noPreview.body.error).toMatch(/preview/i)

    await auth(request(app).get(`/api/restore/${id}/preview`))
    const missing = await auth(request(app).post(`/api/restore/${id}/apply`).send({}))
    expect(missing.status).toBe(400)
    const wrong = await auth(request(app).post(`/api/restore/${id}/apply`).send({ confirm: 'restore' }))
    expect(wrong.status).toBe(400)
    expect(wrong.body.error).toMatch(/RESTORE/)
    expect(state.upserts).toEqual([])
  })

  it('applies a full restore: snapshot first, FK-safe merge, files, sequence, audit', async () => {
    const zip = await buildZip({ tables: MINI_TABLES, files: MINI_FILES })
    const up = await uploadBackup(zip)
    const id = up.body.restoreId
    await auth(request(app).get(`/api/restore/${id}/preview`))

    const apply = await auth(
      request(app).post(`/api/restore/${id}/apply`).send({ confirm: 'RESTORE', includeFiles: true }),
    )
    expect(apply.status).toBe(200)
    expect(apply.body).toMatchObject({ queued: true, restoreId: id })
    expect(apply.body.jobId).toMatch(/^[a-f0-9]{16}$/)

    const job = await waitForJob(apply.body.jobId)
    expect(job.status).toBe('ready')
    expect(job.result.totals).toMatchObject({ rowsRestored: 5, filesRestored: 2, filesFailed: 0 })
    expect(job.result.snapshotBytes).toBeGreaterThan(0)

    // Upserts ran parents-before-children with correct conflict targets.
    const firstUpsert = {}
    for (const u of state.upserts) {
      if (!(u.table in firstUpsert)) firstUpsert[u.table] = state.upserts.indexOf(u)
    }
    expect(firstUpsert.portal_settings).toBeLessThan(firstUpsert.students)
    expect(firstUpsert.students).toBeLessThan(firstUpsert.confirmations)
    expect(state.upserts.find((u) => u.table === 'students').onConflict).toBe('student_id')
    const byTable = Object.fromEntries(state.upserts.map((u) => [u.table, u]))
    expect(byTable.students.rowCount).toBe(2)

    // Files landed in the right buckets as overwrites.
    expect(state.uploads).toHaveLength(2)
    expect(state.uploads).toContainEqual({ bucket: 'id-cards', path: 'STU-1.jpg', bytes: 8, upsert: true })
    expect(state.uploads).toContainEqual({ bucket: 'qr-codes', path: 'STU-1.png', bytes: 8, upsert: true })

    // Sequence reset ran for the restored BIGSERIAL table.
    expect(state.rpcCalls).toContain('reset_qr_audit_sequence')

    // Snapshot is downloadable; result is re-fetchable.
    const snap = await auth(request(app).get(`/api/restore/${id}/snapshot`))
    expect(snap.status).toBe(200)
    expect(snap.headers['content-disposition']).toContain('.zip')
    expect(Number(snap.headers['content-length'])).toBeGreaterThan(0)
    const result = await auth(request(app).get(`/api/restore/${id}/result`))
    expect(result.status).toBe(200)
    expect(result.body.totals.rowsRestored).toBe(5)

    // The generic jobs endpoint serves the restore outcome (full admin).
    const status = await auth(request(app).get(`/api/jobs/${apply.body.jobId}?status=true`))
    expect(status.status).toBe(200)
    expect(status.body).toMatchObject({ status: 'ready', type: 'restore' })
    expect(status.body.result.totals.rowsRestored).toBe(5)

    expect(state.actions.map((a) => a.action)).toEqual([
      'restore_uploaded',
      'restore_started',
      'restore_completed',
    ])
  })

  it('salvages failing batches row-by-row and skips keyless rows', async () => {
    state.failBatchTables.add('confirmations')
    const zip = await buildZip({
      tables: {
        students: [
          { student_id: 'STU-1', full_name: 'Ama' },
          { full_name: 'no primary key' },
          { student_id: 'STU-2', full_name: 'Kofi' },
        ],
        confirmations: [
          { id: 'c1', student_id: 'STU-1', action: 'confirmed' },
          { id: 'c2', student_id: 'STU-2', action: 'confirmed' },
        ],
      },
    })
    const up = await uploadBackup(zip)
    await auth(request(app).get(`/api/restore/${up.body.restoreId}/preview`))
    const apply = await auth(
      request(app).post(`/api/restore/${up.body.restoreId}/apply`).send({ confirm: 'RESTORE', includeFiles: false }),
    )
    const job = await waitForJob(apply.body.jobId)
    expect(job.status).toBe('ready')
    expect(job.result.tables.students).toMatchObject({ restored: 2, skipped: 1 })
    expect(job.result.tables.students.errors[0].error).toMatch(/primary key/)
    // Batch failed, but both rows landed via the row-by-row retry.
    expect(job.result.tables.confirmations).toMatchObject({ restored: 2, skipped: 0 })
    expect(job.result.files).toEqual({ skipped: true })
    expect(state.uploads).toEqual([])
  })

  it('warns (instead of failing) when the sequence-reset function is missing', async () => {
    state.rpcError = 'function does not exist'
    const zip = await buildZip({ tables: { qr_audit: [{ id: 9, action: 'revoke', actor: 'a@test' }] } })
    const up = await uploadBackup(zip)
    await auth(request(app).get(`/api/restore/${up.body.restoreId}/preview`))
    const apply = await auth(
      request(app).post(`/api/restore/${up.body.restoreId}/apply`).send({ confirm: 'RESTORE', includeFiles: false }),
    )
    const job = await waitForJob(apply.body.jobId)
    expect(job.status).toBe('ready')
    expect(job.result.tables.qr_audit).toMatchObject({ restored: 1 })
    expect(job.result.warnings.join(' ')).toMatch(/017_restore_sequence_reset/)
  })

  it('supports discard, and snapshot/result 404 before apply', async () => {
    const zip = await buildZip({ tables: MINI_TABLES })
    const up = await uploadBackup(zip)
    const id = up.body.restoreId
    expect((await auth(request(app).get(`/api/restore/${id}/snapshot`))).status).toBe(404)
    expect((await auth(request(app).get(`/api/restore/${id}/result`))).status).toBe(404)

    const del = await auth(request(app).delete(`/api/restore/${id}`))
    expect(del.status).toBe(200)
    expect((await auth(request(app).get(`/api/restore/${id}/preview`))).status).toBe(404)
    expect(state.actions.map((a) => a.action)).toContain('restore_discarded')
  })

  it('blocks support_admins from upload, apply, and restore job status', async () => {
    state.adminRecord = { id: 'admin-2', role: 'support_admin' }
    const zip = await buildZip({ tables: MINI_TABLES })
    expect((await uploadBackup(zip)).status).toBe(403)

    // A restore job queued by a full admin must stay invisible to support.
    state.adminRecord = { id: 'admin-1', role: 'admin' }
    const up = await uploadBackup(zip)
    await auth(request(app).get(`/api/restore/${up.body.restoreId}/preview`))
    const apply = await auth(
      request(app).post(`/api/restore/${up.body.restoreId}/apply`).send({ confirm: 'RESTORE', includeFiles: false }),
    )
    await waitForJob(apply.body.jobId)
    state.adminRecord = { id: 'admin-2', role: 'support_admin' }
    expect((await auth(request(app).get(`/api/jobs/${apply.body.jobId}?status=true`))).status).toBe(403)
  })
})
