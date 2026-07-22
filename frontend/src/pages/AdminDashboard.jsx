import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch, adminJson, adminForm, authMe } from '../lib/api'
import LayoutMapper from '../components/LayoutMapper'
import { useToast } from '../components/Toast'
import NotificationCenter from '../components/NotificationCenter'
import AnalyticsTab from '../components/AnalyticsTab'
import SessionTimeout from '../components/SessionTimeout'
import { Button, Input, Card, Badge, Table, Select, Modal } from '../components/ui'

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
const LIBERIA_COUNTIES = ['Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount', 'Grand Gedeh', 'Grand Kru', 'Lofa', 'Margibi', 'Maryland', 'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe']

const FIELD_META = { student_id: { label: 'Student ID', locked: true }, full_name: { label: 'Full Name', locked: false }, year_level: { label: 'Level', locked: false }, position: { label: 'Position', locked: false }, signature: { label: 'Signature', locked: false } }

function RenewCohortSection() {
  const toast = useToast()
  const [yearLevel, setYearLevel] = useState(YEARS[0])
  const [newValidUntil, setNewValidUntil] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleRenew() {
    if (!newValidUntil) return toast.error('Please select an expiry date.')
    setLoading(true)
    try {
      const res = await adminJson('/api/students/renew-cohort', 'PUT', { year_level: yearLevel, new_valid_until: newValidUntil })
      const data = await res.json()
      if (res.ok) { toast.success(`Renewed ${data.renewed} student(s) in ${yearLevel}.`); setNewValidUntil('') }
      else toast.error(data.error || 'Renewal failed.')
    } catch { toast.error('Network error.') }
    finally { setLoading(false) }
  }
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end', flexWrap: 'wrap' }}>
      <div className="field-group" style={{ flex: '0 0 auto' }}>
        <label className="field-label">Year level</label>
        <select className="field-input" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} style={{ fontSize: 'var(--text-sm)', padding: '7px 10px' }}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="field-group" style={{ flex: '0 0 auto' }}>
        <label className="field-label">New expiry date</label>
        <input type="date" className="field-input" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} style={{ fontSize: 'var(--text-sm)', padding: '7px 10px' }} />
      </div>
      <Button variant="gold" size="sm" onClick={handleRenew} disabled={loading} loading={loading}>Renew Cohort</Button>
    </div>
  )
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'upload', label: 'Upload', icon: '📤' },
  { id: 'layout', label: 'Layout', icon: '🎨' },
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'submissions', label: 'Submissions', icon: '📋' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const SIDEBAR_SECTIONS = [
  { label: 'Main', items: [
    { id: 'overview', label: 'Dashboard', icon: '📊' },
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'layout', label: 'Card Layout', icon: '🎨' },
    { id: 'students', label: 'Students', icon: '👥' },
  ]},
  { label: 'Management', items: [
    { id: 'submissions', label: 'Submissions', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]},
  { label: 'System', items: [
    { id: 'admins', label: 'Manage Admins', icon: '🔐' },
  ]},
]

