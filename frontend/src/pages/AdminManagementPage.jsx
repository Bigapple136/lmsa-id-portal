import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'
import SessionTimeout from '../components/SessionTimeout'
import { useToast } from '../components/Toast'
import NotificationCenter from '../components/NotificationCenter'
import ConfirmDialog from '../components/ConfirmDialog'
import useBackgroundJobs from '../hooks/useBackgroundJobs'
import BackgroundJobsIndicator from '../components/BackgroundJobsIndicator'
import { runOptimistic } from '../lib/optimistic'

export default function AdminManagementPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const bgJobs = useBackgroundJobs()
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

    const emailSnapshot = email.trim()
    const nameSnapshot = name.trim()
    const roleSnapshot = role
    const prevAdmins = [...admins]

    // Optimistic: show invited admin immediately with pending state
    const optimisticAdmin = {
      id: `temp_${Date.now()}`,
      email: emailSnapshot,
      name: nameSnapshot || null,
      role: roleSnapshot,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }

    setAdmins((prev) => [...prev, optimisticAdmin])
    setEmail('')
    setName('')
    setInviteMsg('')
    toast.info(`Inviting ${emailSnapshot} — syncing in background...`)

    runOptimistic({
      label: `Invite admin ${emailSnapshot}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setAdmins(prevAdmins)
        setEmail(emailSnapshot)
        setName(nameSnapshot)
        setInviteMsg('Invite failed — reverted')
      },
      action: async () => {
        const res = await adminFetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailSnapshot, name: nameSnapshot || undefined, role: roleSnapshot }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to invite admin.')
        return data
      },
      onSuccess: (data) => {
        setAdmins((prev) => prev.map((a) => (a.id === optimisticAdmin.id ? data : a)))
        setInviteMsg('Invite sent! They will receive an email to set their password.')
      },
      onError: (err) => {
        setInviteMsg(err.message || 'Failed to invite admin.')
      },
      jobsApi: bgJobs,
      toast,
      type: 'create',
    })
  }

  function handleRemove(admin) {
    setPendingRemove(admin)
  }

  async function confirmRemove() {
    if (!pendingRemove) return
    const adminToRemove = pendingRemove
    const prevAdmins = [...admins]

    // Optimistic: remove immediately and close modal
    setAdmins((prev) => prev.filter((a) => a.id !== adminToRemove.id))
    setPendingRemove(null)
    toast.info(`Removing ${adminToRemove.email} — syncing...`)

    runOptimistic({
      label: `Remove admin ${adminToRemove.email}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setAdmins(prevAdmins)
        toast.error('Remove failed — reverted')
      },
      action: async () => {
        const res = await adminFetch(`/api/admins/${adminToRemove.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to remove admin.')
        return data
      },
      onSuccess: () => {
        toast.success(`${adminToRemove.email} removed`)
      },
      jobsApi: bgJobs,
      toast,
      type: 'delete',
    })
  }

  function handleRoleChange(admin, newRole) {
    if ((admin.role || 'support_admin') === newRole) return
    setPendingRoleChange({ admin, newRole })
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return
    const { admin, newRole } = pendingRoleChange
    const prevAdmins = [...admins]
    const oldRole = admin.role

    // Optimistic: update role immediately and close modal
    setAdmins((prev) =>
      prev.map((a) => (a.id === admin.id ? { ...a, role: newRole } : a)),
    )
    setPendingRoleChange(null)
    toast.info(`Updating role for ${admin.email} — syncing...`)

    runOptimistic({
      label: `Update role for ${admin.email}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setAdmins(prevAdmins)
        toast.error('Role update failed — reverted')
      },
      action: async () => {
        const res = await adminFetch(`/api/admins/${admin.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update role.')
        return data
      },
      onSuccess: () => {
        toast.success(`Role updated to ${newRole}`)
      },
      jobsApi: bgJobs,
      toast,
      type: 'update',
    })
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
          <div className="topbar-title">
            Manage Admins
            {bgJobs.hasPending && (
              <span style={{ marginLeft: '10px', color: '#60A5FA', fontSize: '11px', fontWeight: 400 }}>
                ● {bgJobs.pendingCount} syncing
              </span>
            )}
          </div>
        </div>
        <div className="u-flex u-ai-center u-gap-8">
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
        <p className="u-mt-10">
          Full admins can manage higher-risk settings. Confirm this matches the intended LMSA access level.
        </p>
      </ConfirmDialog>

      <div className="admin-body">
        <div className="admin-card">
          <div className="section-title">Invite new admin</div>
          <p className="u-fs-13 u-c-muted u-mb-16">
            An invitation email will be sent. They will set their own password before gaining
            access.
          </p>

          <form
            onSubmit={handleInvite}
            className="u-flex u-gap-10 u-wrap u-mb-12"
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
              className={`${inviteMsg.startsWith('Invite') ? 'success-box' : 'error-box'} u-mb-12`}
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
                <span className="u-fs-11 u-fw-600 u-c-muted u-upper u-ls-wide">Name</span>
                <span className="u-fs-11 u-fw-600 u-c-muted u-upper u-ls-wide">Email</span>
                <span className="u-fs-11 u-fw-600 u-c-muted u-upper u-ls-wide">Role</span>
                <span className="u-fs-11 u-fw-600 u-c-muted u-upper u-ls-wide">Added</span>
                <span className="u-fs-11 u-fw-600 u-c-muted u-upper u-ls-wide">Action</span>
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
                    opacity: a._optimistic ? 0.7 : 1,
                  }}
                >
                  <span className="u-fs-13 u-fw-500 u-c-text u-ov-hidden u-ellipsis u-nowrap">
                    {a.name || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
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
                    {a._optimistic && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: '#3B82F6' }}>● syncing</span>
                    )}
                  </span>
                  <span className="u-fs-13 u-c-text u-ov-hidden u-ellipsis u-nowrap">{a.email}</span>
                  <span className="u-fs-12 u-ov-hidden u-ellipsis u-nowrap">
                    {a.id === currentUserId ? (
                      <span className="u-c-muted">{a.role || 'admin'}</span>
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
                  <span className="u-fs-12 u-c-muted u-ov-hidden u-ellipsis u-nowrap">
                    {formatDate(a.created_at)}
                  </span>
                  <span>
                    {a.id === currentUserId ? (
                      <span className="u-fs-11 u-c-muted">—</span>
                    ) : isLastAdmin ? (
                      <span className="u-fs-11 u-c-muted" title="Cannot remove the last admin">—</span>
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
      <BackgroundJobsIndicator jobs={bgJobs.jobs} onClear={bgJobs.clearJobs} />
      <SessionTimeout />
    </div>
  )
}
