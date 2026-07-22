import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminFetch, adminJson, adminForm, authMe } from '../lib/api'
import LayoutMapper from '../components/LayoutMapper'
import { useToast } from '../components/Toast'
import NotificationCenter from '../components/NotificationCenter'
import AnalyticsTab from '../components/AnalyticsTab'

import SessionTimeout from '../components/SessionTimeout'

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
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

const FIELD_META = {
  student_id: { label: 'Student ID', locked: true },
  full_name: { label: 'Full Name', locked: false },
  year_level: { label: 'Level', locked: false },
  position: { label: 'Position', locked: false },
  signature: { label: 'Signature', locked: false },
}

function RenewCohortSection() {
  const toast = useToast()
  const [yearLevel, setYearLevel] = useState(YEARS[0])
  const [newValidUntil, setNewValidUntil] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRenew() {
    if (!newValidUntil) return toast.error('Please select an expiry date.')
    setLoading(true)
    try {
      const res = await adminJson('/api/students/renew-cohort', 'PUT', {
        year_level: yearLevel,
        new_valid_until: newValidUntil,
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Renewed ${data.renewed} student(s) in ${yearLevel}.`)
        setNewValidUntil('')
      } else {
        toast.error(data.error || 'Renewal failed.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
      <div className="field-group" style={{ flex: '0 0 auto' }}>
        <label className="field-label">Year level</label>
        <select
          className="field-input"
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          style={{ fontSize: '13px', padding: '7px 10px' }}
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="field-group" style={{ flex: '0 0 auto' }}>
        <label className="field-label">New expiry date</label>
        <input
          type="date"
          className="field-input"
          value={newValidUntil}
          onChange={(e) => setNewValidUntil(e.target.value)}
          style={{ fontSize: '13px', padding: '7px 10px' }}
        />
      </div>
      <button
        className="btn-gold"
        onClick={handleRenew}
        disabled={loading}
        style={{ fontSize: '12px', padding: '7px 14px', marginBottom: '2px' }}
      >
        {loading ? 'Renewing...' : 'Renew Cohort'}
      </button>
    </div>
  )
}

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

  const [manualForm, setManualForm] = useState({
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
    nationality: '',
    county_of_origin: '',
    current_address: '',
  })
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

  // Field toggle state
  const [fields, setFields] = useState(null)
  const [fieldsSaving, setFieldsSaving] = useState(false)
  const [fieldsMsg, setFieldsMsg] = useState(null)

  // QR field toggle state
  const [qrFields, setQrFields] = useState(null)
  const [qrFieldsSaving, setQrFieldsSaving] = useState(false)
  const [qrFieldsMsg, setQrFieldsMsg] = useState(null)

  // Card layout state
  const [cardLayout, setCardLayout] = useState(null)

  // Download state
  const [downloading, setDownloading] = useState({})

  // QR state
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrMsg, setQrMsg] = useState(null)

  // Submission form state
  const [submissions, setSubmissions] = useState([])
  const [submissionsFilter, setSubmissionsFilter] = useState('pending')
  const [submissionFormEnabled, setSubmissionFormEnabled] = useState(false)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionMsg, setSubmissionMsg] = useState(null)

  const DRAFT_KEY = 'admin_dashboard_draft'

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.manualForm?.student_id || saved.manualForm?.full_name) {
        setManualForm(saved.manualForm)
        setActiveTab(saved.activeTab || 'upload')
        setUploadMode(saved.uploadMode || 'manual')
        setUploadMsg({ ok: true, text: 'Draft restored from your previous session.' })
        setTimeout(() => setUploadMsg(null), 4000)
      }
    } catch (err) {
      console.warn('[Draft] Failed to restore draft', err)
    }
    sessionStorage.removeItem(DRAFT_KEY)
  }, [])

  // Save form text to sessionStorage when tab goes to background
  useEffect(() => {
    function saveDraft() {
      if (document.visibilityState !== 'hidden') return
      const hasDraft =
        manualForm.student_id || manualForm.full_name || Object.values(editForm).some((v) => v)
      if (hasDraft) {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            manualForm,
            uploadMode,
            activeTab,
          }),
        )
      } else {
        sessionStorage.removeItem(DRAFT_KEY)
      }
    }
    document.addEventListener('visibilitychange', saveDraft)
    return () => document.removeEventListener('visibilitychange', saveDraft)
  }, [manualForm, editForm, uploadMode, activeTab])

  // Warn before leaving with unsaved data
  useEffect(() => {
    function onBeforeUnload(e) {
      const hasDraft =
        manualForm.student_id || manualForm.full_name || Object.values(editForm).some((v) => v)
      if (hasDraft) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [manualForm, editForm])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null) return // still loading
    // No session — the login form is rendered inline below (line ~657).
    // No navigation needed; /admin/login does not exist as a route.
  }, [session])

  useEffect(() => {
    if (!session) return
    const init = async () => {
      const res = await authMe()
      if (res.ok) {
        const d = await res.json()
        setUserRole(d.role || 'admin')
      }
      await loadAll()
    }
    init()
  }, [session])

  async function login(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message)
    setLoginLoading(false)
  }

  async function eachLimit(tasks, limit) {
    const results = []
    let i = 0
    async function worker() {
      while (i < tasks.length) {
        const idx = i++
        results[idx] = await tasks[idx]()
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
    return results
  }

  async function loadAll() {
    setDataLoading(true)
    try {
      await eachLimit(
        [
          loadStudents,
          loadTemplate,
          loadFields,
          loadQrFields,
          loadLayout,
          loadSubmissions,
          loadSubmissionForm,
        ],
        3,
      )
    } finally {
      setDataLoading(false)
    }
  }

  async function loadStudents() {
    const res = await adminFetch('/api/students')
    if (!res.ok) return
    const data = await res.json()
    setStudents(data)
    setCurrentPage(1)
    setStats({
      total: data.length,
      confirmed: data.filter((s) => s.status === 'confirmed').length,
      pending: data.filter((s) => ['pending', 'self_corrected'].includes(s.status)).length,
      issues: data.filter((s) => ['issue', 'photo_issue'].includes(s.status)).length,
    })
    const issueStudents = data.filter((s) => ['issue', 'photo_issue'].includes(s.status))
    if (issueStudents.length) {
      const { data: confs } = await supabase
        .from('confirmations')
        .select('student_id, note, action')
        .in(
          'student_id',
          issueStudents.map((s) => s.student_id),
        )
        .order('confirmed_at', { ascending: false })
      if (confs) {
        const map = {}
        confs.forEach((c) => {
          if (!map[c.student_id]) map[c.student_id] = c
        })
        setIssueNotes(map)
      }
    }
  }

  async function loadTemplate() {
    const res = await adminFetch('/api/templates/active')
    if (res.ok) setActiveTemplate(await res.json())
  }

  async function loadFields() {
    const res = await adminFetch('/api/settings/fields')
    if (res.ok) setFields(await res.json())
  }

  async function loadQrFields() {
    const res = await adminFetch('/api/settings/qr-fields')
    if (res.ok) setQrFields(await res.json())
  }

  async function saveQrFields() {
    setQrFieldsSaving(true)
    setQrFieldsMsg(null)
    const res = await adminJson('/api/settings/qr-fields', 'PUT', qrFields)
    setQrFieldsSaving(false)
    if (res.ok) setQrFieldsMsg({ ok: true, text: 'QR field settings saved.' })
    else
      setQrFieldsMsg({
        ok: false,
        text: (await res.json().catch(() => ({}))).error || 'Failed to save QR settings.',
      })
    setTimeout(() => setQrFieldsMsg(null), 2500)
  }

  function toggleQrField(key) {
    setQrFields((prev) => {
      if (!prev?.[key]) return prev
      return { ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }
    })
  }

  async function loadLayout() {
    const res = await adminFetch('/api/settings/layout')
    if (res.ok) setCardLayout(await res.json())
  }

  async function loadSubmissions(statusFilter) {
    setSubmissionsLoading(true)
    try {
      const filter = statusFilter ?? submissionsFilter
      const statusParam = filter !== 'all' ? `?status=${filter}` : ''
      const res = await adminFetch(`/api/submissions${statusParam}`)
      if (res.ok) setSubmissions(await res.json())
    } finally {
      setSubmissionsLoading(false)
    }
  }

  async function loadSubmissionForm() {
    const res = await adminFetch('/api/settings/submission-form')
    if (res.ok) {
      const data = await res.json()
      setSubmissionFormEnabled(data.enabled)
    }
  }

  async function saveLayout(layout) {
    const res = await adminJson('/api/settings/layout', 'PUT', layout)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Save failed')
    }
    const saved = await res.json()
    setCardLayout(saved)
  }

  async function saveFields() {
    setFieldsSaving(true)
    setFieldsMsg(null)
    const res = await adminJson('/api/settings/fields', 'PUT', fields)
    setFieldsSaving(false)
    if (res.ok) setFieldsMsg({ ok: true, text: 'Field settings saved.' })
    else
      setFieldsMsg({
        ok: false,
        text: (await res.json().catch(() => ({}))).error || 'Failed to save settings.',
      })
    setTimeout(() => setFieldsMsg(null), 2500)
  }

  function toggleField(key) {
    if (FIELD_META[key].locked) return
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))
  }

  async function handleDownload(endpoint, filename) {
    setDownloading((prev) => ({ ...prev, [endpoint]: true }))
    try {
      const res = await adminFetch(
        endpoint.startsWith('/api/') ? endpoint : `/api/settings/${endpoint}`,
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Download failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed. Please check your connection.')
    } finally {
      setDownloading((prev) => ({ ...prev, [endpoint]: false }))
    }
  }

  async function handleTemplateUpload() {
    if (!templateFile) return
    setUploading(true)
    setUploadMsg(null)
    const form = new FormData()
    form.append('file', templateFile)
    const res = await adminForm('/api/templates', 'POST', form)
    const data = await res.json()
    setUploading(false)
    if (res.ok) {
      setActiveTemplate(data)
      setTemplateFile(null)
      setUploadMsg({ ok: true, text: 'Template uploaded and set as active.' })
    } else setUploadMsg({ ok: false, text: data.error || 'Upload failed.' })
  }

  async function handleCSVUpload() {
    if (!csvFile) return
    setUploading(true)
    setUploadMsg(null)
    const form = new FormData()
    form.append('csv', csvFile)
    if (zipFile) form.append('zip', zipFile)
    const res = await adminForm('/api/students/bulk', 'POST', form)
    const data = await res.json()
    setUploading(false)
    if (res.ok) {
      setCsvFile(null)
      setZipFile(null)
      setUploadMsg({ ok: true, text: `${data.inserted} student records uploaded successfully.` })
      loadStudents()
    } else setUploadMsg({ ok: false, text: data.error || 'Upload failed.' })
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    setManualSubmitting(true)
    setManualMsg(null)
    const form = new FormData()
    Object.entries(manualForm).forEach(([k, v]) => form.append(k, v))
    if (manualPhoto) form.append('photo', manualPhoto)
    if (manualSig) form.append('signature', manualSig)
    const res = await adminForm('/api/students', 'POST', form)
    const data = await res.json()
    setManualSubmitting(false)
    if (res.ok) {
      setManualMsg({ ok: true, text: `${data.full_name} added successfully. QR code generated.` })
      setManualForm({
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
        nationality: '',
        county_of_origin: '',
        current_address: '',
      })
      setManualPhoto(null)
      setManualSig(null)
      sessionStorage.removeItem(DRAFT_KEY)
      loadStudents()
    } else setManualMsg({ ok: false, text: data.error || 'Could not add student.' })
  }

  function openEdit(s) {
    setEditStudent(s)
    setEditForm({
      full_name: s.full_name,
      year_level: s.year_level,
      position: s.position || '',
      programme: s.programme || '',
      blood_type: s.blood_type || '',
      student_email: s.student_email || '',
      emergency_contact_name: s.emergency_contact_name || '',
      emergency_contact_phone: s.emergency_contact_phone || '',
      date_of_birth: s.date_of_birth || '',
      nationality: s.nationality || '',
      county_of_origin: s.county_of_origin || '',
      current_address: s.current_address || '',
    })
    setEditPhoto(null)
    setEditSig(null)
    setEditMsg(null)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setEditSubmitting(true)
    setEditMsg(null)
    const form = new FormData()
    form.append('full_name', editForm.full_name)
    form.append('year_level', editForm.year_level)
    form.append('position', editForm.position || '')
    form.append('programme', editForm.programme || '')
    form.append('blood_type', editForm.blood_type || '')
    form.append('student_email', editForm.student_email || '')
    form.append('emergency_contact_name', editForm.emergency_contact_name || '')
    form.append('emergency_contact_phone', editForm.emergency_contact_phone || '')
    form.append('date_of_birth', editForm.date_of_birth || '')
    form.append('nationality', editForm.nationality || '')
    form.append('county_of_origin', editForm.county_of_origin || '')
    form.append('current_address', editForm.current_address || '')
    if (editPhoto) form.append('photo', editPhoto)
    if (editSig) form.append('signature', editSig)
    const res = await adminForm(
      `/api/students/${encodeURIComponent(editStudent.student_id)}`,
      'PATCH',
      form,
    )
    const data = await res.json()
    setEditSubmitting(false)
    if (res.ok) {
      setEditMsg({ ok: true, text: 'Student updated. QR code regenerated.' })
      sessionStorage.removeItem(DRAFT_KEY)
      loadStudents()
      setTimeout(() => setEditStudent(null), 1200)
    } else setEditMsg({ ok: false, text: data.error || 'Update failed.' })
  }

  async function handleGenerateQR(studentId) {
    try {
      const res = await adminFetch(`/api/qr/generate/${encodeURIComponent(studentId)}`, {
        method: 'POST',
      })
      if (res.ok) {
        loadStudents()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function handleRegenerateQR(studentId) {
    try {
      const res = await adminFetch(`/api/qr/regenerate/${encodeURIComponent(studentId)}`, {
        method: 'POST',
      })
      if (res.ok) {
        loadStudents()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function handleGenerateAllQR() {
    setQrGenerating(true)
    setQrMsg(null)
    try {
      const res = await adminFetch('/api/qr/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      const data = await res.json()
      if (res.ok)
        setQrMsg({
          ok: true,
          text: `Generated ${data.generated} QR codes.${data.failed ? ` ${data.failed} failed.` : ''}`,
        })
      else setQrMsg({ ok: false, text: data.error || 'Generation failed.' })
      loadStudents()
      setTimeout(() => setQrMsg(null), 4000)
    } catch {
      setQrMsg({ ok: false, text: 'Network error. Please try again.' })
      setTimeout(() => setQrMsg(null), 4000)
    } finally {
      setQrGenerating(false)
    }
  }

  async function handleRegenerateAllQR() {
    if (!window.confirm('This will clear and regenerate QR codes for ALL students. Continue?'))
      return
    setQrGenerating(true)
    setQrMsg(null)
    try {
      const res = await adminFetch('/api/qr/regenerate-all', { method: 'POST' })
      const data = await res.json()
      if (res.ok)
        setQrMsg({
          ok: true,
          text: `Regenerated ${data.generated} QR codes.${data.failed ? ` ${data.failed} failed.` : ''}`,
        })
      else setQrMsg({ ok: false, text: data.error || 'Regeneration failed.' })
      loadStudents()
      setTimeout(() => setQrMsg(null), 6000)
    } catch {
      setQrMsg({ ok: false, text: 'Network error. Please try again.' })
      setTimeout(() => setQrMsg(null), 6000)
    } finally {
      setQrGenerating(false)
    }
  }

  // ── Submission handlers ──
  async function handleToggleSubmissionForm() {
    const newState = !submissionFormEnabled
    try {
      const res = await adminJson('/api/settings/submission-form', 'PUT', { enabled: newState })
      if (res.ok) {
        setSubmissionFormEnabled(newState)
        setSubmissionMsg({
          ok: true,
          text: newState ? 'Form enabled. Share the link with students.' : 'Form disabled.',
        })
      } else {
        setSubmissionMsg({ ok: false, text: 'Failed to update form settings.' })
      }
    } catch {
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    }
    setTimeout(() => setSubmissionMsg(null), 3000)
  }

  async function handleApproveSubmission(id) {
    try {
      const res = await adminFetch(`/api/submissions/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const msg = data.name_warning
          ? { ok: true, text: 'Student approved. ' + data.name_warning, warn: true }
          : { ok: true, text: 'Student approved and record created.' }
        setSubmissionMsg(msg)
        loadSubmissions()
        loadStudents()
      } else {
        setSubmissionMsg({ ok: false, text: data.error || 'Approval failed.' })
      }
    } catch {
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    }
    setTimeout(() => setSubmissionMsg(null), 5000)
  }

  async function handleRejectSubmission(id) {
    const notes = prompt('Reason for rejection (optional):')
    try {
      const res = await adminJson(`/api/submissions/${id}/reject`, 'PATCH', {
        admin_notes: notes || '',
      })
      const data = await res.json()
      if (res.ok) {
        setSubmissionMsg({ ok: true, text: 'Submission rejected.' })
        loadSubmissions()
      } else {
        setSubmissionMsg({ ok: false, text: data.error || 'Rejection failed.' })
      }
    } catch {
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    }
    setTimeout(() => setSubmissionMsg(null), 3000)
  }

  async function handleDeleteSubmission(id) {
    if (!window.confirm('Delete this submission? This cannot be undone.')) return
    const prevSubmissions = submissions
    setSubmissions((prev) => prev.filter((s) => s.id !== id))
    try {
      const res = await adminFetch(`/api/submissions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSubmissionMsg({ ok: true, text: 'Submission deleted.' })
      } else {
        setSubmissions(prevSubmissions)
        setSubmissionMsg({ ok: false, text: 'Failed to delete submission.' })
      }
    } catch {
      setSubmissions(prevSubmissions)
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    }
    setTimeout(() => setSubmissionMsg(null), 3000)
  }

  function getInitials(name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  function statusPill(status) {
    if (status === 'confirmed') return <span className="pill pill-green">Confirmed</span>
    if (status === 'issue') return <span className="pill pill-amber">Issue</span>
    if (status === 'photo_issue') return <span className="pill pill-photo">Photo issue</span>
    if (status === 'self_corrected') return <span className="pill pill-blue">Self-corrected</span>
    return <span className="pill pill-gray">Pending</span>
  }

  const filtered = students.filter(
    (s) =>
      (yearFilter === 'all' || s.year_level === yearFilter) &&
      (s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_id.toLowerCase().includes(search.toLowerCase())),
  )

  const recentActivity = [...students]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  if (!session)
    return (
      <div className="page-center">
        <div className="landing-card">
          <div className="landing-header">
            <p className="landing-subtitle">GoldWay · Admin Access</p>
            <h1 className="landing-title" style={{ fontSize: '1.3rem' }}>
              LMSA ID Portal
            </h1>
            <p className="landing-desc">Admin Dashboard</p>
          </div>
          <form className="landing-form" onSubmit={login}>
            <div className="field-group">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field-group">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <div className="error-box">{loginError}</div>}
            <button className="btn-primary" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )

  return (
    <div className="admin-wrapper">
      {/* ── EDIT MODAL ── */}
      {editStudent && (
        <div className="modal-overlay" onClick={() => setEditStudent(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Edit — {editStudent.student_id}</span>
              <button className="modal-close" onClick={() => setEditStudent(null)}>
                ×
              </button>
            </div>
            {issueNotes[editStudent.student_id] && (
              <div className="info-box" style={{ marginBottom: '14px' }}>
                <strong>Student's report:</strong> {issueNotes[editStudent.student_id].note}
              </div>
            )}
            <form
              onSubmit={handleEditSave}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input
                  className="field-input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Year / Level</label>
                <select
                  className="field-input"
                  value={editForm.year_level}
                  onChange={(e) => setEditForm({ ...editForm, year_level: e.target.value })}
                >
                  {YEARS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
              {fields?.position?.enabled && (
                <div className="field-group">
                  <label className="field-label">Position</label>
                  <input
                    className="field-input"
                    placeholder="e.g. Member"
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  />
                </div>
              )}

              {/* QR-encoded fields */}
              <div
                style={{
                  borderTop: '0.5px solid var(--border)',
                  paddingTop: '10px',
                  marginTop: '2px',
                }}
              >
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                  🔲 QR-encoded details — stored but not printed on card face
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="field-group">
                    <label className="field-label">Programme</label>
                    <input
                      className="field-input"
                      placeholder="e.g. MBBS, Pharm.D"
                      value={editForm.programme}
                      onChange={(e) => setEditForm({ ...editForm, programme: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Blood Type</label>
                    <input
                      className="field-input"
                      placeholder="e.g. O+"
                      value={editForm.blood_type}
                      onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Student Email</label>
                    <input
                      className="field-input"
                      type="email"
                      placeholder="student@email.com"
                      value={editForm.student_email}
                      onChange={(e) => setEditForm({ ...editForm, student_email: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Emergency Contact Name</label>
                    <input
                      className="field-input"
                      placeholder="Full name"
                      value={editForm.emergency_contact_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Emergency Contact Phone</label>
                    <input
                      className="field-input"
                      placeholder="+231 xxx xxxx"
                      value={editForm.emergency_contact_phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Date of Birth</label>
                    <input
                      className="field-input"
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Nationality</label>
                    <input
                      className="field-input"
                      placeholder="Liberian"
                      value={editForm.nationality}
                      onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">County of Origin</label>
                    <input
                      className="field-input"
                      list="liberia-counties-edit"
                      placeholder="e.g. Montserrado"
                      value={editForm.county_of_origin}
                      onChange={(e) =>
                        setEditForm({ ...editForm, county_of_origin: e.target.value })
                      }
                    />
                    <datalist id="liberia-counties-edit">
                      {LIBERIA_COUNTIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Current Address</label>
                    <input
                      className="field-input"
                      placeholder="e.g. 123 Broad Street, Monrovia"
                      value={editForm.current_address}
                      onChange={(e) =>
                        setEditForm({ ...editForm, current_address: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Replace Photo (optional)</label>
                <div
                  className="upload-zone"
                  style={{ padding: '12px' }}
                  onClick={() => document.getElementById('edit-photo-input').click()}
                >
                  <input
                    id="edit-photo-input"
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    hidden
                    onChange={(e) => {
                      if (e.target.files[0]) setEditPhoto(e.target.files[0])
                    }}
                  />
                  {editStudent.photo_url && !editPhoto ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={editStudent.photo_url}
                        alt=""
                        style={{
                          width: '36px',
                          height: '44px',
                          objectFit: 'cover',
                          borderRadius: '3px',
                        }}
                      />
                      <span className="upload-text">
                        Current photo · <span className="upload-link">Replace</span>
                      </span>
                    </div>
                  ) : editPhoto ? (
                    <p className="upload-selected">📷 {editPhoto.name}</p>
                  ) : (
                    <p className="upload-text">
                      No photo yet · <span className="upload-link">Upload</span>
                    </p>
                  )}
                </div>
              </div>
              {fields?.signature?.enabled && (
                <div className="field-group">
                  <label className="field-label">Replace Signature (optional)</label>
                  <div
                    className="upload-zone"
                    style={{ padding: '12px' }}
                    onClick={() => document.getElementById('edit-sig-input').click()}
                  >
                    <input
                      id="edit-sig-input"
                      type="file"
                      accept=".png"
                      hidden
                      onChange={(e) => setEditSig(e.target.files[0])}
                    />
                    {editStudent.signature_url && !editSig ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={editStudent.signature_url}
                          alt=""
                          style={{ height: '28px', objectFit: 'contain', maxWidth: '80px' }}
                        />
                        <span className="upload-text">
                          Current sig · <span className="upload-link">Replace</span>
                        </span>
                      </div>
                    ) : editSig ? (
                      <p className="upload-selected">✍ {editSig.name}</p>
                    ) : (
                      <p className="upload-text">
                        PNG only · transparent background ·{' '}
                        <span className="upload-link">Upload</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
              {editMsg && (
                <div className={editMsg.ok ? 'success-box' : 'error-box'}>{editMsg.text}</div>
              )}
              <div className="btn-row">
                <button className="btn-gold" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn-outline" type="button" onClick={() => setEditStudent(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-topbar">
        <div>
          <div className="topbar-logo">LMSA ID Portal</div>
          <div className="topbar-sub">
            GoldWay Admin Dashboard{userRole === 'support_admin' && ' · Support Admin'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationCenter />
          <button className="btn-outline-light" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <div className="admin-sidebar-layout">
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav">
            {['overview', 'upload', 'layout', 'students', 'submissions', 'analytics', 'settings'].map((tab) => (
              <button
                key={tab}
                className={`admin-sidebar-item ${activeTab === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab)
                  if (tab === 'submissions') loadSubmissions()
                }}
              >
                <span className="admin-sidebar-label">
                  {tab === 'settings'
                    ? 'Settings'
                    : tab === 'submissions'
                      ? 'Submissions'
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </span>
              </button>
            ))}
            {userRole === 'admin' && (
              <button
                className="admin-sidebar-item"
                onClick={() => navigate('/admin/admins')}
              >
                <span className="admin-sidebar-label">Admins</span>
              </button>
            )}
          </nav>
        </aside>

        <div className="admin-tabs">
          {['overview', 'upload', 'layout', 'students', 'submissions', 'analytics', 'settings'].map((tab) => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'submissions') loadSubmissions()
              }}
            >
              {tab === 'settings'
                ? 'Settings'
                : tab === 'submissions'
                  ? 'Submissions'
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          {userRole === 'admin' && (
            <button
              className={`admin-tab ${activeTab === 'admins' ? 'active' : ''}`}
              onClick={() => navigate('/admin/admins')}
            >
              Admins
            </button>
          )}
        </div>

      <div className="admin-body">
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div>
            <div className="stats-grid">
              {dataLoading
                ? [1, 2, 3, 4].map((i) => (
                    <div key={i} className="stat-box">
                      <div className="skeleton skeleton-title" style={{ marginBottom: 8 }} />
                      <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                    </div>
                  ))
                : (
                  <>
                    <div className="stat-box">
                      <div className="stat-num">{stats.total}</div>
                      <div className="stat-lbl">Total</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num confirmed">{stats.confirmed}</div>
                      <div className="stat-lbl">Confirmed</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num pending">{stats.pending}</div>
                      <div className="stat-lbl">Pending</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num issue">{stats.issues}</div>
                      <div className="stat-lbl">Issues</div>
                    </div>
                  </>
                )
              }
            </div>
            <div className="section-title">Active template</div>
            {dataLoading ? (
              <div className="skeleton skeleton-row" style={{ marginBottom: 14 }} />
            ) : activeTemplate ? (
              <div className="template-row">
                <div className="template-icon">🎨</div>
                <div className="template-info">
                  <div className="template-name">{activeTemplate.file_name}</div>
                  <div className="template-meta">
                    Uploaded{' '}
                    {new Date(activeTemplate.uploaded_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {stats.total} cards
                  </div>
                </div>
                <span className="pill pill-green">Active</span>
              </div>
            ) : (
              <div className="error-box" style={{ marginBottom: '14px' }}>
                No template uploaded.{' '}
                <span
                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => setActiveTab('upload')}
                >
                  Upload now →
                </span>
              </div>
            )}
            <div className="section-title" style={{ marginTop: '16px' }}>
              Recent activity
            </div>
            {dataLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))
            ) : recentActivity.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 0' }}>
                No students yet.
              </p>
            ) : recentActivity.map((s) => (
              <div className="student-row" key={s.id}>
                <div className="avatar">{getInitials(s.full_name)}</div>
                <div className="student-info">
                  <div className="student-name">{s.full_name}</div>
                  <div className="student-meta">
                    {s.student_id} · {s.year_level}
                    {s.position ? ` · ${s.position}` : ''}
                  </div>
                </div>
                {statusPill(s.status)}
              </div>
            ))}
          </div>
        )}

        {/* ── UPLOAD ── */}
        {activeTab === 'upload' && (
          <div>
            {/* Downloads */}
            <div className="section-title">Download templates</div>
            <p className="section-desc">
              Download the pre-configured Excel file to fill in student data, and the pre-built
              image folder to organise your photos before uploading.
            </p>
            <div className="download-row">
              <button
                className="download-btn"
                onClick={() => handleDownload('download-excel', 'LMSA_Student_Template.xlsx')}
                disabled={downloading['download-excel']}
              >
                <div className="download-icon">📊</div>
                <div>
                  <div className="download-title">
                    {downloading['download-excel'] ? 'Downloading...' : 'Student data template'}
                  </div>
                  <div className="download-sub">Excel · pre-formatted columns</div>
                </div>
              </button>
              <button
                className="download-btn"
                onClick={() =>
                  handleDownload('download-image-folder', 'LMSA_Image_Upload_Folder.zip')
                }
                disabled={downloading['download-image-folder']}
              >
                <div className="download-icon">📁</div>
                <div>
                  <div className="download-title">
                    {downloading['download-image-folder']
                      ? 'Downloading...'
                      : 'Image folder package'}
                  </div>
                  <div className="download-sub">ZIP · year subfolders + README</div>
                </div>
              </button>
            </div>

            <div className="divider" />

            {/* Template upload */}
            <div className="section-title">
              ID card design template <span className="new-badge">Master design</span>
            </div>
            <p className="section-desc">
              Upload your master card background (PNG/JPG). Student data will overlay automatically.
            </p>
            {activeTemplate && (
              <div className="template-row">
                <div className="template-icon">🎨</div>
                <div className="template-info">
                  <div className="template-name">{activeTemplate.file_name}</div>
                  <div className="template-meta">Currently active · CR-80</div>
                </div>
                <span className="pill pill-green">Active</span>
              </div>
            )}
            <div
              className="upload-zone"
              onClick={() => document.getElementById('template-input').click()}
            >
              <input
                id="template-input"
                type="file"
                accept=".png,.jpg,.jpeg"
                hidden
                onChange={(e) => {
                  setTemplateFile(e.target.files[0])
                  setUploadMsg(null)
                }}
              />
              {templateFile ? (
                <p className="upload-selected">📄 {templateFile.name}</p>
              ) : (
                <>
                  <p className="upload-icon">⬆</p>
                  <p className="upload-text">
                    Drop template or <span className="upload-link">browse</span>
                  </p>
                  <p className="upload-hint">PNG or JPG · 1012 × 638 px (CR-80 at 300 DPI)</p>
                </>
              )}
            </div>
            {templateFile && (
              <button className="btn-gold-full" onClick={handleTemplateUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Template'}
              </button>
            )}
            {uploadMsg && (
              <div
                className={uploadMsg.ok ? 'success-box' : 'error-box'}
                style={{ marginTop: '10px' }}
              >
                {uploadMsg.text}
              </div>
            )}

            <div className="divider" />

            {/* Student data upload */}
            <div className="section-title">Add students</div>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${uploadMode === 'csv' ? 'active' : ''}`}
                onClick={() => {
                  setUploadMode('csv')
                  setUploadMsg(null)
                }}
              >
                CSV batch upload
              </button>
              <button
                className={`mode-btn ${uploadMode === 'manual' ? 'active' : ''}`}
                onClick={() => {
                  setUploadMode('manual')
                  setManualMsg(null)
                }}
              >
                Add manually
              </button>
            </div>

            {uploadMode === 'csv' && (
              <div>
                <p className="section-desc">
                  Fill in the Excel template above, save as CSV, then upload it here. Optionally
                  attach the image folder ZIP.
                </p>
                <div
                  className="upload-zone"
                  style={{ marginBottom: '8px' }}
                  onClick={() => document.getElementById('csv-input').click()}
                >
                  <input
                    id="csv-input"
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={(e) => {
                      setCsvFile(e.target.files[0])
                      setUploadMsg(null)
                    }}
                  />
                  {csvFile ? (
                    <p className="upload-selected">📋 {csvFile.name}</p>
                  ) : (
                    <>
                      <p className="upload-icon">⬆</p>
                      <p className="upload-text">
                        Drop CSV or <span className="upload-link">browse</span>
                      </p>
                      <p className="upload-hint">Save your Excel file as CSV before uploading</p>
                    </>
                  )}
                </div>
                <div
                  className="upload-zone"
                  style={{ marginBottom: '10px', padding: '12px' }}
                  onClick={() => document.getElementById('zip-input').click()}
                >
                  <input
                    id="zip-input"
                    type="file"
                    accept=".zip"
                    hidden
                    onChange={(e) => {
                      setZipFile(e.target.files[0])
                      setUploadMsg(null)
                    }}
                  />
                  {zipFile ? (
                    <p className="upload-selected">📦 {zipFile.name}</p>
                  ) : (
                    <p className="upload-text">
                      Drop image folder ZIP (optional) · <span className="upload-link">browse</span>
                    </p>
                  )}
                </div>
                {csvFile && (
                  <button className="btn-gold-full" onClick={handleCSVUpload} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload CSV'}
                    {zipFile ? ' + Photos' : ''}
                  </button>
                )}
                {uploadMsg && (
                  <div
                    className={uploadMsg.ok ? 'success-box' : 'error-box'}
                    style={{ marginTop: '10px' }}
                  >
                    {uploadMsg.text}
                  </div>
                )}
              </div>
            )}

            {uploadMode === 'manual' && (
              <form onSubmit={handleManualAdd}>
                <div className="manual-form">
                  <div className="field-group">
                    <label className="field-label">Full Name</label>
                    <input
                      className="field-input"
                      placeholder="e.g. Josephine K. Freeman"
                      value={manualForm.full_name}
                      onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Student ID Number</label>
                    <input
                      className="field-input"
                      placeholder="e.g. 123456"
                      value={manualForm.student_id}
                      onChange={(e) => setManualForm({ ...manualForm, student_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Year / Level</label>
                    <select
                      className="field-input"
                      value={manualForm.year_level}
                      onChange={(e) => setManualForm({ ...manualForm, year_level: e.target.value })}
                    >
                      {YEARS.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {fields?.position?.enabled && (
                    <div className="field-group">
                      <label className="field-label">Position</label>
                      <input
                        className="field-input"
                        placeholder="e.g. Member"
                        value={manualForm.position}
                        onChange={(e) => setManualForm({ ...manualForm, position: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="field-group">
                    <label className="field-label">Student Photo</label>
                    <div
                      className="upload-zone"
                      style={{ padding: '12px' }}
                      onClick={() => document.getElementById('manual-photo-input').click()}
                    >
                      <input
                        id="manual-photo-input"
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        hidden
                        onChange={(e) => {
                          if (e.target.files[0]) setManualPhoto(e.target.files[0])
                        }}
                      />
                      {manualPhoto ? (
                        <p className="upload-selected">📷 {manualPhoto.name}</p>
                      ) : (
                        <p className="upload-text">
                          Upload photo (optional) · <span className="upload-link">browse</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {fields?.signature?.enabled && (
                    <div className="field-group">
                      <label className="field-label">Student Signature</label>
                      <div
                        className="upload-zone"
                        style={{ padding: '12px' }}
                        onClick={() => document.getElementById('manual-sig-input').click()}
                      >
                        <input
                          id="manual-sig-input"
                          type="file"
                          accept=".png"
                          hidden
                          onChange={(e) => setManualSig(e.target.files[0])}
                        />
                        {manualSig ? (
                          <p className="upload-selected">✍ {manualSig.name}</p>
                        ) : (
                          <p className="upload-text">
                            PNG · transparent background ·{' '}
                            <span className="upload-link">browse</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* QR-encoded fields */}
                  <div
                    style={{
                      borderTop: '0.5px solid var(--border)',
                      paddingTop: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                      🔲 QR-encoded details — stored but not printed on card face
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="field-group">
                        <label className="field-label">Programme</label>
                        <input
                          className="field-input"
                          placeholder="e.g. MBBS, Pharm.D"
                          value={manualForm.programme}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, programme: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Blood Type</label>
                        <input
                          className="field-input"
                          placeholder="e.g. O+"
                          value={manualForm.blood_type}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, blood_type: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Student Email</label>
                        <input
                          className="field-input"
                          type="email"
                          placeholder="student@email.com"
                          value={manualForm.student_email}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, student_email: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Emergency Contact Name</label>
                        <input
                          className="field-input"
                          placeholder="Full name"
                          value={manualForm.emergency_contact_name}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, emergency_contact_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Emergency Contact Phone</label>
                        <input
                          className="field-input"
                          placeholder="+231 xxx xxxx"
                          value={manualForm.emergency_contact_phone}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              emergency_contact_phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Date of Birth</label>
                        <input
                          className="field-input"
                          type="date"
                          value={manualForm.date_of_birth}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, date_of_birth: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Nationality</label>
                        <input
                          className="field-input"
                          placeholder="Liberian"
                          value={manualForm.nationality}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, nationality: e.target.value })
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">County of Origin</label>
                        <input
                          className="field-input"
                          list="liberia-counties-manual"
                          placeholder="e.g. Montserrado"
                          value={manualForm.county_of_origin}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, county_of_origin: e.target.value })
                          }
                        />
                        <datalist id="liberia-counties-manual">
                          {LIBERIA_COUNTIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field-group">
                        <label className="field-label">Current Address</label>
                        <input
                          className="field-input"
                          placeholder="e.g. 123 Broad Street, Monrovia"
                          value={manualForm.current_address}
                          onChange={(e) =>
                            setManualForm({ ...manualForm, current_address: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="btn-row">
                    <button className="btn-gold" type="submit" disabled={manualSubmitting}>
                      {manualSubmitting ? 'Adding...' : 'Add Student'}
                    </button>
                    <button
                      className="btn-outline"
                      type="button"
                      onClick={() => {
                        setManualForm({
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
                          nationality: '',
                          county_of_origin: '',
                          current_address: '',
                        })
                        setManualPhoto(null)
                        setManualSig(null)
                        setManualMsg(null)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {manualMsg && (
                  <div
                    className={manualMsg.ok ? 'success-box' : 'error-box'}
                    style={{ marginTop: '10px' }}
                  >
                    {manualMsg.text}
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* ── LAYOUT ── */}
        {activeTab === 'layout' && (
          <div>
            <div className="section-title">
              Card layout mapper <span className="new-badge">Template 2</span>
            </div>
            <p className="section-desc">
              Drag each coloured box to position it on your card template. Use the panel on the
              right to fine-tune coordinates, size, font size, and text colour. Click Save layout
              when done — your preview pages will update immediately.
            </p>
            {!activeTemplate && (
              <div className="error-box" style={{ marginBottom: '14px' }}>
                No template uploaded yet.{' '}
                <span
                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => setActiveTab('upload')}
                >
                  Upload your card design first →
                </span>
              </div>
            )}
            <LayoutMapper
              enabledFields={fields}
              templateUrl={activeTemplate?.file_url || null}
              initialLayout={cardLayout}
              onSave={saveLayout}
            />
          </div>
        )}

        {/* ── SUBMISSION FORM ── */}
        {activeTab === 'submissions' && (
          <div>
            <div className="section-title">Submissions</div>
            <div className="mode-toggle">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <button
                  key={f}
                  className={`mode-btn ${submissionsFilter === f ? 'active' : ''}`}
                  onClick={() => {
                    setSubmissionsFilter(f)
                    setTimeout(() => loadSubmissions(f), 0)
                  }}
                  style={{ textTransform: 'capitalize' }}
                >
                  {f}
                </button>
              ))}
            </div>
            {submissionMsg && (
              <div
                className={
                  submissionMsg.warn ? 'info-box' : submissionMsg.ok ? 'success-box' : 'error-box'
                }
                style={{ marginBottom: '10px', fontSize: '13px' }}
              >
                {submissionMsg.text}
              </div>
            )}
            {submissionsLoading ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton skeleton-row" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>
                No {submissionsFilter} submissions.
              </p>
            ) : (
              <div>
                {submissions.map((s) => (
                  <div key={s.id} className="student-row">
                    <div className="avatar">
                      {s.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="student-info">
                      <div className="student-name">{s.full_name}</div>
                      <div className="student-meta">
                        {s.student_id} · {s.year_level}
                        {s.position ? ` · ${s.position}` : ''}
                      </div>
                      <div className="student-meta" style={{ fontSize: '10px', marginTop: '1px' }}>
                        Submitted{' '}
                        {new Date(s.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {s.reviewed_at &&
                          ` · Reviewed ${new Date(s.reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                      </div>
                      {s.admin_notes && (
                        <div className="student-issue-note">Note: {s.admin_notes}</div>
                      )}
                    </div>
                    <span
                      className={`pill ${s.status === 'pending' ? 'pill-gray' : s.status === 'approved' ? 'pill-green' : 'pill-amber'}`}
                    >
                      {s.status}
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {s.status === 'pending' && (
                        <>
                          <button
                            className="btn-gold"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => handleApproveSubmission(s.id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-outline"
                            style={{
                              fontSize: '10px',
                              padding: '4px 8px',
                              borderColor: 'var(--error-text)',
                              color: 'var(--error-text)',
                            }}
                            onClick={() => handleRejectSubmission(s.id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        className="btn-outline"
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                        onClick={() => handleDeleteSubmission(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <div>
            {/* Card field toggles */}
            <div className="section-title">
              Card field settings <span className="new-badge">Template config</span>
            </div>
            <p className="section-desc">
              Toggle which fields appear on the ID card. This also controls the columns in the
              downloadable Excel template and the structure of the image folder.
            </p>
            {fields ? (
              <div className="field-toggle-panel">
                {Object.entries(FIELD_META).map(([key, meta]) => (
                  <div
                    key={key}
                    className={`field-toggle-row ${fields[key]?.enabled ? 'on' : ''} ${meta.locked ? 'locked' : ''}`}
                    onClick={() => toggleField(key)}
                  >
                    <div className="field-toggle-check">{fields[key]?.enabled ? '✓' : ''}</div>
                    <div className="field-toggle-label">{meta.label}</div>
                    {meta.locked && <span className="field-toggle-badge">Always on</span>}
                  </div>
                ))}
                <div
                  style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <button
                    className="btn-gold"
                    onClick={saveFields}
                    disabled={fieldsSaving}
                    style={{ padding: '7px 16px', fontSize: '13px' }}
                  >
                    {fieldsSaving ? 'Saving...' : 'Save field settings'}
                  </button>
                  {fieldsMsg && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: fieldsMsg.ok ? 'var(--success-text)' : 'var(--error-text)',
                      }}
                    >
                      {fieldsMsg.text}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="skeleton skeleton-card" />
            )}

            {/* QR field toggles */}
            <div className="section-title" style={{ marginTop: '18px' }}>
              QR code fields <span className="new-badge">QR</span>
            </div>
            <p className="section-desc">
              Toggle which extra fields are encoded into the QR code. Enabled fields are included in
              the QR payload and appear on the QR verification page.
            </p>
            {qrFields ? (
              <div className="field-toggle-panel">
                {Object.entries(qrFields).map(([key, meta]) => (
                  <div
                    key={key}
                    className={`field-toggle-row ${meta.enabled ? 'on' : ''}`}
                    onClick={() => toggleQrField(key)}
                  >
                    <div className="field-toggle-check">{meta.enabled ? '✓' : ''}</div>
                    <div className="field-toggle-label">{meta.label}</div>
                  </div>
                ))}
                <div
                  style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <button
                    className="btn-gold"
                    onClick={saveQrFields}
                    disabled={qrFieldsSaving}
                    style={{ padding: '7px 16px', fontSize: '13px' }}
                  >
                    {qrFieldsSaving ? 'Saving...' : 'Save QR fields'}
                  </button>
                  {qrFieldsMsg && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: qrFieldsMsg.ok ? 'var(--success-text)' : 'var(--error-text)',
                      }}
                    >
                      {qrFieldsMsg.text}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="skeleton skeleton-card" />
            )}

            <div className="divider" />

            {/* Submission form status */}
            <div className="section-title">Submission form status</div>
            <div
              style={{
                background: 'var(--white)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>Form Status</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {submissionFormEnabled
                      ? 'Students can submit their details'
                      : 'Form is closed to submissions'}
                  </div>
                </div>
                <button
                  className={`btn-${submissionFormEnabled ? 'outline' : 'gold'}`}
                  onClick={handleToggleSubmissionForm}
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  {submissionFormEnabled ? 'Disable Form' : 'Enable Form'}
                </button>
              </div>
              {submissionFormEnabled && (
                <div
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>
                    Share this link with students:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: 'var(--white)',
                        border: '0.5px solid var(--border)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {window.location.origin}/submit
                    </code>
                    <button
                      className="btn-gold"
                      style={{ fontSize: '11px', padding: '5px 10px', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/submit`)
                        setSubmissionMsg({ ok: true, text: 'Link copied!' })
                        setTimeout(() => setSubmissionMsg(null), 2000)
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Card expiry / renewal */}
            {userRole === 'admin' && (
              <>
                <div className="section-title">Card expiry / renewal</div>
                <p className="section-desc">
                  Renew all cards for a given year level by setting a new expiry date. This resets
                  those students' status to confirmed.
                </p>
                <RenewCohortSection userRole={userRole} />
              </>
            )}

            <div className="divider" />

            {/* Backup */}
            {userRole === 'admin' && (
              <>
                <div className="section-title">System backup</div>
                <p className="section-desc">
                  Download a full backup of all database records and uploaded files (photos,
                  signatures, QR codes, templates). The backup is delivered as a ZIP file.
                </p>
                <button
                  className="btn-gold"
                  onClick={async () => {
                    try {
                      setDownloading((prev) => ({ ...prev, backup: true }))
                      const res = await adminFetch('/api/backup')
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}))
                        toast.error(body.error || 'Backup failed.')
                        return
                      }
                      const blob = await res.blob()
                      const disposition = res.headers.get('Content-Disposition') || ''
                      const match = disposition.match(/filename="?(.+?)"?$/)
                      const filename = match ? match[1] : 'lmsa-backup.zip'
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = filename
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } catch {
                      toast.error('Backup failed. Please try again.')
                    } finally {
                      setDownloading((prev) => ({ ...prev, backup: false }))
                    }
                  }}
                  disabled={downloading.backup}
                  style={{ fontSize: '13px', padding: '9px 18px' }}
                >
                  {downloading.backup ? 'Generating backup...' : '📦 Download Full Backup'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {activeTab === 'students' && (
          <div>
            {/* QR bulk controls - admin only */}
            {userRole === 'admin' && (
              <div
                style={{
                  background: 'var(--bg)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px',
                  marginBottom: '14px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  🔲 QR Code Management
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                  {students.filter((s) => s.qr_url).length} of {students.length} students have QR
                  codes generated.
                </div>
                <div className="btn-row">
                  <button
                    className="btn-gold"
                    onClick={handleGenerateAllQR}
                    disabled={qrGenerating}
                    style={{ fontSize: '12px', padding: '7px 14px' }}
                  >
                    {qrGenerating ? 'Generating...' : '⚡ Generate missing QR codes'}
                  </button>
                  <button
                    className="btn-outline"
                    onClick={handleRegenerateAllQR}
                    disabled={qrGenerating}
                    style={{
                      fontSize: '12px',
                      padding: '7px 14px',
                      borderColor: '#CC0000',
                      color: '#CC0000',
                    }}
                  >
                    {qrGenerating ? 'Regenerating...' : '🔄 Regenerate all'}
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => handleDownload('/api/qr/export', 'LMSA_QR_Codes.zip')}
                    disabled={downloading['/api/qr/export']}
                    style={{ fontSize: '12px', padding: '7px 14px' }}
                  >
                    {downloading['/api/qr/export'] ? 'Exporting...' : '⬇ Export all as ZIP'}
                  </button>
                </div>
                {qrMsg && (
                  <div
                    className={qrMsg.ok ? 'success-box' : 'error-box'}
                    style={{ marginTop: '8px', fontSize: '12px' }}
                  >
                    {qrMsg.text}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                background: 'var(--bg)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}
              >
                📋 Photoshoot Roster
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                Export a printable roster with student names, ID numbers, and signature spaces for
                the photoshoot session.
              </div>
              <button
                className="btn-outline"
                onClick={() =>
                  handleDownload('/api/students/export/photoshoot', 'LMSA_Photoshoot_Roster.pdf')
                }
                disabled={downloading['/api/students/export/photoshoot']}
                style={{ fontSize: '12px', padding: '7px 14px' }}
              >
                {downloading['/api/students/export/photoshoot']
                  ? 'Exporting...'
                  : '⬇ Export Photoshoot Roster (PDF)'}
              </button>
            </div>

            <div
              style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}
            >
              <input
                className="field-input"
                placeholder="Search by name or student ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                style={{ flex: 1 }}
              />
              <select
                className="field-input"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value)
                  setCurrentPage(1)
                }}
                style={{ width: 'auto', minWidth: '130px', fontSize: '13px' }}
              >
                <option value="all">All Classes</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                className="btn-gold"
                onClick={() => {
                  setActiveTab('upload')
                  setUploadMode('manual')
                }}
              >
                + Add
              </button>
            </div>
            {dataLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))
            ) : filtered.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>
                {search ? 'No students match your search.' : 'No students added yet.'}
              </p>
            ) : (() => {
              const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
              const safePage = Math.min(currentPage, totalPages)
              const pageStart = (safePage - 1) * PAGE_SIZE
              const pageEnd = safePage * PAGE_SIZE
              const pageStudents = filtered.slice(pageStart, pageEnd)
              const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
              const visiblePages = pageNums.filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
              )
              const trimmedPages = visiblePages.reduce((acc, p, i) => {
                if (i > 0 && p - visiblePages[i - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              return (
                <>
                  {pageStudents.map((s) => (
                    <div className="student-row" key={s.id}>
                      {s.photo_url ? (
                        <img
                          src={s.photo_url}
                          alt={s.full_name}
                          style={{
                            width: '30px',
                            height: '36px',
                            borderRadius: '3px',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div className="avatar">{getInitials(s.full_name)}</div>
                      )}
                      <div className="student-info">
                        <div className="student-name">{s.full_name}</div>
                        <div className="student-meta">
                          {s.student_id} · {s.year_level}
                          {s.position ? ` · ${s.position}` : ''}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '2px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {s.qr_url ? (
                            <>
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--success-text)',
                                  background: 'var(--success-bg)',
                                  padding: '1px 7px',
                                  borderRadius: '20px',
                                  border: '0.5px solid var(--success-border)',
                                }}
                              >
                                QR ✓
                              </span>
                              <button
                                style={{
                                  fontSize: '10px',
                                  color: '#5b8def',
                                  background: 'transparent',
                                  padding: '1px 7px',
                                  borderRadius: '20px',
                                  border: '0.5px solid #5b8def',
                                  cursor: 'pointer',
                                }}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(
                                      `${import.meta.env.VITE_API_URL || ''}/api/students/preview-url/${encodeURIComponent(s.student_id)}`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                      },
                                    )
                                    if (!res.ok) return
                                    const { url } = await res.json()
                                    window.open(url, '_blank', 'noopener,noreferrer')
                                  } catch (err) {
                                    console.warn('[Preview] Failed to open preview', err)
                                  }
                                }}
                              >
                                View preview
                              </button>
                              <button
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--gold)',
                                  background: 'transparent',
                                  padding: '1px 7px',
                                  borderRadius: '20px',
                                  border: '0.5px solid var(--gold)',
                                  cursor: 'pointer',
                                }}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(
                                      `${import.meta.env.VITE_API_URL || ''}/api/qr/verification-url/${encodeURIComponent(s.student_id)}`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                      },
                                    )
                                    if (!res.ok) return
                                    const { url } = await res.json()
                                    window.open(url, '_blank', 'noopener,noreferrer')
                                  } catch (err) {
                                    console.warn('[QR Page] Failed to open verification page', err)
                                  }
                                }}
                              >
                                View page
                              </button>
                              {userRole === 'admin' && (
                                <button
                                  style={{
                                    fontSize: '10px',
                                    color: '#CC0000',
                                    background: 'transparent',
                                    padding: '1px 7px',
                                    borderRadius: '20px',
                                    border: '0.5px solid #CC0000',
                                    cursor: 'pointer',
                                  }}
                                  onClick={async () => {
                                    await handleRegenerateQR(s.student_id)
                                  }}
                                >
                                  Regenerate
                                </button>
                              )}
                            </>
                          ) : (
                            userRole === 'admin' && (
                              <button
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--warn-text)',
                                  background: 'var(--warn-bg)',
                                  padding: '1px 7px',
                                  borderRadius: '20px',
                                  border: '0.5px solid var(--warn-border)',
                                  cursor: 'pointer',
                                }}
                                onClick={async () => {
                                  await handleGenerateQR(s.student_id)
                                }}
                              >
                                Generate QR
                              </button>
                            )
                          )}
                          {s.student_id && userRole === 'admin' && (
                            <button
                              type="button"
                              style={{
                                fontSize: '10px',
                                color: '#CC0000',
                                background: 'transparent',
                                padding: '1px 7px',
                                borderRadius: '20px',
                                border: '0.5px solid #CC0000',
                                cursor: 'pointer',
                              }}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    'Delete this student record? This cannot be undone.',
                                  )
                                )
                                  return
                                try {
                                  const res = await adminFetch(
                                    `/api/students/${encodeURIComponent(s.student_id)}`,
                                    { method: 'DELETE' },
                                  )
                                  if (!res.ok) {
                                    toast.error('Failed to delete student.')
                                    return
                                  }
                                  loadStudents()
                                } catch {
                                  toast.error('Failed to delete student.')
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        {issueNotes[s.student_id] && (
                          <div className="student-issue-note">{issueNotes[s.student_id].note}</div>
                        )}
                      </div>
                      {statusPill(s.status)}
                      <button className="btn-edit" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      marginTop: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        border: '0.5px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--bg)',
                        cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                        opacity: safePage === 1 ? 0.4 : 1,
                      }}
                    >
                      ‹ Prev
                    </button>
                    {trimmedPages.map((p, i) =>
                      p === '…' ? (
                        <span
                          key={`ellipsis-${i}`}
                          style={{ padding: '4px 4px', fontSize: '12px', color: 'var(--muted)' }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            border: '0.5px solid',
                            borderColor: safePage === p ? 'var(--gold)' : 'var(--border)',
                            borderRadius: '6px',
                            background: safePage === p ? 'var(--gold)' : 'var(--bg)',
                            color: safePage === p ? '#0D1B2A' : 'var(--text)',
                            cursor: 'pointer',
                            fontWeight: safePage === p ? '600' : '400',
                          }}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        border: '0.5px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--bg)',
                        cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: safePage === totalPages ? 0.4 : 1,
                      }}
                    >
                      Next ›
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>
                      {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
                    </span>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
      </div>

      <SessionTimeout />
    </div>
  )
}
