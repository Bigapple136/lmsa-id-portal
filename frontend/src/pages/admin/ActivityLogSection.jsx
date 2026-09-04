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
      style={{
        background: 'var(--bg)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
      }}
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
        <div style={{ marginTop: '10px' }}>
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
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>No recorded actions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
              {entries.map((e) => (
                <div key={e.id} style={{ fontSize: '12px', borderBottom: '0.5px solid var(--border)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text)' }}>{humanizeAction(e.action)}</span>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', marginTop: '2px' }}>
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
