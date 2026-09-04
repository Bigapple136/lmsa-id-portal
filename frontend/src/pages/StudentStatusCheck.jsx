/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'
import useDocumentTitle from '../lib/useDocumentTitle'

const STATUS_INFO = {
  confirmed: {
    label: 'Confirmed',
    tone: 'success',
    message: 'Your card has been confirmed. LMSA has been notified.',
  },
  pending: {
    label: 'Pending review',
    tone: 'warn',
    message: 'Your submission is under review. LMSA will contact you once a decision is made.',
  },
  photo_issue: {
    label: 'Photo issue',
    tone: 'error',
    message:
      'There is an issue with your photo. Please check your email or contact LMSA for guidance.',
  },
  self_corrected: {
    label: 'Self-corrected',
    tone: 'info',
    message: 'You have submitted corrections. They are now under review.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'error',
    message: 'Your submission was not approved. Please contact LMSA for more information.',
  },
}

function getStatusInfo(status) {
  return (
    STATUS_INFO[status] || {
      label: status || 'Unknown',
      tone: 'neutral',
      message: 'LMSA has not published a detailed status for this record yet.',
    }
  )
}

function StatusMark({ tone }) {
  return <span className={`status-mark status-mark--${tone}`} aria-hidden="true" />
}

export default function StudentStatusCheck() {
  useDocumentTitle('Check card status')
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
      const data = await res.json().catch(() => ({}))

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

  const info = result ? getStatusInfo(result.status) : null

  return (
    <div className="page-outer">
      <Navbar showLogin={false} />
      <main className="status-check-shell" id="main-content">
        <section className="status-check-card">
          <div className="status-check-header">
            <div className="landing-emblem status-check-emblem" aria-hidden="true">
              <svg width="42" height="42" viewBox="0 0 40 40" fill="none">
                <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="2" />
              </svg>
            </div>
            <h1>Check Your Card Status</h1>
            <p>A.M. Dogliotti College of Medicine</p>
          </div>

          <form className="status-check-form" onSubmit={handleSubmit} noValidate>
            <p className="status-check-intro">
              Enter your Student ID to check the current LMSA ID card status and available next
              steps.
            </p>

            {error && (
              <div className="error-box" role="alert">
                {error}
                <div
                  className="status-check-error-actions"
                  aria-label="Status lookup recovery options"
                >
                  <Link to="/submit">Submit details</Link>
                  <Link to="/">Return to lookup</Link>
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="student-status-id">
                Student ID
              </label>
              <input
                id="student-status-id"
                type="text"
                className="input-field"
                placeholder="e.g. AMD-2024-0001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={loading}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'student-status-error-help' : undefined}
              />
              <p className="field-hint" id="student-status-error-help">
                Use the Student ID issued by LMSA or your faculty office.
              </p>
            </div>

            <button type="submit" className="btn-primary status-check-submit" disabled={loading}>
              {loading ? 'Checking status…' : 'Check Status'}
            </button>
          </form>

          {result && info && (
            <div className="status-result" aria-live="polite">
              <div className={`status-result-banner status-result-banner--${info.tone}`}>
                <div className="status-result-title">
                  <StatusMark tone={info.tone} />
                  <strong>{info.label}</strong>
                </div>
                <p>{info.message}</p>
              </div>

              <dl className="status-result-record">
                <div>
                  <dt>Full name</dt>
                  <dd>{result.full_name}</dd>
                </div>
                <div>
                  <dt>Student ID</dt>
                  <dd>{result.student_id}</dd>
                </div>
                <div>
                  <dt>Year / Level</dt>
                  <dd>{result.year_level}</dd>
                </div>
              </dl>

              {result.has_qr ? (
                <div className="status-next-card status-next-card--info">
                  <strong>Your ID card preview link</strong>
                  <p>
                    This secure preview link expires in 7 days. Use it to review, confirm, or report
                    an issue with your card.
                  </p>
                  <a
                    href={result.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary status-next-action"
                  >
                    View ID card preview
                  </a>
                </div>
              ) : (
                <div className="status-next-card status-next-card--warn">
                  <strong>QR code not yet generated</strong>
                  <p>
                    Your ID card QR code has not been generated yet. LMSA administration can confirm
                    the next production step.
                  </p>
                </div>
              )}

              {!result.has_photo && (
                <div className="status-next-card status-next-card--warn">
                  <strong>Photo not yet uploaded</strong>
                  <p>
                    Your profile photo is missing. Contact LMSA or the faculty office to have your
                    photo added to the system.
                  </p>
                </div>
              )}

              <dl className="status-result-record status-result-record--dates">
                <div>
                  <dt>Last updated</dt>
                  <dd>{new Date(result.updated_at || Date.now()).toLocaleString()}</dd>
                </div>
                {result.confirmed_at && (
                  <div>
                    <dt>Confirmed</dt>
                    <dd>{new Date(result.confirmed_at).toLocaleString()}</dd>
                  </div>
                )}
              </dl>

              <div className="status-result-actions">
                <button
                  className="btn-outline"
                  type="button"
                  onClick={() => {
                    setStudentId('')
                    setResult(null)
                    setError('')
                  }}
                >
                  Check another ID
                </button>
                <Link className="btn-primary" to="/">
                  Back to student portal
                </Link>
              </div>
            </div>
          )}

          <p className="status-check-footnote">
            Don&apos;t have a Student ID yet? <Link to="/submit">Submit a new application</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
