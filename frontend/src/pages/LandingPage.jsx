import { useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { apiFetch } from '../lib/api'

const FORM_HELP_ID = 'landing-form-help'
const FORM_ERROR_ID = 'landing-form-error'

export default function LandingPage() {
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorKind, setErrorKind] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    if (!studentId.trim() || !fullName.trim()) {
      setError('Please enter both your Student ID and full name.')
      setErrorKind('missing')
      return
    }
    setLoading(true)
    setError('')
    setErrorKind('')
    try {
      const params = new URLSearchParams({
        student_id: studentId.trim(),
        full_name: fullName.trim(),
      })
      const res = await apiFetch(`/api/students/lookup?${params}`)
      const data = await res.json()
      if (!res.ok || !data.found) {
        setError(
          'We could not find a matching record. Check your Student ID and the spelling of your enrolled name, then try again.',
        )
        setErrorKind('lookup')
        return
      }
      window.location.href = data.preview_url
    } catch {
      setError('We could not reach the portal. Check your connection, then try again.')
      setErrorKind('network')
    } finally {
      setLoading(false)
    }
  }

  const describedBy = error ? `${FORM_HELP_ID} ${FORM_ERROR_ID}` : FORM_HELP_ID

  return (
    <div className="page-outer">
      <div className="split-landing">
        <div className="split-brand" aria-label="LMSA and A.M. Dogliotti identity">
          <div className="split-emblem">
            <img
              src="/lmsa-logo.png"
              alt="Liberia Medical Students Association logo"
              width="120"
              height="120"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1 className="split-title">Liberia Medical Students&apos; Association</h1>
          <p className="split-sub">A.M. Dogliotti College of Medicine</p>
          <p className="split-desc">Student ID verification and card management portal.</p>
        </div>
        <div className="split-form-panel">
          <div className="landing-mobile-brand" aria-label="LMSA identity">
            <img src="/lmsa-logo.png" alt="" className="landing-mobile-logo" aria-hidden="true" />
            <div>
              <p className="landing-mobile-kicker">LMSA ID Portal</p>
              <p className="landing-mobile-name">A.M. Dogliotti College of Medicine</p>
            </div>
          </div>

          <div className="split-card">
            <h2 className="split-card-title">Verify Your ID</h2>
            <p className="split-card-sub" id={FORM_HELP_ID}>
              Enter your Student ID and enrolled name to preview, confirm, or report corrections on
              your student card.
            </p>
            <form className="landing-form" onSubmit={handleSearch} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="student-id-input">
                  Student ID Number
                </label>
                <input
                  id="student-id-input"
                  name="student_id"
                  type="text"
                  className="field-input"
                  placeholder="e.g. AMD-2024-0001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                  aria-required="true"
                  aria-invalid={errorKind === 'missing' || errorKind === 'lookup'}
                  aria-describedby={describedBy}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="full-name-input">
                  Full Name
                </label>
                <input
                  id="full-name-input"
                  name="full_name"
                  type="text"
                  className="field-input"
                  placeholder="As it appears on enrollment"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={errorKind === 'missing' || errorKind === 'lookup'}
                  aria-describedby={describedBy}
                />
              </div>

              {error && (
                <div className="error-box" id={FORM_ERROR_ID} role="alert">
                  {error}
                </div>
              )}

              {(errorKind === 'lookup' || errorKind === 'network') && (
                <div className="landing-recovery" aria-label="Lookup recovery options">
                  <p className="landing-recovery-title">Need another path?</p>
                  <ul className="landing-recovery-list">
                    <li>Use your official AMD student ID format.</li>
                    <li>Enter your full enrolled name, including middle initials if used.</li>
                  </ul>
                  <div className="landing-recovery-links">
                    <Link to="/submit">Submit details</Link>
                    <Link to="/check-status">Check status</Link>
                  </div>
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Searching…
                  </>
                ) : (
                  'Look Up My Card'
                )}
              </button>

              <ul className="verification-steps" aria-label="Verification steps">
                <li>Preview card</li>
                <li>Confirm details</li>
                <li>Report corrections</li>
              </ul>

              <div className="landing-alt-actions" aria-label="Student support links">
                <Link to="/submit">Submit your details</Link>
                <span aria-hidden="true">·</span>
                <Link to="/check-status">Check card status</Link>
              </div>

              <p className="landing-hint">
                Having trouble? Contact LMSA through your faculty office.
              </p>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
