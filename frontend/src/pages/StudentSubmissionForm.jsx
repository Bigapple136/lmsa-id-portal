import { useState, useEffect } from 'react'
import Footer from '../components/Footer'
import { apiFetch } from '../lib/api'
import { Button } from '../components/ui'

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const LIBERIA_COUNTIES = [
  'Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount',
  'Grand Gedeh', 'Grand Kru', 'Lofa', 'Margibi', 'Maryland',
  'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe',
]

const STEPS = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'academic', label: 'Academic Information' },
  { key: 'additional', label: 'Additional Information' },
  { key: 'review', label: 'Review & Submit' },
]

export default function StudentSubmissionForm() {
  const [enabled, setEnabled] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [fieldsConfig, setFieldsConfig] = useState(null)
  const [qrFieldsConfig, setQrFieldsConfig] = useState(null)
  const [form, setForm] = useState({
    student_id: '', full_name: '', year_level: '1st Year', position: '',
    programme: '', blood_type: '', student_email: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    date_of_birth: '', nationality: 'Liberian', county_of_origin: '', current_address: '',
  })

  useEffect(() => {
    async function init() {
      try {
        const [statusRes, fieldsRes, qrFieldsRes] = await Promise.all([
          apiFetch('/api/submissions/status'), apiFetch('/api/settings/fields'), apiFetch('/api/settings/qr-fields'),
        ])
        const [statusData, fieldsData, qrFieldsData] = await Promise.all([
          statusRes.json(), fieldsRes.json(), qrFieldsRes.json(),
        ])
        setEnabled(statusData.enabled); setFieldsConfig(fieldsData); setQrFieldsConfig(qrFieldsData)
      } catch { setEnabled(false) }
      setLoading(false)
    }
    init()
  }, [])

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const showPosition = fieldsConfig?.position?.enabled === true
  const showProgramme = qrFieldsConfig?.programme?.enabled === true
  const showBloodType = qrFieldsConfig?.blood_type?.enabled === true
  const showStudentEmail = qrFieldsConfig?.student_email?.enabled === true
  const showEmergencyContactName = qrFieldsConfig?.emergency_contact_name?.enabled === true
  const showEmergencyContactPhone = qrFieldsConfig?.emergency_contact_phone?.enabled === true
  const showDateOfBirth = qrFieldsConfig?.date_of_birth?.enabled === true
  const showNationality = qrFieldsConfig?.nationality?.enabled === true
  const showCountyOfOrigin = qrFieldsConfig?.county_of_origin?.enabled === true
  const showCurrentAddress = qrFieldsConfig?.current_address?.enabled === true

  function canNext() {
    if (step === 0) return form.student_id.trim() && form.full_name.trim()
    return true
  }

  async function doSubmit() {
    setSubmitting(true); setError('')
    try {
      const res = await apiFetch('/api/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) setSubmitted(true)
      else setError(data.error || 'Submission failed. Please try again.')
    } catch { setError('Something went wrong. Please check your connection and try again.') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="page-center">
      <div className="landing-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)' }}>
        <p className="loading">Loading submission form...</p>
      </div>
    </div>
  )

  if (!enabled) return (
    <div className="page-center">
      <div className="landing-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)' }}>
        <div style={{ fontSize: '36px', marginBottom: 'var(--space-3)' }}>🔒</div>
        <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Form is currently closed</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>The student submission form is not accepting responses at this time.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="submission-page">
      <div className="submission-topbar">
        <div className="submission-topbar-inner">
          <div className="submission-topbar-brand">
            <img src="/lmsa-logo.png" alt="LMSA" className="submission-topbar-logo" />
            <span className="submission-topbar-name">LMSA</span>
          </div>
        </div>
      </div>
      <div className="submission-wizard-body">
        <div className="submission-wizard-card">
          <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-8)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✅</div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text)' }}>Submission Received!</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
              Your details have been submitted successfully. An admin will review your information shortly.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>You may now close this tab.</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )

  const reviewRows = [
    { label: 'Student ID', value: form.student_id },
    { label: 'Full Name', value: form.full_name },
    { label: 'Year / Level', value: form.year_level },
    showPosition && form.position && { label: 'Position', value: form.position },
    showProgramme && form.programme && { label: 'Programme', value: form.programme },
    showBloodType && form.blood_type && { label: 'Blood Type', value: form.blood_type },
    showStudentEmail && form.student_email && { label: 'Email', value: form.student_email },
    showDateOfBirth && form.date_of_birth && { label: 'Date of Birth', value: form.date_of_birth },
    showNationality && form.nationality && { label: 'Nationality', value: form.nationality },
    showCountyOfOrigin && form.county_of_origin && { label: 'County of Origin', value: form.county_of_origin },
    showCurrentAddress && form.current_address && { label: 'Address', value: form.current_address },
    showEmergencyContactName && form.emergency_contact_name && { label: 'Emergency Contact', value: form.emergency_contact_name },
    showEmergencyContactPhone && form.emergency_contact_phone && { label: 'Emergency Phone', value: form.emergency_contact_phone },
  ].filter(Boolean)

  return (
    <div className="submission-page">
      <div className="submission-topbar">
        <div className="submission-topbar-inner">
          <div className="submission-topbar-brand">
            <img src="/lmsa-logo.png" alt="LMSA" className="submission-topbar-logo" />
            <span className="submission-topbar-name">LMSA</span>
          </div>
          <div className="submission-topbar-right">
            <span className="submission-topbar-portal">Student Portal</span>
          </div>
        </div>
      </div>

      <div className="submission-wizard-body">
        <div className="submission-wizard-card">
          <div className="step-indicator">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`step-item ${i <= step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="step-circle">{i < step ? '✓' : i + 1}</div>
                <div className="step-label">{s.label}</div>
                {i < STEPS.length - 1 && <div className="step-line" />}
              </div>
            ))}
          </div>

          <div className="submission-form-body">
            {error && <div className="error-box" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

            {step === 0 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h2 className="form-section-title">Student Information</h2>
                    <p className="form-section-sub">Please provide accurate information.</p>
                  </div>
                  <div className="form-security-badge">
                    <span className="form-security-icon">🔒</span>
                    <span className="form-security-text">Your information is secure and confidential.</span>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field-group">
                    <label className="field-label">Student ID <span className="required">*</span></label>
                    <input className="field-input" placeholder="Enter your student ID" value={form.student_id} onChange={update('student_id')} required />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Full Name <span className="required">*</span></label>
                    <input className="field-input" placeholder="Enter your full name" value={form.full_name} onChange={update('full_name')} required />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Year Level <span className="required">*</span></label>
                    <select className="field-input" value={form.year_level} onChange={update('year_level')}>
                      <option value="">Select year level</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h2 className="form-section-title">Academic Information</h2>
                    <p className="form-section-sub">Tell us about your programme and role.</p>
                  </div>
                </div>
                <div className="form-grid">
                  {showProgramme && (
                    <div className="field-group">
                      <label className="field-label">Programme</label>
                      <input className="field-input" placeholder="Enter your programme" value={form.programme} onChange={update('programme')} />
                    </div>
                  )}
                  {showBloodType && (
                    <div className="field-group">
                      <label className="field-label">Blood Type</label>
                      <select className="field-input" value={form.blood_type} onChange={update('blood_type')}>
                        <option value="">Select blood type</option>
                        {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}
                  {showPosition && (
                    <div className="field-group">
                      <label className="field-label">Position</label>
                      <input className="field-input" placeholder="Enter your position" value={form.position} onChange={update('position')} />
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h2 className="form-section-title">Additional Information</h2>
                    <p className="form-section-sub">Contact and personal details.</p>
                  </div>
                </div>
                <div className="form-grid">
                  {showStudentEmail && (
                    <div className="field-group">
                      <label className="field-label">Email</label>
                      <input className="field-input" type="email" placeholder="Enter your email address" value={form.student_email} onChange={update('student_email')} />
                    </div>
                  )}
                  {showDateOfBirth && (
                    <div className="field-group">
                      <label className="field-label">Date of Birth</label>
                      <input className="field-input" type="date" value={form.date_of_birth} onChange={update('date_of_birth')} />
                    </div>
                  )}
                  {showNationality && (
                    <div className="field-group">
                      <label className="field-label">Nationality</label>
                      <input className="field-input" placeholder="Enter your nationality" value={form.nationality} onChange={update('nationality')} />
                    </div>
                  )}
                  {showCountyOfOrigin && (
                    <div className="field-group">
                      <label className="field-label">County of Origin</label>
                      <input className="field-input" list="liberia-counties-sub" placeholder="e.g. Montserrado" value={form.county_of_origin} onChange={update('county_of_origin')} />
                      <datalist id="liberia-counties-sub">{LIBERIA_COUNTIES.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                  )}
                  {showCurrentAddress && (
                    <div className="field-group form-grid-full">
                      <label className="field-label">Address</label>
                      <textarea className="field-input" placeholder="Enter your full address" rows={3}
                        value={form.current_address} onChange={update('current_address')}
                        style={{ resize: 'vertical', minHeight: '60px' }} />
                    </div>
                  )}
                  {showEmergencyContactName && (
                    <div className="field-group">
                      <label className="field-label">Emergency Contact Name</label>
                      <input className="field-input" placeholder="Enter full name" value={form.emergency_contact_name} onChange={update('emergency_contact_name')} />
                    </div>
                  )}
                  {showEmergencyContactPhone && (
                    <div className="field-group">
                      <label className="field-label">Emergency Contact Phone</label>
                      <input className="field-input" placeholder="+231 xxx xxxx" value={form.emergency_contact_phone} onChange={update('emergency_contact_phone')} />
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="form-section-header">
                  <div>
                    <h2 className="form-section-title">Review &amp; Submit</h2>
                    <p className="form-section-sub">Please review your information before submitting.</p>
                  </div>
                  <div className="form-security-badge">
                    <span className="form-security-icon">🔒</span>
                    <span className="form-security-text">Your information is secure and confidential.</span>
                  </div>
                </div>
                <div className="review-grid">
                  {reviewRows.map(r => (
                    <div key={r.label} className="review-row">
                      <span className="review-label">{r.label}</span>
                      <span className="review-value">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="review-agree">
                  <input type="checkbox" id="agree-tos" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    style={{ accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }} />
                  <label htmlFor="agree-tos" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5, cursor: 'pointer' }}>
                    I agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Privacy Policy</a>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="submission-form-footer">
            <Button variant="outline" size="md" onClick={() => step === 0 ? window.history.back() : setStep(step - 1)}>
              {step === 0 ? '← Cancel' : '← Back'}
            </Button>
            {step < 3 ? (
              <Button variant="primary" size="md" onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Continue →
              </Button>
            ) : (
              <Button variant="gold" size="md" onClick={doSubmit} disabled={!agreed || submitting} loading={submitting}>
                Submit
              </Button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
