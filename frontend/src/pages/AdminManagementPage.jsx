import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'

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
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role })
      })
      const data = await res.json()
      if (!res.ok) { setInviteMsg(data.error || 'Failed to invite admin.'); return }
      setAdmins(prev => [...prev, data])
      setEmail('')
      setName('')
      setInviteMsg('Invite sent! They will receive an email to set their password.')
    } catch {
      setInviteMsg('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remove this admin? They will lose access immediately.')) return
    try {
      const res = await adminFetch(`/api/admins/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to remove admin.'); return }
      setAdmins(prev => prev.filter(a => a.id !== id))
    } catch {
      alert('Failed to remove admin.')
    }
  }

  async function handleRoleChange(id, newRole) {
    try {
      const res = await adminFetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to update role.'); return }
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, role: newRole } : a))
    } catch {
      alert('Failed to update role.')
    }
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  }

  const isLastAdmin = admins.length === 1

  return (
    <div className="page-outer">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <button className="btn-back" onClick={() => navigate('/admin')}>← Dashboard</button>
          <div className="topbar-title">Manage Admins</div>
        </div>
        <button className="btn-outline-light" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <div className="admin-body">
        <div className="admin-card">
          <div className="section-title">Invite new admin</div>
          <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'16px' }}>
            An invitation email will be sent. They will set their own password before gaining access.
          </p>

          <form onSubmit={handleInvite} style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
            <div className="field-group" style={{ flex:'1 1 200px' }}>
              <label className="field-label">Full name</label>
              <input className="field-input" placeholder="Jane Doe" value={name}
                onChange={e => setName(e.target.value)} autoComplete="off"/>
            </div>
            <div className="field-group" style={{ flex:'1 1 240px' }}>
              <label className="field-label">Email address</label>
              <input className="field-input" type="email" placeholder="jane@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="off"/>
            </div>
            <div className="field-group" style={{ flex:'0 0 140px' }}>
              <label className="field-label">Role</label>
              <select className="field-input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="support_admin">Support Admin</option>
                <option value="admin">Full Admin</option>
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', flexShrink:0 }}>
              <button className="btn-gold" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>

          {inviteMsg && (
            <div className={inviteMsg.startsWith('Invite') ? 'success-box' : 'error-box'} style={{ marginBottom:'12px' }}>
              {inviteMsg}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="section-title">Admin accounts ({admins.length})</div>

          {loading ? (
            <div style={{ padding:'16px 0', color:'var(--muted)', fontSize:'13px' }}>Loading...</div>
          ) : error ? (
            <div className="error-box">{error}</div>
          ) : (
            <div className="meta-table" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', maxWidth:'100%' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr 1fr auto', gap:'8px', padding:'10px 12px',
                borderBottom:'2px solid var(--border)', marginBottom:'4px' }}>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Name</span>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email</span>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Role</span>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Added</span>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Action</span>
              </div>
              {admins.map(a => (
                <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr 1fr auto', gap:'8px', padding:'10px 12px',
                  borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text)' }}>
                    {a.name || <span style={{ color:'var(--muted)', fontStyle:'italic' }}>—</span>}
                    {a.id === currentUserId && (
                      <span style={{ marginLeft:'6px', fontSize:'10px', background:'var(--gold)', color:'#fff',
                        padding:'1px 6px', borderRadius:'10px', fontWeight:600 }}>You</span>
                    )}
                  </span>
                  <span style={{ fontSize:'13px', color:'var(--text)' }}>{a.email}</span>
                  <span style={{ fontSize:'12px' }}>
                    {a.id === currentUserId ? (
                      <span style={{ color:'var(--muted)' }}>{a.role || 'admin'}</span>
                    ) : (
                      <select value={a.role || 'support_admin'} onChange={e => handleRoleChange(a.id, e.target.value)}
                        style={{ fontSize:'12px', padding:'2px 6px', borderRadius:'4px', border:'0.5px solid var(--border)',
                          background:'var(--bg)', color:'var(--text)' }}>
                        <option value="support_admin">Support Admin</option>
                        <option value="admin">Full Admin</option>
                      </select>
                    )}
                  </span>
                  <span style={{ fontSize:'12px', color:'var(--muted)' }}>{formatDate(a.created_at)}</span>
                  <span>
                    {a.id === currentUserId ? (
                      <span style={{ fontSize:'11px', color:'var(--muted)' }}>—</span>
                    ) : isLastAdmin ? (
                      <span style={{ fontSize:'11px', color:'var(--muted)' }} title="Cannot remove the last admin">—</span>
                    ) : (
                      <button style={{ fontSize:'10px', color:'#CC0000', background:'transparent', padding:'2px 8px',
                        borderRadius:'20px', border:'0.5px solid #CC0000', cursor:'pointer' }}
                        onClick={() => handleRemove(a.id)}>
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
    </div>
  )
}
