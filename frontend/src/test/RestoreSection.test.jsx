import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RestoreSection from '../components/RestoreSection'
import { adminFetch, adminForm, adminJson } from '../lib/api'

vi.mock('../lib/api', () => ({
  adminFetch: vi.fn(),
  adminForm: vi.fn(),
  adminJson: vi.fn(),
}))

vi.mock('../components/Toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))

const RESTORE_ID = '0123456789abcdef'
const SESSION = {
  restoreId: RESTORE_ID,
  backupGeneratedAt: '2026-09-01T00:00:00.000Z',
  tables: {
    students: { status: 'ok', rows: 2 },
    templates: { status: 'missing' },
  },
  files: { 'id-cards': { count: 1 }, 'qr-codes': { count: 0 }, templates: { count: 0 } },
  warnings: ['notifications had errors when the backup was taken and will be skipped'],
  totals: { rows: 2, files: 1 },
}
const PREVIEW = {
  restoreId: RESTORE_ID,
  backupGeneratedAt: '2026-09-01T00:00:00.000Z',
  tables: [
    { table: 'students', action: 'merge', backupRows: 2, liveRows: 10 },
    { table: 'templates', action: 'skip', reason: 'not present in this backup', backupRows: 0, liveRows: 3 },
  ],
  files: [{ bucket: 'id-cards', backupFiles: 1, liveFiles: 5 }],
  warnings: ['QR signing keys are never in backups and are never touched by restore.'],
}
const RESULT = {
  restoreId: RESTORE_ID,
  backupGeneratedAt: '2026-09-01T00:00:00.000Z',
  completedAt: '2026-09-09T00:00:00.000Z',
  snapshotBytes: 1234,
  tables: { students: { restored: 2, skipped: 0, errors: [] } },
  files: { restored: 1, failed: 0 },
  warnings: [],
  totals: { rowsRestored: 2, rowsSkipped: 0, filesRestored: 1, filesFailed: 0 },
}

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body, headers: { get: () => 'application/json' } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function selectBackupFile() {
  const zip = new File(['fake-zip'], 'lmsa-backup-test.zip', { type: 'application/zip' })
  fireEvent.change(screen.getByLabelText(/backup zip file/i), { target: { files: [zip] } })
}

describe('RestoreSection', () => {
  it('starts with upload only — nothing can be applied before a backup is staged', () => {
    render(<RestoreSection />)
    expect(screen.getByLabelText(/backup zip file/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /upload & validate/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /apply restore/i })).toBeNull()
  })

  it('runs the guided flow: upload → preview → typed confirm → apply → result', async () => {
    adminForm.mockResolvedValueOnce(jsonResponse(SESSION))
    const jobStatuses = [
      jsonResponse({
        status: 'processing',
        progress: { phase: 'tables', label: 'Restoring students… (1/2)', tablesDone: 1, tablesTotal: 2 },
      }),
      jsonResponse({ status: 'ready', result: RESULT }),
    ]
    adminFetch.mockImplementation(async (url) => {
      if (url.includes('/preview')) return jsonResponse(PREVIEW)
      if (url.includes('/api/jobs/')) return jobStatuses.shift() || jobStatuses[jobStatuses.length - 1]
      throw new Error('unexpected fetch: ' + url)
    })
    adminJson.mockResolvedValueOnce(jsonResponse({ queued: true, jobId: 'job1', restoreId: RESTORE_ID }))

    render(<RestoreSection pollInterval={10} />)
    selectBackupFile()
    fireEvent.click(screen.getByRole('button', { name: /upload & validate/i }))

    // Staged session + auto-fetched preview.
    await screen.findByText(/backup taken:/i)
    expect(screen.getByText(/contents:/i).parentElement.textContent).toMatch(/2 rows/)
    await screen.findByText('students')
    expect(screen.getByText('Merge')).toBeTruthy()
    expect(screen.getByText('Skip')).toBeTruthy()

    // Apply stays disabled until the exact phrase is typed.
    const apply = screen.getByRole('button', { name: /apply restore/i })
    expect(apply).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/type restore to confirm/i), { target: { value: 'restore' } })
    expect(apply).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/type restore to confirm/i), { target: { value: 'RESTORE' } })
    expect(apply).not.toBeDisabled()

    fireEvent.click(apply)
    await waitFor(() => expect(adminJson).toHaveBeenCalledWith(`/api/restore/${RESTORE_ID}/apply`, 'POST', {
      confirm: 'RESTORE',
      includeFiles: true,
    }))

    // Progress then the result summary.
    await screen.findByRole('progressbar')
    await screen.findByText(/rows restored:/i)
    expect(screen.getByText(/rows restored:/i).parentElement.textContent).toMatch(/2/)
    expect(screen.getByRole('button', { name: /download pre-restore snapshot/i })).toBeTruthy()
  })

  it('shows upload errors without staging anything', async () => {
    adminForm.mockResolvedValueOnce(jsonResponse({ error: 'Not a LIMSA backup' }, false))
    render(<RestoreSection pollInterval={10} />)
    selectBackupFile()
    fireEvent.click(screen.getByRole('button', { name: /upload & validate/i }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toMatch(/Not a LIMSA backup/)
    expect(screen.queryByRole('button', { name: /apply restore/i })).toBeNull()
  })

  it('downloads the pre-restore snapshot from the result screen', async () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:snapshot')
    globalThis.URL.revokeObjectURL = vi.fn()
    adminForm.mockResolvedValueOnce(jsonResponse(SESSION))
    adminFetch.mockImplementation(async (url) => {
      if (url.includes('/preview')) return jsonResponse(PREVIEW)
      if (url.includes('/api/jobs/')) return jsonResponse({ status: 'ready', result: RESULT })
      if (url.includes('/snapshot')) return { ok: true, blob: async () => new Blob(['zip']) }
      throw new Error('unexpected fetch: ' + url)
    })
    adminJson.mockResolvedValueOnce(jsonResponse({ queued: true, jobId: 'job1', restoreId: RESTORE_ID }))

    render(<RestoreSection pollInterval={10} />)
    selectBackupFile()
    fireEvent.click(screen.getByRole('button', { name: /upload & validate/i }))
    await screen.findByText(/backup taken:/i)
    await screen.findByText('students')
    fireEvent.change(screen.getByLabelText(/type restore to confirm/i), { target: { value: 'RESTORE' } })
    fireEvent.click(screen.getByRole('button', { name: /apply restore/i }))
    await screen.findByText(/rows restored:/i)

    fireEvent.click(screen.getByRole('button', { name: /download pre-restore snapshot/i }))
    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith(`/api/restore/${RESTORE_ID}/snapshot`),
    )
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
  })

  it('discards the session and returns to the upload step', async () => {
    adminForm.mockResolvedValueOnce(jsonResponse(SESSION))
    adminFetch.mockImplementation(async (url) => {
      if (url.includes('/preview')) return jsonResponse(PREVIEW)
      if (url.includes('/api/restore/')) return { ok: true, json: async () => ({ discarded: true }) }
      throw new Error('unexpected fetch: ' + url)
    })
    render(<RestoreSection pollInterval={10} />)
    selectBackupFile()
    fireEvent.click(screen.getByRole('button', { name: /upload & validate/i }))
    await screen.findByText(/backup taken:/i)
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    await waitFor(() => expect(screen.getByLabelText(/backup zip file/i)).toBeTruthy())
    expect(screen.queryByText(/backup taken:/i)).toBeNull()
    expect(adminFetch).toHaveBeenCalledWith(`/api/restore/${RESTORE_ID}`, { method: 'DELETE' })
  })
})
