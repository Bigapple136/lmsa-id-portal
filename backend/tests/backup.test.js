import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
const request = require('supertest')
const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OLD_ENV = process.env

// Dummy Supabase env so db.js can construct its client at require time
// (same hermetic pattern as submissions.test.js / qr.test.js). No real
// Supabase call is ever made: tests that mount routers replace the
// client's methods with mocks below.
process.env = {
  ...OLD_ENV,
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
}

afterAll(() => {
  process.env = OLD_ENV
})

// ── Schema-coverage guard ────────────────────────────────────────────────────
// Regression net for the recurring "new table silently missing from backups"
// bug (2f9a943 backfilled five tables; correction_requests was added later
// and missed again). Every CREATE TABLE in sql/ must be backed up or be a
// documented, deliberate exclusion.

function sqlTableNames() {
  const dir = path.join(__dirname, '..', '..', 'sql')
  const names = new Set()
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.sql')) continue
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const match of text.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)) {
      names.add(match[1].toLowerCase())
    }
  }
  return names
}

describe('backup table coverage', () => {
  it('backs up every sql/ table except documented exclusions', () => {
    const { TABLES, EXCLUDED_TABLES } = require('../routes/backup')
    const covered = new Set([...TABLES, ...Object.keys(EXCLUDED_TABLES)].map((t) => t.toLowerCase()))
    const missing = [...sqlTableNames()].filter((t) => !covered.has(t))
    expect(missing).toEqual([])
  })

  it('has no stale/typo entries that match no sql/ table', () => {
    const { TABLES } = require('../routes/backup')
    const known = sqlTableNames()
    const stale = TABLES.filter((t) => !known.has(t.toLowerCase()))
    expect(stale).toEqual([])
  })

  it('keeps qr_keys out of downloadable backups, with a documented reason', () => {
    const { TABLES, EXCLUDED_TABLES } = require('../routes/backup')
    expect(TABLES).not.toContain('qr_keys')
    expect(typeof EXCLUDED_TABLES.qr_keys).toBe('string')
    expect(EXCLUDED_TABLES.qr_keys.length).toBeGreaterThan(0)
  })

  it('backs up correction_requests (the gated student-correction queue)', () => {
    const { TABLES } = require('../routes/backup')
    expect(TABLES).toContain('correction_requests')
  })
})

// ── Filesystem-backed job store ──────────────────────────────────────────────
// Production runs `node cluster.js` (up to 4 workers) and each request lands
// on any worker — so the store must be visible across processes, which an
// in-memory Map is not. These tests pin the cross-instance behaviour.

let jobDir

beforeEach(() => {
  jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmsa-jobs-test-'))
  process.env.LMSA_JOB_DIR = jobDir
})

afterAll(() => {
  delete process.env.LMSA_JOB_DIR
})

function freshJobStore() {
  vi.resetModules()
  return require('../jobStore')
}

describe('jobStore', () => {
  it('runs a job queued → processing → ready with its payload on disk', () => {
    const store = freshJobStore()
    const job = store.createJob({ type: 'backup', filename: 'b.zip', mimeType: 'application/zip' })
    expect(job.id).toMatch(/^[a-f0-9]{16}$/)
    expect(store.getJob(job.id)).toMatchObject({ status: 'queued', filename: 'b.zip' })

    store.setJobProcessing(job.id)
    expect(store.getJob(job.id).status).toBe('processing')

    const payload = Buffer.from('fake-zip-bytes')
    store.setJobReady(job.id, { buffer: payload, filename: 'b.zip', mimeType: 'application/zip' })
    const ready = store.getJob(job.id)
    expect(ready).toMatchObject({ status: 'ready', size: payload.length })

    const filePath = store.getJobFilePath(job.id)
    expect(filePath).toBeTruthy()
    expect(fs.readFileSync(filePath)).toEqual(payload)
  })

  it('shares jobs across module instances (i.e. across cluster workers)', () => {
    const storeA = freshJobStore()
    const job = storeA.createJob({ type: 'qr-export' })
    storeA.setJobReady(job.id, { buffer: Buffer.from('x') })

    const storeB = freshJobStore() // simulates a second worker process
    const seen = storeB.getJob(job.id)
    expect(seen).toMatchObject({ status: 'ready', type: 'qr-export' })
    expect(storeB.getJobFilePath(job.id)).toBeTruthy()
  })

  it('records failures with the error message', () => {
    const store = freshJobStore()
    const job = store.createJob({ type: 'backup' })
    store.setJobFailed(job.id, new Error('boom'))
    expect(store.getJob(job.id)).toMatchObject({ status: 'failed', error: 'boom' })
    expect(store.getJobFilePath(job.id)).toBeNull()
  })

  it('returns nothing for unknown ids and rejects path traversal', () => {
    const store = freshJobStore()
    expect(store.getJob('0123456789abcdef')).toBeUndefined()
    for (const evil of ['../x', '../../etc/passwd', '/abs/path', '', null, undefined, 'x'.repeat(16)]) {
      expect(store.getJob(evil)).toBeUndefined()
      expect(store.getJobFilePath(evil)).toBeNull()
    }
    // No file escaped the job dir.
    expect(fs.readdirSync(jobDir)).toEqual([])
  })

  it('expires old jobs on read and removes their files', () => {
    const store = freshJobStore()
    const job = store.createJob({ type: 'backup' })
    store.setJobReady(job.id, { buffer: Buffer.from('x') })
    expect(fs.readdirSync(jobDir).length).toBe(2)

    // Age the metadata past the 30-minute TTL.
    const metaPath = path.join(jobDir, `${job.id}.json`)
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    meta.createdAt = Date.now() - 31 * 60 * 1000
    fs.writeFileSync(metaPath, JSON.stringify(meta))

    expect(store.getJob(job.id)).toBeUndefined()
    expect(fs.readdirSync(jobDir)).toEqual([])
  })

  it('cleanup() sweeps expired jobs left behind by dead workers', () => {
    const store = freshJobStore()
    const oldJob = store.createJob({ type: 'backup' })
    const freshJob = store.createJob({ type: 'backup' })
    const metaPath = path.join(jobDir, `${oldJob.id}.json`)
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    meta.createdAt = Date.now() - 60 * 60 * 1000
    fs.writeFileSync(metaPath, JSON.stringify(meta))

    store.cleanup()
    expect(store.getJob(oldJob.id)).toBeUndefined()
    expect(store.getJob(freshJob.id)).toBeTruthy()
  })
})

