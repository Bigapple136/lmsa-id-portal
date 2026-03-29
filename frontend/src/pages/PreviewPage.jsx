import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import IDCardDisplay from '../components/IDCardDisplay'
import CardCanvas from '../components/CardCanvas'
import PrintPreviewModal from '../components/PrintPreviewModal'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'

const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

const ISSUE_TYPES = [
  { id:'full_name',   label:'Misspelled name' },
  { id:'year_level',  label:'Wrong level' },
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

  // Template-based preview
  const [templateUrl, setTemplateUrl] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)

  // Report flow state
  const [step, setStep] = useState('idle') // idle | select | form | photo_notice | done
  const [selectedIssues, setSelectedIssues] = useState([])
  const [corrections, setCorrections] = useState({ full_name:'', year_level:'' })
  const [photoNoticed, setPhotoNoticed] = useState(false)

  const [templateStatus, setTemplateStatus] = useState('loading') // loading | ready | missing

  useEffect(() => {
    fetchStudent()
    fetchTemplateAndLayout()
  }, [token])

  async function fetchTemplateAndLayout() {
    try {
      const [tRes, lRes] = await Promise.all([
        apiFetch('/api/templates/active'),
        apiFetch('/api/settings/layout')
      ])
      if (tRes.ok) {
        const t = await tRes.json()
        setTemplateUrl(t.file_url)
        setTemplateStatus('ready')
      } else {
        setTemplateStatus('missing')
      }
      if (lRes.ok) { setCardLayout(await lRes.json()) }
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
    const hasPhoto = selectedIssues.includes('photo_issue')
    const hasText = selectedIssues.some(i => i !== 'photo_issue')
    if (hasText) {
      // Pre-fill corrections with current values
      setCorrections({
        full_name: selectedIssues.includes('full_name') ? student.full_name : '',
        year_level: selectedIssues.includes('year_level') ? student.year_level : ''
      })
      setStep('form')
    } else if (hasPhoto) {
      setStep('photo_notice')
    }
  }

  async function handleCorrectionSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const hasPhoto = selectedIssues.includes('photo_issue')
    const body = {
      corrections: {
        ...(selectedIssues.includes('full_name') && { full_name: corrections.full_name }),
        ...(selectedIssues.includes('year_level') && { year_level: corrections.year_level })
      },
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
  }

  if (loading) return (
    <div className="page-outer">
      <Navbar showLogin={false}/>
      <div className="page-center"><div className="loading">Loading your card...</div></div>
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

          {/* ID Card — uses Canvas when template+layout available, else falls back */}
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

            {/* ── IDLE: show verify + action buttons ── */}
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

            {/* ── STEP: SELECT issue types ── */}
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

            {/* ── STEP: CORRECTION FORM ── */}
            {step === 'form' && (
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
