import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiFetch } from '../lib/api'

export default function LandingPage() {
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    if (!studentId.trim() || !fullName.trim()) {
      setError('Please enter both your Student ID and full name.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        student_id: studentId.trim(),
        full_name: fullName.trim(),
      })
      const res = await apiFetch(`/api/students/lookup?${params}`)
      const data = await res.json()
      if (!res.ok || !data.found) {
        setError(
          'No student found with those details. Please check your Student ID and full name and try again.',
        )
        return
      }
      window.location.href = data.preview_url
    } catch {
      setError('Something went wrong. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-outer">
      <Navbar showLogin={true} />
      <div className="page-center">
        <div className="landing-card">
          <div className="landing-header">
            <div className="landing-emblem">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="1.8" fill="none" />
                <text x="20" y="24" textAnchor="middle" fill="#C9A84C" fontSize="10" fontWeight="900" fontFamily="serif">LM</text>
              </svg>
            </div>
            <p className="landing-subtitle">Liberia Medical Students Association</p>
            <h1 className="landing-title">ID Card Verification Portal</h1>
            <p className="landing-desc">A.M. Dogliotti College of Medicine</p>
            <div className="landing-accent-line" />
          </div>

          <form className="landing-form" onSubmit={handleSearch}>
            <div className="field-group">
              <label className="field-label">Student ID Number</label>
              <input
                className="field-input"
                placeholder="e.g. 123456"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Full Name</label>
              <input
                className="field-input"
                placeholder="As it appears on your enrollment form"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="off"
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Searching...
                </>
              ) : (
                'View My ID Card'
              )}
            </button>

            <p className="landing-hint">Having trouble? Contact LMSA at your faculty office.</p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}