// ── /api/jobs privilege boundary ─────────────────────────────────────────────
// The generic jobs endpoint serves any background result, including full
// backups — so backup-type jobs must enforce the same full-admin rule as
// /api/backup itself, not the route's base requireAdmin.

describe('GET /api/jobs/:jobId', () => {
  let app
  let adminRecord
  const insertedActions = []

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
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: adminRecord, error: null }) }) }),
        }
      }
      if (table === 'admin_actions') {
        return {
          insert: async (row) => {
            insertedActions.push(row)
            return { error: null }
          },
        }
      }
      throw new Error('unexpected table in jobs test: ' + table)
    }

    app = express()
    app.use('/api/jobs', require('../routes/jobs'))
  })

  beforeEach(() => {
    adminRecord = { id: 'admin-1', role: 'admin' }
    insertedActions.length = 0
  })

  async function seedBackupJob() {
    const store = freshJobStore()
    const job = store.createJob({ type: 'backup', filename: 'lmsa-backup-test.zip', mimeType: 'application/zip' })
    store.setJobReady(job.id, {
      buffer: Buffer.from('zip-bytes'),
      filename: 'lmsa-backup-test.zip',
      mimeType: 'application/zip',
    })
    return job
  }

  it('lets a full admin check status and download the file', async () => {
    const job = await seedBackupJob()
    const status = await request(app)
      .get(`/api/jobs/${job.id}?status=true`)
      .set('Authorization', 'Bearer valid-token')
    expect(status.status).toBe(200)
    expect(status.body).toMatchObject({ status: 'ready', jobId: job.id, type: 'backup' })

    const dl = await request(app).get(`/api/jobs/${job.id}`).set('Authorization', 'Bearer valid-token')
    expect(dl.status).toBe(200)
    expect(dl.headers['content-disposition']).toContain('lmsa-backup-test.zip')
    expect(insertedActions.map((a) => a.action)).toContain('backup_downloaded')
  })

  it('blocks a support_admin from backup status and download', async () => {
    adminRecord = { id: 'admin-2', role: 'support_admin' }
    const job = await seedBackupJob()

    const status = await request(app)
      .get(`/api/jobs/${job.id}?status=true`)
      .set('Authorization', 'Bearer valid-token')
    expect(status.status).toBe(403)

    const dl = await request(app).get(`/api/jobs/${job.id}`).set('Authorization', 'Bearer valid-token')
    expect(dl.status).toBe(403)
    expect(insertedActions).toEqual([])
  })

  it('still serves non-backup jobs to support_admins', async () => {
    adminRecord = { id: 'admin-2', role: 'support_admin' }
    const store = freshJobStore()
    const job = store.createJob({ type: 'photoshoot', filename: 'roster.pdf', mimeType: 'application/pdf' })
    store.setJobReady(job.id, { buffer: Buffer.from('pdf-bytes') })

    const res = await request(app)
      .get(`/api/jobs/${job.id}?status=true`)
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ready', type: 'photoshoot' })
  })

  it('404s unknown or expired jobs', async () => {
    const res = await request(app)
      .get('/api/jobs/0123456789abcdef?status=true')
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(404)
  })

  it('401s without a session', async () => {
    const job = await seedBackupJob()
    const res = await request(app).get(`/api/jobs/${job.id}?status=true`)
    expect(res.status).toBe(401)
  })
})
