import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'
import SessionTimeout from '../components/SessionTimeout'
import NotificationCenter from '../components/NotificationCenter'
import { Button, Input, Select, Card, Badge, Table } from '../components/ui'

export default function AdminManagementPage() {
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('support_admin')
  const [submitting, setSubmitting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/admin'); return }
      setCurrentUserId(session.user.id)
      fetchAdmins()
    })
  }, [])

  async function fetchAdmins() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admins')
      if (res.status === 403) { setError('Access denied.'); return }
      if (!res.ok) { setError('Failed to load admins.'); return }
      setAdmins(await res.json())
    } catch { setError('Failed to load admins.') }
    finally { setLoading(false) }
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
      if (!res.ok) { setInviteMsg(data.error || 'Failed to invite admin.'); return }
      setAdmins((prev) => [...prev, data])
      setEmail(''); setName(''); setInviteMsg('Invite sent! They will receive an email to set their password.')
    } catch { setInviteMsg('Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remove this admin? They will lose access immediately.')) return
    try {
      const res = await adminFetch(`/api/admins/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast?.error(data.error || 'Failed to remove admin.'); return }
      setAdmins((prev) => prev.filter((a) => a.id !== id))
    } catch { toast?.error('Failed to remove admin.') }
  }

  async function handleRoleChange(id, newRole) {
    try {
      const res = await adminFetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) { toast?.error(data.error || 'Failed to update role.'); return }
      setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, role: newRole } : a)))
    } catch { toast?.error('Failed to update role.') }
  }

  const isLastAdmin = admins.length === 1

  const headers = [
    { key: 'name', label: 'Name', render: (row) => (
      <span style={{ fontWeight: 500 }}>
        {row.name || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
        {row.id === currentUserId && <Badge variant="amber" style={{ marginLeft: '6px' }}>You</Badge>}
      </span>
    )},
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => (
      row.id === currentUserId ? (
        <span style={{ color: 'var(--muted)' }}>{row.role || 'admin'}</span>
      ) : (
        <select value={row.role || 'support_admin'} onChange={(e) => handleRoleChange(row.id, e.target.value)}
          style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
          <option value="support_admin">Support Admin</option>
          <option value="admin">Full Admin</option>
        </select>
      )
    )},
    { key: 'created_at', label: 'Added', render: (row) => (
      <span style={{ color: 'var(--muted)' }}>
        {row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </span>
    )},
    { key: 'actions', label: 'Action', render: (row) => (
      row.id === currentUserId ? (
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>—</span>
      ) : isLastAdmin ? (
        <span style={{ fontSize: '11px', color: 'var(--muted)' }} title="Cannot remove the last admin">—</span>
      ) : (
        <button onClick={() => handleRemove(row.id)}
          style={{ fontSize: '10px', color: '#CC0000', background: 'transparent', padding: '2px 8px', borderRadius: '20px', border: '1px solid #CC0000', cursor: 'pointer' }}>
          Remove
        </button>
      )
    )},
  ]

  return (
    <div className="page-outer">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>← Dashboard</Button>
          <div className="topbar-title">Manage Admins</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <NotificationCenter />
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </div>

      <div className="admin-body">
        <Card>
          <div className="section-title">Invite new admin</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
            An invitation email will be sent. They will set their own password before gaining access.
          </p>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <Input label="Full name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <Input label="Email address" type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'support_admin', label: 'Support Admin' },
                  { value: 'admin', label: 'Full Admin' },
                ]} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1px' }}>
              <Button variant="gold" type="submit" disabled={submitting} loading={submitting}>Send Invite</Button>
            </div>
          </form>
          {inviteMsg && (
            <div className={inviteMsg.startsWith('Invite') ? 'success-box' : 'error-box'} style={{ marginBottom: 'var(--space-3)' }}>
              {inviteMsg}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-title">Admin accounts ({admins.length})</div>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : error ? (
            <div className="error-box">{error}</div>
          ) : (
            <Table headers={headers} rows={admins} emptyMessage="No admin accounts found." />
          )}
        </Card>
      </div>
      <SessionTimeout />
    </div>
  )
}
