/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'
import useDocumentTitle from '../lib/useDocumentTitle'

const DETAIL_FIELDS = [
  { key: 'full_name', mark: 'NM', label: 'Full Name', highlight: true },
  { key: 'student_id', mark: 'ID', label: 'Student ID', accent: true },
  { key: 'year_level', mark: 'YR', label: 'Level' },
  { key: 'position', mark: 'RL', label: 'Position' },
  { key: 'programme', mark: 'PR', label: 'Programme' },
  { key: 'blood_type', mark: 'BT', label: 'Blood Type', badge: true },
  { key: 'student_email', mark: 'EM', label: 'Email' },
  { key: 'emergency_contact_name', mark: 'EC', label: 'Emergency Contact' },
  { key: 'emergency_contact_phone', mark: 'PH', label: 'Emergency Phone' },
  { key: 'date_of_birth', mark: 'DB', label: 'Date of Birth' },
  { key: 'nationality', mark: 'NT', label: 'Nationality' },
  { key: 'county_of_origin', mark: 'CO', label: 'County of Origin' },
  { key: 'current_address', mark: 'AD', label: 'Current Address' },
]

// Dates arrive as ISO date strings; render them the way a person reading a
// printed card would expect, and never silently show "Invalid Date".
function formatCardDate(value) {
  if (!value) return null
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// How each credential state presents. The badge is the single most-read
// element on this page — it is the whole reason a stranger scanned the code —
// so it states the card's actual standing, not merely that the QR parsed.
const CREDENTIAL_PRESENTATION = {
  valid: {
    tone: 'gold',
    badge: 'Credential verified',
    note: null,
  },
  expired: {
    tone: 'error',
    badge: 'Card expired',
    note: 'This card is past its validity date. The record below is genuine, but the card should be renewed by LMSA before it is accepted as current.',
  },
  inactive: {
    tone: 'error',
    badge: 'Card not active',
    note: 'This student record is not currently active. The QR code is genuine, but the card should not be accepted until LMSA reactivates the record.',
  },
}

function getInitials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function QrSeal({ tone = 'gold' }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 5.5l16.25 9.25v18.5L24 42.5 7.75 33.25v-18.5L24 5.5z"
        stroke={tone === 'error' ? '#E24B4A' : '#C9A84C'}
        strokeWidth="2"
      />
      <path
        d="M16.5 24.5l5 5 10.5-11"
        stroke={tone === 'error' ? '#E24B4A' : '#C9A84C'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function QrStateShell({ title, message, tone = 'gold', children, live = 'polite' }) {
  return (
    <div className="qr-page">
      <Navbar showLogin={false} />
      <main className="qr-state-container" id="main-content" aria-live={live}>
        <div className={`qr-state-card qr-state-card--${tone}`}>
          <div className="qr-state-seal">
            <QrSeal tone={tone} />
          </div>
          <h1 className="qr-state-title">{title}</h1>
          <p className="qr-state-message">{message}</p>
          {children}
        </div>
      </main>
    </div>
  )
}

export default function QrViewPage() {
  useDocumentTitle('Verify credential')
  const { token } = useParams()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [credentialState, setCredentialState] = useState('valid')
  const [credentialReason, setCredentialReason] = useState('')

  useEffect(() => {
    let cancelled = false

    async function verifyCredential() {
      setLoading(true)
      setError('')
      setStudent(null)
      setIsVerified(false)
      setCredentialState('valid')
      setCredentialReason('')

      try {
        const response = await apiFetch(`/api/qr/verify/${encodeURIComponent(token || '')}`, {
          retries: 1,
        })
        const data = await response.json().catch(() => ({}))

        // A bad signature or a missing record is a hard failure. An expired
        // or inactive card is NOT: the server still returns the record so a
        // verifier can see what expired, and the page says so plainly.
        if (!response.ok || !data.student) {
          if (!cancelled) {
            setError(data.error || 'This QR credential could not be verified.')
          }
          return
        }

        if (!cancelled) {
          setStudent(data.student)
          setCredentialState(data.credential_state || (data.verified ? 'valid' : 'inactive'))
          setCredentialReason(data.credential_reason || '')
          window.setTimeout(() => {
            if (!cancelled) setIsVerified(true)
          }, 300)
        }
      } catch {
        if (!cancelled) {
          setError(
            'We could not reach the verification service. Check your connection and try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    verifyCredential()

    return () => {
      cancelled = true
    }
  }, [token])

  const detailRows = useMemo(() => DETAIL_FIELDS.filter((row) => student?.[row.key]), [student])
  const presentation =
    CREDENTIAL_PRESENTATION[credentialState] || CREDENTIAL_PRESENTATION.inactive
  const issuedOn = formatCardDate(student?.issue_date)
  const validUntil = formatCardDate(student?.valid_until)

  if (loading) {
    return (
      <QrStateShell
        title="Verifying credential"
        message="Checking the signed LMSA QR record. This should only take a moment."
      >
        <div className="qr-loading-spinner" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="#1a2942" strokeWidth="3" />
            <path
              d="M20 2a18 18 0 0 1 18 18"
              stroke="#C9A84C"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </QrStateShell>
    )
  }

  if (error || !student) {
    return (
      <QrStateShell
        title="Credential not verified"
        message={
          error ||
          'This QR link is missing, expired, or no longer matches an active student record.'
        }
        tone="error"
        live="assertive"
      >
        <div className="qr-recovery-actions" aria-label="QR verification recovery options">
          <Link className="btn-primary" to="/check-status">
            Check card status
          </Link>
          <Link className="btn-outline" to="/">
            Back to student portal
          </Link>
        </div>
        <p className="qr-state-help">
          If this came from a printed card, ask LMSA or the faculty office to reissue the QR code.
        </p>
      </QrStateShell>
    )
  }

  return (
    <div className="qr-page">
      <Navbar showLogin={false} />

      <main className="qr-container" id="main-content" aria-label="LMSA student credential">
        {isVerified && (
          <>
            <div className={`qr-badge qr-badge--${presentation.tone}`} role="status">
              <QrSeal tone={presentation.tone} />
              {presentation.badge}
            </div>
            {presentation.note && (
              <p className="qr-credential-note" role="alert">
                {credentialReason ? `${credentialReason} ` : ''}
                {presentation.note}
              </p>
            )}
          </>
        )}

        <section className="qr-card">
          <div className="qr-card-header">
            <div className="qr-header-gradient" />
            <div className="qr-header-content">
              <div className="qr-logo-emblem" aria-hidden="true">
                <div className="qr-emblem-inner">
                  <img src="/lmsa-logo.png" alt="" width="42" height="42" />
                </div>
              </div>
              <div className="qr-header-titles">
                <h1 className="qr-header-school">A.M. Dogliotti College of Medicine</h1>
                <p className="qr-header-subtitle">LMSA Student Identification Record</p>
                <div className="qr-header-accent" />
              </div>
            </div>
          </div>

          <div className="qr-profile-section">
            {student.photo_url ? (
              <img
                className="qr-profile-photo"
                src={student.photo_url}
                alt={`${student.full_name} student portrait`}
              />
            ) : (
              <div
                className="qr-profile-photo qr-profile-photo--placeholder"
                aria-label="No student photo on file"
              >
                {getInitials(student.full_name || student.student_id)}
              </div>
            )}
            <div className="qr-profile-summary">
              <p className="qr-profile-label">Signed student record</p>
              <h2>{student.full_name}</h2>
              <p>{student.year_level || 'A.M. Dogliotti College of Medicine'}</p>
            </div>
          </div>

          <div className="qr-divider">
            <div className="qr-divider-line" />
            <div className="qr-divider-dot" />
            <div className="qr-divider-line" />
          </div>

          {/* Validity is the fact a verifier came here for, so it sits above
              the personal details rather than among them. */}
          <div className={`qr-validity qr-validity--${presentation.tone}`}>
            <div className="qr-validity-item">
              <span className="qr-validity-label">Issued</span>
              <span className="qr-validity-value">{issuedOn || 'Not recorded'}</span>
            </div>
            <div className="qr-validity-divider" aria-hidden="true" />
            <div className="qr-validity-item">
              <span className="qr-validity-label">
                {credentialState === 'expired' ? 'Expired' : 'Valid until'}
              </span>
              <span className="qr-validity-value qr-validity-value--strong">
                {validUntil || 'Not recorded'}
              </span>
            </div>
          </div>

          <div className="qr-details">
            {detailRows.map((row) => (
              <div
                key={row.key}
                className={`qr-detail-row${row.highlight ? ' qr-detail-row--highlight' : ''}`}
              >
                <div className="qr-detail-left">
                  <span className="qr-detail-icon" aria-hidden="true">
                    {row.mark}
                  </span>
                  <span className="qr-detail-label">{row.label}</span>
                </div>
                <span
                  className={`qr-detail-value${row.accent ? ' qr-detail-value--accent' : ''}${row.badge ? ' qr-detail-value--badge' : ''}`}
                >
                  {student[row.key]}
                </span>
              </div>
            ))}
          </div>

          <a
            href={`/api/qr/html/${encodeURIComponent(token || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="qr-verify-btn"
          >
            <span>Open official verification page</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 12h8M6 8h8M6 4h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M2 4v.01M2 8v.01M2 12v.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </a>

          <div className="qr-card-footer">
            <span>LMSA ID Verification</span>
            <span className="qr-footer-sep">&bull;</span>
            <span>A.M. Dogliotti College of Medicine</span>
            <span className="qr-footer-sep">&bull;</span>
            <span>University of Liberia</span>
          </div>
        </section>

        <p className="qr-privacy-note">
          This page verifies a signed LMSA QR credential. Only fields approved for QR display are
          shown.
        </p>
      </main>
    </div>
  )
}
