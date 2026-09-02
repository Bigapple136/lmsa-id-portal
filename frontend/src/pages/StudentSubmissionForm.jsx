/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { apiFetch } from '../lib/api'

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const LIBERIA_COUNTIES = [
  'Bomi',
  'Bong',
  'Gbarpolu',
  'Grand Bassa',
  'Grand Cape Mount',
  'Grand Gedeh',
  'Grand Kru',
  'Lofa',
  'Margibi',
  'Maryland',
  'Montserrado',
  'Nimba',
  'River Cess',
  'River Gee',
  'Sinoe',
]

const STEPS = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'academic', label: 'Academic Information' },
  { key: 'additional', label: 'Additional Information' },
  { key: 'review', label: 'Review & Submit' },
]

const INITIAL_FORM = {
  student_id: '',
  full_name: '',
  year_level: '1st Year',
  position: '',
  programme: '',
  blood_type: '',
  student_email: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  date_of_birth: '',
  nationality: 'Liberian',
  county_of_origin: '',
  current_address: '',
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function formatServerError(message) {
  if (!message) return 'Submission failed. Please try again.'
  return message.replace(/_/g, ' ')
}

export default function StudentSubmissionForm() {
  const [enabled, setEnabled] = useState(null)
  const [statusError, setStatusError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [fieldsConfig, setFieldsConfig] = useState(null)
  const [qrFieldsConfig, setQrFieldsConfig] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        setStatusError(false)
        setErrorDetail('')

        let statusRes
        try {
          statusRes = await apiFetch('/api/submissions/status', { retries: 2 })
        } catch (err) {
          console.error('[StudentSubmissionForm] status request failed', err)
          if (window.Sentry) {
            try {
              window.Sentry.captureException(err, { tags: { stage: 'load-status' } })
            } catch {}
          }
          const timedOut = err && err.name === 'AbortError'
          setErrorDetail(
            timedOut
              ? 'The server took too long to respond. This can happen if it was asleep — please retry.'
              : "We couldn't reach the server. Check your connection and retry.",
          )
          setStatusError(true)
          return
        }

        const statusData = await statusRes.json().catch(() => ({}))
        if (!statusRes.ok) {
          console.error('[StudentSubmissionForm] status responded', statusRes.status, statusData)
          setErrorDetail(
            statusRes.status === 429
              ? 'Too many requests right now. Please wait a moment and retry.'
              : 'The form service is temporarily unavailable. Please retry shortly.',
          )
          setStatusError(true)
          return
        }
        setEnabled(typeof statusData.enabled === 'boolean' ? statusData.enabled : false)

        const [fieldsSettled, qrSettled] = await Promise.allSettled([
          apiFetch('/api/settings/fields').then((r) => r.json()),
          apiFetch('/api/settings/qr-fields').then((r) => r.json()),
        ])
        setFieldsConfig(fieldsSettled.status === 'fulfilled' ? fieldsSettled.value : null)
        setQrFieldsConfig(qrSettled.status === 'fulfilled' ? qrSettled.value : null)
      } catch (err) {
        console.error('[StudentSubmissionForm] init failed', err)
        if (window.Sentry) {
          try {
            window.Sentry.captureException(err, { tags: { stage: 'load-init' } })
          } catch {}
        }
        setErrorDetail('Something went wrong while loading the form. Please retry.')
        setStatusError(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [retry])

  const visibleFields = useMemo(
    () => ({
      position: fieldsConfig?.position?.enabled === true,
      programme: qrFieldsConfig?.programme?.enabled === true,
      blood_type: qrFieldsConfig?.blood_type?.enabled === true,
      student_email: qrFieldsConfig?.student_email?.enabled === true,
      emergency_contact_name: qrFieldsConfig?.emergency_contact_name?.enabled === true,
      emergency_contact_phone: qrFieldsConfig?.emergency_contact_phone?.enabled === true,
      date_of_birth: qrFieldsConfig?.date_of_birth?.enabled === true,
      nationality: qrFieldsConfig?.nationality?.enabled === true,
      county_of_origin: qrFieldsConfig?.county_of_origin?.enabled === true,
      current_address: qrFieldsConfig?.current_address?.enabled === true,
    }),
    [fieldsConfig, qrFieldsConfig],
  )

  const update = (field) => (e) => {
    const value = e.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    if (error) setError('')
  }

  function validateFields(fields) {
    const nextErrors = {}

    for (const field of fields) {
      const value = String(form[field] || '').trim()
      if (field === 'student_id' && !value) nextErrors[field] = 'Enter your Student ID.'
      if (field === 'full_name' && !value) nextErrors[field] = 'Enter your full name.'
      if (field === 'year_level' && !YEARS.includes(form.year_level)) {
        nextErrors[field] = 'Select your year level.'
      }
      if (field === 'student_email' && value && !isEmail(value)) {
        nextErrors[field] = 'Enter a valid email address.'
      }
      if (field === 'date_of_birth' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        nextErrors[field] = 'Use a valid date of birth.'
      }
    }

    return nextErrors
  }

  function fieldsForStep(stepIndex) {
    if (stepIndex === 0) return ['student_id', 'full_name', 'year_level']
    if (stepIndex === 1) return visibleFields.programme ? ['programme'] : []
    if (stepIndex === 2) {
      return [
        visibleFields.student_email && 'student_email',
        visibleFields.date_of_birth && 'date_of_birth',
        visibleFields.nationality && 'nationality',
        visibleFields.county_of_origin && 'county_of_origin',
        visibleFields.current_address && 'current_address',
        visibleFields.blood_type && 'blood_type',
        visibleFields.emergency_contact_name && 'emergency_contact_name',
        visibleFields.emergency_contact_phone && 'emergency_contact_phone',
      ].filter(Boolean)
    }
    return []
  }

  function validateStep(stepIndex = step) {
    const nextErrors = validateFields(fieldsForStep(stepIndex))
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setError('Please fix the highlighted field before continuing.')
      return false
    }
    setError('')
    return true
  }

  function handleNext() {
    if (!validateStep(step)) return
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function handleBack() {
    if (step === 0) {
      if (window.history.length > 1) window.history.back()
      else window.location.assign('/')
      return
    }
    setError('')
    setFieldErrors({})
    setStep((current) => Math.max(current - 1, 0))
  }

  function validateAllSteps() {
    const stepErrors = [0, 1, 2].map((stepIndex) => validateFields(fieldsForStep(stepIndex)))
    const nextErrors = Object.assign({}, ...stepErrors)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const firstErrorStep = stepErrors.findIndex((errors) => Object.keys(errors).length)
      setStep(firstErrorStep >= 0 ? firstErrorStep : 0)
      setError('Please fix the highlighted field before submitting.')
      return false
    }
    return true
  }

  async function doSubmit() {
    if (!validateAllSteps()) return
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy before submitting.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError(formatServerError(data.error))
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reviewRows = [
    { label: 'Student ID', value: form.student_id || 'Not provided' },
    { label: 'Full Name', value: form.full_name || 'Not provided' },
    { label: 'Year / Level', value: form.year_level || 'Not provided' },
    visibleFields.position && { label: 'Position', value: form.position || 'Not provided' },
    visibleFields.programme && { label: 'Programme', value: form.programme || 'Not provided' },
    visibleFields.student_email && { label: 'Email', value: form.student_email || 'Not provided' },
    visibleFields.date_of_birth && {
      label: 'Date of Birth',
      value: form.date_of_birth || 'Not provided',
    },
    visibleFields.nationality && {
      label: 'Nationality',
      value: form.nationality || 'Not provided',
    },
    visibleFields.county_of_origin && {
      label: 'County of Origin',
      value: form.county_of_origin || 'Not provided',
    },
    visibleFields.current_address && {
      label: 'Address',
      value: form.current_address || 'Not provided',
    },
    visibleFields.blood_type && { label: 'Blood Type', value: form.blood_type || 'Not provided' },
    visibleFields.emergency_contact_name && {
      label: 'Emergency Contact',
      value: form.emergency_contact_name || 'Not provided',
    },
    visibleFields.emergency_contact_phone && {
      label: 'Emergency Phone',
      value: form.emergency_contact_phone || 'Not provided',
    },
  ].filter(Boolean)

  if (loading) {
    return (
      <SubmissionState
        title="Loading student form"
        message="Preparing the secure LMSA submission form."
      />
    )
  }

  if (statusError) {
    return (
      <SubmissionState
        title="Unable to load the form"
        message={
          errorDetail ||
          'We could not reach the server. Please check your connection and try again.'
        }
        tone="error"
      >
        <button
          className="btn-primary submission-state-action"
          onClick={() => setRetry((n) => n + 1)}
        >
          Retry loading form
        </button>
        <Link className="btn-outline submission-state-action" to="/check-status">
          Check existing status
        </Link>
      </SubmissionState>
    )
  }

  if (!enabled) {
    return (
      <SubmissionState
        title="Form is currently closed"
        message="The student submission form is not accepting responses at this time. You can still check an existing card status."
        tone="locked"
      >
        <Link className="btn-primary submission-state-action" to="/check-status">
          Check card status
        </Link>
        <Link className="btn-outline submission-state-action" to="/">
          Back to student portal
        </Link>
      </SubmissionState>
    )
  }

  if (submitted) {
    return (
      <div className="submission-page">
        <SubmissionTopbar />
        <div className="submission-wizard-body">
          <div className="submission-wizard-card">
            <div className="submission-final-state" role="status">
              <div className="submission-final-seal" aria-hidden="true">
                <SealIcon />
              </div>
              <h1>Submission received</h1>
              <p>
                Your details have been submitted successfully. LMSA will review your information
                before it is added to the ID card workflow.
              </p>
              <div className="submission-final-actions">
                <Link className="btn-primary" to="/check-status">
                  Check status later
                </Link>
                <Link className="btn-outline" to="/">
                  Back to student portal
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="submission-page">
      <SubmissionTopbar />

      <div className="submission-wizard-body">
        <div className="submission-wizard-card">
          <div className="step-indicator" aria-label="Submission progress">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`step-item ${i <= step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <div className="step-circle">{i < step ? '\u2713' : i + 1}</div>
                <div className="step-label">{s.label}</div>
                {i < STEPS.length - 1 && <div className="step-line" aria-hidden="true" />}
              </div>
            ))}
          </div>

          <div className="submission-form-body">
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}

            {step === 0 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h1 className="form-section-title">Student Information</h1>
                    <p className="form-section-sub">
                      Enter the details LMSA uses to identify your student card record. Required
                      fields are marked.
                    </p>
                  </div>
                  <SecurityBadge />
                </div>
                <div className="form-grid">
                  <FieldWrapper field="student_id" label="Student ID" required errors={fieldErrors}>
                    <input
                      id="submission-student-id"
                      className="field-input"
                      placeholder="e.g. AMD-2024-0001"
                      value={form.student_id}
                      onChange={update('student_id')}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.student_id)}
                      aria-describedby="submission-student-id-error"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                  </FieldWrapper>
                  <FieldWrapper field="full_name" label="Full Name" required errors={fieldErrors}>
                    <input
                      id="submission-full-name"
                      className="field-input"
                      placeholder="Enter your full name"
                      value={form.full_name}
                      onChange={update('full_name')}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.full_name)}
                      aria-describedby="submission-full-name-error"
                      autoComplete="name"
                    />
                  </FieldWrapper>
                  <FieldWrapper field="year_level" label="Year Level" required errors={fieldErrors}>
                    <select
                      id="submission-year-level"
                      className="field-input"
                      value={form.year_level}
                      onChange={update('year_level')}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.year_level)}
                      aria-describedby="submission-year-level-error"
                    >
                      <option value="">Select year level</option>
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>
                  {visibleFields.position && (
                    <FieldWrapper field="position" label="Position" errors={fieldErrors}>
                      <input
                        id="submission-position"
                        className="field-input"
                        placeholder="Your position in LMSA"
                        value={form.position}
                        onChange={update('position')}
                        aria-describedby="submission-position-hint"
                      />
                      <p className="field-hint" id="submission-position-hint">
                        Optional — for LMSA roles that appear on the card.
                      </p>
                    </FieldWrapper>
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h1 className="form-section-title">Academic Information</h1>
                    <p className="form-section-sub">
                      Add academic details when LMSA has requested them for QR verification.
                    </p>
                  </div>
                </div>
                {visibleFields.programme ? (
                  <div className="form-grid">
                    <FieldWrapper field="programme" label="Programme" errors={fieldErrors}>
                      <input
                        id="submission-programme"
                        className="field-input"
                        placeholder="Enter your programme"
                        value={form.programme}
                        onChange={update('programme')}
                        aria-describedby="submission-programme-hint"
                      />
                      <p className="field-hint" id="submission-programme-hint">
                        Optional — leave blank if LMSA has not assigned a programme label.
                      </p>
                    </FieldWrapper>
                  </div>
                ) : (
                  <div className="form-grid-empty">
                    No additional academic fields are needed for this submission.
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h1 className="form-section-title">Additional Information</h1>
                    <p className="form-section-sub">
                      These details may appear when an official QR code is scanned. Only provide
                      information you recognise and want LMSA to review.
                    </p>
                  </div>
                </div>
                {fieldsForStep(2).length ? (
                  <div className="form-grid">
                    {visibleFields.student_email && (
                      <FieldWrapper field="student_email" label="Email" errors={fieldErrors}>
                        <input
                          id="submission-student-email"
                          className="field-input"
                          type="email"
                          placeholder="Enter your email address"
                          value={form.student_email}
                          onChange={update('student_email')}
                          aria-invalid={Boolean(fieldErrors.student_email)}
                          aria-describedby="submission-student-email-error"
                          autoComplete="email"
                        />
                      </FieldWrapper>
                    )}
                    {visibleFields.date_of_birth && (
                      <FieldWrapper
                        field="date_of_birth"
                        label="Date of Birth"
                        errors={fieldErrors}
                      >
                        <input
                          id="submission-date-of-birth"
                          className="field-input"
                          type="date"
                          value={form.date_of_birth}
                          onChange={update('date_of_birth')}
                          aria-invalid={Boolean(fieldErrors.date_of_birth)}
                          aria-describedby="submission-date-of-birth-error"
                        />
                      </FieldWrapper>
                    )}
                    {visibleFields.nationality && (
                      <FieldWrapper field="nationality" label="Nationality" errors={fieldErrors}>
                        <input
                          id="submission-nationality"
                          className="field-input"
                          placeholder="Enter your nationality"
                          value={form.nationality}
                          onChange={update('nationality')}
                          autoComplete="country-name"
                        />
                      </FieldWrapper>
                    )}
                    {visibleFields.county_of_origin && (
                      <FieldWrapper
                        field="county_of_origin"
                        label="County of Origin"
                        errors={fieldErrors}
                      >
                        <input
                          id="submission-county-of-origin"
                          className="field-input"
                          list="liberia-counties-sub"
                          placeholder="e.g. Montserrado"
                          value={form.county_of_origin}
                          onChange={update('county_of_origin')}
                        />
                        <datalist id="liberia-counties-sub">
                          {LIBERIA_COUNTIES.map((county) => (
                            <option key={county} value={county} />
                          ))}
                        </datalist>
                      </FieldWrapper>
                    )}
                    {visibleFields.current_address && (
                      <FieldWrapper
                        field="current_address"
                        label="Address"
                        errors={fieldErrors}
                        className="form-grid-full"
                      >
                        <textarea
                          id="submission-current-address"
                          className="field-input submission-textarea"
                          placeholder="Enter your full address"
                          rows={3}
                          value={form.current_address}
                          onChange={update('current_address')}
                          autoComplete="street-address"
                        />
                      </FieldWrapper>
                    )}
                    {visibleFields.blood_type && (
                      <FieldWrapper field="blood_type" label="Blood Type" errors={fieldErrors}>
                        <select
                          id="submission-blood-type"
                          className="field-input"
                          value={form.blood_type}
                          onChange={update('blood_type')}
                        >
                          <option value="">Select blood type</option>
                          {BLOOD_TYPES.map((bloodType) => (
                            <option key={bloodType} value={bloodType}>
                              {bloodType}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>
                    )}
                    {visibleFields.emergency_contact_name && (
                      <FieldWrapper
                        field="emergency_contact_name"
                        label="Emergency Contact Name"
                        errors={fieldErrors}
                      >
                        <input
                          id="submission-emergency-contact-name"
                          className="field-input"
                          placeholder="Enter full name"
                          value={form.emergency_contact_name}
                          onChange={update('emergency_contact_name')}
                          autoComplete="name"
                        />
                      </FieldWrapper>
                    )}
                    {visibleFields.emergency_contact_phone && (
                      <FieldWrapper
                        field="emergency_contact_phone"
                        label="Emergency Contact Phone"
                        errors={fieldErrors}
                      >
                        <input
                          id="submission-emergency-contact-phone"
                          className="field-input"
                          type="tel"
                          placeholder="+231 xxx xxxx"
                          value={form.emergency_contact_phone}
                          onChange={update('emergency_contact_phone')}
                          autoComplete="tel"
                        />
                      </FieldWrapper>
                    )}
                  </div>
                ) : (
                  <div className="form-grid-empty">
                    No QR or emergency fields are enabled for this submission.
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h1 className="form-section-title">Review &amp; Submit</h1>
                    <p className="form-section-sub">
                      Review the information LMSA will receive before submitting.
                    </p>
                  </div>
                  <SecurityBadge />
                </div>
                <div className="review-grid">
                  {reviewRows.map((row) => (
                    <div key={row.label} className="review-row">
                      <span className="review-label">{row.label}</span>
                      <span className="review-value">{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="review-note">
                  Blank optional details are recorded as “Not provided” and can be clarified during
                  LMSA review.
                </p>
                <div className="review-agree">
                  <input
                    type="checkbox"
                    id="agree-tos"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <label htmlFor="agree-tos">
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noreferrer">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="submission-form-footer">
            <button className="submission-btn-cancel" type="button" onClick={handleBack}>
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button className="submission-btn-next" type="button" onClick={handleNext}>
                Continue
              </button>
            ) : (
              <button
                className="submission-btn-submit"
                type="button"
                onClick={doSubmit}
                disabled={!agreed || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit details'}
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function SubmissionTopbar() {
  return (
    <div className="submission-topbar">
      <div className="submission-topbar-inner">
        <Link className="submission-topbar-brand" to="/" aria-label="LMSA ID Portal home">
          <img src="/lmsa-logo.png" alt="LMSA" className="submission-topbar-logo" />
          <span className="submission-topbar-name">LMSA</span>
        </Link>
        <div className="submission-topbar-right">
          <span className="submission-topbar-portal">Student Portal</span>
        </div>
      </div>
    </div>
  )
}

function FieldWrapper({ field, label, required = false, errors, children, className = '' }) {
  const inputId = `submission-${field.replace(/_/g, '-')}`
  const errorId = `${inputId}-error`
  return (
    <div className={`field-group ${className}`.trim()}>
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {children}
      {errors[field] && (
        <p className="field-error" id={errorId}>
          {errors[field]}
        </p>
      )}
    </div>
  )
}

function SecurityBadge() {
  return (
    <div className="form-security-badge">
      <span className="form-security-icon" aria-hidden="true">
        <SealIcon small />
      </span>
      <span className="form-security-text">Your information is secure and kept confidential.</span>
    </div>
  )
}

function SubmissionState({ title, message, tone = 'info', children }) {
  return (
    <div className="submission-page">
      <SubmissionTopbar />
      <main className="submission-wizard-body">
        <div className={`submission-state-card submission-state-card--${tone}`} role="status">
          <div className="submission-state-seal" aria-hidden="true">
            <SealIcon tone={tone} />
          </div>
          <h1>{title}</h1>
          <p>{message}</p>
          {children && <div className="submission-state-actions">{children}</div>}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function SealIcon({ tone = 'info', small = false }) {
  const stroke = tone === 'error' ? '#E24B4A' : tone === 'locked' ? '#C9A84C' : '#087F8C'
  const size = small ? 20 : 46
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none" aria-hidden="true">
      <path d="M23 5l15.5 9v18L23 41 7.5 32V14L23 5z" stroke={stroke} strokeWidth="2" />
      <path
        d="M15.5 23.5l5 5L31 17.5"
        stroke={stroke}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
