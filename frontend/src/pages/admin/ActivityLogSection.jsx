import { useState, useEffect } from 'react'
import { adminFetch } from '../../lib/api'

function humanizeAction(action) {
  const labels = {
    renew_cohort: 'Renewed cohort',
    student_delete: 'Deleted student',
    student_photo_remove: 'Removed student photo',
    student_signature_remove: 'Removed student signature',
    manual_confirmation: 'Manually confirmed student',
    layout_save: 'Saved layout',
    layout_revert: 'Reverted layout',
  }
  return labels[action] || action
}

function ActivityLogSection() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin-actions?limit=50')
      setEntries(res.ok ? await res.json() : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  useEffect(() => {
    if (open && !loaded) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div
      className="u-bg-bg u-bd u-r-8 u-p-12"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--text)',
        }}
      >
        Recent admin activity
        <span style={{ fontSize: '10px', color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div className="u-mt-10">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={load}
              disabled={loading}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {entries.length === 0 && !loading ? (
            <p className="u-fs-12 u-c-muted">No recorded actions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
              {entries.map((e) => (
                <div key={e.id} style={{ fontSize: '12px', borderBottom: '0.5px solid var(--border)', paddingBottom: '8px' }}>
                  <div className="u-flex u-jc-between u-gap-8">
                    <span className="u-fw-600 u-c-text">{humanizeAction(e.action)}</span>
                    <span className="u-c-muted u-shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <div className="u-c-muted u-mt-2">
                    {e.admin_email || 'unknown admin'}
                    {e.target_type && ` · ${e.target_type}${e.target_id ? `:${e.target_id}` : ''}`}
                  </div>
                  {e.details && Object.keys(e.details).length > 0 && (
                    <div style={{ color: 'var(--muted)', marginTop: '2px', fontFamily: 'monospace', fontSize: '11px' }}>
                      {JSON.stringify(e.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActivityLogSection
