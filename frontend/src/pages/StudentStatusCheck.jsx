import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/Toast'

export default function StudentStatusCheck() {
  const navigate = useNavigate()
  const toast = useToast()
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    const trimmed = studentId.trim()
    if (!trimmed) {
      setError('Please enter your Student ID.')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch(`/api/students/status?student_id=${encodeURIComponent(trimmed)}`)
      const data = await res.json()

      if (!res.ok || !data.found) {
        setError(data.error || 'Student not found. Please check your Student ID and try again.')
        return
      }

      setResult(data.student)
    } catch {
      setError('Unable to check status. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status) => {
    switch (status) {
      case 'confirmed':
        return { label: '✓ Confirmed', color: 'var(--success-text)', bg: 'var(--success-bg)', icon: '✓' }
      case 'pending':
        return { label: '⏳ Pending Review', color: 'var(--warn-text)', bg: 'var(--warn-bg)', icon: '⏳' }
      case 'photo_issue':
        return { label: '📷 Photo Issue', color: 'var(--error-text)', bg: 'var(--error-bg)', icon: '📷' }
      case 'self_corrected':
        return { label: '✏️ Self-Corrected', color: 'var(--info-text)', bg: 'var(--info-bg)', icon: '✏️' }
      case 'rejected':
        return { label: '✗ Rejected', color: 'var(--error-text)', bg: 'var(--error-bg)', icon: '✗' }
      default:
        return { label: status || 'Unknown', color: 'var(--muted)', bg: 'var(--border)', icon: '?' }
    }
  }

  if (result) {
    const info = getStatusInfo(result.status)
    return (
      <div className="page-outer">
        <Navbar showLogin={false} />
        <div className="page-center">
          <div className="landing-card" style={{ maxWidth: 480 }}>
            <div className="landing-header" style={{ background: 'var(--navy)', padding: '28px 24px 24px', textAlign: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <div className="landing-emblem" style={{ margin: '0 auto 16px', width: 48, height: 48 }}>
                <svg width="48" height="48" viewBox="0 0 40 40" fill="none" style={{ display: 'block', margin: '0 auto' }}>
                  <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="2" fill="none" />
                </svg>
              </div>
              <h2 style={{ fontFamily: 'Georgia, serif', color: '#fff', marginBottom: '6px', fontSize: '1.5rem' }}>
                Card Status Check
              </h2>
              <p style={{ color: '#8899AA', fontSize: '13px' }}>
                A.M. Dogliotti College of Medicine
              </p>
            </div>

            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div className="landing-form" style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: '20px', padding: '16px', background: info.bg, borderRadius: 'var(--radius)', border: `1px solid ${info.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{info.icon}</span>
                    <strong style={{ fontSize: '16px', color: info.color }}>{info.label}</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: info.color, margin: 0 }}>
                    {result.status === 'confirmed' && 'Your card has been confirmed. LMSA has been notified.'}
                    {result.status === 'pending' && 'Your submission is under review. The admin will contact you once a decision is made.'}
                    {result.status === 'photo_issue' && 'There is an issue with your photo. Please check your email or contact LMSA for guidance.'}
                    {result.status === 'self_corrected' && 'You have submitted corrections. They are now under review.'}
                    {result.status === 'rejected' && 'Your submission was not approved. Please contact LMSA for more information.'}
                  </p>
                </div>

                <div style={{ textAlign: 'left', marginBottom: '20px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Full Name</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{result.full_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px', marginBottom: '4px' }}>Student ID</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{result.student_id}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px', marginBottom: '4px' }}>Year / Level</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{result.year_level}</div>
                </div>

                {result.has_qr && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--info-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--info-text)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--info-text)', marginBottom: '8px', fontWeight: 600 }}>Your ID Card Preview Link</div>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', wordBreak: 'break-all' }}>
                      {result.preview_url}
                    </p>
                    <a
                      href={result.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ display: 'inline-block', textDecoration: 'none' }}
                    >
                      View Your ID Card Preview
                    </a>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                      This link expires in 7 days. You can request a new one anytime from this page.
                    </p>
                  </div>
                )}

                {!result.has_qr && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--warn-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--warn-text)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--warn-text)', fontWeight: 600 }}>QR Code Not Yet Generated</div>
                    <p style={{ fontSize: '13px', color: 'var(--warn-text)', marginTop: '4px' }}>
                      Your ID card QR code has not been generated yet. Contact LMSA administration once your card is confirmed.
                    </p>
                  </div>
                )}

                {!result.has_photo && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--warn-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--warn-text)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--warn-text)', fontWeight: 600 }}>Photo Not Yet Uploaded</div>
                    <p style={{ fontSize: '13px', color: 'var(--warn-text)', marginTop: '4px' }}>
                      Your profile photo is missing. Please contact LMSA to have your photo added to the system.
                    </p>
                  </div>
                )}

                <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Last updated: <strong style={{ color: 'var(--text)' }}>{new Date(result.updated_at || Date.now()).toLocaleString()}</strong>
                  </div>
                  {result.confirmed_at && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Confirmed: <strong style={{ color: 'var(--text)' }}>{new Date(result.confirmed_at).toLocaleString()}</strong>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    className="btn-outline"
                    onClick={() => { setStudentId(''); setResult(null); }}
                    style={{ flex: 1, maxWidth: 200 }}
                  >
                    Check Another ID
                  </button>
                  <a href="/" className="btn-primary" style={{ flex: 1, maxWidth: 200, textAlign: 'center', textDecoration: 'none' }}>
                    ← Back to Home
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-outer">
      <Navbar showLogin={false} />
      <div className="page-center">
        <div className="landing-card" style={{ maxWidth: 420 }}>
          <div className="landing-header" style={{ background: 'var(--navy)', padding: '28px 24px 24px', textAlign: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <div className="landing-emblem" style={{ margin: '0 auto 16px', width: 48, height: 48 }}>
              <svg width="48" height="48" viewBox="0 0 40 40" fill="none" style={{ display: 'block', margin: '0 auto' }}>
                <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', color: '#fff', marginBottom: '6px', fontSize: '1.5rem' }}>
              Check Your Card Status
            </h2>
            <p style={{ color: '#8899AA', fontSize: '13px' }}>
              A.M. Dogliotti College of Medicine
            </p>
          </div>

          <div className="landing-form" style={{ padding: '32px 24px' }}>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px', textAlign: 'center' }}>
              Enter your Student ID to check the status of your LMSA ID card application.
              You can also view your ID card preview if it has been generated.
            </p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>
              )}

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label" htmlFor="studentId">
                  Student ID
                </label>
                <input
                  id="studentId"
                  type="text"
                  className="input-field"
                  placeholder="Enter your Student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '14px' }}
                disabled={loading}
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </form>

            <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--hint)', textAlign: 'center' }}>
              Don&apos;t have a Student ID yet?{' '}
              <a href="/submit" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                Submit a new application
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}