export default function AdminDashboard() {
  const toast = useToast()
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [uploadMode, setUploadMode] = useState('csv')
  const [students, setStudents] = useState([])
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, issues: 0 })
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [dataLoading, setDataLoading] = useState(false)
  const [templateFile, setTemplateFile] = useState(null)
  const [csvFile, setCsvFile] = useState(null)
  const [zipFile, setZipFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [manualForm, setManualForm] = useState({ student_id: '', full_name: '', year_level: '1st Year', position: '', programme: '', blood_type: '', student_email: '', emergency_contact_name: '', emergency_contact_phone: '', date_of_birth: '', nationality: '', county_of_origin: '', current_address: '' })
  const [manualPhoto, setManualPhoto] = useState(null)
  const [manualSig, setManualSig] = useState(null)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualMsg, setManualMsg] = useState(null)
  const [editStudent, setEditStudent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editPhoto, setEditPhoto] = useState(null)
  const [editSig, setEditSig] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMsg, setEditMsg] = useState(null)
  const [issueNotes, setIssueNotes] = useState({})
  const [yearFilter, setYearFilter] = useState('all')
  const [fields, setFields] = useState(null)
  const [fieldsSaving, setFieldsSaving] = useState(false)
  const [fieldsMsg, setFieldsMsg] = useState(null)
  const [qrFields, setQrFields] = useState(null)
  const [qrFieldsSaving, setQrFieldsSaving] = useState(false)
  const [qrFieldsMsg, setQrFieldsMsg] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)
  const [downloading, setDownloading] = useState({})
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrMsg, setQrMsg] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [submissionsFilter, setSubmissionsFilter] = useState('pending')
  const [submissionFormEnabled, setSubmissionFormEnabled] = useState(false)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionMsg, setSubmissionMsg] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectId, setRejectId] = useState(null)
  const DRAFT_KEY = 'admin_dashboard_draft'

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.manualForm?.student_id || saved.manualForm?.full_name) {
        setManualForm(saved.manualForm); setActiveTab(saved.activeTab || 'upload'); setUploadMode(saved.uploadMode || 'manual')
        setUploadMsg({ ok: true, text: 'Draft restored from your previous session.' }); setTimeout(() => setUploadMsg(null), 4000)
      }
    } catch {}
    sessionStorage.removeItem(DRAFT_KEY)
  }, [])

  useEffect(() => {
    function saveDraft() {
      if (document.visibilityState !== 'hidden') return
      const hasDraft = manualForm.student_id || manualForm.full_name || Object.values(editForm).some((v) => v)
      if (hasDraft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ manualForm, uploadMode, activeTab }))
      else sessionStorage.removeItem(DRAFT_KEY)
    }
    document.addEventListener('visibilitychange', saveDraft)
    return () => document.removeEventListener('visibilitychange', saveDraft)
  }, [manualForm, editForm, uploadMode, activeTab])

  useEffect(() => {
    function onBeforeUnload(e) {
      if (manualForm.student_id || manualForm.full_name || Object.values(editForm).some((v) => v)) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [manualForm, editForm])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const res = await authMe()
      if (res.ok) { const d = await res.json(); setUserRole(d.role || 'admin') }
      await loadAll()
    })()
  }, [session])

  async function login(e) {
    e.preventDefault(); setLoginLoading(true); setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message); setLoginLoading(false)
  }

  async function eachLimit(tasks, limit) {
    const results = []; let i = 0
    async function worker() { while (i < tasks.length) { const idx = i++; results[idx] = await tasks[idx]() } }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
    return results
  }

  async function loadAll() {
    setDataLoading(true)
    try { await eachLimit([loadStudents, loadTemplate, loadFields, loadQrFields, loadLayout, loadSubmissions, loadSubmissionsStatus, loadStats], 4) }
    catch {}
    setDataLoading(false)
  }

  async function loadStudents() {
    try { const res = await adminFetch('/api/students'); if (res.ok) setStudents(await res.json()) } catch {}
  }
  async function loadTemplate() {
    try { const res = await adminFetch('/api/templates/active'); if (res.ok) setActiveTemplate(await res.json()) } catch {}
  }
  async function loadStats() {
    try { const res = await adminFetch('/api/students'); if (res.ok) { const data = await res.json(); setStats({ total: data.length, confirmed: data.filter(s => s.status === 'confirmed').length, pending: data.filter(s => s.status === 'pending' || s.status === 'self_corrected').length, issues: data.filter(s => s.status === 'issue' || s.status === 'photo_issue').length }) } } catch {}
  }
  async function loadFields() {
    try { const res = await adminFetch('/api/settings/fields'); if (res.ok) setFields(await res.json()) } catch {}
  }
  async function loadQrFields() {
    try { const res = await adminFetch('/api/settings/qr-fields'); if (res.ok) setQrFields(await res.json()) } catch {}
  }
  async function loadLayout() {
    try { const res = await adminFetch('/api/settings/layout'); if (res.ok) setCardLayout(await res.json()) } catch {}
  }
  async function loadSubmissions() {
    setSubmissionsLoading(true)
    try {
      const res = await adminFetch(`/api/submissions${submissionsFilter !== 'all' ? `?status=${submissionsFilter}` : ''}`)
      if (res.ok) setSubmissions(await res.json())
    } catch {}
    setSubmissionsLoading(false)
  }
  async function loadSubmissionsStatus() {
    try { const res = await adminFetch('/api/settings/submission-form'); if (res.ok) { const d = await res.json(); setSubmissionFormEnabled(d.enabled) } } catch {}
  }

  async function handleTemplateUpload() {
    if (!templateFile) return
    setUploading(true); setUploadMsg(null)
    try {
      const fd = new FormData(); fd.append('template', templateFile)
      const res = await adminForm('/api/templates', 'POST', fd)
      const data = await res.json()
      if (res.ok) { setUploadMsg({ ok: true, text: 'Template uploaded and activated.' }); setTemplateFile(null); loadTemplate() }
      else setUploadMsg({ ok: false, text: data.error || 'Upload failed.' })
    } catch { setUploadMsg({ ok: false, text: 'Upload failed.' }) }
    finally { setUploading(false) }
  }

  async function handleCsvUpload() {
    if (!csvFile) return
    setUploading(true); setUploadMsg(null)
    try {
      const fd = new FormData(); fd.append('csv', csvFile)
      if (zipFile) fd.append('photos', zipFile)
      const res = await adminForm('/api/students/bulk', 'POST', fd)
      const data = await res.json()
      if (res.ok) { setUploadMsg({ ok: true, text: `Imported ${data.count || 0} student(s).` }); setCsvFile(null); setZipFile(null); loadStudents() }
      else setUploadMsg({ ok: false, text: data.error || 'Import failed.' })
    } catch { setUploadMsg({ ok: false, text: 'Import failed.' }) }
    finally { setUploading(false) }
  }

  async function handleManualSubmit(e) {
    e.preventDefault(); setManualSubmitting(true); setManualMsg(null)
    try {
      const fd = new FormData(); Object.entries(manualForm).forEach(([k, v]) => fd.append(k, v))
      if (manualPhoto) fd.append('photo', manualPhoto)
      if (manualSig) fd.append('signature', manualSig)
      const res = await adminForm('/api/students', 'POST', fd)
      const data = await res.json()
      if (res.ok) { setManualMsg({ ok: true, text: `Student "${manualForm.full_name}" created.` }); setManualForm({ student_id: '', full_name: '', year_level: '1st Year', position: '', programme: '', blood_type: '', student_email: '', emergency_contact_name: '', emergency_contact_phone: '', date_of_birth: '', nationality: '', county_of_origin: '', current_address: '' }); setManualPhoto(null); setManualSig(null); loadStudents() }
      else setManualMsg({ ok: false, text: data.error || 'Creation failed.' })
    } catch { setManualMsg({ ok: false, text: 'Network error.' }) }
    finally { setManualSubmitting(false) }
  }

  async function saveFields(newFields) {
    setFieldsSaving(true); setFieldsMsg(null)
    try {
      const res = await adminJson('/api/settings/fields', 'PUT', newFields)
      if (res.ok) { setFields(newFields); setFieldsMsg({ ok: true, text: 'Card fields updated.' }) }
      else { const d = await res.json(); setFieldsMsg({ ok: false, text: d.error || 'Save failed.' }) }
      } catch { setFieldsMsg({ ok: false, text: 'Network error.' }) }
    finally { setFieldsSaving(false); setTimeout(() => setFieldsMsg(null), 3000) }
  }

  async function saveQrFields(newQrFields) {
    setQrFieldsSaving(true); setQrFieldsMsg(null)
    try {
      const res = await adminJson('/api/settings/qr-fields', 'PUT', newQrFields)
      if (res.ok) { setQrFields(newQrFields); setQrFieldsMsg({ ok: true, text: 'QR fields updated.' }) }
      else { const d = await res.json(); setQrFieldsMsg({ ok: false, text: d.error || 'Save failed.' }) }
    } catch { setQrFieldsMsg({ ok: false, text: 'Network error.' }) }
    finally { setQrFieldsSaving(false); setTimeout(() => setQrFieldsMsg(null), 3000) }
  }

  async function generateQR(studentId) {
    setQrGenerating(true)
    try {
      const res = await adminJson(`/api/qr/generate/${studentId}`, 'POST')
      if (res.ok) { toast.success('QR code generated.'); loadStudents() }
      else { const d = await res.json(); toast.error(d.error || 'Generation failed.') }
    } catch { toast.error('Network error.') }
    finally { setQrGenerating(false) }
  }

  async function generateAllQR() {
    setQrGenerating(true); setQrMsg(null)
    try {
      const res = await adminJson('/api/qr/generate-all', 'POST')
      const d = await res.json()
      if (res.ok) { setQrMsg({ ok: true, text: `Generated ${d.count || 0} QR code(s).` }); loadStudents() }
      else setQrMsg({ ok: false, text: d.error || 'Generation failed.' })
    } catch { setQrMsg({ ok: false, text: 'Network error.' }) }
    finally { setQrGenerating(false) }
  }

  async function handleApprove(id) {
    try {
      const res = await adminJson(`/api/submissions/${id}/approve`, 'POST')
      if (res.ok) { toast.success('Submission approved.'); loadSubmissions(); loadStudents() }
      else { const d = await res.json(); toast.error(d.error || 'Approval failed.') }
    } catch { toast.error('Network error.') }
  }

  async function handleReject(id) {
    if (!rejectNote.trim()) return toast.error('Please provide a reason.')
    try {
      const res = await adminJson(`/api/submissions/${id}/reject`, 'PATCH', { admin_notes: rejectNote })
      if (res.ok) { toast.success('Submission rejected.'); setRejectId(null); setRejectNote(''); loadSubmissions() }
      else { const d = await res.json(); toast.error(d.error || 'Rejection failed.') }
    } catch { toast.error('Network error.') }
  }

  async function handleDeleteSubmission(id) {
    if (!window.confirm('Delete this submission permanently?')) return
    try {
      const res = await adminFetch(`/api/submissions/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Submission deleted.'); loadSubmissions() }
      else toast.error('Delete failed.')
    } catch { toast.error('Network error.') }
  }

  async function toggleSubmissionForm() {
    try {
      const res = await adminJson('/api/settings/submission-form', 'PUT', { enabled: !submissionFormEnabled })
      if (res.ok) setSubmissionFormEnabled(!submissionFormEnabled)
      else toast.error('Toggle failed.')
    } catch { toast.error('Network error.') }
  }

  async function handleExportQR() { setDownloading(d => ({ ...d, qr: true })); try { window.open((await adminFetch('/api/qr/export')).url, '_blank') } catch {} finally { setDownloading(d => ({ ...d, qr: false })) } }

  async function handleDownloadExcel() { setDownloading(d => ({ ...d, excel: true })); try { window.open((await adminFetch('/api/settings/download-excel')).url, '_blank') } catch {} finally { setDownloading(d => ({ ...d, excel: false })) } }

  async function handleDownloadImageFolder() { setDownloading(d => ({ ...d, folder: true })); try { window.open((await adminFetch('/api/settings/download-image-folder')).url, '_blank') } catch {} finally { setDownloading(d => ({ ...d, folder: false })) } }

  async function handleDeleteStudent(id) {
    if (!window.confirm('Delete this student permanently?')) return
    try {
      const res = await adminFetch(`/api/students/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Student deleted.'); loadStudents() }
      else { const d = await res.json(); toast.error(d.error || 'Delete failed.') }
    } catch { toast.error('Network error.') }
  }

  const isFullAdmin = userRole === 'admin'
  const filteredStudents = students.filter(s => {
    const matchSearch = !search || s.student_id?.toLowerCase().includes(search.toLowerCase()) || s.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchYear = yearFilter === 'all' || s.year_level === yearFilter
    return matchSearch && matchYear
  })
  const pageCount = Math.ceil(filteredStudents.length / PAGE_SIZE)
  const pagedStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (!session) return (
    <div className="page-center">
      <div className="landing-card" style={{ maxWidth: '400px' }}>
        <div className="landing-header">
          <div className="landing-title">Admin Login</div>
          <div className="landing-desc">LIMSA ID Card Portal</div>
        </div>
        <form className="landing-form" onSubmit={login}>
          {loginError && <div className="error-box">{loginError}</div>}
          <div className="field-group">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required autoComplete="email" />
          </div>
          <div className="field-group">
            <label className="field-label">Password</label>
            <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <Button variant="primary" size="lg" full type="submit" disabled={loginLoading} loading={loginLoading}>Sign In</Button>
        </form>
      </div>
    </div>
  )

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <div className="stats-grid">
              <div className="stat-box"><div className="stat-num">{stats.total}</div><div className="stat-lbl">Total Students</div></div>
              <div className="stat-box"><div className="stat-num confirmed">{stats.confirmed}</div><div className="stat-lbl">Confirmed</div></div>
              <div className="stat-box"><div className="stat-num pending">{stats.pending}</div><div className="stat-lbl">Pending</div></div>
              <div className="stat-box"><div className="stat-num issue">{stats.issues}</div><div className="stat-lbl">Issues</div></div>
            </div>
            <Card>
              <div className="section-title">Active Template</div>
              {activeTemplate ? (
                <div className="template-row">
                  <div className="template-icon">🖼️</div>
                  <div className="template-info"><div className="template-name">{activeTemplate.file_name}</div><div className="template-meta">Uploaded {new Date(activeTemplate.uploaded_at).toLocaleDateString()}</div></div>
                  <Badge variant="green">Active</Badge>
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>No active template. Upload one in the <button className="upload-link" onClick={() => setActiveTab('upload')}>Upload tab</button>.</p>
              )}
            </Card>
          </>
        )

      case 'upload':
        return (
          <>
            <Card>
              <div className="section-title">Upload ID Card Template</div>
              <p className="section-desc">Upload a PNG or JPG image of the ID card design. This will be used as the background for all cards.</p>
              <div className="upload-zone" onClick={() => document.getElementById('template-input')?.click()}>
                <div className="upload-icon">🖼️</div>
                <div className="upload-text">{templateFile ? templateFile.name : 'Click to select a template image'}</div>
                <div className="upload-hint">PNG or JPG recommended</div>
              </div>
              <input id="template-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setTemplateFile(e.target.files[0])} />
              {templateFile && <div style={{ marginBottom: 'var(--space-3)' }}><Button variant="gold" size="sm" onClick={handleTemplateUpload} disabled={uploading} loading={uploading}>Upload Template</Button></div>}
              {uploadMsg && <div className={uploadMsg.ok ? 'success-box' : 'error-box'} style={{ marginBottom: 0 }}>{uploadMsg.text}</div>}
            </Card>

            <Card>
              <div className="section-title">Bulk Import Students</div>
              <p className="section-desc">Upload a CSV file with student data. Optionally include a ZIP folder with photos and signatures.</p>
              <div className="download-row">
                <div className="download-btn" onClick={handleDownloadExcel}>
                  <div className="download-icon">📄</div>
                  <div><div className="download-title">Download Excel Template</div><div className="download-sub">Use this template to prepare your data</div></div>
                </div>
                <div className="download-btn" onClick={handleDownloadImageFolder}>
                  <div className="download-icon">📁</div>
                  <div><div className="download-title">Download Image Folder</div><div className="download-sub">ZIP structure for photos & signatures</div></div>
                </div>
              </div>
              <div className="upload-zone" onClick={() => document.getElementById('csv-input')?.click()} style={{ marginTop: 'var(--space-3)' }}>
                <div className="upload-icon">📋</div>
                <div className="upload-text">{csvFile ? csvFile.name : 'Click to select CSV file'}</div>
                <div className="upload-hint">.csv format</div>
              </div>
              <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setCsvFile(e.target.files[0])} />
              <div className="upload-zone" onClick={() => document.getElementById('zip-input')?.click()}>
                <div className="upload-icon">📦</div>
                <div className="upload-text">{zipFile ? zipFile.name : 'Click to select photo ZIP (optional)'}</div>
                <div className="upload-hint">.zip with photos and signatures</div>
              </div>
              <input id="zip-input" type="file" accept=".zip" style={{ display: 'none' }} onChange={e => setZipFile(e.target.files[0])} />
              {csvFile && <div style={{ margin: 'var(--space-3) 0' }}><Button variant="gold" size="sm" onClick={handleCsvUpload} disabled={uploading} loading={uploading}>Import Students</Button></div>}
              {uploadMsg?.ok === false && <div className="error-box">{uploadMsg.text}</div>}
            </Card>

            <Card>
              <div className="section-title">Add Student Manually</div>
              <p className="section-desc">Fill in the form to add a single student record.</p>
              <div className="mode-toggle">
                <button className={`mode-btn ${uploadMode === 'csv' ? 'active' : ''}`} onClick={() => setUploadMode('csv')}>Quick Add</button>
                <button className={`mode-btn ${uploadMode === 'manual' ? 'active' : ''}`} onClick={() => setUploadMode('manual')}>Full Details</button>
              </div>
              <form className="manual-form" onSubmit={handleManualSubmit}>
                {manualMsg && <div className={manualMsg.ok ? 'success-box' : 'error-box'}>{manualMsg.text}</div>}
                {uploadMode === 'csv' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input label="Student ID" placeholder="AMD-2024-0001" value={manualForm.student_id} onChange={update('student_id')} required />
                    <Input label="Full Name" placeholder="Jane Doe" value={manualForm.full_name} onChange={update('full_name')} required />
                    <Select label="Year Level" value={manualForm.year_level} onChange={update('year_level')} options={YEARS.map(y => ({ value: y, label: y }))} />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input label="Student ID" placeholder="AMD-2024-0001" value={manualForm.student_id} onChange={update('student_id')} required />
                    <Input label="Full Name" placeholder="Jane Doe" value={manualForm.full_name} onChange={update('full_name')} required />
                    <Select label="Year Level" value={manualForm.year_level} onChange={update('year_level')} options={YEARS.map(y => ({ value: y, label: y }))} />
                    <Input label="Position" placeholder="Class Rep" value={manualForm.position} onChange={update('position')} />
                    <Input label="Programme" placeholder="MBBS" value={manualForm.programme} onChange={update('programme')} />
                    <Select label="Blood Type" value={manualForm.blood_type} onChange={update('blood_type')} options={BLOOD_TYPES.map(b => ({ value: b, label: b }))} />
                    <Input label="Email" type="email" placeholder="jane@example.com" value={manualForm.student_email} onChange={update('student_email')} />
                    <Input label="Emergency Contact" placeholder="Full name" value={manualForm.emergency_contact_name} onChange={update('emergency_contact_name')} />
                    <Input label="Emergency Phone" placeholder="+231 xxx xxxx" value={manualForm.emergency_contact_phone} onChange={update('emergency_contact_phone')} />
                    <Input label="Date of Birth" type="date" value={manualForm.date_of_birth} onChange={update('date_of_birth')} />
                    <Input label="Nationality" placeholder="Liberian" value={manualForm.nationality} onChange={update('nationality')} />
                    <Input label="County of Origin" placeholder="Montserrado" value={manualForm.county_of_origin} onChange={update('county_of_origin')} />
                    <div className="form-grid-full">
                      <Input label="Current Address" placeholder="Full address" value={manualForm.current_address} onChange={update('current_address')} />
                    </div>
                    <div>
                      <label className="field-label">Photo</label>
                      <input type="file" accept="image/*" onChange={e => setManualPhoto(e.target.files[0])} style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)' }} />
                    </div>
                    <div>
                      <label className="field-label">Signature</label>
                      <input type="file" accept="image/*" onChange={e => setManualSig(e.target.files[0])} style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)' }} />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button variant="gold" size="sm" type="submit" disabled={manualSubmitting} loading={manualSubmitting}>Add Student</Button>
                </div>
              </form>
            </Card>
          </>
        )

      case 'layout':
        return (
          <Card>
            <div className="section-title">Card Layout Editor</div>
            <p className="section-desc">Drag the fields to position them on the ID card. Changes apply immediately.</p>
            {cardLayout ? <LayoutMapper layout={cardLayout} onSave={async (newLayout) => { try { await adminJson('/api/settings/layout', 'PUT', newLayout); toast.success('Layout saved.') } catch { toast.error('Save failed.') } }} /> : <div className="loading">Loading layout...</div>}
          </Card>
        )

      case 'students':
        return (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', alignItems: 'end' }}>
              <div className="field-group" style={{ flex: '1 1 200px', minWidth: 0 }}>
                <label className="field-label">Search</label>
                <input className="field-input" placeholder="Search by ID or name..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} />
              </div>
              <div className="field-group" style={{ flex: '0 0 140px' }}>
                <label className="field-label">Year</label>
                <select className="field-input" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="all">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end', paddingBottom: '1px' }}>
                <Button variant="gold" size="sm" onClick={generateAllQR} disabled={qrGenerating} loading={qrGenerating}>Generate All QR</Button>
                <Button variant="outline" size="sm" onClick={handleExportQR}>Export QR ZIP</Button>
              </div>
            </div>
            {qrMsg && <div className={qrMsg.ok ? 'success-box' : 'error-box'} style={{ marginBottom: 'var(--space-4)' }}>{qrMsg.text}</div>}
            <Card>
              {dataLoading ? <div className="loading"><span className="spinner" /> Loading students...</div> : (
                <>
                  {pagedStudents.map(s => (
                    <div key={s.student_id} className="student-row">
                      <div className="avatar">{s.full_name?.charAt(0) || '?'}</div>
                      <div className="student-info">
                        <div className="student-name">{s.full_name}</div>
                        <div className="student-meta">{s.student_id} · {s.year_level}{s.status ? ` · ` : ''}{s.status && <Badge variant={s.status === 'confirmed' ? 'green' : s.status === 'issue' || s.status === 'photo_issue' ? 'photo' : 'amber'}>{s.status}</Badge>}</div>
                        {s.issue_note && <div className="student-issue-note">{s.issue_note}</div>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setEditStudent(s); setEditForm({ ...s }); setEditPhoto(null); setEditSig(null); setEditMsg(null) }}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(s.preview_url || '#', '_blank')}>Preview</Button>
                      {isFullAdmin && <Button variant="danger" size="sm" onClick={() => handleDeleteStudent(s.student_id)}>Delete</Button>}
                    </div>
                  ))}
                  {pagedStudents.length === 0 && <div className="submission-empty">No students found.</div>}
                  {pageCount > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-1)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)' }}>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Prev</Button>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '6px 12px' }}>Page {currentPage} of {pageCount}</span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}>Next →</Button>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Modal open={!!editStudent} onClose={() => setEditStudent(null)} title={`Edit: ${editStudent?.full_name || ''}`}>
              {editStudent && (
                <form onSubmit={async (e) => { e.preventDefault(); setEditSubmitting(true); setEditMsg(null)
                  try {
                    const fd = new FormData(); Object.entries(editForm).forEach(([k, v]) => fd.append(k, v))
                    if (editPhoto) fd.append('photo', editPhoto); if (editSig) fd.append('signature', editSig)
                    const res = await adminForm(`/api/students/${editStudent.student_id}`, 'PATCH', fd)
                    const data = await res.json()
                    if (res.ok) { setEditMsg({ ok: true, text: 'Student updated.' }); setEditStudent(null); loadStudents() }
                    else setEditMsg({ ok: false, text: data.error || 'Update failed.' })
                  } catch { setEditMsg({ ok: false, text: 'Network error.' }) }
                  finally { setEditSubmitting(false) }
                }}>
                  {editMsg && <div className={editMsg.ok ? 'success-box' : 'error-box'} style={{ marginBottom: 'var(--space-3)' }}>{editMsg.text}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <Input label="Full Name" value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required />
                    <Select label="Year Level" value={editForm.year_level || ''} onChange={e => setEditForm({ ...editForm, year_level: e.target.value })} options={YEARS.map(y => ({ value: y, label: y }))} />
                    <Input label="Position" value={editForm.position || ''} onChange={e => setEditForm({ ...editForm, position: e.target.value })} />
                    <Input label="Programme" value={editForm.programme || ''} onChange={e => setEditForm({ ...editForm, programme: e.target.value })} />
                    <Select label="Blood Type" value={editForm.blood_type || ''} onChange={e => setEditForm({ ...editForm, blood_type: e.target.value })} options={BLOOD_TYPES.map(b => ({ value: b, label: b }))} />
                    <Input label="Email" type="email" value={editForm.student_email || ''} onChange={e => setEditForm({ ...editForm, student_email: e.target.value })} />
                    <Input label="Emergency Contact" value={editForm.emergency_contact_name || ''} onChange={e => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} />
                    <Input label="Emergency Phone" value={editForm.emergency_contact_phone || ''} onChange={e => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} />
                    <Input label="Date of Birth" type="date" value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
                    <Input label="Nationality" value={editForm.nationality || ''} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })} />
                    <Input label="County of Origin" value={editForm.county_of_origin || ''} onChange={e => setEditForm({ ...editForm, county_of_origin: e.target.value })} />
                    <div className="form-grid-full">
                      <Input label="Address" value={editForm.current_address || ''} onChange={e => setEditForm({ ...editForm, current_address: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div><label className="field-label">New Photo</label><input type="file" accept="image/*" onChange={e => setEditPhoto(e.target.files[0])} style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)' }} /></div>
                    <div><label className="field-label">New Signature</label><input type="file" accept="image/*" onChange={e => setEditSig(e.target.files[0])} style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)' }} /></div>
                  </div>
                  <div className="btn-row">
                    <Button variant="gold" size="md" type="submit" disabled={editSubmitting} loading={editSubmitting}>Save Changes</Button>
                    <Button variant="outline" size="md" type="button" onClick={() => setEditStudent(null)}>Cancel</Button>
                  </div>
                </form>
              )}
            </Modal>
          </>
        )

      case 'submissions':
        return (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', alignItems: 'end' }}>
              <div className="field-group">
                <label className="field-label">Status</label>
                <select className="field-input" value={submissionsFilter} onChange={e => { setSubmissionsFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <Button variant="outline" size="sm" onClick={loadSubmissions}>Refresh</Button>
            </div>

            <Card>
              {submissionsLoading ? <div className="loading">Loading submissions...</div> : (
                <>
                  {submissions.map(s => (
                    <div key={s.id} className="student-row">
                      <div className="avatar">{s.full_name?.charAt(0) || '?'}</div>
                      <div className="student-info">
                        <div className="student-name">{s.full_name} <Badge variant={s.status === 'approved' ? 'green' : s.status === 'rejected' ? 'photo' : 'amber'}>{s.status}</Badge></div>
                        <div className="student-meta">{s.student_id} · {new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="submission-actions">
                        {s.status === 'pending' && (
                          <>
                            <button className="btn-sm-approve" onClick={() => handleApprove(s.id)}>Approve</button>
                            <button className="btn-sm-reject" onClick={() => setRejectId(s.id)}>Reject</button>
                          </>
                        )}
                        <button className="btn-sm-delete" onClick={() => handleDeleteSubmission(s.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {submissions.length === 0 && <div className="submission-empty">No submissions.</div>}
                </>
              )}
            </Card>

            <Modal open={!!rejectId} onClose={() => { setRejectId(null); setRejectNote('') }} title="Reject Submission">
              <div className="field-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="field-label">Reason for rejection</label>
                <textarea className="field-input" rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Explain why this submission is being rejected..." style={{ resize: 'vertical' }} />
              </div>
              <div className="btn-row">
                <Button variant="danger" size="md" onClick={() => handleReject(rejectId)} disabled={!rejectNote.trim()}>Reject</Button>
                <Button variant="outline" size="md" onClick={() => { setRejectId(null); setRejectNote('') }}>Cancel</Button>
              </div>
            </Modal>
          </>
        )

      case 'analytics':
        return <AnalyticsTab />

      case 'settings':
        return (
          <>
            {isFullAdmin && (
              <Card>
                <div className="section-title">Card Fields</div>
                <p className="section-desc">Toggle which fields appear on the printed ID card.</p>
                {fields && (
                  <div className="field-toggle-panel">
                    {Object.entries(FIELD_META).map(([key, meta]) => (
                      <div key={key} className={`field-toggle-row ${fields[key]?.enabled ? 'on' : ''} ${meta.locked ? 'locked' : ''}`} onClick={() => { if (meta.locked) return; saveFields({ ...fields, [key]: { ...fields[key], enabled: !fields[key]?.enabled } }) }}>
                        <div className="field-toggle-check">{fields[key]?.enabled ? '✓' : ''}</div>
                        <div className="field-toggle-label">{meta.label}</div>
                        {meta.locked && <span className="field-toggle-badge">Required</span>}
                        {fieldsSaving && <span className="spinner" />}
                      </div>
                    ))}
                  </div>
                )}
                {fieldsMsg && <div className={fieldsMsg.ok ? 'success-box' : 'error-box'}>{fieldsMsg.text}</div>}
              </Card>
            )}

            <Card>
              <div className="section-title">QR Code Fields</div>
              <p className="section-desc">Toggle which fields are encoded in the QR code.</p>
              {qrFields && (
                <div className="field-toggle-panel">
                  {Object.entries(qrFields).map(([key, cfg]) => (
                    <div key={key} className={`field-toggle-row ${cfg.enabled ? 'on' : ''}`} onClick={() => saveQrFields({ ...qrFields, [key]: { ...cfg, enabled: !cfg.enabled } })}>
                      <div className="field-toggle-check">{cfg.enabled ? '✓' : ''}</div>
                      <div className="field-toggle-label">{cfg.label || key}</div>
                    </div>
                  ))}
                </div>
              )}
              {qrFieldsMsg && <div className={qrFieldsMsg.ok ? 'success-box' : 'error-box'}>{qrFieldsMsg.text}</div>}
            </Card>

            <Card>
              <div className="section-title">Submission Form</div>
              <div className="submission-setting-box">
                <div className="submission-setting-row">
                  <div>
                    <div className="submission-setting-label">Student self-submission form</div>
                    <div className="submission-setting-hint">Allow students to submit their details online.</div>
                  </div>
                  <Badge variant={submissionFormEnabled ? 'green' : 'gray'}>{submissionFormEnabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                {isFullAdmin && <Button variant={submissionFormEnabled ? 'danger' : 'gold'} size="sm" onClick={toggleSubmissionForm}>{submissionFormEnabled ? 'Disable Form' : 'Enable Form'}</Button>}
                {submissionFormEnabled && (
                  <div className="submission-link-box" style={{ marginTop: 'var(--space-3)' }}>
                    <div className="submission-link-label">Submission link</div>
                    <div className="submission-link-row">
                      <input className="submission-link-code" readOnly value={`${window.location.origin}/submit`} />
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/submit`); toast.success('Link copied!') }}>Copy</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {isFullAdmin && (
              <Card>
                <div className="section-title">Card Renewal</div>
                <p className="section-desc">Set a new expiry date for an entire cohort. Requires admin privileges.</p>
                <RenewCohortSection />
              </Card>
            )}

            {isFullAdmin && (
              <Card>
                <div className="section-title">System</div>
                <Button variant="outline" size="sm" onClick={async () => { try { window.open((await adminFetch('/api/backup')).url, '_blank') } catch { toast.error('Backup failed.') } }}>Download System Backup</Button>
              </Card>
            )}
          </>
        )

      case 'admins':
        navigate('/admin/admins')
        return null

      default:
        return null
    }
  }

  function update(field) {
    return (e) => setManualForm({ ...manualForm, [field]: e.target.value })
  }

  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  return (
    <div className="admin-wrapper">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <div className="topbar-logo">LMSA</div>
          <div className="topbar-sub">ID Card Portal</div>
          <div style={{ width: '1px', height: '24px', background: 'var(--navy-600)', margin: '0 var(--space-2)' }} />
          <div className="topbar-title">Admin Dashboard</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <NotificationCenter />
          {userRole && (
            <Badge variant={isFullAdmin ? 'green' : 'blue'}>{isFullAdmin ? 'Admin' : 'Support'}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map(tab => (
          <button key={tab.id} className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-sidebar-layout">
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav">
            {SIDEBAR_SECTIONS.map(section => (
              <div key={section.label}>
                <div className="admin-sidebar-section">{section.label}</div>
                {section.items.map(item => (
                  <button key={item.id} className={`admin-sidebar-item ${activeTab === item.id ? 'active' : ''} ${item.id === 'admins' ? 'admin-sidebar-item--danger' : ''}`}
                    onClick={() => { if (item.id === 'admins') navigate('/admin/admins'); else setActiveTab(item.id) }}>
                    <span className="admin-sidebar-icon">{item.icon}</span>
                    <span className="admin-sidebar-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="admin-body">
          {renderTabContent()}
        </main>
      </div>

      <SessionTimeout />
    </div>
  )
}
