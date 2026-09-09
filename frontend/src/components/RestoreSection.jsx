import { useEffect, useRef, useState } from 'react'
import { adminFetch, adminForm, adminJson } from '../lib/api'
import { useToast } from './Toast'

// Guided restore: upload a backup ZIP → review the live-vs-backup preview →
// type RESTORE to apply. `pollInterval` is injectable so tests can poll fast.
const CONFIRM_PHRASE = 'RESTORE'
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function formatBytes(n) {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function progressPercent(progress) {
  if (!progress) return null
  if (progress.phase === 'tables' && progress.tablesTotal > 0) {
    return Math.round((100 * progress.tablesDone) / progress.tablesTotal)
  }
  if (progress.phase === 'files' && progress.filesTotal > 0) {
    return Math.round((100 * progress.filesDone) / progress.filesTotal)
  }
  return null
}

export default function RestoreSection({ pollInterval = 2500 }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [session, setSession] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [includeFiles, setIncludeFiles] = useState(true)
  const [confirm, setConfirm] = useState('')
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const aliveRef = useRef(true)
  useEffect(() => () => {
    aliveRef.current = false
  }, [],)

  function reset() {
    setFile(null)
    setSession(null)
    setPreview(null)
    setIncludeFiles(true)
    setConfirm('')
    setApplying(false)
    setProgress(null)
    setResult(null)
    setError(null)
  }

  async function fetchPreview(restoreId) {
    setPreviewLoading(true)
    try {
      const res = await adminFetch(`/api/restore/${restoreId}/preview`)
      const data = await res.json().catch(() => ({}))
      if (!aliveRef.current) return
      if (!res.ok) throw new Error(data.error || 'Preview failed.')
      setPreview(data)
    } catch (err) {
      if (!aliveRef.current) return
      setError(err.message || 'Preview failed.')
    } finally {
      if (aliveRef.current) setPreviewLoading(false)
    }
  }

  async function handleUpload() {
    if (!file || uploading) return
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await adminForm('/api/restore/upload', 'POST', form, { timeoutMs: UPLOAD_TIMEOUT_MS })
      const data = await res.json().catch(() => ({}))
      if (!aliveRef.current) return
      if (!res.ok) throw new Error(data.error || 'Upload failed.')
      setSession(data)
      toast.success('Backup validated — review the preview below.')
      fetchPreview(data.restoreId)
    } catch (err) {
      if (!aliveRef.current) return
      setError(err.message || 'Upload failed.')
    } finally {
      if (aliveRef.current) setUploading(false)
    }
  }

  async function pollJob(jobId) {
    if (!aliveRef.current) return
    try {
      const res = await adminFetch(`/api/jobs/${jobId}?status=true`)
      const data = await res.json().catch(() => ({}))
      if (!aliveRef.current) return
      if (!res.ok) throw new Error(data.error || 'Status check failed.')
      if (data.status === 'ready') {
        setProgress(data.progress || { phase: 'done', label: 'Restore complete.' })
        setResult(data.result || null)
        setApplying(false)
        if (data.result) toast.success('Restore complete — snapshot saved.')
        else setError('Restore finished without a result summary.')
        return
      }
      if (data.status === 'failed') {
        setApplying(false)
        setError(data.error || 'Restore failed.')
        return
      }
      setProgress(data.progress || { phase: 'queued', label: 'Restore queued…' })
      setTimeout(() => pollJob(jobId), pollInterval)
    } catch (err) {
      if (!aliveRef.current) return
      setApplying(false)
      setError(err.message || 'Status check failed.')
    }
  }

  async function handleApply() {
    if (!session || applying) return
    setError(null)
    setApplying(true)
    setProgress({ phase: 'queued', label: 'Restore queued…' })
    try {
      const res = await adminJson(`/api/restore/${session.restoreId}/apply`, 'POST', {
        confirm,
        includeFiles,
      })
      const data = await res.json().catch(() => ({}))
      if (!aliveRef.current) return
      if (!res.ok) throw new Error(data.error || 'Apply failed.')
      toast.info('Restore running — current data is snapshotted first.')
      pollJob(data.jobId)
    } catch (err) {
      if (!aliveRef.current) return
      setApplying(false)
      setError(err.message || 'Apply failed.')
    }
  }

  async function handleSnapshotDownload() {
    if (!session) return
    try {
      const res = await adminFetch(`/api/restore/${session.restoreId}/snapshot`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Snapshot download failed.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lmsa-pre-restore-${session.restoreId}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Snapshot download started')
    } catch (err) {
      toast.error(err.message || 'Snapshot download failed.')
    }
  }

  async function handleDiscard() {
    if (session) {
      try {
        await adminFetch(`/api/restore/${session.restoreId}`, { method: 'DELETE' })
      } catch {
        // Discard is best-effort; the session expires on its own.
      }
    }
    reset()
  }

  const canApply = !!session && !!preview && !previewLoading && !applying && !result && confirm === CONFIRM_PHRASE
  const pct = progressPercent(progress)
  const backupFileCount = session ? Object.values(session.files || {}).reduce((n, b) => n + (b.count || 0), 0) : 0

  return (
    <div className="restore-section">
      <div
        style={{
          background: 'var(--white)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px',
        }}
      >
        <div className="u-fs-13 u-fw-500">Restore from backup</div>
        <div className="u-fs-11 u-c-muted u-mt-2" style={{ lineHeight: 1.5 }}>
          Upload a backup ZIP to merge it back into the live system. Backup rows overwrite same-record live rows;
          live-only records and files are never deleted. Current data is snapshotted automatically before anything is
          applied.
        </div>

        {error && (
          <div className="u-mt-10 u-fs-12" role="alert" style={{ color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {!session && (
          <div className="u-flex u-gap-8 u-ai-center u-mt-10" style={{ flexWrap: 'wrap' }}>
            <label className="u-fs-12" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Backup ZIP file
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-label="Backup ZIP file"
              />
            </label>
            <button className="btn-gold u-fs-12 u-p-7-14" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Uploading…' : 'Upload & validate'}
            </button>
          </div>
        )}

        {session && !result && (
          <>
            <div className="u-mt-10 u-fs-12" style={{ lineHeight: 1.6 }}>
              <div>
                <span className="u-fw-500">Backup taken:</span> {formatDate(session.backupGeneratedAt)}
              </div>
              <div>
                <span className="u-fw-500">Contents:</span> {(session.totals?.rows ?? 0).toLocaleString()} rows ·{' '}
                {(session.totals?.files ?? 0).toLocaleString()} files
              </div>
            </div>

            {(session.warnings || []).length > 0 && (
              <ul className="u-fs-11 u-mt-10" style={{ color: 'var(--warning-text, #8a5a00)', paddingLeft: '18px' }}>
                {session.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            {previewLoading && <div className="u-fs-12 u-c-muted u-mt-10">Loading live-vs-backup preview…</div>}

            {preview && (
              <div className="u-mt-10" style={{ overflowX: 'auto' }}>
                <table className="u-fs-11" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '4px 8px' }}>Table</th>
                      <th style={{ padding: '4px 8px' }}>In backup</th>
                      <th style={{ padding: '4px 8px' }}>Live now</th>
                      <th style={{ padding: '4px 8px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.tables.map((t) => (
                      <tr key={t.table} style={{ borderTop: '0.5px solid var(--border)' }}>
                        <td style={{ padding: '4px 8px' }}>{t.table}</td>
                        <td style={{ padding: '4px 8px' }}>{(t.backupRows ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '4px 8px' }}>
                          {t.liveRows === null || t.liveRows === undefined ? '—' : t.liveRows.toLocaleString()}
                        </td>
                        <td style={{ padding: '4px 8px' }} title={t.reason || ''}>
                          {t.action === 'merge' ? (
                            <span style={{ color: 'var(--success-text)' }}>Merge</span>
                          ) : (
                            <span className="u-c-muted">Skip</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(preview.warnings || []).length > 0 && (
                  <ul className="u-fs-11 u-mt-10" style={{ color: 'var(--warning-text, #8a5a00)', paddingLeft: '18px' }}>
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!applying && (
              <div className="u-mt-10 u-flex u-gap-8 u-ai-center" style={{ flexWrap: 'wrap' }}>
                <label className="u-fs-12" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={includeFiles}
                    onChange={(e) => setIncludeFiles(e.target.checked)}
                    aria-label={`Restore files (${backupFileCount} in backup)`}
                  />
                  Restore files ({backupFileCount.toLocaleString()} in backup)
                </label>
              </div>
            )}

            {!applying && (
              <div className="u-mt-10 u-flex u-gap-8 u-ai-center" style={{ flexWrap: 'wrap' }}>
                <label className="u-fs-12" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Type {CONFIRM_PHRASE} to confirm
                  <input
                    type="text"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
                    style={{ padding: '6px 10px', border: '0.5px solid var(--border)', borderRadius: '4px' }}
                  />
                </label>
                <button className="btn-danger u-fs-12 u-p-7-14" onClick={handleApply} disabled={!canApply}>
                  Apply restore
                </button>
                <button className="btn-outline u-fs-12 u-p-7-14" onClick={handleDiscard}>
                  Discard
                </button>
              </div>
            )}

            {applying && (
              <div className="u-mt-10">
                <div className="u-fs-12">{progress?.label || 'Restore running…'}</div>
                {pct !== null ? (
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Restore progress"
                    style={{
                      height: '8px',
                      borderRadius: '4px',
                      background: 'var(--bg)',
                      border: '0.5px solid var(--border)',
                      marginTop: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold, #c9a227)' }} />
                  </div>
                ) : (
                  <div className="u-fs-11 u-c-muted u-mt-2">Working… this can take a few minutes.</div>
                )}
              </div>
            )}
          </>
        )}

        {result && (
          <>
            <div className="u-mt-10 u-fs-12" style={{ lineHeight: 1.6 }} role="status">
              <div>
                <span className="u-fw-500">Rows restored:</span>{' '}
                {(result.totals?.rowsRestored ?? 0).toLocaleString()} ({(result.totals?.rowsSkipped ?? 0).toLocaleString()}{' '}
                skipped)
              </div>
              <div>
                <span className="u-fw-500">Files restored:</span>{' '}
                {result.files?.skipped ? 'skipped by choice' : (result.totals?.filesRestored ?? 0).toLocaleString()}
                {!result.files?.skipped && (result.totals?.filesFailed ?? 0) > 0 && (
                  <> ({(result.totals.filesFailed).toLocaleString()} failed)</>
                )}
              </div>
              <div>
                <span className="u-fw-500">Pre-restore snapshot:</span> {formatBytes(result.snapshotBytes)} — keep it
                until you have verified the data.
              </div>
            </div>

            {(result.warnings || []).length > 0 && (
              <ul className="u-fs-11 u-mt-10" style={{ color: 'var(--warning-text, #8a5a00)', paddingLeft: '18px' }}>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            {Object.entries(result.tables || {}).some(([, t]) => (t.errors || []).length > 0) && (
              <details className="u-mt-10 u-fs-11">
                <summary style={{ cursor: 'pointer' }}>Row-level details (first few per table)</summary>
                <ul style={{ paddingLeft: '18px' }}>
                  {Object.entries(result.tables)
                    .filter(([, t]) => (t.errors || []).length > 0)
                    .map(([table, t]) => (
                      <li key={table}>
                        <span className="u-fw-500">{table}</span> — restored {t.restored}, skipped {t.skipped}
                        <ul style={{ paddingLeft: '18px' }}>
                          {t.errors.slice(0, 5).map((e, i) => (
                            <li key={i}>
                              {e.row}: {e.error}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              </details>
            )}

            <div className="u-mt-10 u-flex u-gap-8 u-ai-center" style={{ flexWrap: 'wrap' }}>
              <button className="btn-gold u-fs-12 u-p-7-14" onClick={handleSnapshotDownload}>
                Download pre-restore snapshot
              </button>
              <button className="btn-outline u-fs-12 u-p-7-14" onClick={handleDiscard}>
                Start over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
