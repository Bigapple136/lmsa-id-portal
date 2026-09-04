/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import IDCardDisplay from '../components/IDCardDisplay'
import CardCanvas from '../components/CardCanvas'
import PrintPreviewModal from '../components/PrintPreviewModal'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/Toast'
import useDocumentTitle from '../lib/useDocumentTitle'

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const QR_FIELD_META = {
  blood_type: { label: 'Blood Type' },
  programme: { label: 'Programme' },
  student_email: { label: 'Email' },
  emergency_contact_name: { label: 'Emergency Contact Name' },
  emergency_contact_phone: { label: 'Emergency Contact Phone' },
  date_of_birth: { label: 'Date of Birth' },
  nationality: { label: 'Nationality' },
  county_of_origin: { label: 'County of Origin' },
  current_address: { label: 'Current Address' },
}

const ISSUE_TYPES = [
  { id: 'full_name', label: 'Misspelled name' },
  { id: 'year_level', label: 'Wrong level' },
  { id: 'qr_details', label: 'QR Code details (blood type, programme, etc.)' },
  { id: 'photo_issue', label: 'Wrong image' },
]

function base64UrlDecode(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function formatExpiry(exp) {
  if (!exp) return null
  const now = Math.floor(Date.now() / 1000)
  const diff = exp - now
  if (diff <= 0) return { expired: true, text: 'Expired' }
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  if (days > 0) return { expired: false, text: `${days}d ${hours}h remaining`, days, hours }
  if (hours > 0) return { expired: false, text: `${hours}h remaining`, days: 0, hours }
  const mins = Math.floor((diff % 3600) / 60)
  return { expired: false, text: `${mins}m remaining`, days: 0, hours: 0, mins }
}

export default function PreviewPage() {
  useDocumentTitle('Your ID card')
  const { token } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [templateUrl, setTemplateUrl] = useState(null)
  const [templateUrlFront, setTemplateUrlFront] = useState(null)
  const [templateUrlBack, setTemplateUrlBack] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)
  const [qrFields, setQrFields] = useState(null)
  const [fieldSides, setFieldSides] = useState(null)

  const [step, setStep] = useState('idle')
  const [selectedIssues, setSelectedIssues] = useState([])
  const [corrections, setCorrections] = useState({ full_name: '', year_level: '' })
  const [qrCorrections, setQrCorrections] = useState({})
  const [qrWrongFields, setQrWrongFields] = useState({})
  const [correctionError, setCorrectionError] = useState('')
  const [photoNoticed, setPhotoNoticed] = useState(false)
  const [reportTab, setReportTab] = useState('qr')

  const [, setTemplateStatus] = useState('loading')

  // Decode token to get expiry info (v2 tokens)
  const tokenInfo = useMemo(() => {
    if (!token || !token.startsWith('v2.')) return { version: 'v1', exp: null, expInfo: null }
    const parts = token.split('.')
    if (parts.length !== 4) return { version: 'v2', exp: null, expInfo: null }
    const claims = base64UrlDecode(parts[1])
    if (!claims) return { version: 'v2', exp: null, expInfo: null }
    const expInfo = formatExpiry(claims.exp)
    return { version: 'v2', exp: claims.exp, expInfo, claims }
  }, [token])

  // CardCanvas resolves front/back independently against calibrated
  // defaults, so it only needs a template and field-sides to render
  // something correct — no completeness gate required.
  const useDisplayCanvas = useMemo(
    () => Boolean(templateUrl && fieldSides),
    [templateUrl, fieldSides],
  )

  useEffect(() => {
    fetchStudent()
    fetchTemplateAndLayout()
  }, [token])

  // Listen for layout changes from admin dashboard and auto-refresh
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('layout-changes')
    channel.onmessage = (event) => {
      if (event.data?.type === 'layout-updated') {
        fetchTemplateAndLayout()
      }
    }
    return () => channel.close()
  }, [])

  async function fetchTemplateAndLayout() {
    // Fetch each resource independently so one failing endpoint never discards
    // the already-succeeded template/layout/qr-field responses.
    const [tRes, lRes, qrRes, fsRes] = await Promise.allSettled([
      apiFetch('/api/templates/active'),
      apiFetch('/api/settings/layout'),
      apiFetch('/api/settings/qr-fields'),
      apiFetch('/api/settings/field-sides'),
    ])
    if (tRes.status === 'fulfilled' && tRes.value.ok) {
      try {
        const t = await tRes.value.json()
        // t is now { front: {...}, back: {...} }
        setTemplateUrlFront(t.front?.file_url || null)
        setTemplateUrlBack(t.back?.file_url || null)
        // For backward compat, also set templateUrl to front
        setTemplateUrl(t.front?.file_url || t.back?.file_url || null)
        setTemplateStatus('ready')
      } catch {
        setTemplateStatus('missing')
      }
    } else {
      setTemplateStatus('missing')
    }
    if (lRes.status === 'fulfilled' && lRes.value.ok) {
      try {
        setCardLayout(await lRes.value.json())
      } catch {
        /* layout fetch parsed nothing usable — CardCanvas falls back to defaults */
      }
    }
    if (qrRes.status === 'fulfilled' && qrRes.value.ok) {
      try {
        setQrFields(await qrRes.value.json())
      } catch {}
    }
    if (fsRes.status === 'fulfilled' && fsRes.value.ok) {
      try {
        setFieldSides(await fsRes.value.json())
      } catch {}
    }
  }

  async function fetchStudent() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/students/preview/${encodeURIComponent(token)}`)
      if (res.status === 403) {
        setError('Invalid or tampered link.')
        return
      }
      if (!res.ok) {
        setError('Student record not found.')
        return
      }
      const data = await res.json()
      setStudent(data)
      if (data.status === 'confirmed') setConfirmed(true)
    } catch {
      setError('Failed to load your card. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/confirmations/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirmed' }),
      })
      if (!res.ok) throw new Error('Confirmation failed')
      setConfirmed(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleIssue(id) {
    setCorrectionError('')
    setSelectedIssues((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function handleIssueNext() {
    if (!selectedIssues.length) return
    const hasQr = selectedIssues.includes('qr_details')
    const hasPhoto = selectedIssues.includes('photo_issue')
    const hasOther = selectedIssues.some((i) => i !== 'qr_details' && i !== 'photo_issue')

    if (hasOther) {
      setCorrections({
        full_name: selectedIssues.includes('full_name') ? student.full_name || '' : '',
        year_level: selectedIssues.includes('year_level') ? student.year_level || '' : '',
      })
    }
    setCorrectionError('')

    if (hasQr && hasOther) {
      setReportTab('qr')
      setStep('report_modal')
    } else if (hasQr) {
      setStep('qr_form')
    } else if (hasOther) {
      setStep('other_form')
    } else if (hasPhoto) {
      setStep('photo_notice')
    }
  }

  function selectedQrFields() {
    return enabledQrFields().filter((field) => qrWrongFields[field])
  }

  function validateQrCorrectionSelection() {
    const fields = selectedQrFields()
    if (!fields.length) return { error: 'Select at least one QR detail to correct.' }

    const values = {}
    for (const field of fields) {
      const value = String(qrCorrections[field] || '').trim()
      if (!value) return { error: `Enter the correct ${QR_FIELD_META[field].label.toLowerCase()}.` }
      if (value === String(student[field] || '').trim()) {
        return {
          error: `Enter a ${QR_FIELD_META[field].label.toLowerCase()} that differs from the current record.`,
        }
      }
      values[field] = value
    }

    return { values }
  }

  function handleCombinedQrNext() {
    setCorrectionError('')
    const result = validateQrCorrectionSelection()
    if (result.error) {
      setCorrectionError(result.error)
      return
    }
    setReportTab('other')
  }

  function buildValidatedCorrectionBody() {
    const hasQr = selectedIssues.includes('qr_details')
    const hasPhoto = selectedIssues.includes('photo_issue')
    const hasOther = selectedIssues.some((i) => i !== 'qr_details' && i !== 'photo_issue')
    const nextCorrections = {}
    const nextQrCorrections = {}

    if (hasOther && selectedIssues.includes('full_name')) {
      const value = corrections.full_name.trim()
      if (!value) return { error: 'Enter the correct full name before submitting.' }
      if (value === String(student.full_name || '').trim()) {
        return { error: 'Enter a corrected full name that differs from the current record.' }
      }
      nextCorrections.full_name = value
    }

    if (hasOther && selectedIssues.includes('year_level')) {
      const value = corrections.year_level
      if (!value) return { error: 'Select the correct year / level before submitting.' }
      if (value === student.year_level) {
        return { error: 'Select a year / level that differs from the current record.' }
      }
      nextCorrections.year_level = value
    }

    if (hasQr) {
      const qrValidation = validateQrCorrectionSelection()
      if (qrValidation.error) return qrValidation
      Object.assign(nextQrCorrections, qrValidation.values)
    }

    return {
      body: {
        corrections: nextCorrections,
        qr_corrections: nextQrCorrections,
        photo_issue: hasPhoto,
      },
    }
  }

  function canSubmitQrCorrections() {
    const fields = selectedQrFields()
    return fields.length > 0 && fields.every((field) => String(qrCorrections[field] || '').trim())
  }

  async function handleCorrectionSubmit(e) {
    e.preventDefault()
    setCorrectionError('')
    const result = buildValidatedCorrectionBody()
    if (result.error) {
      setCorrectionError(result.error)
      return
    }

    setSubmitting(true)
    const hasPhoto = selectedIssues.includes('photo_issue')
    const body = result.body

    try {
      const res = await apiFetch(
        `/api/students/${encodeURIComponent(student.student_id)}/self-correct?token=${encodeURIComponent(token)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setStudent(updated)
      if (hasPhoto) setPhotoNoticed(true)
      setStep('done')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoOnlyReport() {
    setSubmitting(true)
    try {
      const res = await apiFetch(
        `/api/students/${encodeURIComponent(student.student_id)}/self-correct?token=${encodeURIComponent(token)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ corrections: {}, photo_issue: true }),
        },
      )
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setStudent(updated)
      setPhotoNoticed(true)
      setStep('done')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetReportFlow() {
    setStep('idle')
    setSelectedIssues([])
    setCorrections({ full_name: '', year_level: '' })
    setQrCorrections({})
    setQrWrongFields({})
    setCorrectionError('')
  }

  function toggleQrWrong(field) {
    setCorrectionError('')
    setQrWrongFields((prev) => {
      const next = { ...prev, [field]: !prev[field] }
      if (!next[field]) {
        setQrCorrections((prev2) => {
          const copy = { ...prev2 }
          delete copy[field]
          return copy
        })
      }
      return next
    })
  }

  function handleQrCorrectionChange(field, value) {
    setCorrectionError('')
    setQrCorrections((prev) => ({ ...prev, [field]: value }))
  }

  function enabledQrFields() {
    if (!qrFields) return []
    return Object.keys(QR_FIELD_META).filter((f) => qrFields[f]?.enabled)
  }

  if (loading)
    return (
      <div className="page-outer">
        <Navbar showLogin={false} hideMenu />
        <div className="page-center">
          <div className="preview-card">
            <div className="preview-topbar">
              <div className="skeleton skeleton-text skeleton-w-60" />
            </div>
            <div className="preview-skeleton-body">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text skeleton-w-80" />
              <div className="skeleton skeleton-text skeleton-w-65" />
              <div className="skeleton skeleton-text skeleton-w-50" />
              <div className="skeleton skeleton-text skeleton-w-40" />
            </div>
          </div>
        </div>
      </div>
    )

  if (error)
    return (
      <div className="page-outer">
        <Navbar showLogin={false} hideMenu />
        <div className="page-center">
          <div className="landing-card">
            <div className="landing-form">
              <div className="error-box" role="alert">
                {error}
              </div>
              <div className="preview-recovery-actions" aria-label="Preview recovery options">
                <button className="btn-outline" onClick={() => navigate('/')}>
                  Back to student portal
                </button>
                <button className="btn-gold" onClick={() => navigate('/check-status')}>
                  Check card status
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )

  return (
    <div className="page-outer">
      <Navbar showLogin={false} hideMenu />
      <main className="page-center" id="main-content">
        <div className="preview-card">
          <h1 className="sr-only">
            Your LMSA student ID card — review, confirm, or report a correction
          </h1>
          {/* Expiry warning banner for preview links (v2 tokens only) */}
          {tokenInfo.version === 'v2' && tokenInfo.expInfo && (
            <div
              className={`expiry-banner ${tokenInfo.expInfo.expired ? 'expired' : tokenInfo.expInfo.days <= 1 ? 'expiring-soon' : ''}`}
            >
              {tokenInfo.expInfo.expired ? (
                <>
                  <span className="expiry-banner-label">Expired</span>
                  This preview link has expired. Please request a new link from LMSA.
                </>
              ) : tokenInfo.expInfo.days <= 1 ? (
                <>
                  <span className="expiry-banner-label">Soon</span>
                  This preview link expires in {tokenInfo.expInfo.text}. Please confirm or report
                  issues soon.
                </>
              ) : (
                <>
                  <span className="expiry-banner-label">Active</span>
                  This preview link expires in {tokenInfo.expInfo.text}.
                </>
              )}
            </div>
          )}

          <div className="preview-topbar">
            <button className="btn-back" onClick={() => navigate('/')}>
              Back
            </button>
            <span className="preview-topbar-title">Your ID Card Preview</span>
          </div>

          {useDisplayCanvas ? (
            <div className="preview-card-stage">
              <CardCanvas
                student={student}
                templateUrlFront={templateUrlFront}
                templateUrlBack={templateUrlBack}
                layout={cardLayout}
                fieldSides={fieldSides}
                maxWidth={380}
              />
            </div>
          ) : (
            <div>
              <IDCardDisplay student={student} />
              {!templateUrl && (
                <p
                  className="preview-template-note"
                >
                  No card template uploaded yet — showing the fallback layout.
                </p>
              )}
            </div>
          )}
          <div className="preview-actions-pad">
            <button className="btn-print" onClick={() => setShowPrint(true)}>
              View print preview
            </button>

            {/* ── CONFIRMED ── */}
            {confirmed && (
              <div className="success-box">
                Your card has been confirmed. LMSA has been notified. Thank you.
              </div>
            )}

            {/* ── IDLE ── */}
            {!confirmed && step === 'idle' && (
              <>
                <div className="confirm-box">
                  Your details were found. Review carefully, then confirm or report an issue.
                </div>

                <div className="section-title">Verify your details</div>
                <div className="meta-table">
                  <div className="meta-row">
                    <span className="meta-key">Full name</span>
                    <span className="meta-val">{student.full_name}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Student ID</span>
                    <span className="meta-val">{student.student_id}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Year / Level</span>
                    <span className="meta-val">{student.year_level}</span>
                  </div>
                  <div className="meta-row meta-row--last">
                    <span className="meta-key">Status</span>
                    <span className="meta-val status-pending">
                      {student.status === 'photo_issue'
                        ? 'Photo issue — admin notified'
                        : 'Pending confirmation'}
                    </span>
                  </div>
                </div>

                <div className="divider" />

                <div className="section-title">QR Code details</div>
                <p className="preview-panel-hint">
                  These details will appear when someone scans your ID card QR code. Please review
                  carefully.
                </p>
                <div className="meta-table meta-table--tight">
                  {enabledQrFields().map((field) => (
                    <div key={field} className="meta-row">
                      <span className="meta-key">{QR_FIELD_META[field].label}</span>
                      <span
                        className={`meta-val${student[field] ? '' : ' meta-value--unset'}`}
                      >
                        {student[field] || '— not set'}
                      </span>
                    </div>
                  ))}
                </div>

                {student.status === 'photo_issue' ? (
                  <div className="info-box">
                    Your photo issue has been reported. LMSA will contact you to arrange a re-shoot.
                  </div>
                ) : (
                  <div className="btn-row">
                    <button className="btn-gold" onClick={handleConfirm} disabled={submitting}>
                      {submitting ? 'Confirming...' : 'Confirm — all correct'}
                    </button>
                    <button className="btn-outline" onClick={() => setStep('select')}>
                      Report an issue
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── STEP: SELECT ── */}
            {step === 'select' && (
              <div className="report-panel">
                <div className="section-title">What needs correcting?</div>
                <p className="preview-panel-hint preview-panel-hint--lg">
                  Select all that apply — you can fix multiple things at once.
                </p>
                <div
                  className="issue-type-list"
                >
                  {ISSUE_TYPES.map((issue) => (
                    <label
                      key={issue.id}
                      className={`issue-option ${selectedIssues.includes(issue.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(issue.id)}
                        onChange={() => toggleIssue(issue.id)}
                        className="accent-gold"
                      />
                      <span>{issue.label}</span>
                    </label>
                  ))}
                </div>
                <div className="btn-row">
                  <button
                    className="btn-gold"
                    onClick={handleIssueNext}
                    disabled={!selectedIssues.length}
                  >
                    Continue
                  </button>
                  <button className="btn-outline" onClick={resetReportFlow}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: QR FORM (QR only) ── */}
            {step === 'qr_form' && (
              <div className="report-panel">
                <div className="section-title">Correct your QR Code details</div>
                <p className="correction-help">
                  These details will appear when your QR code is scanned. Select each incorrect
                  field and enter the replacement value.
                </p>
                {correctionError && (
                  <div className="error-box" role="alert">
                    {correctionError}
                  </div>
                )}
                <div className="qr-correction-list">
                  {enabledQrFields().map((field) => (
                    <QrFieldRow
                      key={field}
                      field={field}
                      currentValue={student[field] || '—'}
                      isWrong={!!qrWrongFields[field]}
                      correctionValue={qrCorrections[field] || ''}
                      onToggleWrong={() => toggleQrWrong(field)}
                      onCorrectionChange={(v) => handleQrCorrectionChange(field, v)}
                    />
                  ))}
                </div>
                <div className="btn-row">
                  <button
                    className="btn-gold"
                    onClick={handleCorrectionSubmit}
                    disabled={submitting || !canSubmitQrCorrections()}
                  >
                    {submitting ? 'Submitting...' : 'Submit Correction'}
                  </button>
                  <button className="btn-outline" onClick={() => setStep('select')}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: REPORT MODAL (QR + other issues) ── */}
            {step === 'report_modal' && (
              <div className="report-panel report-panel--flush">
                <div
                  className="modal report-tabs-shell"
                >
                  <div
                    className="report-tabs"
                  >
                    <button
                      onClick={() => {
                        setCorrectionError('')
                        setReportTab('qr')
                      }}
                      type="button"
                      className={`report-tab${reportTab === 'qr' ? ' is-active' : ''}`}
                    >
                      QR Code Details
                    </button>
                    <button
                      onClick={() => {
                        setCorrectionError('')
                        setReportTab('other')
                      }}
                      type="button"
                      className={`report-tab${reportTab === 'other' ? ' is-active' : ''}`}
                    >
                      Other Issues
                    </button>
                  </div>

                  {reportTab === 'qr' && (
                    <div className="report-tab-panel">
                      <p className="correction-help">
                        Select every incorrect QR detail and enter the value LMSA should review.
                      </p>
                      {correctionError && (
                        <div className="error-box" role="alert">
                          {correctionError}
                        </div>
                      )}
                      <div className="qr-correction-list">
                        {enabledQrFields().map((field) => (
                          <QrFieldRow
                            key={field}
                            field={field}
                            currentValue={student[field] || '—'}
                            isWrong={!!qrWrongFields[field]}
                            correctionValue={qrCorrections[field] || ''}
                            onToggleWrong={() => toggleQrWrong(field)}
                            onCorrectionChange={(v) => handleQrCorrectionChange(field, v)}
                          />
                        ))}
                      </div>
                      <div className="btn-row">
                        <button
                          className="btn-gold"
                          onClick={handleCombinedQrNext}
                          disabled={!canSubmitQrCorrections()}
                        >
                          Continue to other details
                        </button>
                        <button className="btn-outline" onClick={() => setStep('select')}>
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {reportTab === 'other' && (
                    <form onSubmit={handleCorrectionSubmit}>
                      <div
                        className="report-tab-form"
                      >
                        {correctionError && (
                          <div className="error-box" role="alert">
                            {correctionError}
                          </div>
                        )}
                        {selectedIssues.includes('full_name') && (
                          <div className="field-group">
                            <label
                              className="field-label"
                              htmlFor="preview-correct-full-name-combined"
                            >
                              Correct full name
                            </label>
                            <input
                              id="preview-correct-full-name-combined"
                              className="field-input"
                              value={corrections.full_name}
                              onChange={(e) => {
                                setCorrectionError('')
                                setCorrections({ ...corrections, full_name: e.target.value })
                              }}
                              placeholder="Enter your correct full name"
                              required
                            />
                          </div>
                        )}
                        {selectedIssues.includes('year_level') && (
                          <div className="field-group">
                            <label className="field-label" htmlFor="preview-correct-year-combined">
                              Correct year / level
                            </label>
                            <select
                              id="preview-correct-year-combined"
                              className="field-input"
                              value={corrections.year_level}
                              onChange={(e) => {
                                setCorrectionError('')
                                setCorrections({ ...corrections, year_level: e.target.value })
                              }}
                            >
                              {YEARS.map((y) => (
                                <option key={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {selectedIssues.includes('photo_issue') && (
                          <div className="info-box">
                            Your photo issue will also be reported to the admin for correction.
                          </div>
                        )}
                      </div>
                      <div className="btn-row btn-row--padded">
                        <button className="btn-gold" type="submit" disabled={submitting}>
                          {submitting ? 'Submitting...' : 'Submit Correction'}
                        </button>
                        <button
                          className="btn-outline"
                          type="button"
                          onClick={() => setStep('select')}
                        >
                          Back
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP: OTHER FORM (non-QR issues only) ── */}
            {step === 'other_form' && (
              <div className="report-panel">
                <div className="section-title">Enter the correct details</div>
                <form
                  onSubmit={handleCorrectionSubmit}
                  className="stacked-form"
                >
                  {correctionError && (
                    <div className="error-box" role="alert">
                      {correctionError}
                    </div>
                  )}
                  {selectedIssues.includes('full_name') && (
                    <div className="field-group">
                      <label className="field-label" htmlFor="preview-correct-full-name">
                        Correct full name
                      </label>
                      <input
                        id="preview-correct-full-name"
                        className="field-input"
                        value={corrections.full_name}
                        onChange={(e) => {
                          setCorrectionError('')
                          setCorrections({ ...corrections, full_name: e.target.value })
                        }}
                        placeholder="Enter your correct full name"
                        required
                      />
                    </div>
                  )}
                  {selectedIssues.includes('year_level') && (
                    <div className="field-group">
                      <label className="field-label" htmlFor="preview-correct-year">
                        Correct year / level
                      </label>
                      <select
                        id="preview-correct-year"
                        className="field-input"
                        value={corrections.year_level}
                        onChange={(e) => {
                          setCorrectionError('')
                          setCorrections({ ...corrections, year_level: e.target.value })
                        }}
                      >
                        {YEARS.map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedIssues.includes('photo_issue') && (
                    <div className="info-box">
                      Your photo issue will also be reported to the admin for correction.
                    </div>
                  )}
                  <div className="btn-row">
                    <button className="btn-gold" type="submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Correction'}
                    </button>
                    <button className="btn-outline" type="button" onClick={() => setStep('select')}>
                      Back
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── STEP: PHOTO ONLY NOTICE ── */}
            {step === 'photo_notice' && (
              <div className="report-panel">
                <div className="section-title">Wrong photo</div>
                <div className="info-box info-box--spaced">
                  For security, photo corrections cannot be made online. Submitting this report will
                  notify LMSA who will arrange a re-shoot with you.
                </div>
                <div className="btn-row">
                  <button
                    className="btn-gold"
                    onClick={handlePhotoOnlyReport}
                    disabled={submitting}
                  >
                    {submitting ? 'Reporting...' : 'Notify admin'}
                  </button>
                  <button className="btn-outline" onClick={resetReportFlow}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: DONE ── */}
            {step === 'done' && (
              <div className="success-box">
                {photoNoticed && !selectedIssues.some((i) => i !== 'photo_issue')
                  ? 'Photo issue reported. LMSA will contact you to arrange a re-shoot.'
                  : 'Corrections submitted. Please review your updated card above and confirm if everything looks correct now.'}
                {selectedIssues.some((i) => i !== 'photo_issue') && !confirmed && (
                  <div className="mt-12">
                    <button
                      className="btn-gold btn-full"
                      onClick={handleConfirm}
                      disabled={submitting}
                    >
                      {submitting ? 'Confirming...' : 'Confirm — now looks correct'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {showPrint && <PrintPreviewModal student={student} onClose={() => setShowPrint(false)} />}
    </div>
  )
}

function QrFieldRow({
  field,
  currentValue,
  isWrong,
  correctionValue,
  onToggleWrong,
  onCorrectionChange,
}) {
  const isBloodType = field === 'blood_type'
  const inputId = `qr-correction-${field}`
  const editorId = `qr-correction-value-${field}`
  return (
    <div className={`qr-field-row${isWrong ? ' is-selected' : ''}`}>
      <div className="qr-field-row-main">
        <label className="qr-field-toggle" htmlFor={inputId}>
          <input id={inputId} type="checkbox" checked={isWrong} onChange={onToggleWrong} />
          <span>{QR_FIELD_META[field].label}</span>
        </label>
        <span className="qr-field-current">Current: {currentValue}</span>
      </div>
      {isWrong && (
        <div className="qr-field-editor">
          <label className="field-label" htmlFor={editorId}>
            Correct {QR_FIELD_META[field].label.toLowerCase()}
          </label>
          {isBloodType ? (
            <select
              id={editorId}
              className="field-input"
              value={correctionValue}
              onChange={(e) => onCorrectionChange(e.target.value)}
              required
            >
              <option value="">Select correct blood type</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={editorId}
              className="field-input"
              type={
                field === 'student_email'
                  ? 'email'
                  : field === 'emergency_contact_phone'
                    ? 'tel'
                    : 'text'
              }
              value={correctionValue}
              onChange={(e) => onCorrectionChange(e.target.value)}
              placeholder={`Correct ${QR_FIELD_META[field].label.toLowerCase()}`}
              required
            />
          )}
        </div>
      )}
    </div>
  )
}
