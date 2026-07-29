import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import Navbar from '../components/Navbar'
import { adminFetch } from '../lib/api'

export default function QrViewPage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isVerified, setIsVerified] = useState(false)
  const [animateRef] = useAutoAnimate()

  useEffect(() => {
    (async () => {
      try {
        const r = await adminFetch(`/api/students/${encodeURIComponent(studentId)}`)
        const data = await r.json()
        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }
        setStudent(data)
        setLoading(false)
        setTimeout(() => setIsVerified(true), 600)
      } catch {
        setError('Failed to load student data.')
        setLoading(false)
      }
    })()
  }, [studentId])

  if (loading)
    return (
      <div className="qr-loading">
        <div className="qr-loading-spinner">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="#1a2942" strokeWidth="3" fill="none" />
            <path d="M20 2a18 18 0 0 1 18 18" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <p className="qr-loading-text">Verifying credentials...</p>
      </div>
    )

  if (error || !student)
    return (
      <div className="qr-error">
        <div className="qr-error-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#CC0000" strokeWidth="3" fill="none" />
            <path d="M16 16l16 16M32 16l-16 16" stroke="#CC0000" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <p className="qr-error-text">{error || 'Student not found.'}</p>
        <p className="qr-error-subtext">Invalid or expired credential</p>
      </div>
    )

  const detailRows = [
    { icon: '\u{1F464}', label: 'Full Name', value: student.full_name, highlight: true },
    { icon: '\u{1F393}', label: 'Student ID', value: student.student_id, accent: true },
    { icon: '\u{1F4DA}', label: 'Level', value: student.year_level },
    { icon: '\u{1F4BC}', label: 'Position', value: student.position },
    { icon: '\u{1F3DB}\uFE0F', label: 'Programme', value: student.programme },
    { icon: '\u{1FA78}', label: 'Blood Type', value: student.blood_type, badge: true },
    { icon: '\u2709\uFE0F', label: 'Email', value: student.student_email },
    { icon: '\u{1F198}', label: 'Emergency Contact', value: student.emergency_contact_name },
    { icon: '\u{1F4DE}', label: 'Emergency Phone', value: student.emergency_contact_phone },
    { icon: '\u{1F382}', label: 'Date of Birth', value: student.date_of_birth },
    { icon: '\u{1F30D}', label: 'Nationality', value: student.nationality },
    { icon: '\u{1F4CD}', label: 'County of Origin', value: student.county_of_origin },
    { icon: '\u{1F3E0}', label: 'Current Address', value: student.current_address },
  ].filter((r) => r.value)

  return (
    <div className="qr-page">
      <Navbar />

      <div className="qr-container">
        {isVerified && (
          <div className="qr-badge">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#00C853" />
              <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Verified Credential
          </div>
        )}

        <div className="qr-card">
          <div className="qr-card-header">
            <div className="qr-header-gradient" />
            <div className="qr-header-content">
              <div className="qr-logo-emblem">
                <div className="qr-emblem-inner">
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                    <path d="M20 4l16 10v12L20 36 4 26V14L20 4z" stroke="#C9A84C" strokeWidth="2" fill="none" />
                    <text x="20" y="24" textAnchor="middle" fill="#C9A84C" fontSize="11" fontWeight="900" fontFamily="serif">LM</text>
                  </svg>
                </div>
              </div>
              <div className="qr-header-titles">
                <h1 className="qr-header-school">A.M. Dogliotti College of Medicine</h1>
                <p className="qr-header-subtitle">Student Identification &bull; Official Record</p>
                <div className="qr-header-accent" />
              </div>
            </div>
          </div>

          <div className="qr-section">
            {student.qr_url ? (
              <div className="qr-wrapper">
                <img
                  src={student.qr_url}
                  alt="QR Code"
                  className="qr-image"
                />
                <div className="qr-glow" />
              </div>
            ) : (
              <div className="qr-placeholder">
                <div className="qr-placeholder-icon">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="8" width="20" height="20" rx="3" stroke="#C9A84C" strokeWidth="2" fill="none" />
                    <rect x="36" y="8" width="20" height="20" rx="3" stroke="#C9A84C" strokeWidth="2" fill="none" />
                    <rect x="8" y="36" width="20" height="20" rx="3" stroke="#C9A84C" strokeWidth="2" fill="none" />
                    <rect x="36" y="36" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="44" y="36" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="52" y="36" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="36" y="44" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="44" y="44" width="4" height="4" fill="#C9A84C" />
                    <rect x="52" y="44" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="36" y="52" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="44" y="52" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                    <rect x="52" y="52" width="4" height="4" fill="#C9A84C" opacity="0.5" />
                  </svg>
                </div>
                <p className="qr-placeholder-text">QR code pending generation</p>
              </div>
            )}
            <p className="qr-instructions">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                <path d="M7 1v3M7 10v3M1 7h3M10 7h3" stroke="#8a9ab5" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Scan to verify identity
            </p>
          </div>

          <div className="qr-divider">
            <div className="qr-divider-line" />
            <div className="qr-divider-dot" />
            <div className="qr-divider-line" />
          </div>

          <div className="qr-details" ref={animateRef}>
            {detailRows.map((row) => (
              <div
                key={row.label}
                className={`qr-detail-row${row.highlight ? ' qr-detail-row--highlight' : ''}`}
              >
                <div className="qr-detail-left">
                  <span className="qr-detail-icon">{row.icon}</span>
                  <span className="qr-detail-label">{row.label}</span>
                </div>
                <span
                  className={`qr-detail-value${row.accent ? ' qr-detail-value--accent' : ''}${row.badge ? ' qr-detail-value--badge' : ''}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {student.qr_url && (
            <button
              onClick={async () => {
                try {
                  const r = await adminFetch(`/api/qr/verification-url/${encodeURIComponent(studentId)}`)
                  const data = await r.json()
                  if (data.url) window.open(data.url, '_blank', 'noopener')
                } catch {}
              }}
              className="qr-verify-btn"
            >
              <span>Open Print-Ready Page</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12h8M6 8h8M6 4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 4v.01M2 8v.01M2 12v.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <div className="qr-card-footer">
            <span>LMSA ID Verification</span>
            <span className="qr-footer-sep">&bull;</span>
            <span>GoldWay</span>
            <span className="qr-footer-sep">&bull;</span>
            <span>University of Liberia</span>
          </div>
        </div>

        <div className="qr-watermark" />
      </div>
    </div>
  )
}
