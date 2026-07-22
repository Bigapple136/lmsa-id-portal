import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiFetch } from '../lib/api'

export default function StudentStatusPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Missing access token.'); return }
    async function fetchStatus() {
      try {
        const res = await apiFetch(`/api/submissions/status?token=${encodeURIComponent(token)}`)
        const result = await res.json()
        if (!res.ok || !result.found) { setStatus('error'); setError('Invalid or expired link.'); return }
        setData(result); setStatus('loaded')
      } catch { setStatus('error'); setError('Unable to load status.') }
    }
    fetchStatus()
  }, [token])

  if (status === 'loading') return (
    <div className="page-outer">
      <Navbar />
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="loading">Loading...</div>
        </div>
      </div>
      <Footer />
    </div>
  )

  if (status === 'error') return (
    <div className="page-outer">
      <Navbar />
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="landing-emblem" style={{ margin: '0 auto var(--space-4)' }}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="#E24B4A" strokeWidth="2" fill="none" />
              <path d="M14 14l12 12M26 14l-12 12" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 style={{ color: 'var(--error-500)', marginBottom: 'var(--space-2)' }}>Access Denied</h2>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{error}</p>
        </div>
      </div>
      <Footer />
    </div>
  )

  return (
    <div className="page-outer">
      <Navbar />
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="landing-emblem" style={{ margin: '0 auto var(--space-4)' }}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="var(--gold)" strokeWidth="1.8" fill="none" />
            </svg>
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', color: 'var(--navy-800)', marginBottom: 'var(--space-1)' }}>Correction Status</h2>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>A.M. Dogliotti College of Medicine</p>

          {data?.status === 'approved' && (
            <div className="success-box" style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: 'var(--text-md)' }}>Approved</strong>
              <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', color: 'var(--success-600)' }}>
                Your correction has been accepted. Your card will reflect the updated details.
              </p>
            </div>
          )}
          {data?.status === 'rejected' && (
            <div className="error-box" style={{ textAlign: 'left' }}>
              <strong>Rejected</strong>
              <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', color: 'var(--error-600)' }}>
                Admin notes: {data.admin_notes || 'No additional notes provided.'}
              </p>
            </div>
          )}
          {(data?.status === 'pending' || data?.status === 'self_corrected') && (
            <div className="info-box" style={{ textAlign: 'left' }}>
              <strong>Under Review</strong>
              <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                Your submission is being reviewed. The admin will contact you once a decision is made.
              </p>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-5)', textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Name: <strong style={{ color: 'var(--text)' }}>{data?.full_name}</strong></div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>ID: <strong style={{ color: 'var(--text)' }}>{data?.student_id}</strong></div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>Last updated: <strong style={{ color: 'var(--text)' }}>{new Date(data?.updated_at || Date.now()).toLocaleString()}</strong></div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
