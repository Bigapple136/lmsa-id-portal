import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function StudentStatusPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Missing access token.')
      return
    }
    async function fetchStatus() {
      try {
        const res = await apiFetch(`/api/submissions/status?token=${encodeURIComponent(token)}`)
        const result = await res.json()
        if (!res.ok || !result.found) {
          setStatus('error')
          setError('Invalid or expired link.')
          return
        }
        setData(result)
        setStatus('loaded')
      } catch {
        setStatus('error')
        setError('Unable to load status.')
      }
    }
    fetchStatus()
  }, [token])

  if (status === 'loading') return <div className="page-center"><p>Loading...</p></div>
  if (status === 'error') return (
    <div className="page-center">
      <div className="landing-card" style={{ textAlign: 'center', padding: '32px' }}>
        <h2 style={{ color: 'var(--error-text)' }}>Access Denied</h2>
        <p style={{ color: 'var(--muted)', marginTop: '8px' }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="page-center">
      <div className="landing-card" style={{ textAlign: 'center', padding: '32px' }}>
        <div className="landing-emblem" style={{ margin: '0 auto 16px' }}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="1.8" fill="none" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', color: 'var(--navy)', marginBottom: '6px' }}>
          Correction Status
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
          A.M. Dogliotti College of Medicine
        </p>
        {data?.status === 'approved' && (
          <div className="success-box">
            <strong style={{ fontSize: '16px' }}>✓ Approved</strong>
            <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--success-text)' }}>
              Your correction has been accepted. Your card will reflect the updated details.
            </p>
          </div>
        )}
        {data?.status === 'rejected' && (
          <div className="error-box">
            <strong>✗ Rejected</strong>
            <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--error-text)' }}>
              Admin notes: {data.admin_notes || 'No additional notes provided.'}
            </p>
          </div>
        )}
        {(data?.status === 'pending' || data?.status === 'self_corrected') && (
          <div className="info-box">
            <strong>Under Review</strong>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Your submission is being reviewed. The admin will contact you once a decision is made.
            </p>
          </div>
        )}
        <div style={{ marginTop: '20px', textAlign: 'left', borderTop: '0.5px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Name: <strong style={{ color: 'var(--text)' }}>{data?.full_name}</strong></div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>ID: <strong style={{ color: 'var(--text)' }}>{data?.student_id}</strong></div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Last updated: <strong style={{ color: 'var(--text)' }}>{new Date(data?.updated_at || Date.now()).toLocaleString()}</strong></div>
        </div>
      </div>
    </div>
  )
}
