/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'

const STATUS_DETAILS = {
  approved: {
    tone: 'success',
    label: 'Approved',
    message: 'Your correction has been accepted. Your card will reflect the updated details.',
  },
  rejected: {
    tone: 'error',
    label: 'Rejected',
    message: 'Your correction was not approved. Review the admin note below or contact LMSA.',
  },
  pending: {
    tone: 'info',
    label: 'Under review',
    message: 'Your submission is being reviewed. LMSA will contact you once a decision is made.',
  },
  self_corrected: {
    tone: 'info',
    label: 'Under review',
    message: 'Your correction has been received and is awaiting LMSA review.',
  },
}

function StatusSeal({ tone = 'info' }) {
  const stroke = tone === 'error' ? '#E24B4A' : tone === 'success' ? '#2A7A42' : '#087F8C'
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <path d="M21 4l14 8.25v16.5L21 37 7 28.75v-16.5L21 4z" stroke={stroke} strokeWidth="2" />
      <path
        d="M14.5 21.5l4.25 4.25L28 16.5"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function StudentStatusPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('This status link is missing its access token.')
      return
    }

    async function fetchStatus() {
      setStatus('loading')
      setError('')
      try {
        const res = await apiFetch(`/api/submissions/status?token=${encodeURIComponent(token)}`)
        const result = await res.json().catch(() => ({}))
        if (!res.ok || !result.found) {
          setStatus('error')
          setError('This status link is invalid or has expired.')
          return
        }
        setData(result)
        setStatus('loaded')
      } catch {
        setStatus('error')
        setError('Unable to load status. Check your connection and try again.')
      }
    }

    fetchStatus()
  }, [token])

  const detail = STATUS_DETAILS[data?.status] || STATUS_DETAILS.pending

  return (
    <div className="page-outer">
      <Navbar showLogin={false} />
      <main className="public-status-shell">
        <section className="public-status-card" aria-live="polite">
          {status === 'loading' ? (
            <>
              <div className="public-status-seal">
                <StatusSeal />
              </div>
              <h1 className="public-status-title">Loading correction status</h1>
              <p className="public-status-text">Checking the secure LMSA status link.</p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="public-status-seal public-status-seal--error">
                <StatusSeal tone="error" />
              </div>
              <h1 className="public-status-title">Status link unavailable</h1>
              <p className="public-status-text" role="alert">
                {error}
              </p>
              <div className="public-status-actions">
                <Link className="btn-primary" to="/check-status">
                  Check with Student ID
                </Link>
                <Link className="btn-outline" to="/">
                  Back to student portal
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className={`public-status-seal public-status-seal--${detail.tone}`}>
                <StatusSeal tone={detail.tone} />
              </div>
              <h1 className="public-status-title">Correction Status</h1>
              <p className="public-status-subtitle">A.M. Dogliotti College of Medicine</p>

              <div className={`public-status-banner public-status-banner--${detail.tone}`}>
                <strong>{detail.label}</strong>
                <p>{detail.message}</p>
                {data?.status === 'rejected' && (
                  <p className="public-status-note">
                    Admin note: {data.admin_notes || 'No additional notes provided.'}
                  </p>
                )}
              </div>

              <dl className="public-status-record">
                <div>
                  <dt>Name</dt>
                  <dd>{data?.full_name || 'Not available'}</dd>
                </div>
                <div>
                  <dt>Student ID</dt>
                  <dd>{data?.student_id || 'Not available'}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{new Date(data?.updated_at || Date.now()).toLocaleString()}</dd>
                </div>
              </dl>

              <div className="public-status-actions">
                <Link className="btn-primary" to="/check-status">
                  Check card status
                </Link>
                <Link className="btn-outline" to="/">
                  Back to student portal
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
