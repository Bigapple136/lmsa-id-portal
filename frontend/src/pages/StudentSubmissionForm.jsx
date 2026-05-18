import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

export default function StudentSubmissionForm() {
  const [enabled, setEnabled] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [fieldsConfig, setFieldsConfig] = useState(null)
  const [qrFieldsConfig, setQrFieldsConfig] = useState(null)
  const [form, setForm] = useState({
    student_id: '', full_name: '', year_level: '1st Year', position: '',
    programme: '', blood_type: '', student_email: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })

  useEffect(() => {
    async function init() {
      try {
        const [statusRes, fieldsRes, qrFieldsRes] = await Promise.all([
          apiFetch('/api/submissions/status'),
          apiFetch('/api/settings/fields'),
          apiFetch('/api/settings/qr-fields'),
        ])
        const [statusData, fieldsData, qrFieldsData] = await Promise.all([
          statusRes.json(), fieldsRes.json(), qrFieldsRes.json(),
        ])
        setEnabled(statusData.enabled)
        setFieldsConfig(fieldsData)
        setQrFieldsConfig(qrFieldsData)
      } catch {
        setEnabled(false)
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await apiFetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)

    if (res.ok) {
      setSubmitted(true)
    } else {
      setError(data.error || 'Submission failed. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Form is currently closed</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            The student submission form is not accepting responses at this time.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="page-center">
        <div className="landing-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Submission Received!</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Your details have been submitted successfully. An admin will review your information shortly.
          </p>
          <button className="btn-gold" onClick={() => {
            setSubmitted(false)
            setForm({
              student_id: '', full_name: '', year_level: '1st Year', position: '',
              programme: '', blood_type: '', student_email: '',
              emergency_contact_name: '', emergency_contact_phone: '',
            })
          }}>
            Submit another
          </button>
        </div>
      </div>
    )
  }

  const showPosition = fieldsConfig?.position?.enabled === true
  const showProgramme = qrFieldsConfig?.programme?.enabled === true
  const showBloodType = qrFieldsConfig?.blood_type?.enabled === true
  const showStudentEmail = qrFieldsConfig?.student_email?.enabled === true
  const showEmergencyContactName = qrFieldsConfig?.emergency_contact_name?.enabled === true
  const showEmergencyContactPhone = qrFieldsConfig?.emergency_contact_phone?.enabled === true
  const hasAdditionalFields = showProgramme || showBloodType || showStudentEmail || showEmergencyContactName || showEmergencyContactPhone

  return (
    <div className="page-center">
      <div className="landing-card">
        <div className="landing-header">
          <h1 className="landing-title" style={{ fontSize: '1.1rem' }}>Student Details Form</h1>
          <p className="landing-desc">Submit your information for your ID card</p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="field-group">
              <label className="field-label">Full Name</label>
              <input className="field-input" placeholder="e.g. Josephine K. Freeman"
                value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
            </div>

            <div className="field-group">
              <label className="field-label">Student ID Number</label>
              <input className="field-input" placeholder="e.g. AMD-2024-0042"
                value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} required />
            </div>

            <div className="field-group">
              <label className="field-label">Year / Level</label>
              <select className="field-input" value={form.year_level}
                onChange={e => setForm({...form, year_level: e.target.value})}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>

            {showPosition && (
              <div className="field-group">
                <label className="field-label">Position (optional)</label>
                <input className="field-input" placeholder="e.g. Class Representative"
                  value={form.position} onChange={e => setForm({...form, position: e.target.value})} />
              </div>
            )}

            {hasAdditionalFields && (
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Additional details
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {showProgramme && (
                    <div className="field-group">
                      <label className="field-label">Programme</label>
                      <input className="field-input" placeholder="e.g. MBBS, Pharm.D"
                        value={form.programme} onChange={e => setForm({...form, programme: e.target.value})} />
                    </div>
                  )}
                  {showBloodType && (
                    <div className="field-group">
                      <label className="field-label">Blood Type</label>
                      <input className="field-input" placeholder="e.g. O+"
                        value={form.blood_type} onChange={e => setForm({...form, blood_type: e.target.value})} />
                    </div>
                  )}
                  {showStudentEmail && (
                    <div className="field-group">
                      <label className="field-label">Student Email</label>
                      <input className="field-input" type="email" placeholder="student@email.com"
                        value={form.student_email} onChange={e => setForm({...form, student_email: e.target.value})} />
                    </div>
                  )}
                  {showEmergencyContactName && (
                    <div className="field-group">
                      <label className="field-label">Emergency Contact Name</label>
                      <input className="field-input" placeholder="Full name"
                        value={form.emergency_contact_name} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} />
                    </div>
                  )}
                  {showEmergencyContactPhone && (
                    <div className="field-group">
                      <label className="field-label">Emergency Contact Phone</label>
                      <input className="field-input" placeholder="+231 xxx xxxx"
                        value={form.emergency_contact_phone} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}

          <div className="btn-row" style={{ marginTop: '16px' }}>
            <button className="btn-gold-full" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
