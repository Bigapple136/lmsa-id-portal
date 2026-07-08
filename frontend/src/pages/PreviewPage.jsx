import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import IDCardDisplay from '../components/IDCardDisplay'
import CardCanvas from '../components/CardCanvas'
import PrintPreviewModal from '../components/PrintPreviewModal'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'

const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']
const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

const QR_FIELD_META = {
  blood_type: { label:'Blood Type' },
  programme: { label:'Programme' },
  student_email: { label:'Email' },
  emergency_contact_name: { label:'Emergency Contact Name' },
  emergency_contact_phone: { label:'Emergency Contact Phone' },
  date_of_birth: { label:'Date of Birth' },
  nationality: { label:'Nationality' },
  county_of_origin: { label:'County of Origin' },
  current_address: { label:'Current Address' },
}

const ISSUE_TYPES = [
  { id:'full_name',   label:'Misspelled name' },
  { id:'year_level',  label:'Wrong level' },
  { id:'qr_details',  label:'QR Code details (blood type, programme, etc.)' },
  { id:'photo_issue', label:'Wrong image' },
]

export default function PreviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [templateUrl, setTemplateUrl] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)
  const [qrFields, setQrFields] = useState(null)

  const [step, setStep] = useState('idle')
  const [selectedIssues, setSelectedIssues] = useState([])
  const [corrections, setCorrections] = useState({ full_name:'', year_level:'' })
  const [qrCorrections, setQrCorrections] = useState({})
  const [qrWrongFields, setQrWrongFields] = useState({})
  const [photoNoticed, setPhotoNoticed] = useState(false)
  const [reportTab, setReportTab] = useState('qr')

  const [templateStatus, setTemplateStatus] = useState('loading')

  useEffect(() => {
    fetchStudent()
    fetchTemplateAndLayout()
  }, [token])

  async function fetchTemplateAndLayout() {
    try {
      const [tRes, lRes, qrRes] = await Promise.all([
        apiFetch('/api/templates/active'),
        apiFetch('/api/settings/layout'),
        apiFetch('/api/settings/qr-fields')
      ])
      if (tRes.ok) {
        const t = await tRes.json()
        setTemplateUrl(t.file_url)
        setTemplateStatus('ready')
      } else {
        setTemplateStatus('missing')
      }
      if (lRes.ok) setCardLayout(await lRes.json())
      if (qrRes.ok) setQrFields(await qrRes.json())
    } catch {
      setTemplateStatus('missing')
    }
  }

  async function fetchStudent() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/students/preview/${encodeURIComponent(token)}`)
      if (res.status === 403) { setError('Invalid or tampered link.'); return }
      if (!res.ok) { setError('Student record not found.'); return }
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
      await apiFetch('/api/confirmations', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ student_id: student.student_id, action:'confirmed' })
      })
      setConfirmed(true)
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleIssue(id) {
    setSelectedIssues(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  function handleIssueNext() {
    if (!selectedIssues.length) return
    const hasQr    = selectedIssues.includes('qr_details')
    const hasPhoto = selectedIssues.includes('photo_issue')
    const hasOther = selectedIssues.some(i => i !== 'qr_details' && i !== 'photo_issue')

    if (hasQr && hasOther) {
      setReportTab('qr')
      setStep('report_modal')
    } else if (hasQr) {
      setStep('qr_form')
    } else if (hasOther) {
      setCorrections({
        full_name:  selectedIssues.includes('full_name') ? student.full_name : '',
        year_level: selectedIssues.includes('year_level') ? student.year_level : ''
      })
      setStep('other_form')
    } else if (hasPhoto) {
      setStep('photo_notice')
    }
  }

  async function handleCorrectionSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const hasQr    = selectedIssues.includes('qr_details')
    const hasPhoto = selectedIssues.includes('photo_issue')
    const hasOther = selectedIssues.some(i => i !== 'qr_details' && i !== 'photo_issue')

    const body = {
      corrections: hasOther ? {
        ...(selectedIssues.includes('full_name') && { full_name: corrections.full_name }),
        ...(selectedIssues.includes('year_level') && { year_level: corrections.year_level })
      } : {},
      qr_corrections: hasQr ? qrCorrections : {},
      photo_issue: hasPhoto
    }

    try {
      const res = await apiFetch(`/api/students/${encodeURIComponent(student.student_id)}/self-correct`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setStudent(updated)
      if (hasPhoto) setPhotoNoticed(true)
      setStep('done')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoOnlyReport() {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/students/${encodeURIComponent(student.student_id)}/self-correct`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ corrections:{}, photo_issue: true })
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setStudent(updated)
      setPhotoNoticed(true)
      setStep('done')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetReportFlow() {
    setStep('idle')
    setSelectedIssues([])
    setCorrections({ full_name:'', year_level:'' })
    setQrCorrections({})
    setQrWrongFields({})
  }

  function toggleQrWrong(field) {
    setQrWrongFields(prev => {
      const next = { ...prev, [field]: !prev[field] }
      if (!next[field]) {
        setQrCorrections(prev2 => {
          const copy = { ...prev2 }
          delete copy[field]
          return copy
        })
      }
      return next
    })
  }

  function handleQrCorrectionChange(field, value) {
    setQrCorrections(prev => ({ ...prev, [field]: value }))
  }

  function enabledQrFields() {
    if (!qrFields) return []
    return Object.keys(QR_FIELD_META).filter(f => qrFields[f]?.enabled)
  }

  if (loading) return (
    <div className="page-outer">
      <Navbar showLogin={false}/>
      <div className="page-center">
        <div className="preview-card">
          <div className="preview-topbar">
            <div className="skeleton skeleton-text" style={{width: 60}}/>
          </div>
          <div style={{padding: 16}}>
            <div className="skeleton skeleton-card" style={{marginBottom: 16}}/>
            <div className="skeleton skeleton-title" style={{marginBottom: 12}}/>
            <div className="skeleton skeleton-text" style={{marginBottom: 8, width: '80%'}}/>
            <div className="skeleton skeleton-text" style={{marginBottom: 8, width: '65%'}}/>
            <div className="skeleton skeleton-text" style={{marginBottom: 8, width: '50%'}}/>
            <div className="skeleton skeleton-text" style={{width: '40%'}}/>
          </div>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="page-outer">
      <Navbar showLogin={false}/>
      <div className="page-center">
        <div className="landing-card">
          <div className="landing-form">
            <div className="error-box">{error}</div>
            <button className="btn-outline" onClick={() => navigate('/')}>← Go back</button>
          </div>
        </div>
      </div>
    </div>
  )

  const isActioned = confirmed || ['photo_issue'].includes(student?.status)

  return (
    <div className="page-outer">
      <Navbar showLogin={false}/>
      <div className="page-center">
        <div className="preview-card">

          <div className="preview-topbar">
            <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
            <span className="preview-topbar-title">Your ID Card Preview</span>
          </div>

          {templateUrl && cardLayout
            ? <div style={{ padding:'16px 16px 0' }}>
                <CardCanvas student={student} templateUrl={templateUrl} layout={cardLayout} maxWidth={380}/>
              </div>
            : <IDCardDisplay student={student}/>
          }

          <div style={{ padding:'0 16px 16px' }}>

            <button className="btn-print" onClick={() => setShowPrint(true)}>
              🖨 View Print Preview
            </button>

            {/* ── CONFIRMED ── */}
            {confirmed && (
              <div className="success-box">
                ✓ Your card has been confirmed. LMSA has been notified. Thank you!
              </div>
            )}

            {/* ── IDLE ── */}
            {!confirmed && step === 'idle' && (
              <>
                <div className="confirm-box">
                  ✓ Your details were found. Review carefully and confirm or report an issue.
                </div>

                <div className="section-title">Verify your details</div>
                <div className="meta-table">
                  <div className="meta-row"><span className="meta-key">Full name</span><span className="meta-val">{student.full_name}</span></div>
                  <div className="meta-row"><span className="meta-key">Student ID</span><span className="meta-val">{student.student_id}</span></div>
                  <div className="meta-row"><span className="meta-key">Year / Level</span><span className="meta-val">{student.year_level}</span></div>
                  <div className="meta-row" style={{ borderBottom:'none' }}>
                    <span className="meta-key">Status</span>
                    <span className="meta-val status-pending">
                      {student.status === 'photo_issue' ? 'Photo issue — admin notified' : 'Pending confirmation'}
                    </span>
                  </div>
                </div>

                <div className="divider"/>

                <div className="section-title">QR Code details</div>
                <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'12px' }}>
                  These details will appear when someone scans your ID card QR code. Please review carefully.
                </p>
                <div className="meta-table" style={{ marginBottom:'4px' }}>
                  {enabledQrFields().map(field => (
                    <div key={field} className="meta-row">
                      <span className="meta-key">{QR_FIELD_META[field].label}</span>
                      <span className="meta-val" style={{ color: student[field] ? 'var(--text)' : 'var(--muted)', fontStyle: student[field] ? 'normal' : 'italic' }}>
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
                      {submitting ? '...' : 'Confirm — all correct'}
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
                <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'12px' }}>
                  Select all that apply — you can fix multiple things at once.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
                  {ISSUE_TYPES.map(issue => (
                    <label key={issue.id} className={`issue-option ${selectedIssues.includes(issue.id)?'selected':''}`}>
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(issue.id)}
                        onChange={() => toggleIssue(issue.id)}
                        style={{ accentColor:'var(--gold)' }}
                      />
                      <span>{issue.label}</span>
                    </label>
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn-gold" onClick={handleIssueNext} disabled={!selectedIssues.length}>
                    Continue
                  </button>
                  <button className="btn-outline" onClick={resetReportFlow}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── STEP: QR FORM (QR only) ── */}
            {step === 'qr_form' && (
              <div className="report-panel">
                <div className="section-title">Correct your QR Code details</div>
                <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'14px' }}>
                  These details will appear when your QR code is scanned. Toggle any that are incorrect.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'16px' }}>
                  {enabledQrFields().map(field => (
                    <QrFieldRow
                      key={field}
                      field={field}
                      currentValue={student[field] || '—'}
                      isWrong={!!qrWrongFields[field]}
                      correctionValue={qrCorrections[field] || ''}
                      onToggleWrong={() => toggleQrWrong(field)}
                      onCorrectionChange={v => handleQrCorrectionChange(field, v)}
                    />
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn-gold" onClick={handleCorrectionSubmit} disabled={submitting || !Object.values(qrWrongFields).some(Boolean)}>
                    {submitting ? 'Submitting...' : 'Submit Correction'}
                  </button>
                  <button className="btn-outline" onClick={() => setStep('select')}>Back</button>
                </div>
              </div>
            )}

            {/* ── STEP: REPORT MODAL (QR + other issues) ── */}
            {step === 'report_modal' && (
              <div className="report-panel" style={{ padding:'0' }}>
                <div className="modal" style={{ position:'relative', maxHeight:'none', borderRadius:'16px', overflow:'hidden' }}>
                  <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', background:'#f9fafb' }}>
                    <button
                      onClick={() => setReportTab('qr')}
                      style={{
                        flex:1, padding:'12px 8px', fontSize:'13px', fontWeight:600,
                        border:'none', background:'transparent', cursor:'pointer',
                        borderBottom: reportTab === 'qr' ? '2px solid var(--gold)' : '2px solid transparent',
                        color: reportTab === 'qr' ? 'var(--gold)' : 'var(--muted)'
                      }}>
                      QR Code Details
                    </button>
                    <button
                      onClick={() => setReportTab('other')}
                      style={{
                        flex:1, padding:'12px 8px', fontSize:'13px', fontWeight:600,
                        border:'none', background:'transparent', cursor:'pointer',
                        borderBottom: reportTab === 'other' ? '2px solid var(--gold)' : '2px solid transparent',
                        color: reportTab === 'other' ? 'var(--gold)' : 'var(--muted)'
                      }}>
                      Other Issues
                    </button>
                  </div>

                  {reportTab === 'qr' && (
                    <div style={{ padding:'16px' }}>
                      <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'14px' }}>
                        Toggle any details that are incorrect and enter the correct value.
                      </p>
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'16px' }}>
                        {enabledQrFields().map(field => (
                          <QrFieldRow
                            key={field}
                            field={field}
                            currentValue={student[field] || '—'}
                            isWrong={!!qrWrongFields[field]}
                            correctionValue={qrCorrections[field] || ''}
                            onToggleWrong={() => toggleQrWrong(field)}
                            onCorrectionChange={v => handleQrCorrectionChange(field, v)}
                          />
                        ))}
                      </div>
                      <div className="btn-row">
                        <button className="btn-gold" onClick={handleCorrectionSubmit} disabled={submitting || !Object.values(qrWrongFields).some(Boolean)}>
                          {submitting ? 'Submitting...' : 'Submit Correction'}
                        </button>
                        <button className="btn-outline" onClick={() => setStep('select')}>Back</button>
                      </div>
                    </div>
                  )}

                  {reportTab === 'other' && (
                    <form onSubmit={handleCorrectionSubmit}>
                      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
                        {selectedIssues.includes('full_name') && (
                          <div className="field-group">
                            <label className="field-label">Correct full name</label>
                            <input className="field-input"
                              value={corrections.full_name}
                              onChange={e => setCorrections({...corrections, full_name:e.target.value})}
                              placeholder="Enter your correct full name" required/>
                          </div>
                        )}
                        {selectedIssues.includes('year_level') && (
                          <div className="field-group">
                            <label className="field-label">Correct year / level</label>
                            <select className="field-input" value={corrections.year_level}
                              onChange={e => setCorrections({...corrections, year_level:e.target.value})}>
                              {YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                          </div>
                        )}
                        {selectedIssues.includes('photo_issue') && (
                          <div className="info-box">
                            Your photo issue will also be reported to the admin for correction.
                          </div>
                        )}
                      </div>
                      <div className="btn-row" style={{ padding:'0 16px 16px' }}>
                        <button className="btn-gold" type="submit" disabled={submitting}>
                          {submitting ? 'Submitting...' : 'Submit Correction'}
                        </button>
                        <button className="btn-outline" type="button" onClick={() => setStep('select')}>Back</button>
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
                <form onSubmit={handleCorrectionSubmit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {selectedIssues.includes('full_name') && (
                    <div className="field-group">
                      <label className="field-label">Correct full name</label>
                      <input className="field-input" value={corrections.full_name}
                        onChange={e => setCorrections({...corrections, full_name:e.target.value})}
                        placeholder="Enter your correct full name" required/>
                    </div>
                  )}
                  {selectedIssues.includes('year_level') && (
                    <div className="field-group">
                      <label className="field-label">Correct year / level</label>
                      <select className="field-input" value={corrections.year_level}
                        onChange={e => setCorrections({...corrections, year_level:e.target.value})}>
                        {YEARS.map(y => <option key={y}>{y}</option>)}
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
                    <button className="btn-outline" type="button" onClick={() => setStep('select')}>Back</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── STEP: PHOTO ONLY NOTICE ── */}
            {step === 'photo_notice' && (
              <div className="report-panel">
                <div className="section-title">Wrong photo</div>
                <div className="info-box" style={{ marginBottom:'14px' }}>
                  For security, photo corrections cannot be made online. Submitting this report will notify LMSA who will arrange a re-shoot with you.
                </div>
                <div className="btn-row">
                  <button className="btn-gold" onClick={handlePhotoOnlyReport} disabled={submitting}>
                    {submitting ? 'Reporting...' : 'Notify admin'}
                  </button>
                  <button className="btn-outline" onClick={resetReportFlow}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── STEP: DONE ── */}
            {step === 'done' && (
              <div className="success-box">
                {photoNoticed && !selectedIssues.some(i => i !== 'photo_issue')
                  ? '📷 Your photo issue has been reported. LMSA will contact you to arrange a re-shoot.'
                  : '✓ Your corrections have been submitted. Please review your updated card above and confirm if everything looks correct now.'
                }
                {selectedIssues.some(i => i !== 'photo_issue') && !confirmed && (
                  <div style={{ marginTop:'12px' }}>
                    <button className="btn-gold" onClick={handleConfirm} disabled={submitting} style={{ width:'100%' }}>
                      {submitting ? '...' : 'Confirm — now looks correct'}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {showPrint && <PrintPreviewModal student={student} onClose={() => setShowPrint(false)}/>}
    </div>
  )
}

function QrFieldRow({ field, currentValue, isWrong, correctionValue, onToggleWrong, onCorrectionChange }) {
  const isBloodType = field === 'blood_type'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', flex:1 }}>
          <input
            type="checkbox"
            checked={isWrong}
            onChange={onToggleWrong}
            style={{ accentColor:'var(--gold)' }}
          />
          <span style={{ fontSize:'13px', color:'#374151', fontWeight:500 }}>
            {QR_FIELD_META[field].label}
          </span>
        </label>
        <span style={{ fontSize:'13px', color:'#9ca3af' }}>{currentValue}</span>
      </div>
      {isWrong && (
        <div style={{ paddingLeft:'28px' }}>
          {isBloodType ? (
              <select
              className="field-input"
              value={correctionValue}
              onChange={e => onCorrectionChange(e.target.value)}
              style={{ fontSize:'13px' }}>
              <option value="">Select correct blood type</option>
              {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          ) : (
            <input
              className="field-input"
              type={field === 'student_email' ? 'email' : field === 'emergency_contact_phone' ? 'tel' : 'text'}
              value={correctionValue}
              onChange={e => onCorrectionChange(e.target.value)}
              placeholder={`Correct ${QR_FIELD_META[field].label.toLowerCase()}`}
              style={{ fontSize:'13px' }}
            />
          )}
        </div>
      )}
    </div>
  )
}
