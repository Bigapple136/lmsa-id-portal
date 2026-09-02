import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, adminJson } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import EmptyState from '../components/EmptyState'
import NotificationCenter from '../components/NotificationCenter'
import SessionTimeout from '../components/SessionTimeout'

const STATUS_COLORS = {
  active: { bg: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success-border)' },
  retired: { bg: '#FEF6E4', text: '#8A5C0A', border: '#E8B84E' },
  revoked: { bg: 'var(--error-bg)', text: 'var(--error-text)', border: 'var(--error-border)' },
}

const STATUS_LABELS = {
  active: 'Active (Signing)',
  retired: 'Retired (Verify Only)',
  revoked: 'Revoked (Rejected)',
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function KidBadge({ kid }) {
  return (
    <code style={{
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      background: 'var(--border)',
      padding: '2px 6px',
      borderRadius: '4px',
      color: 'var(--text)',
    }}>
      {kid}
    </code>
  )
}

function StatusBadgeCell({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.revoked
  const label = STATUS_LABELS[status] || status
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: style.bg,
      color: style.text,
      border: `1px solid ${style.border}`,
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: style.text,
      }} />
      {label}
    </span>
  )
}

export default function QrKeyManagement() {
  const toast = useToast()
  const navigate = useNavigate()
  const [keys, setKeys] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [rotateModalOpen, setRotateModalOpen] = useState(false)
  const [rotateLoading, setRotateLoading] = useState(false)
  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [revokeKid, setRevokeKid] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState('')
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [inspectModalOpen, setInspectModalOpen] = useState(false)
  const [inspectToken, setInspectToken] = useState('')
  const [inspectResult, setInspectResult] = useState(null)
  const [inspectLoading, setInspectLoading] = useState(false)

  async function loadKeys() {
    try {
      const res = await adminFetch('/api/qr/keys')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load keys')
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (err) {
      toast.error('Failed to load QR keys: ' + err.message)
    }
  }

  async function loadAudit() {
    setAuditLoading(true)
    try {
      const res = await adminFetch('/api/qr/audit')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load audit log')
      const data = await res.json()
      setAudit(data.audit || [])
    } catch (err) {
      toast.error('Failed to load audit log: ' + err.message)
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    async function loadInitialData() {
      setLoading(true)
      await Promise.all([loadKeys(), loadAudit()])
      if (mounted) setLoading(false)
    }
    loadInitialData()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRotate() {
    setRotateLoading(true)
    try {
      const res = await adminJson('/api/qr/keys/rotate', 'POST', {})
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Rotation failed')
      }
      const data = await res.json()
      toast.success(`Key rotated: ${data.old_kid} → ${data.new_kid}`)
      setRotateModalOpen(false)
      await loadKeys()
      await loadAudit()
    } catch (err) {
      toast.error('Rotation failed: ' + err.message)
    } finally {
      setRotateLoading(false)
    }
  }

  async function handleRevoke() {
    if (!revokeKid) return
    if (!revokeReason.trim()) {
      toast.error('Please provide a reason for revocation')
      return
    }
    if (revokeConfirm.trim() !== revokeKid) {
      toast.error('Type the key ID exactly to confirm revocation')
      return
    }
    setRevokeLoading(true)
    try {
      const res = await adminJson(`/api/qr/keys/revoke/${revokeKid}`, 'POST', { reason: revokeReason })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Revocation failed')
      }
      toast.success(`Key ${revokeKid} revoked`)
      setRevokeModalOpen(false)
      setRevokeKid(null)
      setRevokeReason('')
      setRevokeConfirm('')
      await loadKeys()
      await loadAudit()
    } catch (err) {
      toast.error('Revocation failed: ' + err.message)
    } finally {
      setRevokeLoading(false)
    }
  }

  async function handleInspect() {
    if (!inspectToken.trim()) {
      toast.error('Please enter a token to inspect')
      return
    }
    setInspectLoading(true)
    setInspectResult(null)
    try {
      const res = await adminFetch(`/api/qr/inspect/${encodeURIComponent(inspectToken.trim())}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Inspection failed')
      }
      const data = await res.json()
      setInspectResult(data)
    } catch (err) {
      toast.error('Inspection failed: ' + err.message)
    } finally {
      setInspectLoading(false)
    }
  }

  function openRevokeModal(kid) {
    setRevokeKid(kid)
    setRevokeReason('')
    setRevokeConfirm('')
    setRevokeModalOpen(true)
  }

  function openInspectModal() {
    setInspectToken('')
    setInspectResult(null)
    setInspectModalOpen(true)
  }

  const activeKey = keys.find(k => k.status === 'active')
  const keyCounts = keys.reduce(
    (acc, key) => ({ ...acc, [key.status]: (acc[key.status] || 0) + 1 }),
    { active: 0, retired: 0, revoked: 0 },
  )

  return (
    <div className="page-outer">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <button className="btn-back" onClick={() => navigate('/admin')}>
            ← Dashboard
          </button>
          <div>
            <div className="topbar-title">QR Key Management</div>
            <div className="topbar-sub">Credential security · signing keys and audit trail</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationCenter />
          <button className="btn-outline-light" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <div className="admin-body admin-subview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--navy)', marginBottom: '4px' }}>
            QR Key Management
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Rotate, revoke, and inspect QR signing keys. Active key signs new tokens; retired keys verify only; revoked keys reject all tokens.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-gold" onClick={openInspectModal} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>qr_code_scanner</span>
            QR Inspector
          </button>
          <button className="btn-gold" onClick={() => setRotateModalOpen(true)} disabled={rotateLoading} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>rotate_right</span>
            Rotate Key
          </button>
        </div>
      </div>

      <section className="qr-key-posture" aria-label="QR key security posture">
        <div className="qr-key-posture-title">Current credential security posture</div>
        {loading ? (
          <div className="admin-loading-state">Loading key ring…</div>
        ) : (
          <div className="qr-key-posture-grid">
            <div className="qr-key-posture-stat">
              <strong>{keyCounts.active}</strong>
              <span>active signing key</span>
            </div>
            <div className="qr-key-posture-stat">
              <strong>{keyCounts.retired}</strong>
              <span>retired verification keys</span>
            </div>
            <div className="qr-key-posture-stat">
              <strong>{keyCounts.revoked}</strong>
              <span>revoked rejected keys</span>
            </div>
            <div className="qr-key-posture-stat">
              <strong>{audit.length}</strong>
              <span>audit entries shown</span>
            </div>
          </div>
        )}
      </section>

      {/* Active Key Banner */}
      {activeKey && (
        <div style={{
          background: 'linear-gradient(135deg, var(--success-bg) 0%, #E6F4EC 100%)',
          border: '1px solid var(--success-border)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--success-text)', fontSize: '24px' }}>verified</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--success-text)' }}>Active Signing Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <KidBadge kid={activeKey.kid} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Created {formatDate(activeKey.created_at)}</span>
                {activeKey.rotated_from && (
                  <span style={{ fontSize: '11px', color: 'var(--success-text)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                    Rotated from {activeKey.rotated_from}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
            <span>Rotates all new QR codes to new key</span>
          </div>
        </div>
      )}

      {/* Key Ring Table */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--navy)' }}>Key Ring</h2>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
        </div>

        {keys.length === 0 ? (
          <EmptyState
            icon="vpn_key"
            title="No QR keys found"
            description="Run the migration to seed the initial k_legacy key, or rotate to create a new active key."
            actionLabel="Rotate Key"
            onAction={() => setRotateModalOpen(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--white)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rotated</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revoked</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rotated From</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.kid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' }}>
                      <KidBadge kid={key.kid} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadgeCell status={key.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '12px' }}>{formatDate(key.created_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>{formatDate(key.rotated_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>{formatDate(key.revoked_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                      {key.rotated_from ? <KidBadge kid={key.rotated_from} /> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {key.status === 'retired' && (
                          <button
                            className="btn-gold"
                            onClick={() => openRevokeModal(key.kid)}
                            style={{ fontSize: '11px', padding: '6px 12px' }}
                            title="Revoke this retired key (rejects all its tokens)"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>block</span>
                            Revoke
                          </button>
                        )}
                        {key.status === 'revoked' && (
                          <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', color: 'var(--error-text)' }}>block</span>
                            Revoked
                          </span>
                        )}
                        {key.status === 'active' && (
                          <span style={{ fontSize: '11px', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>verified</span>
                            Signing
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit Log */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--navy)' }}>Audit Log</h2>
          <button
            className="btn-secondary"
            onClick={loadAudit}
            disabled={auditLoading}
            style={{ fontSize: '11px', padding: '6px 12px' }}
          >
            {auditLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {audit.length === 0 ? (
          <EmptyState
            icon="history"
            title="No audit entries"
            description="Key rotations and revocations will appear here."
          />
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--white)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '180px' }}>Actor</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Key ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry, idx) => (
                  <tr key={entry.id} style={{ borderBottom: idx < audit.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{formatDateTime(entry.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        background: entry.action === 'rotate' ? 'var(--success-bg)' : 'var(--error-bg)',
                        color: entry.action === 'rotate' ? 'var(--success-text)' : 'var(--error-text)',
                        border: entry.action === 'rotate' ? '1px solid var(--success-border)' : '1px solid var(--error-border)',
                      }}>
                        {entry.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '12px' }}>{entry.actor}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {entry.kid ? <KidBadge kid={entry.kid} /> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {entry.old_kid && <span>Old: <KidBadge kid={entry.old_kid} /></span>}
                        {entry.new_kid && <span>New: <KidBadge kid={entry.new_kid} /></span>}
                        {entry.reason && <span style={{ fontStyle: 'italic' }}>"{entry.reason}"</span>}
                        {entry.meta && Object.keys(entry.meta).length > 0 && (
                          <details style={{ marginTop: '4px' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--hint)' }}>Meta</summary>
                            <pre style={{ marginTop: '4px', fontSize: '10px', background: 'var(--bg)', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                              {JSON.stringify(entry.meta, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rotate Modal */}
      {rotateModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rotate-key-dialog-title"
            style={{ maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="rotate-key-dialog-title" style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Rotate QR Signing Key</h3>
              <button type="button" className="modal-close" onClick={() => setRotateModalOpen(false)} aria-label="Close rotate key dialog">✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
                This will create a new active signing key and retire the current active key.
                All <strong>new QR codes</strong> will be signed with the new key. Existing tokens
                signed by the retired key will <strong>continue to verify</strong>.
              </p>
              {activeKey && (
                <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>Current Active Key</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KidBadge kid={activeKey.kid} />
                    <span style={{ color: 'var(--success-text)', fontWeight: '500' }}>Signing</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => setRotateModalOpen(false)} disabled={rotateLoading}>
                  Cancel
                </button>
                <button className="btn-gold" onClick={handleRotate} disabled={rotateLoading} style={{ fontWeight: '600' }}>
                  {rotateLoading ? 'Rotating...' : 'Rotate Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-key-dialog-title"
            style={{ maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="revoke-key-dialog-title" style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Revoke Key</h3>
              <button type="button" className="modal-close" onClick={() => setRevokeModalOpen(false)} aria-label="Close revoke key dialog">✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
                You are about to revoke <strong><KidBadge kid={revokeKid} /></strong>.
              </p>
              <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: 'var(--error-text)' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>⚠ This action is irreversible</strong>
                All tokens signed by this key will be <strong>rejected on verification</strong> (403). Students with cards using this key will need new QR codes issued.
              </div>
              <div className="field-group" style={{ marginBottom: '16px' }}>
                <label className="field-label" htmlFor="revokeReason">Reason for revocation (required)</label>
                <textarea
                  id="revokeReason"
                  className="field-input"
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g., Key compromise suspected, scheduled rotation, key owner left organization..."
                  style={{ fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>
              <div className="field-group" style={{ marginBottom: '16px' }}>
                <label className="field-label" htmlFor="revokeConfirm">Type key ID to confirm</label>
                <input
                  id="revokeConfirm"
                  className="field-input"
                  value={revokeConfirm}
                  onChange={(e) => setRevokeConfirm(e.target.value)}
                  placeholder={revokeKid || 'key ID'}
                  autoComplete="off"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => setRevokeModalOpen(false)} disabled={revokeLoading}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={handleRevoke} disabled={revokeLoading || !revokeReason.trim() || revokeConfirm.trim() !== revokeKid}>
                  {revokeLoading ? 'Revoking...' : 'Revoke Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Inspector Modal */}
      {inspectModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-token-dialog-title"
            style={{ maxWidth: '700px', maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="inspect-token-dialog-title" style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>QR Token Inspector</h3>
              <button type="button" className="modal-close" onClick={() => setInspectModalOpen(false)} aria-label="Close QR token inspector">✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div className="field-group" style={{ marginBottom: '16px' }}>
                <label className="field-label" htmlFor="inspectToken">Paste QR Token</label>
                <textarea
                  id="inspectToken"
                  className="field-input"
                  rows={3}
                  value={inspectToken}
                  onChange={(e) => setInspectToken(e.target.value)}
                  placeholder="v2.eyJzaWQiOiJTVDAwMSIsImlhdCI6MTcw...k_2025_01_15.abc123def456"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
                <button className="btn-secondary" onClick={() => { setInspectToken(''); setInspectResult(null); }} disabled={inspectLoading}>
                  Clear
                </button>
                <button className="btn-gold" onClick={handleInspect} disabled={inspectLoading || !inspectToken.trim()}>
                  {inspectLoading ? 'Inspecting...' : 'Inspect Token'}
                </button>
              </div>

              {inspectResult && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--white)', overflow: 'hidden' }}>
                  {/* Summary Banner */}
                  <div style={{
                    padding: '16px 20px',
                    background: inspectResult.valid ? 'var(--success-bg)' : 'var(--error-bg)',
                    borderBottom: '1px solid ' + (inspectResult.valid ? 'var(--success-border)' : 'var(--error-border)'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: '24px',
                      color: inspectResult.valid ? 'var(--success-text)' : 'var(--error-text)',
                    }}>
                      {inspectResult.valid ? 'verified' : 'block'}
                    </span>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: inspectResult.valid ? 'var(--success-text)' : 'var(--error-text)' }}>
                        {inspectResult.summary}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Version: <strong>{inspectResult.token_info?.version?.toUpperCase() || '?'}</strong>
                        {inspectResult.token_info?.kid && (
                          <> · Key: <KidBadge kid={inspectResult.token_info.kid} /></>
                        )}
                        {inspectResult.key_info && (
                          <> · Key Status: <StatusBadgeCell status={inspectResult.key_info.status} /></>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                      {/* Token Info */}
                      <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token Details</h4>
                        <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                          <div><strong>Version:</strong> {inspectResult.token_info?.version?.toUpperCase() || '?'}</div>
                          {inspectResult.token_info?.kid && <div><strong>Key ID:</strong> <KidBadge kid={inspectResult.token_info.kid} /></div>}
                          {inspectResult.token_info?.claims && (
                            <>
                              <div><strong>Student ID:</strong> {inspectResult.token_info.claims.sid || '—'}</div>
                              <div><strong>Issued:</strong> {inspectResult.token_info.claims.iat ? new Date(inspectResult.token_info.claims.iat * 1000).toLocaleString() : '—'}</div>
                              <div><strong>Expires:</strong> {inspectResult.token_info.claims.exp ? new Date(inspectResult.token_info.claims.exp * 1000).toLocaleString() : 'Never'}</div>
                            </>
                          )}
                          {inspectResult.token_info?.student_id && <div><strong>Student ID (v1):</strong> {inspectResult.token_info.student_id}</div>}
                        </div>
                      </div>

                      {/* Key Info */}
                      <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Status</h4>
                        <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                          {inspectResult.key_info ? (
                            <>
                              <div><strong>Key ID:</strong> <KidBadge kid={inspectResult.key_info.kid} /></div>
                              <div><strong>Status:</strong> <StatusBadgeCell status={inspectResult.key_info.status} /></div>
                            </>
                          ) : (
                            <div style={{ color: 'var(--muted)' }}>Key not found in key ring</div>
                          )}
                        </div>
                      </div>

                      {/* Student Info */}
                      {inspectResult.student && (
                        <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Record</h4>
                          <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                            <div><strong>Name:</strong> {inspectResult.student.full_name || '—'}</div>
                            <div><strong>Student ID:</strong> {inspectResult.student.student_id || '—'}</div>
                            <div><strong>Level:</strong> {inspectResult.student.year_level || '—'}</div>
                            <div><strong>Programme:</strong> {inspectResult.student.program || '—'}</div>
                            {inspectResult.student.qr_url && (
                              <div><strong>QR URL:</strong> <a href={inspectResult.student.qr_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontSize: '11px', wordBreak: 'break-all' }}>View QR</a></div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Raw Claims (for v2) */}
                      {inspectResult.token_info?.claims && (
                        <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw Claims (v2)</h4>
                          <pre style={{ margin: 0, fontSize: '10px', background: 'var(--white)', padding: '12px', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>
                            {JSON.stringify(inspectResult.token_info.claims, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      <SessionTimeout />
    </div>
  )
}
