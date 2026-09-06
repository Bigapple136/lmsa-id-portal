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
import BackgroundJobsIndicator from '../components/BackgroundJobsIndicator'
import useBackgroundJobs from '../hooks/useBackgroundJobs'
import { runOptimistic, createJob } from '../lib/optimistic'
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
  const bgJobs = useBackgroundJobs()
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

  const [fields, setFields] = useState(null)
  const [fieldsSaving, setFieldsSaving] = useState(false)
  const [fieldsMsg, setFieldsMsg] = useState(null)

  const [qrFields, setQrFields] = useState(null)
  const [qrFieldsSaving, setQrFieldsSaving] = useState(false)
  const [qrFieldsMsg, setQrFieldsMsg] = useState(null)

  const [cardLayout, setCardLayout] = useState(null)
  const [fieldSides, setFieldSides] = useState(null)

  const [downloading, setDownloading] = useState({})

  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrMsg, setQrMsg] = useState(null)
  const [qrRegenerateModalOpen, setQrRegenerateModalOpen] = useState(false)
  const [qrRegenerateAcknowledged, setQrRegenerateAcknowledged] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (session === null) return
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

  // ── Optimistic: save QR fields ──
  async function saveQrFields() {
    const prev = qrFields ? { ...qrFields } : null
    const snapshot = JSON.parse(JSON.stringify(qrFields || {}))

    // Optimistic: show success immediately, admin can continue
    setQrFieldsMsg({ ok: true, text: 'QR field settings saved — syncing...' })
    setQrFieldsSaving(false)

    runOptimistic({
      label: 'Save QR field settings',
      optimisticUpdate: () => {},
      rollback: () => {
        if (prev) setQrFields(prev)
        setQrFieldsMsg({ ok: false, text: 'Failed to save QR settings — reverted.' })
      },
      action: async () => {
        const res = await adminJson('/api/settings/qr-fields', 'PUT', snapshot)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to save QR settings.')
        }
        return res.json()
      },
      onSuccess: (saved) => {
        setQrFields(saved)
        setQrFieldsMsg({ ok: true, text: 'QR field settings saved.' })
        setTimeout(() => setQrFieldsMsg(null), 2500)
      },
      onError: () => {
        setQrFieldsMsg({ ok: false, text: 'Failed to save QR settings.' })
        setTimeout(() => setQrFieldsMsg(null), 4000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'save',
    })
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

  // ── Optimistic: save field sides ──
  async function saveFieldSides(sides) {
    const prev = fieldSides ? { ...fieldSides } : null
    // Optimistic: update UI immediately
    setFieldSides(sides)
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
    }

    runOptimistic({
      label: 'Save field sides',
      optimisticUpdate: () => {},
      rollback: () => {
        if (prev) setFieldSides(prev)
        toast.error('Failed to save field sides — reverted')
      },
      action: async () => {
        const res = await adminJson('/api/settings/field-sides', 'PUT', sides)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Save failed')
        }
        return res.json()
      },
      onSuccess: (saved) => {
        setFieldSides(saved)
      },
      jobsApi: bgJobs,
      toast,
      type: 'save',
    })
  }

  async function loadSubmissions(statusFilterParam) {
    setSubmissionsLoading(true)
    try {
      const filter = statusFilterParam ?? submissionsFilter
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

  // ── Optimistic: save layout ──
  async function saveLayout(layout) {
    const prev = cardLayout ? JSON.parse(JSON.stringify(cardLayout)) : null
    const optimisticLayout = {
      front: layout.front || cardLayout?.front || null,
      back: layout.back || cardLayout?.back || null,
    }
    // Optimistic: show new layout immediately
    setCardLayout(optimisticLayout)
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
    }

    runOptimistic({
      label: 'Save card layout',
      optimisticUpdate: () => {},
      rollback: () => {
        if (prev) setCardLayout(prev)
      },
      action: async () => {
        const res = await adminJson('/api/settings/layout', 'PUT', layout)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Save failed')
        }
        return res.json()
      },
      onSuccess: (saved) => {
        setCardLayout(saved)
      },
      jobsApi: bgJobs,
      toast,
      type: 'save',
    })

    return optimisticLayout
  }

  async function loadLayoutHistory(side) {
    const res = await adminFetch(`/api/settings/layout/history?side=${side}`)
    if (!res.ok) return []
    return res.json()
  }

  // ── Optimistic: revert layout ──
  async function revertLayout(historyId) {
    const prev = cardLayout ? JSON.parse(JSON.stringify(cardLayout)) : null

    const job = createJob({ label: 'Revert layout', type: 'save' })
    bgJobs.addJob(job)

    try {
      const res = await adminJson(`/api/settings/layout/history/${historyId}/revert`, 'POST', {})
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Revert failed')
      }
      const { side, value } = await res.json()
      // Optimistic update already applied via response, but apply immediately
      setCardLayout((prevLayout) => ({ ...prevLayout, [side]: value }))
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('layout-changes').postMessage({ type: 'layout-updated' })
      }
      bgJobs.updateJob(job.id, { status: 'success' })
      setTimeout(() => bgJobs.removeJob(job.id), 2000)
      toast.success('Layout reverted')
      return { side, value }
    } catch (err) {
      if (prev) setCardLayout(prev)
      bgJobs.updateJob(job.id, { status: 'error', error: err.message })
      setTimeout(() => bgJobs.removeJob(job.id), 4000)
      toast.error(`Revert failed: ${err.message}`)
      throw err
    }
  }

  // ── Optimistic: save fields ──
  async function saveFields() {
    const prev = fields ? JSON.parse(JSON.stringify(fields)) : null
    setFieldsMsg({ ok: true, text: 'Field settings saved — syncing...' })

    runOptimistic({
      label: 'Save field settings',
      optimisticUpdate: () => {},
      rollback: () => {
        if (prev) setFields(prev)
        setFieldsMsg({ ok: false, text: 'Failed to save — reverted' })
      },
      action: async () => {
        const res = await adminJson('/api/settings/fields', 'PUT', prev)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to save settings.')
        }
        return res.json()
      },
      onSuccess: () => {
        setFieldsMsg({ ok: true, text: 'Field settings saved.' })
        setTimeout(() => setFieldsMsg(null), 2500)
      },
      onError: () => {
        setFieldsMsg({ ok: false, text: 'Failed to save settings.' })
        setTimeout(() => setFieldsMsg(null), 4000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'save',
    })
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

  // ── Optimistic: handle download ──
  // Downloads are non-blocking — admin can continue working while file prepares
  async function handleDownload(endpoint, filename) {
    const label = `Download ${filename}`
    const job = createJob({ label, type: 'download' })
    bgJobs.addJob(job)
    setDownloading((prev) => ({ ...prev, [endpoint]: true }))
    toast.info(`${label} — preparing...`)

    try {
      const res = await adminFetch(
        endpoint.startsWith('/api/') ? endpoint : `/api/settings/${endpoint}`,
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Download failed')
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
      bgJobs.updateJob(job.id, { status: 'success' })
      setTimeout(() => bgJobs.removeJob(job.id), 2000)
      toast.success(`${filename} downloaded`)
    } catch (err) {
      bgJobs.updateJob(job.id, { status: 'error', error: err.message })
      setTimeout(() => bgJobs.removeJob(job.id), 4000)
      toast.error(err.message || 'Download failed. Please try again.')
    } finally {
      setDownloading((prev) => ({ ...prev, [endpoint]: false }))
    }
  }

  // ── Optimistic: template upload ──
  async function handleTemplateUpload(side) {
    const file = side === 'front' ? templateFileFront : templateFileBack
    if (!file) return

    const prevFront = activeTemplateFront
    const prevBack = activeTemplateBack
    const objectUrl = URL.createObjectURL(file)

    const optimisticTemplate = {
      file_name: file.name,
      file_url: objectUrl,
      uploaded_at: new Date().toISOString(),
      is_active: true,
      side,
      _optimistic: true,
    }

    // Optimistic: show template immediately with local preview
    if (side === 'front') {
      setActiveTemplateFront(optimisticTemplate)
      setTemplateFileFront(null)
    } else {
      setActiveTemplateBack(optimisticTemplate)
      setTemplateFileBack(null)
    }
    setUploadMsg({ ok: true, text: `${side.charAt(0).toUpperCase() + side.slice(1)} template — preview shown, syncing in background...` })

    runOptimistic({
      label: `Upload ${side} template`,
      optimisticUpdate: () => {},
      rollback: () => {
        if (side === 'front') setActiveTemplateFront(prevFront)
        else setActiveTemplateBack(prevBack)
        setUploadMsg({ ok: false, text: 'Template upload failed — reverted' })
        URL.revokeObjectURL(objectUrl)
      },
      action: async () => {
        const form = new FormData()
        form.append('file', file)
        const res = await adminForm(`/api/templates?side=${side}`, 'POST', form)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed.')
        return data
      },
      onSuccess: (data) => {
        URL.revokeObjectURL(objectUrl)
        if (side === 'front') {
          setActiveTemplateFront(data)
        } else {
          setActiveTemplateBack(data)
        }
        setUploadMsg({ ok: true, text: `${side.charAt(0).toUpperCase() + side.slice(1)} template uploaded and set as active.` })
        setTimeout(() => setUploadMsg(null), 4000)
      },
      onError: (err) => {
        setUploadMsg({ ok: false, text: err.message || 'Upload failed.' })
      },
      jobsApi: bgJobs,
      toast,
      type: 'upload',
    })
  }

  // ── Optimistic: CSV bulk upload ──
  async function handleCSVUpload() {
    if (!csvFile) return

    const fileToUpload = csvFile
    const zipToUpload = zipFile
    const queuedCount = 0 // will be updated after response

    // Optimistic: clear file inputs immediately and show queued message
    // Admin can continue working while import processes in background
    setCsvFile(null)
    setZipFile(null)
    setUploadMsg({ ok: true, text: `Import queued — processing in background. You can continue working.` })
    toast.info('CSV import queued — processing in background')

    const job = createJob({ label: `Import ${fileToUpload.name}`, type: 'upload' })
    bgJobs.addJob(job)

    try {
      const form = new FormData()
      form.append('csv', fileToUpload)
      if (zipToUpload) form.append('zip', zipToUpload)
      const res = await adminForm('/api/students/bulk', 'POST', form)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed.')

      setUploadMsg({ ok: true, text: `${data.queued} student record${data.queued !== 1 ? 's' : ''} queued for import — processing in background.` })
      bgJobs.updateJob(job.id, { status: 'success' })
      setTimeout(() => bgJobs.removeJob(job.id), 3000)
      toast.success(`${data.queued} records queued for import`)

      // Reload students after a short delay to show imported records
      // Poll a few times as background import completes
      setTimeout(() => loadStudents(), 2000)
      setTimeout(() => loadStudents(), 5000)
      setTimeout(() => loadStudents(), 10000)
    } catch (err) {
      setUploadMsg({ ok: false, text: err.message || 'Upload failed.' })
      bgJobs.updateJob(job.id, { status: 'error', error: err.message })
      setTimeout(() => bgJobs.removeJob(job.id), 5000)
      toast.error(`Import failed: ${err.message}`)
    }
  }

  // ── Optimistic: manual add student ──
  async function handleManualAdd(e) {
    e.preventDefault()

    const formSnapshot = { ...manualForm }
    const photoSnapshot = manualPhoto
    const sigSnapshot = manualSig

    // Create optimistic student record
    const optimisticStudent = {
      id: `temp_${Date.now()}`,
      student_id: formSnapshot.student_id,
      full_name: formSnapshot.full_name,
      year_level: formSnapshot.year_level,
      position: formSnapshot.position || null,
      programme: formSnapshot.programme || null,
      blood_type: formSnapshot.blood_type || null,
      student_email: formSnapshot.student_email || null,
      emergency_contact_name: formSnapshot.emergency_contact_name || null,
      emergency_contact_phone: formSnapshot.emergency_contact_phone || null,
      date_of_birth: formSnapshot.date_of_birth || null,
      nationality: formSnapshot.nationality || null,
      county_of_origin: formSnapshot.county_of_origin || null,
      current_address: formSnapshot.current_address || null,
      photo_url: photoSnapshot ? URL.createObjectURL(photoSnapshot) : null,
      signature_url: sigSnapshot ? URL.createObjectURL(sigSnapshot) : null,
      qr_url: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      _optimistic: true,
    }

    const prevStudents = [...students]

    // Optimistic: add to list immediately, clear form, allow admin to continue
    setStudents((prev) => [optimisticStudent, ...prev])
    setStats((prev) => ({
      ...prev,
      total: prev.total + 1,
      pending: prev.pending + 1,
    }))
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
    setManualMsg({ ok: true, text: `${formSnapshot.full_name} added — syncing in background...` })
    sessionStorage.removeItem(DRAFT_KEY)

    runOptimistic({
      label: `Add student ${formSnapshot.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setStudents(prevStudents)
        setStats((prev) => ({
          total: Math.max(0, prev.total - 1),
          pending: Math.max(0, prev.pending - 1),
        }))
        setManualForm(formSnapshot)
        setManualMsg({ ok: false, text: 'Failed to add student — reverted' })
        if (optimisticStudent.photo_url) URL.revokeObjectURL(optimisticStudent.photo_url)
        if (optimisticStudent.signature_url) URL.revokeObjectURL(optimisticStudent.signature_url)
      },
      action: async () => {
        const form = new FormData()
        Object.entries(formSnapshot).forEach(([k, v]) => form.append(k, v))
        if (photoSnapshot) form.append('photo', photoSnapshot)
        if (sigSnapshot) form.append('signature', sigSnapshot)
        const res = await adminForm('/api/students', 'POST', form)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not add student.')
        return data
      },
      onSuccess: (data) => {
        // Replace optimistic record with real one
        setStudents((prev) => prev.map((s) => (s.id === optimisticStudent.id ? data : s)))
        setManualMsg({ ok: true, text: `${data.full_name} added — QR generating in background.` })
        if (optimisticStudent.photo_url) URL.revokeObjectURL(optimisticStudent.photo_url)
        if (optimisticStudent.signature_url) URL.revokeObjectURL(optimisticStudent.signature_url)
        // Reload to get accurate stats and QR (poll as QR generates in background)
        setTimeout(() => loadStudents(), 2000)
        setTimeout(() => loadStudents(), 5000)
      },
      onError: (err) => {
        setManualMsg({ ok: false, text: err.message || 'Could not add student.' })
      },
      jobsApi: bgJobs,
      toast,
      type: 'create',
    })
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

  // ── Optimistic: edit save ──
  async function handleEditSave(e) {
    e.preventDefault()

    const studentId = editStudent.student_id
    const prevStudent = { ...editStudent }
    const prevStudents = [...students]
    const formSnapshot = { ...editForm }
    const removePhotoFlag = editRemovePhoto && !editPhoto
    const removeSigFlag = editRemoveSig && !editSig

    // Build optimistic updated student
    const optimisticUpdated = {
      ...editStudent,
      full_name: formSnapshot.full_name,
      year_level: formSnapshot.year_level,
      position: formSnapshot.position || null,
      programme: formSnapshot.programme || null,
      blood_type: formSnapshot.blood_type || null,
      student_email: formSnapshot.student_email || null,
      emergency_contact_name: formSnapshot.emergency_contact_name || null,
      emergency_contact_phone: formSnapshot.emergency_contact_phone || null,
      date_of_birth: formSnapshot.date_of_birth || null,
      nationality: formSnapshot.nationality || null,
      county_of_origin: formSnapshot.county_of_origin || null,
      current_address: formSnapshot.current_address || null,
      photo_url: removePhotoFlag ? null : editPhoto ? URL.createObjectURL(editPhoto) : editStudent.photo_url,
      signature_url: removeSigFlag ? null : editSig ? URL.createObjectURL(editSig) : editStudent.signature_url,
      status: 'pending',
      _optimistic: true,
    }

    // Optimistic: update list immediately and close modal
    setStudents((prev) => prev.map((s) => (s.student_id === studentId ? optimisticUpdated : s)))
    setEditStudent(null)
    toast.info(`Updating ${formSnapshot.full_name} — syncing...`)

    runOptimistic({
      label: `Update ${formSnapshot.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setStudents(prevStudents)
        setEditStudent(prevStudent)
        toast.error('Update failed — reverted')
      },
      action: async () => {
        const form = new FormData()
        form.append('full_name', formSnapshot.full_name)
        form.append('year_level', formSnapshot.year_level)
        form.append('position', formSnapshot.position || '')
        form.append('programme', formSnapshot.programme || '')
        form.append('blood_type', formSnapshot.blood_type || '')
        form.append('student_email', formSnapshot.student_email || '')
        form.append('emergency_contact_name', formSnapshot.emergency_contact_name || '')
        form.append('emergency_contact_phone', formSnapshot.emergency_contact_phone || '')
        form.append('date_of_birth', formSnapshot.date_of_birth || '')
        form.append('nationality', formSnapshot.nationality || '')
        form.append('county_of_origin', formSnapshot.county_of_origin || '')
        form.append('current_address', formSnapshot.current_address || '')
        if (editPhoto) form.append('photo', editPhoto)
        if (editSig) form.append('signature', editSig)
        if (removePhotoFlag) form.append('remove_photo', '1')
        if (removeSigFlag) form.append('remove_signature', '1')
        const res = await adminForm(
          `/api/students/${encodeURIComponent(studentId)}`,
          'PATCH',
          form,
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Update failed.')
        return data
      },
      onSuccess: (data) => {
        setStudents((prev) => prev.map((s) => (s.student_id === data.student_id ? { ...s, ...data } : s)))
        // Clean up object URLs
        if (optimisticUpdated.photo_url && optimisticUpdated.photo_url.startsWith('blob:')) {
          URL.revokeObjectURL(optimisticUpdated.photo_url)
        }
        if (optimisticUpdated.signature_url && optimisticUpdated.signature_url.startsWith('blob:')) {
          URL.revokeObjectURL(optimisticUpdated.signature_url)
        }
        // QR regeneration is background — poll for updated QR
        setTimeout(() => loadStudents(), 2000)
        setTimeout(() => loadStudents(), 6000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'update',
    })
  }

  // ── Optimistic: generate single QR ──
  async function handleGenerateQR(studentId) {
    const prevStudents = [...students]
    // Optimistic: mark as generating immediately
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, qr_url: s.qr_url || 'generating', _qrGenerating: true } : s))
    )

    runOptimistic({
      label: `Generate QR for ${studentId}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setStudents(prevStudents)
      },
      action: async () => {
        const res = await adminFetch(`/api/qr/generate/${encodeURIComponent(studentId)}`, {
          method: 'POST',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'QR generation failed')
        }
        return res.json()
      },
      onSuccess: (data) => {
        if (data.queued || data.background) {
          // Backend queued — keep spinner and poll for real QR
          toast.info(`QR generation queued for ${studentId} — background processing`)
          setTimeout(() => loadStudents(), 2000)
          setTimeout(() => loadStudents(), 5000)
          setTimeout(() => loadStudents(), 10000)
          return
        }
        setStudents((prev) =>
          prev.map((s) => (s.student_id === studentId ? { ...s, qr_url: data.qr_url, _qrGenerating: false } : s))
        )
        loadStudents()
      },
      jobsApi: bgJobs,
      toast,
      type: 'qr',
    })

    return true
  }

  // ── Optimistic: regenerate single QR ──
  async function handleRegenerateQR(studentId) {
    const prevStudents = [...students]
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, _qrGenerating: true } : s))
    )

    runOptimistic({
      label: `Regenerate QR for ${studentId}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setStudents(prevStudents)
      },
      action: async () => {
        const res = await adminFetch(`/api/qr/regenerate/${encodeURIComponent(studentId)}`, {
          method: 'POST',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'QR regeneration failed')
        }
        return res.json()
      },
      onSuccess: (data) => {
        if (data.queued || data.background) {
          toast.info(`QR regeneration queued for ${studentId} — background processing`)
          setTimeout(() => loadStudents(), 2000)
          setTimeout(() => loadStudents(), 5000)
          setTimeout(() => loadStudents(), 10000)
          return
        }
        setStudents((prev) =>
          prev.map((s) => (s.student_id === studentId ? { ...s, qr_url: data.qr_url, _qrGenerating: false } : s))
        )
        loadStudents()
      },
      jobsApi: bgJobs,
      toast,
      type: 'qr',
    })

    return true
  }

  // ── Optimistic: generate all QR ──
  async function handleGenerateAllQR() {
    setQrMsg({ ok: true, text: 'Generating missing QR codes in background — you can continue working.' })
    toast.info('Generating QR codes in background...')

    const job = createJob({ label: 'Generate missing QR codes', type: 'qr' })
    bgJobs.addJob(job)

    try {
      const res = await adminFetch('/api/qr/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed.')

      // Handle both immediate and queued responses
      if (data.queued) {
        setQrMsg({
          ok: true,
          text: `${data.queued} QR codes queued for generation in background.`,
        })
        bgJobs.updateJob(job.id, { status: 'success' })
        setTimeout(() => bgJobs.removeJob(job.id), 3000)
        // Poll for completion
        setTimeout(() => loadStudents(), 3000)
        setTimeout(() => loadStudents(), 8000)
      } else {
        setQrMsg({
          ok: true,
          text: `Generated ${data.generated} QR codes.${data.failed ? ` ${data.failed} failed.` : ''}`,
        })
        bgJobs.updateJob(job.id, { status: 'success' })
        setTimeout(() => bgJobs.removeJob(job.id), 3000)
        loadStudents()
      }
      setTimeout(() => setQrMsg(null), 5000)
    } catch (err) {
      setQrMsg({ ok: false, text: err.message || 'Network error.' })
      bgJobs.updateJob(job.id, { status: 'error', error: err.message })
      setTimeout(() => bgJobs.removeJob(job.id), 5000)
      setTimeout(() => setQrMsg(null), 5000)
    }
  }

  function handleRegenerateAllQR() {
    setQrRegenerateAcknowledged(false)
    setQrRegenerateModalOpen(true)
  }

  // ── Optimistic: regenerate all QR ──
  async function confirmRegenerateAllQR() {
    setQrRegenerateModalOpen(false)
    setQrMsg({ ok: true, text: 'Regenerating all QR codes in background — you can continue working.' })
    toast.info('Regenerating all QR codes in background...')

    const job = createJob({ label: `Regenerate all QR codes (${students.length} records)`, type: 'qr' })
    bgJobs.addJob(job)

    try {
      const res = await adminFetch('/api/qr/regenerate-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Regeneration failed.')

      if (data.queued) {
        setQrMsg({
          ok: true,
          text: `${data.queued} QR codes queued for regeneration in background.`,
        })
        bgJobs.updateJob(job.id, { status: 'success' })
        setTimeout(() => bgJobs.removeJob(job.id), 3000)
        setTimeout(() => loadStudents(), 3000)
        setTimeout(() => loadStudents(), 8000)
      } else {
        setQrMsg({
          ok: true,
          text: `Regenerated ${data.generated} QR codes.${data.failed ? ` ${data.failed} failed.` : ''}`,
        })
        bgJobs.updateJob(job.id, { status: 'success' })
        setTimeout(() => bgJobs.removeJob(job.id), 3000)
        loadStudents()
      }
      setTimeout(() => setQrMsg(null), 6000)
    } catch (err) {
      setQrMsg({ ok: false, text: err.message || 'Network error.' })
      bgJobs.updateJob(job.id, { status: 'error', error: err.message })
      setTimeout(() => bgJobs.removeJob(job.id), 5000)
      setTimeout(() => setQrMsg(null), 6000)
    }
  }

  // ── Optimistic: toggle submission form ──
  async function handleToggleSubmissionForm() {
    const newState = !submissionFormEnabled
    const prevState = submissionFormEnabled

    // Optimistic: toggle immediately
    setSubmissionFormEnabled(newState)
    setSubmissionMsg({
      ok: true,
      text: newState ? 'Form enabled — syncing...' : 'Form disabled — syncing...',
    })

    runOptimistic({
      label: newState ? 'Enable submission form' : 'Disable submission form',
      optimisticUpdate: () => {},
      rollback: () => {
        setSubmissionFormEnabled(prevState)
        setSubmissionMsg({ ok: false, text: 'Failed to update — reverted' })
      },
      action: async () => {
        const res = await adminJson('/api/settings/submission-form', 'PUT', { enabled: newState })
        if (!res.ok) throw new Error('Failed to update form settings.')
        return res.json()
      },
      onSuccess: () => {
        setSubmissionMsg({
          ok: true,
          text: newState ? 'Form enabled. Share the link with students.' : 'Form disabled.',
        })
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      onError: () => {
        setSubmissionMsg({ ok: false, text: 'Failed to update form settings.' })
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'save',
    })
  }

  // ── Optimistic: approve submission ──
  async function handleApproveSubmission(id) {
    const submission = submissions.find((s) => s.id === id)
    if (!submission) return

    const prevSubmissions = [...submissions]
    const prevStudents = [...students]

    // Optimistic: remove from pending list immediately and add student placeholder
    const optimisticStudent = {
      id: `temp_${Date.now()}`,
      student_id: submission.student_id,
      full_name: submission.full_name,
      year_level: submission.year_level,
      position: submission.position || null,
      programme: submission.programme || null,
      blood_type: submission.blood_type || null,
      student_email: submission.student_email || null,
      emergency_contact_name: submission.emergency_contact_name || null,
      emergency_contact_phone: submission.emergency_contact_phone || null,
      date_of_birth: submission.date_of_birth || null,
      nationality: submission.nationality || null,
      county_of_origin: submission.county_of_origin || null,
      current_address: submission.current_address || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      _optimistic: true,
    }

    setSubmissions((prev) => prev.filter((s) => s.id !== id))
    setStudents((prev) => [optimisticStudent, ...prev])
    setSubmissionMsg({ ok: true, text: `Approving ${submission.full_name} — syncing...` })
    toast.info(`Approving ${submission.full_name} in background...`)

    runOptimistic({
      label: `Approve submission ${submission.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setSubmissions(prevSubmissions)
        setStudents(prevStudents)
        setSubmissionMsg({ ok: false, text: 'Approval failed — reverted' })
      },
      action: async () => {
        const res = await adminFetch(`/api/submissions/${id}/approve`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Approval failed.')
        return data
      },
      onSuccess: (data) => {
        const msg = data.name_warning
          ? { ok: true, text: 'Student approved. ' + data.name_warning, warn: true }
          : { ok: true, text: 'Student approved and record created.' }
        setSubmissionMsg(msg)
        // Replace optimistic student with real one
        if (data.student) {
          setStudents((prev) => prev.map((s) => (s.id === optimisticStudent.id ? data.student : s)))
        }
        loadStudents()
        setTimeout(() => setSubmissionMsg(null), 5000)
      },
      onError: (err) => {
        setSubmissionMsg({ ok: false, text: err.message || 'Approval failed.' })
        setTimeout(() => setSubmissionMsg(null), 5000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'approve',
    })
  }

  function handleRejectSubmission(submission) {
    setPendingRejectSubmission(submission)
    setRejectNotes('')
  }

  // ── Optimistic: reject submission ──
  async function confirmRejectSubmission() {
    if (!pendingRejectSubmission) return

    const submission = pendingRejectSubmission
    const prevSubmissions = [...submissions]

    // Optimistic: update status immediately and close modal
    setSubmissions((prev) =>
      prev.map((s) => (s.id === submission.id ? { ...s, status: 'rejected', admin_notes: rejectNotes || '' } : s))
    )
    setPendingRejectSubmission(null)
    setRejectNotes('')
    setSubmissionMsg({ ok: true, text: `Rejecting ${submission.full_name} — syncing...` })

    runOptimistic({
      label: `Reject submission ${submission.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setSubmissions(prevSubmissions)
        setPendingRejectSubmission(submission)
        setSubmissionMsg({ ok: false, text: 'Rejection failed — reverted' })
      },
      action: async () => {
        const res = await adminJson(`/api/submissions/${submission.id}/reject`, 'PATCH', {
          admin_notes: rejectNotes || '',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Rejection failed.')
        return data
      },
      onSuccess: () => {
        setSubmissionMsg({ ok: true, text: 'Submission rejected.' })
        loadSubmissions()
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      onError: (err) => {
        setSubmissionMsg({ ok: false, text: err.message || 'Rejection failed.' })
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'reject',
    })
  }

  function handleDeleteSubmission(submission) {
    setPendingDeleteSubmission(submission)
  }

  // ── Optimistic: delete submission (already optimistic, enhanced with jobs) ──
  async function confirmDeleteSubmission() {
    if (!pendingDeleteSubmission) return
    const submission = pendingDeleteSubmission
    const prevSubmissions = submissions

    // Optimistic: remove immediately
    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
    setPendingDeleteSubmission(null)
    setSubmissionMsg({ ok: true, text: `Deleting submission — syncing...` })

    runOptimistic({
      label: `Delete submission ${submission.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setSubmissions(prevSubmissions)
        setSubmissionMsg({ ok: false, text: 'Failed to delete — reverted' })
      },
      action: async () => {
        const res = await adminFetch(`/api/submissions/${submission.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete submission.')
        return true
      },
      onSuccess: () => {
        setSubmissionMsg({ ok: true, text: 'Submission deleted.' })
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      onError: () => {
        setSubmissionMsg({ ok: false, text: 'Failed to delete submission.' })
        setTimeout(() => setSubmissionMsg(null), 3000)
      },
      jobsApi: bgJobs,
      toast,
      type: 'delete',
    })
  }

  function handleDeleteStudent(student) {
    setPendingDeleteStudent(student)
  }

  // ── Optimistic: delete student ──
  async function confirmDeleteStudent() {
    if (!pendingDeleteStudent) return
    const student = pendingDeleteStudent
    const prevStudents = [...students]

    // Optimistic: remove immediately and close modal
    setStudents((prev) => prev.filter((s) => s.student_id !== student.student_id))
    setStats((prev) => ({
      total: Math.max(0, prev.total - 1),
      confirmed: student.status === 'confirmed' ? Math.max(0, prev.confirmed - 1) : prev.confirmed,
      pending: ['pending', 'self_corrected'].includes(student.status) ? Math.max(0, prev.pending - 1) : prev.pending,
      issues: ['issue', 'photo_issue'].includes(student.status) ? Math.max(0, prev.issues - 1) : prev.issues,
    }))
    setPendingDeleteStudent(null)
    toast.info(`Deleting ${student.full_name} — syncing...`)

    runOptimistic({
      label: `Delete student ${student.full_name}`,
      optimisticUpdate: () => {},
      rollback: () => {
        setStudents(prevStudents)
        setStats({
          total: prevStudents.length,
          confirmed: prevStudents.filter((s) => s.status === 'confirmed').length,
          pending: prevStudents.filter((s) => ['pending', 'self_corrected'].includes(s.status)).length,
          issues: prevStudents.filter((s) => ['issue', 'photo_issue'].includes(s.status)).length,
        })
        toast.error('Delete failed — reverted')
      },
      action: async () => {
        const res = await adminFetch(
          `/api/students/${encodeURIComponent(student.student_id)}`,
          { method: 'DELETE' },
        )
        if (!res.ok) throw new Error('Failed to delete student.')
        return true
      },
      onSuccess: () => {
        loadStudents()
      },
      jobsApi: bgJobs,
      toast,
      type: 'delete',
    })
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

  const dashboard = {
    PAGE_SIZE,
    activeTemplateBack,
    activeTemplateFront,
    analyticsData,
    bgJobs,
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
            {bgJobs.hasPending && (
              <span style={{ marginLeft: '12px', color: '#60A5FA', fontSize: '11px' }}>
                ● {bgJobs.pendingCount} syncing in background
              </span>
            )}
          </div>
        </div>
        <div className="u-flex u-ai-center u-gap-8">
          <NotificationCenter
            onNavigateStudent={(studentId, _type) => {
              setStatusFilter('issues')
              setActiveTab('students')
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
        <AdminNav
          tabs={ADMIN_TABS}
          activeTab={activeTab}
          onSelect={selectTab}
          userRole={userRole}
          onNavigate={navigate}
        />

      <main className="admin-body" id="admin-tabpanel" role="tabpanel" tabIndex={-1}>
        <DashboardProvider value={dashboard}>
        {activeTab === 'overview' && (
          <OverviewTab />
        )}
        {activeTab === 'upload' && (
          <UploadTab />
        )}
        {activeTab === 'layout' && (
          <LayoutTab />
        )}
        {activeTab === 'submissions' && (
          <SubmissionsTab />
        )}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
        {activeTab === 'students' && (
          <StudentsTab />
        )}
        </DashboardProvider>
      </main>
      </div>

      <BackgroundJobsIndicator jobs={bgJobs.jobs} onClear={bgJobs.clearJobs} />
      <SessionTimeout />
    </div>
  )
}
