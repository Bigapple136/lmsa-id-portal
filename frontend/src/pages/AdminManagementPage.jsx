import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'
import SessionTimeout from '../components/SessionTimeout'
import { useToast } from '../components/Toast'
import NotificationCenter from '../components/NotificationCenter'
import ConfirmDialog from '../components/ConfirmDialog'

export default function AdminManagementPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('support_admin')
  const [submitting, setSubmitting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [pendingRemove, setPendingRemove] = useState(null)
  const [pendingRoleChange, setPendingRoleChange] = useState(null)
  const [adminActionLoading, setAdminActionLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/admin')
        return
      }
      setCurrentUserId(session.user.id)
      fetchAdmins()
    })
  }, [])

  async function fetchAdmins() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admins')
      if (res.status === 403) {
        setError('Access denied.')
        return
      }
      if (!res.ok) {
        setError('Failed to load admins.')
        return
      }
      const data = await res.json()
      setAdmins(data)
    } catch {
      setError('Failed to load admins.')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setInviteMsg('')
    try {
      const res = await adminFetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteMsg(data.error || 'Failed to invite admin.')
        return
      }
      setAdmins((prev) => [...prev, data])
      setEmail('')
      setName('')
      setInviteMsg('Invite sent! They will receive an email to set their password.')
    } catch {
      setInviteMsg('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRemove(admin) {
    setPendingRemove(admin)
  }

  async function confirmRemove() {
    if (!pendingRemove) return
    setAdminActionLoading(true)
    try {
      const res = await adminFetch(`/api/admins/${pendingRemove.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove admin.')
        return
      }
      setAdmins((prev) => prev.filter((a) => a.id !== pendingRemove.id))
      setPendingRemove(null)
    } catch {
      toast.error('Failed to remove admin.')
    } finally {
      setAdminActionLoading(false)
    }
  }

  function handleRoleChange(admin, newRole) {
    if ((admin.role || 'support_admin') === newRole) return
    setPendingRoleChange({ admin, newRole })
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return
    setAdminActionLoading(true)
    try {
      const res = await adminFetch(`/api/admins/${pendingRoleChange.admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: pendingRoleChange.newRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update role.')
        return
      }
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === pendingRoleChange.admin.id ? { ...a, role: pendingRoleChange.newRole } : a,
        ),
      )
      setPendingRoleChange(null)
    } catch {
      toast.error('Failed to update role.')
    } finally {
      setAdminActionLoading(false)
    }
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isLastAdmin = admins.length === 1

  return (
    <div className="page-outer">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <button className="btn-back" onClick={() => navigate('/admin')}>
            ← Dashboard
          </button>
          <div className="topbar-title">Manage Admins</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationCenter />
          <button className="btn-outline-light" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove admin access?"
        confirmLabel="Remove admin"
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        loading={adminActionLoading}
      >
        <p>
          <strong>{pendingRemove?.email}</strong> will lose LMSA admin access immediately.
          This should only be done after confirming the person no longer needs portal access.
        </p>
        <div className="confirm-dialog-note">This access change is immediate and should match LMSA operator records.</div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingRoleChange)}
        title="Change admin role?"
        confirmLabel="Update role"
        variant="normal"
        onCancel={() => setPendingRoleChange(null)}
        onConfirm={confirmRoleChange}
        loading={adminActionLoading}
      >
        <p>
          Change <strong>{pendingRoleChange?.admin?.email}</strong> from{' '}
          <strong>{pendingRoleChange?.admin?.role || 'support_admin'}</strong> to{' '}
          <strong>{pendingRoleChange?.newRole}</strong>?
        </p>
        <p style={{ marginTop: '10px' }}>
          Full admins can manage higher-risk settings. Confirm this matches the intended LMSA access level.
        </p>
      </ConfirmDialog>

      <div className="admin-body">
        <div className="admin-card">
          <div className="section-title">Invite new admin</div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            An invitation email will be sent. They will set their own password before gaining
            access.
          </p>

          <form
            onSubmit={handleInvite}
            style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}
          >
            <div className="field-group" style={{ flex: '1 1 200px' }}>
              <label className="field-label" htmlFor="invite-admin-name">Full name</label>
              <input
                id="invite-admin-name"
                className="field-input"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field-group" style={{ flex: '1 1 240px' }}>
              <label className="field-label" htmlFor="invite-admin-email">Email address</label>
              <input
                id="invite-admin-email"
                className="field-input"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="field-group" style={{ flex: '0 0 140px' }}>
              <label className="field-label" htmlFor="invite-admin-role">Role</label>
              <select
                id="invite-admin-role"
                className="field-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="support_admin">Support Admin</option>
                <option value="admin">Full Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
              <button className="btn-gold" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>

          {inviteMsg && (
            <div
              className={inviteMsg.startsWith('Invite') ? 'success-box' : 'error-box'}
              style={{ marginBottom: '12px' }}
            >
              {inviteMsg}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="section-title">Admin accounts ({admins.length})</div>

          {loading ? (
            <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: '13px' }}>
              Loading...
            </div>
          ) : error ? (
            <div className="error-box">{error}</div>
          ) : (
            <div
              className="meta-table"
              style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.5fr 1fr 1fr auto',
                  gap: '8px',
                  padding: '10px 12px',
                  borderBottom: '2px solid var(--border)',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Name
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Email
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Role
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Added
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Action
                </span>
              </div>
              {admins.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.5fr 1fr 1fr auto',
                    gap: '8px',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name || (
                      <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                    )}
                    {a.id === currentUserId && (
                      <span
                        style={{
                          marginLeft: '6px',
                          fontSize: '10px',
                          background: 'var(--gold)',
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        You
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.email}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.id === currentUserId ? (
                      <span style={{ color: 'var(--muted)' }}>{a.role || 'admin'}</span>
                    ) : (
                      <select
                        value={a.role || 'support_admin'}
                        aria-label={`Change role for ${a.email}`}
                        onChange={(e) => handleRoleChange(a, e.target.value)}
                        style={{
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '0.5px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          maxWidth: '100%',
                        }}
                      >
                        <option value="support_admin">Support Admin</option>
                        <option value="admin">Full Admin</option>
                      </select>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(a.created_at)}
                  </span>
                  <span>
                    {a.id === currentUserId ? (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>—</span>
                    ) : isLastAdmin ? (
                      <span
                        style={{ fontSize: '11px', color: 'var(--muted)' }}
                        title="Cannot remove the last admin"
                      >
                        —
                      </span>
                    ) : (
                      <button
                        style={{
                          fontSize: '10px',
                          color: '#CC0000',
                          background: 'transparent',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          border: '0.5px solid #CC0000',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleRemove(a)}
                        aria-label={`Remove admin access for ${a.email}`}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <SessionTimeout />
    </div>
  )
}
