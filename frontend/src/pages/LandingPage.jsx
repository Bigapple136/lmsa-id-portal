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
      <div className="split-landing">
        <div className="split-brand">
          <div className="split-emblem">
            <svg width="72" height="72" viewBox="0 0 40 40" fill="none">
              <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="2" fill="none" />
              <text x="20" y="25" textAnchor="middle" fill="#C9A84C" fontSize="10" fontWeight="900" fontFamily="serif">LM</text>
            </svg>
          </div>
          <h1 className="split-title">A.M. Dogliotti College of Medicine</h1>
          <p className="split-sub">Liberia Medical Students Association</p>
          <p className="split-desc">Student ID verification and card management portal.</p>
        </div>
        <div className="split-form-panel">
          <div className="split-card">
            <h2 className="split-card-title">Verify Your ID</h2>
            <p className="split-card-sub">Enter your details to view or confirm your student card.</p>
            <form className="landing-form" onSubmit={handleSearch}>
              <div className="field-group">
                <label className="field-label">Student ID Number</label>
                <input
                  className="field-input"
                  placeholder="e.g. AMD-2024-0001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input
                  className="field-input"
                  placeholder="As it appears on enrollment"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {error && <div className="error-box">{error}</div>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? (<><span className="spinner" />Searching...</>) : 'View My ID Card'}
              </button>
              <p className="landing-hint">Having trouble? Contact LMSA at your faculty office.</p>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
