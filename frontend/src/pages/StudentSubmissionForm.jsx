import { useState, useEffect } from 'react'
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

export default function StudentSubmissionForm() {
  const [enabled, setEnabled] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [fieldsConfig, setFieldsConfig] = useState(null)
  const [qrFieldsConfig, setQrFieldsConfig] = useState(null)
  const [form, setForm] = useState({
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
          statusRes.json(),
          fieldsRes.json(),
          qrFieldsRes.json(),
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

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setConfirming(true)
  }

  async function doSubmit() {
    setConfirming(false)
    setSubmitting(true)

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
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            Form is currently closed
          </h2>
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
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            Submission Received!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Your details have been submitted successfully. An admin will review your information
            shortly.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
            You may now close this tab.
          </p>
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
  const showDateOfBirth = qrFieldsConfig?.date_of_birth?.enabled === true
  const showNationality = qrFieldsConfig?.nationality?.enabled === true
  const showCountyOfOrigin = qrFieldsConfig?.county_of_origin?.enabled === true
  const showCurrentAddress = qrFieldsConfig?.current_address?.enabled === true
  const hasAdditionalFields =
    showProgramme ||
    showBloodType ||
    showStudentEmail ||
    showEmergencyContactName ||
    showEmergencyContactPhone ||
    showDateOfBirth ||
    showNationality ||
    showCountyOfOrigin ||
    showCurrentAddress

  return (
    <div className="page-outer">
      <div className="page-center">
        <div className="landing-card">
          <div className="landing-header">
            <h1 className="landing-title">Student Details Form</h1>
            <p className="landing-desc">Submit your information for your ID card</p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input
                  className="field-input"
                  placeholder="e.g. Josephine K. Freeman"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label">Student ID Number</label>
                <input
                  className="field-input"
                  placeholder="e.g. AMD-2024-0042"
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label">Year / Level</label>
                <select
                  className="field-input"
                  value={form.year_level}
                  onChange={(e) => setForm({ ...form, year_level: e.target.value })}
                >
                  {YEARS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>

              {showPosition && (
                <div className="field-group">
                  <label className="field-label">Position (optional)</label>
                  <input
                    className="field-input"
                    placeholder="e.g. Member"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>
              )}

              {hasAdditionalFields && (
                <div
                  style={{
                    borderTop: '0.5px solid var(--border)',
                    paddingTop: '12px',
                    marginTop: '4px',
                  }}
                >
<p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
  Additional Details
</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {showProgramme && (
                      <div className="field-group">
                        <label className="field-label">Programme</label>
                        <input
                          className="field-input"
                          placeholder="e.g. MBBS, Pharm.D"
                          value={form.programme}
                          onChange={(e) => setForm({ ...form, programme: e.target.value })}
                        />
                      </div>
                    )}
                    {showBloodType && (
                      <div className="field-group">
                        <label className="field-label">Blood Type</label>
                        <select
                          className="field-input"
                          value={form.blood_type}
                          onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                        >
                          <option value="">— Select —</option>
                          {BLOOD_TYPES.map((b) => (
                            <option key={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {showStudentEmail && (
                      <div className="field-group">
                        <label className="field-label">Student Email</label>
                        <input
                          className="field-input"
                          type="email"
                          placeholder="student@email.com"
                          value={form.student_email}
                          onChange={(e) => setForm({ ...form, student_email: e.target.value })}
                        />
                      </div>
                    )}
                    {showEmergencyContactName && (
                      <div className="field-group">
                        <label className="field-label">Emergency Contact Name</label>
                        <input
                          className="field-input"
                          placeholder="Full name"
                          value={form.emergency_contact_name}
                          onChange={(e) =>
                            setForm({ ...form, emergency_contact_name: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {showEmergencyContactPhone && (
                      <div className="field-group">
                        <label className="field-label">Emergency Contact Phone</label>
                        <input
                          className="field-input"
                          placeholder="+231 xxx xxxx"
                          value={form.emergency_contact_phone}
                          onChange={(e) =>
                            setForm({ ...form, emergency_contact_phone: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {showDateOfBirth && (
                      <div className="field-group">
                        <label className="field-label">Date of Birth</label>
                        <input
                          className="field-input"
                          type="date"
                          value={form.date_of_birth}
                          onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                          required
                        />
                      </div>
                    )}
                    {showNationality && (
                      <div className="field-group">
                        <label className="field-label">Nationality</label>
                        <input
                          className="field-input"
                          placeholder="Liberian"
                          value={form.nationality}
                          onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                          required
                        />
                      </div>
                    )}
                    {showCountyOfOrigin && (
                      <div className="field-group">
                        <label className="field-label">County of Origin</label>
                        <input
                          className="field-input"
                          list="liberia-counties"
                          placeholder="e.g. Montserrado"
                          value={form.county_of_origin}
                          onChange={(e) => setForm({ ...form, county_of_origin: e.target.value })}
                          required
                        />
                        <datalist id="liberia-counties">
                          {LIBERIA_COUNTIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    )}
                    {showCurrentAddress && (
                      <div className="field-group">
                        <label className="field-label">Current Address</label>
                        <input
                          className="field-input"
                          placeholder="e.g. 123 Broad Street, Monrovia"
                          value={form.current_address}
                          onChange={(e) => setForm({ ...form, current_address: e.target.value })}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="error-box" style={{ marginTop: '12px' }}>
                {error}
              </div>
            )}

            <div className="btn-row" style={{ marginTop: '16px' }}>
              <button className="btn-gold-full" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Details'}
              </button>
            </div>
          </form>

          {confirming && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '16px',
              }}
              onClick={() => setConfirming(false)}
            >
              <div
                style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  maxWidth: '400px',
                  width: '100%',
                  padding: '24px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    color: 'var(--text)',
                  }}
                >
                  Verify Your Details
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--muted)',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  Please review your information carefully before submitting. You will not be able
                  to edit this submission after it is sent.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Full Name
                    </span>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text)',
                        marginTop: '2px',
                      }}
                    >
                      {form.full_name}
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Student ID
                    </span>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text)',
                        marginTop: '2px',
                      }}
                    >
                      {form.student_id}
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Year / Level
                    </span>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text)',
                        marginTop: '2px',
                      }}
                    >
                      {form.year_level}
                    </div>
                  </div>
                  {showPosition && form.position && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Position
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.position}
                      </div>
                    </div>
                  )}
                  {showProgramme && form.programme && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Programme
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.programme}
                      </div>
                    </div>
                  )}
                  {showBloodType && form.blood_type && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Blood Type
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.blood_type}
                      </div>
                    </div>
                  )}
                  {showStudentEmail && form.student_email && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Student Email
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.student_email}
                      </div>
                    </div>
                  )}
                  {showEmergencyContactName && form.emergency_contact_name && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Emergency Contact
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.emergency_contact_name}
                      </div>
                    </div>
                  )}
                  {showEmergencyContactPhone && form.emergency_contact_phone && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Emergency Phone
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.emergency_contact_phone}
                      </div>
                    </div>
                  )}
                  {showDateOfBirth && form.date_of_birth && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Date of Birth
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.date_of_birth}
                      </div>
                    </div>
                  )}
                  {showNationality && form.nationality && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Nationality
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.nationality}
                      </div>
                    </div>
                  )}
                  {showCountyOfOrigin && form.county_of_origin && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        County of Origin
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.county_of_origin}
                      </div>
                    </div>
                  )}
                  {showCurrentAddress && form.current_address && (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Current Address
                      </span>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginTop: '2px',
                        }}
                      >
                        {form.current_address}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="agree-tos"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{
                      marginTop: '3px',
                      accentColor: 'var(--gold)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <label
                    htmlFor="agree-tos"
                    style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                      cursor: 'pointer',
                    }}
                  >
                    I agree to the{' '}
                    <button
                      onClick={() => window.open('/terms', '_blank')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--gold)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: 0,
                      }}
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      onClick={() => window.open('/privacy', '_blank')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--gold)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: 0,
                      }}
                    >
                      Privacy Policy
                    </button>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setConfirming(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={doSubmit}
                    disabled={!agreed}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--gold)',
                      color: 'var(--navy)',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: agreed ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: agreed ? 1 : 0.5,
                    }}
                  >
                    Confirm &amp; Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
