import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { supabase } from '../lib/supabase'
import useDocumentTitle from '../lib/useDocumentTitle'
import { adminFetch, adminJson, adminForm, authMe } from '../lib/api'
import LayoutMapper from '../components/LayoutMapper'
import { useToast } from '../components/Toast'
import NotificationCenter from '../components/NotificationCenter'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import SettingsCard from '../components/SettingsCard'
import FieldToggleGroup from '../components/FieldToggleGroup'
import ConfirmDialog from '../components/ConfirmDialog'
import AssetSlot from '../components/AssetSlot'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

import SessionTimeout from '../components/SessionTimeout'
import { YEARS, LIBERIA_COUNTIES, FIELD_META } from './admin/constants'
import RenewCohortSection from './admin/RenewCohortSection'
import ActivityLogSection from './admin/ActivityLogSection'
import AdminNav, { ADMIN_TABS } from './admin/AdminNav'
import { DashboardProvider } from './admin/DashboardContext'
import OverviewTab from './admin/OverviewTab'
import UploadTab from './admin/UploadTab'
import LayoutTab from './admin/LayoutTab'
import SubmissionsTab from './admin/SubmissionsTab'
import SettingsTab from './admin/SettingsTab'
import StudentsTab from './admin/StudentsTab'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)





export default function AdminDashboard() {
  const toast = useToast()
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)
  const navigate = useNavigate()

  // Tab state lives in the query string so a section is bookmarkable,
  // shareable, and reachable with the browser Back button.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = ADMIN_TABS.some((t) => t.id === tabParam) ? tabParam : 'overview'
  const setActiveTab = useCallback(
    (tab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === 'overview') next.delete('tab')
          else next.set('tab', tab)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const [settingsActive, setSettingsActive] = useState('fields')
  const [uploadMode, setUploadMode] = useState('csv')

  const [students, setStudents] = useState([])
  const [activeTemplateFront, setActiveTemplateFront] = useState(null)
  const [activeTemplateBack, setActiveTemplateBack] = useState(null)
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, issues: 0 })
  const [analyticsData, setAnalyticsData] = useState(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [dataLoading, setDataLoading] = useState(false)

  const [templateFileFront, setTemplateFileFront] = useState(null)
  const [templateFileBack, setTemplateFileBack] = useState(null)
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
  const [editRemovePhoto, setEditRemovePhoto] = useState(false)
  const [editRemoveSig, setEditRemoveSig] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMsg, setEditMsg] = useState(null)
  const [issueNotes, setIssueNotes] = useState({})
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  // Field→side assignment (front | back | both)
  const [fieldSides, setFieldSides] = useState(null)

  // Download state
  const [downloading, setDownloading] = useState({})

  // QR state
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrMsg, setQrMsg] = useState(null)
  const [qrRegenerateModalOpen, setQrRegenerateModalOpen] = useState(false)
  const [qrRegenerateAcknowledged, setQrRegenerateAcknowledged] = useState(false)

  // Submission form state
  const [submissions, setSubmissions] = useState([])
  const [submissionsFilter, setSubmissionsFilter] = useState('pending')
  const [submissionFormEnabled, setSubmissionFormEnabled] = useState(false)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionMsg, setSubmissionMsg] = useState(null)
  const [pendingRejectSubmission, setPendingRejectSubmission] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [pendingDeleteSubmission, setPendingDeleteSubmission] = useState(null)
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState(null)
  const [dangerSubmitting, setDangerSubmitting] = useState(false)

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
    // Mount-only: this restores a draft once and then clears it. setActiveTab
    // is stable, and re-running this would resurrect a discarded draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (activeTab !== 'settings') return
    const cards = Array.from(document.querySelectorAll('.settings-card[id]'))
    if (!cards.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setSettingsActive(e.target.id)
        })
      },
      { rootMargin: '-150px 0px -55% 0px', threshold: 0 }
    )
    cards.forEach((c) => obs.observe(c))
    return () => obs.disconnect()
  }, [activeTab])

  useEffect(() => {
    if (!session) return
    const init = async () => {
      // A failure to load the session/role must never prevent the rest of the
      // dashboard from loading — default to full admin and continue.
      try {
        const res = await authMe()
        if (res.ok) {
          const d = await res.json()
          setUserRole(d.role || 'admin')
        } else {
          setUserRole('admin')
        }
      } catch (err) {
        console.warn('[AdminDashboard] authMe failed; continuing with default role:', err)
        setUserRole('admin')
      }
      try {
        await loadAll()
      } catch (err) {
        console.warn('[AdminDashboard] Initial load failed:', err?.message || err)
      }
    }
    init()
  }, [session])

  async function login(e) {
    e.preventDefault()
    if (failedAttempts >= 3 && !captchaToken) {
      setLoginError('Please complete the CAPTCHA verification.')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('[Auth] Sign-in failed:', error.message, error)
        const msg = error.message.includes('Invalid login credentials')
          ? 'Invalid email or password. If you were just invited, click the link in your email to set a password first.'
          : error.message
        setLoginError(msg)
        setFailedAttempts((prev) => prev + 1)
        if (captchaRef.current) captchaRef.current.resetCaptcha()
        setCaptchaToken(null)
      } else {
        setFailedAttempts(0)
        setCaptchaToken(null)
      }
    } catch (err) {
      console.error('[Auth] Sign-in request error:', err)
      setLoginError('Unable to reach the authentication server. Please check your connection and try again.')
    } finally {
      setLoginLoading(false)
    }
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

  // Isolate each dashboard section so one failing request can't cascade into an
  // unhandled rejection that stalls the rest of the dashboard.
  const safeLoad = (fn) => async () => {
    try {
      await fn()
    } catch (err) {
      console.warn('[AdminDashboard] A section failed to load:', err?.message || err)
    }
  }

  async function loadAll() {
    setDataLoading(true)
    try {
      await eachLimit(
        [
          safeLoad(loadStudents),
          safeLoad(loadTemplate),
          safeLoad(loadFields),
          safeLoad(loadQrFields),
          safeLoad(loadLayout),
          safeLoad(loadFieldSides),
          safeLoad(loadSubmissions),
          safeLoad(loadSubmissionForm),
          safeLoad(loadAnalytics),
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
    if (res.ok) {
      const data = await res.json()
      setActiveTemplateFront(data.front || null)
      setActiveTemplateBack(data.back || null)
    }
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
    try {
      const res = await adminJson('/api/settings/qr-fields', 'PUT', qrFields)
      if (res.ok) setQrFieldsMsg({ ok: true, text: 'QR field settings saved.' })
      else
        setQrFieldsMsg({
          ok: false,
          text: (await res.json().catch(() => ({}))).error || 'Failed to save QR settings.',
        })
    } catch {
      setQrFieldsMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setQrFieldsSaving(false)
    }
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
    if (res.ok) {
      setCardLayout(await res.json())
    } else {
      console.warn('[AdminDashboard] loadLayout failed:', res.status, res.statusText)
    }
  }

  async function loadFieldSides() {
    const res = await adminFetch('/api/settings/field-sides')
    if (res.ok) setFieldSides(await res.json())
  }

  async function saveFieldSides(sides) {
    try {
      const res = await adminJson('/api/settings/field-sides', 'PUT', sides)
      if (res.ok) setFieldSides(await res.json())
      // Notify other tabs (e.g., PreviewPage) that field sides changed
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
      }
    } catch {
      /* non-critical — layout save still works */
    }
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

  async function loadAnalytics() {
    try {
      const res = await adminFetch('/api/analytics')
      if (res.ok) setAnalyticsData(await res.json())
    } catch {}
  }

  async function saveLayout(layout) {
    // layout is the full { front, back } object from LayoutMapper
    const res = await adminJson('/api/settings/layout', 'PUT', layout)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      console.warn('[AdminDashboard] saveLayout failed:', res.status, data)
      throw new Error(data.error || 'Save failed')
    }
    const saved = await res.json()
    setCardLayout(saved)
    // Notify other tabs (e.g., PreviewPage) that layout changed
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
    }
  }

  async function loadLayoutHistory(side) {
    const res = await adminFetch(`/api/settings/layout/history?side=${side}`)
    if (!res.ok) return []
    return res.json()
  }

  async function revertLayout(historyId) {
    const res = await adminJson(`/api/settings/layout/history/${historyId}/revert`, 'POST', {})
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Revert failed')
    }
    const { side, value } = await res.json()
    setCardLayout((prev) => ({ ...prev, [side]: value }))
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
    }
    return { side, value }
  }

  async function saveFields() {
    setFieldsSaving(true)
    setFieldsMsg(null)
    try {
      const res = await adminJson('/api/settings/fields', 'PUT', fields)
      if (res.ok) setFieldsMsg({ ok: true, text: 'Field settings saved.' })
      else
        setFieldsMsg({
          ok: false,
          text: (await res.json().catch(() => ({}))).error || 'Failed to save settings.',
        })
    } catch {
      setFieldsMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setFieldsSaving(false)
    }
    setTimeout(() => setFieldsMsg(null), 2500)
  }

  function toggleField(key) {
    if (FIELD_META[key].locked) return
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))
  }

  function openFileInput(id) {
    document.getElementById(id)?.click()
  }

  function handleFileZoneKeyDown(event, id) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFileInput(id)
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

  async function handleTemplateUpload(side) {
    const file = side === 'front' ? templateFileFront : templateFileBack
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await adminForm(`/api/templates?side=${side}`, 'POST', form)
      const data = await res.json()
      if (res.ok) {
        if (side === 'front') {
          setActiveTemplateFront(data)
          setTemplateFileFront(null)
        } else {
          setActiveTemplateBack(data)
          setTemplateFileBack(null)
        }
        setUploadMsg({ ok: true, text: `${side.charAt(0).toUpperCase() + side.slice(1)} template uploaded and set as active.` })
      } else setUploadMsg({ ok: false, text: data.error || 'Upload failed.' })
    } catch {
      setUploadMsg({ ok: false, text: 'Upload failed. Please check your connection.' })
    } finally {
      setUploading(false)
    }
  }

  async function handleCSVUpload() {
    if (!csvFile) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const form = new FormData()
      form.append('csv', csvFile)
      if (zipFile) form.append('zip', zipFile)
      const res = await adminForm('/api/students/bulk', 'POST', form)
      const data = await res.json()
      if (res.ok) {
        setCsvFile(null)
        setZipFile(null)
        setUploadMsg({ ok: true, text: `${data.queued} student record${data.queued !== 1 ? 's' : ''} queued for import.` })
        loadStudents()
      } else setUploadMsg({ ok: false, text: data.error || 'Upload failed.' })
    } catch {
      setUploadMsg({ ok: false, text: 'Upload failed. Please check your connection.' })
    } finally {
      setUploading(false)
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    setManualSubmitting(true)
    setManualMsg(null)
    try {
      const form = new FormData()
      Object.entries(manualForm).forEach(([k, v]) => form.append(k, v))
      if (manualPhoto) form.append('photo', manualPhoto)
      if (manualSig) form.append('signature', manualSig)
      const res = await adminForm('/api/students', 'POST', form)
      const data = await res.json()
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
    } catch {
      setManualMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setManualSubmitting(false)
    }
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
    setEditRemovePhoto(false)
    setEditRemoveSig(false)
    setEditMsg(null)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setEditSubmitting(true)
    setEditMsg(null)
    try {
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
      // Removal flags are ignored server-side when a replacement is uploaded
      if (editRemovePhoto && !editPhoto) form.append('remove_photo', '1')
      if (editRemoveSig && !editSig) form.append('remove_signature', '1')
      const res = await adminForm(
        `/api/students/${encodeURIComponent(editStudent.student_id)}`,
        'PATCH',
        form,
      )
      const data = await res.json()
      if (res.ok) {
        const removed = [
          editRemovePhoto && !editPhoto ? 'photo' : null,
          editRemoveSig && !editSig ? 'signature' : null,
        ].filter(Boolean)
        setEditMsg({
          ok: true,
          text: removed.length
            ? `Student updated. ${removed.join(' and ')} removed. QR code regenerated.`
            : 'Student updated. QR code regenerated.',
        })
        sessionStorage.removeItem(DRAFT_KEY)
        // Reflect the saved record (incl. the new versioned photo/signature
        // URLs) immediately, both in the dialog thumbnail and the list row,
        // rather than waiting for the full reload.
        if (data && typeof data === 'object') {
          setEditStudent((prev) => (prev ? { ...prev, ...data } : prev))
          setEditPhoto(null)
          setEditSig(null)
          setEditRemovePhoto(false)
          setEditRemoveSig(false)
          setStudents((prev) =>
            prev.map((s) => (s.student_id === data.student_id ? { ...s, ...data } : s)),
          )
        }
        loadStudents()
        setTimeout(() => setEditStudent(null), 1200)
      } else setEditMsg({ ok: false, text: data.error || 'Update failed.' })
    } catch {
      setEditMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setEditSubmitting(false)
    }
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

  function handleRegenerateAllQR() {
    setQrRegenerateAcknowledged(false)
    setQrRegenerateModalOpen(true)
  }

  async function confirmRegenerateAllQR() {
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
      setQrRegenerateModalOpen(false)
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

  function handleRejectSubmission(submission) {
    setPendingRejectSubmission(submission)
    setRejectNotes('')
  }

  async function confirmRejectSubmission() {
    if (!pendingRejectSubmission) return
    setDangerSubmitting(true)
    try {
      const res = await adminJson(`/api/submissions/${pendingRejectSubmission.id}/reject`, 'PATCH', {
        admin_notes: rejectNotes || '',
      })
      const data = await res.json()
      if (res.ok) {
        setSubmissionMsg({ ok: true, text: 'Submission rejected.' })
        setPendingRejectSubmission(null)
        setRejectNotes('')
        loadSubmissions()
      } else {
        setSubmissionMsg({ ok: false, text: data.error || 'Rejection failed.' })
      }
    } catch {
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setDangerSubmitting(false)
    }
    setTimeout(() => setSubmissionMsg(null), 3000)
  }

  function handleDeleteSubmission(submission) {
    setPendingDeleteSubmission(submission)
  }

  async function confirmDeleteSubmission() {
    if (!pendingDeleteSubmission) return
    const prevSubmissions = submissions
    setDangerSubmitting(true)
    setSubmissions((prev) => prev.filter((s) => s.id !== pendingDeleteSubmission.id))
    try {
      const res = await adminFetch(`/api/submissions/${pendingDeleteSubmission.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSubmissionMsg({ ok: true, text: 'Submission deleted.' })
        setPendingDeleteSubmission(null)
      } else {
        setSubmissions(prevSubmissions)
        setSubmissionMsg({ ok: false, text: 'Failed to delete submission.' })
      }
    } catch {
      setSubmissions(prevSubmissions)
      setSubmissionMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setDangerSubmitting(false)
    }
    setTimeout(() => setSubmissionMsg(null), 3000)
  }

  function handleDeleteStudent(student) {
    setPendingDeleteStudent(student)
  }

  async function confirmDeleteStudent() {
    if (!pendingDeleteStudent) return
    setDangerSubmitting(true)
    try {
      const res = await adminFetch(
        `/api/students/${encodeURIComponent(pendingDeleteStudent.student_id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        toast.error('Failed to delete student.')
        return
      }
      setPendingDeleteStudent(null)
      loadStudents()
    } catch {
      toast.error('Failed to delete student.')
    } finally {
      setDangerSubmitting(false)
    }
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
    return <StatusBadge status={status} />
  }

  const filtered = students.filter(
    (s) =>
      (yearFilter === 'all' || s.year_level === yearFilter) &&
      (statusFilter === 'all' ||
        (statusFilter === 'issues' ? ['issue', 'photo_issue'].includes(s.status) : s.status === statusFilter)) &&
      (s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_id.toLowerCase().includes(search.toLowerCase())),
  )

  // Single entry point for tab changes so the submissions lazy-load stays in
  // one place instead of being repeated per nav copy.
  useDocumentTitle(
    session
      ? `${ADMIN_TABS.find((t) => t.id === activeTab)?.label || 'Dashboard'} · Admin`
      : 'Admin sign in',
  )

  function selectTab(tab) {
    setActiveTab(tab)
    if (tab === 'submissions') loadSubmissions()
  }

  const recentActivity = [...students]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  // Everything the extracted tab bodies read. Assembled here so the tabs stay
  // presentational and all state continues to be owned by this component.
  const dashboard = {
    PAGE_SIZE,
    activeTemplateBack,
    activeTemplateFront,
    analyticsData,
    cardLayout,
    csvFile,
    currentPage,
    dataLoading,
    downloading,
    fieldSides,
    fields,
    fieldsMsg,
    fieldsSaving,
    filtered,
    getInitials,
    handleApproveSubmission,
    handleCSVUpload,
    handleDeleteStudent,
    handleDeleteSubmission,
    handleDownload,
    handleFileZoneKeyDown,
    handleGenerateAllQR,
    handleGenerateQR,
    handleManualAdd,
    handleRegenerateAllQR,
    handleRegenerateQR,
    handleRejectSubmission,
    handleTemplateUpload,
    handleToggleSubmissionForm,
    issueNotes,
    loadLayoutHistory,
    loadSubmissions,
    manualForm,
    manualMsg,
    manualPhoto,
    manualSig,
    manualSubmitting,
    navigate,
    openEdit,
    openFileInput,
    qrFields,
    qrFieldsMsg,
    qrFieldsSaving,
    qrGenerating,
    qrMsg,
    recentActivity,
    revertLayout,
    saveFieldSides,
    saveFields,
    saveLayout,
    saveQrFields,
    search,
    selectTab,
    session,
    setActiveTab,
    setCsvFile,
    setCurrentPage,
    setDownloading,
    setManualForm,
    setManualMsg,
    setManualPhoto,
    setManualSig,
    setSearch,
    setStatusFilter,
    setSubmissionMsg,
    setSubmissionsFilter,
    setTemplateFileBack,
    setTemplateFileFront,
    setUploadMode,
    setUploadMsg,
    setYearFilter,
    setZipFile,
    settingsActive,
    stats,
    statusFilter,
    statusPill,
    students,
    submissionFormEnabled,
    submissionMsg,
    submissions,
    submissionsFilter,
    submissionsLoading,
    templateFileBack,
    templateFileFront,
    toast,
    toggleField,
    toggleQrField,
    uploadMode,
    uploadMsg,
    uploading,
    userRole,
    yearFilter,
    zipFile,
  }

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
              <label className="field-label" htmlFor="admin-login-email">Email</label>
              <input
                id="admin-login-email"
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="admin-login-password">Password</label>
              <input
                id="admin-login-password"
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <div className="error-box">{loginError}</div>}
            {failedAttempts >= 3 && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                <HCaptcha
                  ref={captchaRef}
                  sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || ''}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  theme="light"
                />
              </div>
            )}
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
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-student-dialog-title"
            style={{ maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span id="edit-student-dialog-title">Edit — {editStudent.student_id}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditStudent(null)}
                aria-label="Close student editor"
              >
                ×
              </button>
            </div>
            {issueNotes[editStudent.student_id] && (
              <div className="info-box u-mb-14" >
                <strong>Student's report:</strong> {issueNotes[editStudent.student_id].note}
              </div>
            )}
            <form
              onSubmit={handleEditSave}
              className="u-flex u-col u-gap-12"
            >
              <div className="field-group">
                <label className="field-label" htmlFor="edit-full-name">Full Name</label>
                <input
                  id="edit-full-name"
                  className="field-input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="edit-year-level">Year / Level</label>
                <select
                  id="edit-year-level"
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
                  <label className="field-label" htmlFor="edit-position">Position</label>
                  <input
                    id="edit-position"
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
                <p className="u-fs-11 u-c-muted u-mb-10">
                  QR-encoded details — stored but not printed on card face
                </p>
                <div className="u-flex u-col u-gap-10">
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-programme">Programme</label>
                    <input
                      id="edit-programme"
                      className="field-input"
                      placeholder="e.g. MBBS, Pharm.D"
                      value={editForm.programme}
                      onChange={(e) => setEditForm({ ...editForm, programme: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-blood-type">Blood Type</label>
                    <input
                      id="edit-blood-type"
                      className="field-input"
                      placeholder="e.g. O+"
                      value={editForm.blood_type}
                      onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-student-email">Student Email</label>
                    <input
                      id="edit-student-email"
                      className="field-input"
                      type="email"
                      placeholder="student@email.com"
                      value={editForm.student_email}
                      onChange={(e) => setEditForm({ ...editForm, student_email: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-emergency-contact-name">Emergency Contact Name</label>
                    <input
                      id="edit-emergency-contact-name"
                      className="field-input"
                      placeholder="Full name"
                      value={editForm.emergency_contact_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-emergency-contact-phone">Emergency Contact Phone</label>
                    <input
                      id="edit-emergency-contact-phone"
                      className="field-input"
                      placeholder="+231 xxx xxxx"
                      value={editForm.emergency_contact_phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-date-of-birth">Date of Birth</label>
                    <input
                      id="edit-date-of-birth"
                      className="field-input"
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-nationality">Nationality</label>
                    <input
                      id="edit-nationality"
                      className="field-input"
                      placeholder="Liberian"
                      value={editForm.nationality}
                      onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="edit-county-of-origin">County of Origin</label>
                    <input
                      id="edit-county-of-origin"
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
                    <label className="field-label" htmlFor="edit-current-address">Current Address</label>
                    <input
                      id="edit-current-address"
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
              <AssetSlot
                id="edit-photo-input"
                label="Photo"
                accept=".jpg,.jpeg,.png"
                hint="JPG or PNG · portrait orientation works best"
                currentUrl={editStudent.photo_url}
                stagedFile={editPhoto}
                markedForRemoval={editRemovePhoto}
                onPick={(f) => {
                  setEditPhoto(f)
                  setEditRemovePhoto(false)
                }}
                onRemove={() => setEditRemovePhoto(true)}
                onUndo={() => {
                  setEditPhoto(null)
                  setEditRemovePhoto(false)
                }}
                thumbStyle={{ width: '36px', height: '44px', objectFit: 'cover', borderRadius: '3px' }}
                emptyText="No photo on file"
                currentText="Current photo"
                removeLabel="Remove"
              />
              {fields?.signature?.enabled && (
                <AssetSlot
                  id="edit-sig-input"
                  label="Signature"
                  accept=".png"
                  hint="PNG only · transparent background"
                  currentUrl={editStudent.signature_url}
                  stagedFile={editSig}
                  markedForRemoval={editRemoveSig}
                  onPick={(f) => {
                    setEditSig(f)
                    setEditRemoveSig(false)
                  }}
                  onRemove={() => setEditRemoveSig(true)}
                  onUndo={() => {
                    setEditSig(null)
                    setEditRemoveSig(false)
                  }}
                  thumbStyle={{ height: '28px', maxWidth: '80px', objectFit: 'contain' }}
                  emptyText="No signature on file"
                  currentText="Current signature"
                  removeLabel="Remove"
                />
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

      <ConfirmDialog
        open={qrRegenerateModalOpen}
        title="Regenerate all QR codes?"
        confirmLabel="Regenerate all QR codes"
        onCancel={() => setQrRegenerateModalOpen(false)}
        onConfirm={confirmRegenerateAllQR}
        confirmDisabled={!qrRegenerateAcknowledged}
        loading={qrGenerating}
      >
        <p>
          This will replace QR images for <strong>{students.length} student record{students.length === 1 ? '' : 's'}</strong>.
          Use it only after confirming the active signing key and public scanner path are correct.
        </p>
        <label className="qr-field-toggle u-mt-12" >
          <input
            type="checkbox"
            checked={qrRegenerateAcknowledged}
            onChange={(e) => setQrRegenerateAcknowledged(e.target.checked)}
          />
          I understand existing printed cards may need to be reissued if QR images change.
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingRejectSubmission)}
        title="Reject student submission?"
        confirmLabel="Reject submission"
        onCancel={() => {
          setPendingRejectSubmission(null)
          setRejectNotes('')
        }}
        onConfirm={confirmRejectSubmission}
        loading={dangerSubmitting}
      >
        <p>
          This moves <strong>{pendingRejectSubmission?.full_name || 'this student'}</strong> out of the pending review queue.
          Add a clear LMSA-facing reason so another admin understands the decision later.
        </p>
        <div className="field-group u-mt-12" >
          <label className="field-label" htmlFor="submission-reject-notes">
            Rejection note (optional but recommended)
          </label>
          <textarea
            id="submission-reject-notes"
            className="field-input"
            rows={3}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="e.g. Photo does not meet ID-card requirements."
            style={{ fontFamily: 'inherit' }}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteSubmission)}
        title="Delete submission?"
        confirmLabel="Delete submission"
        onCancel={() => setPendingDeleteSubmission(null)}
        onConfirm={confirmDeleteSubmission}
        loading={dangerSubmitting}
      >
        <p>
          This permanently removes the submission for <strong>{pendingDeleteSubmission?.full_name || 'this student'}</strong> from the review queue.
        </p>
        <div className="confirm-dialog-note">This cannot be undone. Reject instead if you need to keep a decision trail.</div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteStudent)}
        title="Delete student record?"
        confirmLabel="Delete student record"
        onCancel={() => setPendingDeleteStudent(null)}
        onConfirm={confirmDeleteStudent}
        loading={dangerSubmitting}
      >
        <p>
          This permanently deletes <strong>{pendingDeleteStudent?.full_name || 'this student'}</strong>
          {pendingDeleteStudent?.student_id ? ` (${pendingDeleteStudent.student_id})` : ''} and associated card operations.
        </p>
        <div className="confirm-dialog-note">This cannot be undone. Export or back up records first if LMSA needs an audit copy.</div>
      </ConfirmDialog>

      <div className="admin-topbar">
        <div>
          <h1 className="topbar-logo">LMSA ID Portal</h1>
          <div className="topbar-sub">
            GoldWay Admin Dashboard{userRole === 'support_admin' && ' · Support Admin'}
          </div>
        </div>
        <div className="u-flex u-ai-center u-gap-8">
          <NotificationCenter
            onNavigateStudent={(studentId, _type) => {
              setStatusFilter('issues')
              setActiveTab('students')
              // Find the student and open edit modal
              const student = students.find((s) => s.student_id === studentId)
              if (student) openEdit(student)
            }}
          />
          <button className="btn-outline-light" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <div className="admin-sidebar-layout">
        {/* One nav definition, two presentations. The sidebar and the
            horizontal strip are the same tablist rendered once; CSS swaps
            which container is visible at the 900px breakpoint. */}
        <AdminNav
          tabs={ADMIN_TABS}
          activeTab={activeTab}
          onSelect={selectTab}
          userRole={userRole}
          onNavigate={navigate}
        />

      <main className="admin-body" id="admin-tabpanel" role="tabpanel" tabIndex={-1}>
        <DashboardProvider value={dashboard}>
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <OverviewTab />
        )}

        {/* ── UPLOAD ── */}
        {activeTab === 'upload' && (
          <UploadTab />
        )}

        {/* ── LAYOUT ── */}
        {activeTab === 'layout' && (
          <LayoutTab />
        )}

        {/* ── SUBMISSION FORM ── */}
        {activeTab === 'submissions' && (
          <SubmissionsTab />
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}

        {/* ── STUDENTS ── */}
        {activeTab === 'students' && (
          <StudentsTab />
        )}
        </DashboardProvider>
      </main>
      </div>

      <SessionTimeout />
    </div>
  )
}
