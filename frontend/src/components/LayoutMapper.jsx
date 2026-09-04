import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { detectZonesFromImage } from '../lib/detectZones'
import CardCanvas from './CardCanvas'
import Panel from './Panel'
import ConfirmDialog from './ConfirmDialog'
import {
  CALIBRATED_LAYOUT_FRONT,
  CALIBRATED_LAYOUT_BACK,
  VALID_LAYOUT_FIELDS,
  cardDimensionsMm,
} from '../lib/layoutConstants'
import {
  imagePlacementForZone,
  isImageField,
  suggestLayout,
  textPlacementForZone,
} from '../lib/layoutMath'
import { SAMPLE_PHOTO_URL, SAMPLE_QR_URL, SAMPLE_SIGNATURE_URL } from '../lib/previewAssets'

const DISPLAY_W = 260

// Placeholder data for the live preview panel — never real student data.
// The three asset URLs are bundled sample graphics (see lib/previewAssets):
// without them CardCanvas silently skips photo, signature and QR, leaving the
// preview blind for exactly the fields whose size and clipping matter most.
const PREVIEW_STUDENT = {
  full_name: 'Jane K. Doe',
  student_id: 'AMD-2024-0001',
  year_level: '3rd Year',
  position: 'Class President',
  blood_type: 'O+',
  emergency_contact_phone: '+231 77 000 0000',
  issue_date: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  photo_url: SAMPLE_PHOTO_URL,
  signature_url: SAMPLE_SIGNATURE_URL,
  qr_url: SAMPLE_QR_URL,
}

// All fields that can be positioned on the card, in display order
const LAYOUT_FIELD_ORDER = [
  'photo',
  'full_name',
  'student_id',
  'year_level',
  'position',
  'signature',
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

const FIELD_META = {
  photo: { label: 'Photo', color: '#3B82F6', bg: '#DBEAFE' },
  full_name: { label: 'Name', color: '#22C55E', bg: '#DCFCE7' },
  student_id: { label: 'ID#', color: '#F59E0B', bg: '#FEF3C7' },
  year_level: { label: 'Level', color: '#8B5CF6', bg: '#EDE9FE' },
  position: { label: 'Position', color: '#F43F5E', bg: '#FFE4E6' },
  signature: { label: 'Signature', color: '#14B8A6', bg: '#CCFBF1' },
  qr: { label: 'QR Code', color: '#6B7280', bg: '#F3F4F6' },
  emergency_contact_name: { label: 'Emerg. Name', color: '#EC4899', bg: '#FCE7F3' },
  emergency_contact_phone: { label: 'Emerg. Phone', color: '#EC4899', bg: '#FCE7F3' },
  blood_type: { label: 'Blood Type', color: '#EF4444', bg: '#FEE2E2' },
  programme: { label: 'Programme', color: '#6366F1', bg: '#E0E7FF' },
  date_of_birth: { label: 'DOB', color: '#6366F1', bg: '#E0E7FF' },
  nationality: { label: 'Nationality', color: '#6366F1', bg: '#E0E7FF' },
  county_of_origin: { label: 'County', color: '#6366F1', bg: '#E0E7FF' },
  current_address: { label: 'Address', color: '#6366F1', bg: '#E0E7FF' },
  student_email: { label: 'Email', color: '#6B7280', bg: '#F3F4F6' },
  issue_date: { label: 'Issued', color: '#0EA5E9', bg: '#E0F2FE' },
  valid_until: { label: 'Valid Until', color: '#0EA5E9', bg: '#E0F2FE' },
}

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Sans', value: 'sans-serif' },
]

// One set of movement bounds for every path that can move a field: drag,
// arrow-key nudge, and the numeric X/Y inputs. These previously disagreed —
// drag clamped to 92/95 while the inputs accepted 95/95 — so the same value
// had two ceilings depending on how you set it.
const MAX_X = 0.92
const MAX_Y = 0.95
const COARSE_STEP = 0.01
const FINE_STEP = 0.002

const clampX = (v) => Math.max(0, Math.min(MAX_X, v))
const clampY = (v) => Math.max(0, Math.min(MAX_Y, v))

// Build a proposed layout from detected zones. The heuristics themselves live
// in lib/layoutMath so click-to-snap and Auto-Map resolve a field into a box
// the same way.
function buildSuggestedLayout(zones, side, imgSize) {
  const aspect = imgSize.height / imgSize.width
  return suggestLayout(zones, side, aspect, (field) => FIELD_META[field]?.label || field)
}

export default function LayoutMapper({
  enabledFields,
  templateUrlFront,
  templateUrlBack,
  templateNameFront,
  templateNameBack,
  initialLayout,
  onSave,
  suggestedLayoutFront,
  suggestedLayoutBack,
  onSaveFieldSides,
  fieldSides: initialFieldSides,
  onLoadLayoutHistory,
  onRevertLayout,
}) {
  const [side, setSide] = useState('front') // 'front' | 'back'

  // Field→side assignment (front | back | both). Persisted separately.
  const [fieldSides, setFieldSides] = useState(() => ({
    photo: 'front',
    full_name: 'front',
    student_id: 'front',
    year_level: 'front',
    position: 'front',
    signature: 'front',
    qr: 'both',
    blood_type: 'back',
    emergency_contact_phone: 'back',
    issue_date: 'back',
    valid_until: 'back',
    ...(initialFieldSides || {}),
  }))

  const [frontLayout, setFrontLayout] = useState(() => ({
    ...CALIBRATED_LAYOUT_FRONT,
    ...(initialLayout?.front || initialLayout || {}),
  }))
  const [backLayout, setBackLayout] = useState(() => ({
    ...CALIBRATED_LAYOUT_BACK,
    ...(initialLayout?.back || {}),
  }))

  const [selected, setSelected] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [displayH, setDisplayH] = useState(413)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [zones, setZones] = useState([])
  const [imgSize, setImgSize] = useState({ width: 590, height: 1004 })
  const [zonesLoading, setZonesLoading] = useState(false)
  const [zonesError, setZonesError] = useState(null) // 'load' | 'detect' | null
  const [activeZone, setActiveZone] = useState(null)
  const [autoMap, setAutoMap] = useState(null) // { side, layout, rows }
  // Which side(s) hold edits that have not been saved yet.
  const [dirty, setDirty] = useState({ front: false, back: false })
  // A destructive action staged for confirmation: 'reset' | 'automap' | { switchTo }
  const [pendingAction, setPendingAction] = useState(null)
  const [fieldSidesOpen, setFieldSidesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [revertingId, setRevertingId] = useState(null)
  const containerRef = useRef(null)
  const autoMapDialogRef = useRef(null)

  // Editing aids
  const [showGrid, setShowGrid] = useState(false)
  const [snapGrid, setSnapGrid] = useState(false)
  const [zoom, setZoom] = useState(1)
  const GRID_STEP = 0.05

  const templateUrl = side === 'front' ? templateUrlFront : templateUrlBack
  const layout = side === 'front' ? frontLayout : backLayout
  const setLayoutState = side === 'front' ? setFrontLayout : setBackLayout
  // Every edit routes through here so the side is flagged dirty. Without this
  // an admin could nudge for twenty minutes and lose all of it to Reset, a
  // side switch, or a tab change with no warning — version history only ever
  // holds saved states.
  const setLayout = useCallback(
    (updater) => {
      setLayoutState(updater)
      setDirty((prev) => (prev[side] ? prev : { ...prev, [side]: true }))
    },
    [setLayoutState, side],
  )
  const defaultLayout = side === 'front' ? CALIBRATED_LAYOUT_FRONT : CALIBRATED_LAYOUT_BACK
  const resolvedSuggested = side === 'front' ? suggestedLayoutFront : suggestedLayoutBack
  const hasUnsaved = dirty.front || dirty.back

  // Physical card size derived from the template's own aspect ratio, so the mm
  // readouts stay true whether the template is portrait (LMSA's production
  // card) or landscape. Hardcoding one orientation made every measurement in
  // the property panel wrong by a factor of ~1.59.
  const { widthMm, heightMm } = useMemo(() => cardDimensionsMm(imgSize), [imgSize])

  // Auto-Map is a modal: it takes focus on open and closes on Escape, so a
  // keyboard admin is not trapped behind an overlay they cannot dismiss.
  useEffect(() => {
    if (!autoMap) return undefined
    const previousActive = document.activeElement
    window.setTimeout(() => autoMapDialogRef.current?.focus(), 0)
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAutoMap(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus()
    }
  }, [autoMap])

  // Warn before a browser navigation/refresh discards unsaved layout work.
  useEffect(() => {
    if (!hasUnsaved) return undefined
    function onBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsaved])

  // Re-init field sides once from the persisted prop (when it first arrives or
  // on mount). After that, local state is authoritative so a stale server echo
  // from saveFieldSides can't clobber in-flight edits.
  const sidesInitialized = useRef(false)
  useEffect(() => {
    if (!sidesInitialized.current && initialFieldSides) {
      setFieldSides((prev) => ({ ...prev, ...initialFieldSides }))
      sidesInitialized.current = true
    }
  }, [initialFieldSides])

  // Hydrate from the saved layout once it arrives from the server (mirrors
  // the sidesInitialized pattern above). initialLayout is fetched async in
  // AdminDashboard, so this effect often fires after the mapper has already
  // mounted with the hardcoded defaults in frontLayout/backLayout. Guarding
  // with a ref and spreading the server data LAST means the real saved map
  // wins on that first hydration, instead of the defaults permanently
  // overwriting it. After that, local state is authoritative so in-progress
  // edits survive any later prop update (e.g. the echo after Save).
  // FIX: Reset layoutInitialized when templates change, so layout re-syncs
  // if admin uploads new templates while the mapper is open.
  const layoutInitialized = useRef(false)
  useEffect(() => {
    // Reset when templates change (new upload)
    layoutInitialized.current = false
  }, [templateUrlFront, templateUrlBack])
  useEffect(() => {
    if (layoutInitialized.current || !initialLayout) return
    if (initialLayout.front) {
      setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...prev, ...initialLayout.front }))
    } else if (!initialLayout.back) {
      setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...prev, ...initialLayout }))
    }
    if (initialLayout.back) {
      setBackLayout((prev) => ({ ...CALIBRATED_LAYOUT_BACK, ...prev, ...initialLayout.back }))
    }
    layoutInitialized.current = true
  }, [initialLayout])

  // Calculate display height from template aspect ratio
  useEffect(() => {
    if (!templateUrl) return
    const img = new Image()
    img.onload = () => setDisplayH(Math.round((DISPLAY_W * img.naturalHeight) / img.naturalWidth))
    img.src = templateUrl
  }, [templateUrl])

  // Detect printed boxes on the current template side
  useEffect(() => {
    let cancelled = false
    setZones([])
    setActiveZone(null)
    setZonesError(null)
    if (!templateUrl) return undefined
    setZonesLoading(true)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      detectZonesFromImage(img)
        .then((res) => {
          if (cancelled) return
          setZones(res.zones)
          setImgSize({ width: res.width, height: res.height })
        })
        .catch((err) => {
          // "we could not read your template" and "your template has no boxes"
          // are different problems with different fixes; reporting the first
          // as the second sends admins off re-exporting artwork to work
          // around a missing CORS header.
          if (cancelled) return
          console.warn('[LayoutMapper] zone detection failed:', err?.message)
          setZonesError('detect')
        })
        .finally(() => {
          if (!cancelled) setZonesLoading(false)
        })
    }
    img.onerror = () => {
      if (cancelled) return
      setZonesLoading(false)
      setZonesError('load')
    }
    img.src = templateUrl
    return () => {
      cancelled = true
    }
  }, [templateUrl])

  // Fields assigned to the current side. A field set to 'none' matches
  // neither side, so it drops out of the canvas, the legend, the snap-to-box
  // list, and the property panel without any further filtering.
  const sideFields = LAYOUT_FIELD_ORDER.filter(
    (f) => fieldSides[f] === side || fieldSides[f] === 'both',
  )
  const activeFields = sideFields.filter(
    (k) => k === 'qr' || enabledFields?.[k]?.enabled !== false,
  )
  // Fields the admin has explicitly taken off the card, for the summary line.
  const offFields = LAYOUT_FIELD_ORDER.filter((f) => fieldSides[f] === 'none')

  // ── Drag ──
  function startDrag(e, field) {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    setDragging({
      field,
      startX: e.clientX,
      startY: e.clientY,
      origX: layout[field]?.x ?? 0,
      origY: layout[field]?.y ?? 0,
      cW: rect.width,
      cH: rect.height,
    })
    setSelected(field)
  }

  const onMove = useCallback(
    (e) => {
      if (!dragging) return
      const dx = (e.clientX - dragging.startX) / dragging.cW
      const dy = (e.clientY - dragging.startY) / dragging.cH
      let nx = dragging.origX + dx
      let ny = dragging.origY + dy
      if (snapGrid) {
        nx = Math.round(nx / GRID_STEP) * GRID_STEP
        ny = Math.round(ny / GRID_STEP) * GRID_STEP
      }
      setLayout((prev) => ({
        ...prev,
        [dragging.field]: {
          ...prev[dragging.field],
          x: clampX(nx),
          y: clampY(ny),
        },
      }))
    },
    [dragging, setLayout, snapGrid],
  )

  const onUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onMove, onUp])

  // ── Field property update ──
  function set(field, key, value) {
    setLayout((prev) => ({ ...prev, [field]: { ...prev[field], [key]: value } }))
  }

  // ── Nudge a field by a step (snaps to grid when enabled, fine with Shift) ──
  // Fine is 0.2% ≈ 0.11mm horizontally on the production card, so an admin can
  // close the last hair of a misalignment instead of overshooting by a whole
  // percent in each direction.
  function nudge(field, dx, dy, fine = false) {
    const step = fine ? FINE_STEP : snapGrid ? GRID_STEP : COARSE_STEP
    setLayout((prev) => {
      const cur = prev[field] || {}
      return {
        ...prev,
        [field]: {
          ...cur,
          x: clampX((cur.x ?? 0) + dx * step),
          y: clampY((cur.y ?? 0) + dy * step),
        },
      }
    })
  }

  function handleFieldKeyDown(event, field) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelected(field)
      return
    }

    const moves = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setSelected(field)
    nudge(field, move[0], move[1], event.shiftKey)
  }

  function handleZoneKeyDown(event, index) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setActiveZone(index)
  }

  // ── Save ──
  async function handleSave() {
    // Check: at least one template must be uploaded to save layout
    if (!templateUrlFront && !templateUrlBack) {
      setMsg({ ok: false, text: 'Upload a template (front or back) before saving layout.' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      // Filter out config keys (fontFamily, logoPosition, etc) - keep only valid student fields
      const cleanLayout = (layout) => {
        const cleaned = {}
        Object.entries(layout || {}).forEach(([key, val]) => {
          if (VALID_LAYOUT_FIELDS.has(key)) {
            cleaned[key] = val
          }
        })
        return cleaned
      }

      // Only send layout for sides that have uploaded templates.
      // This prevents saving default/empty layouts for templates that don't exist yet.
      const payload = {}
      if (templateUrlFront) payload.front = cleanLayout(frontLayout)
      if (templateUrlBack) payload.back = cleanLayout(backLayout)
      await onSave(payload)
      // Only the sides actually sent are clean now.
      setDirty((prev) => ({
        front: templateUrlFront ? false : prev.front,
        back: templateUrlBack ? false : prev.back,
      }))
      setMsg({ ok: true, text: 'Layout saved — live for students now.' })
      if (historyOpen) loadHistory()
    } catch (err) {
      // Surface the server's reason instead of collapsing auth, validation and
      // network failures into one unactionable sentence.
      const detail = err?.message && err.message !== 'Save failed' ? ` ${err.message}` : ''
      setMsg({ ok: false, text: `Failed to save layout.${detail} Your changes are still here — try again.` })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 6000)
    }
  }

  // ── Version history ──
  const loadHistory = useCallback(async () => {
    if (!onLoadLayoutHistory) return
    setHistoryLoading(true)
    try {
      setHistory((await onLoadLayoutHistory(side)) || [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [onLoadLayoutHistory, side])

  useEffect(() => {
    if (historyOpen) loadHistory()
  }, [historyOpen, side, loadHistory])

  async function handleRevert(entry) {
    if (!onRevertLayout) return
    setRevertingId(entry.id)
    try {
      const { side: revertedSide, value } = await onRevertLayout(entry.id)
      if (revertedSide === 'front') setFrontLayout({ ...CALIBRATED_LAYOUT_FRONT, ...value })
      else setBackLayout({ ...CALIBRATED_LAYOUT_BACK, ...value })
      // A revert persists server-side, so that side is clean again.
      setDirty((prev) => ({ ...prev, [revertedSide === 'front' ? 'front' : 'back']: false }))
      setMsg({ ok: true, text: `Reverted to ${new Date(entry.created_at).toLocaleString()}` })
      loadHistory()
    } catch (err) {
      const detail = err?.message && err.message !== 'Revert failed' ? ` ${err.message}` : ''
      setMsg({ ok: false, text: `Failed to revert.${detail}` })
    } finally {
      setRevertingId(null)
      setTimeout(() => setMsg(null), 6000)
    }
  }

  // ── Snap a field into a detected template box ──
  function snapFieldToZone(field, zone) {
    if (isImageField(field)) {
      setLayout((prev) => ({
        ...prev,
        [field]: { ...prev[field], ...imagePlacementForZone(zone) },
      }))
      return
    }
    const aspect = imgSize.height / imgSize.width
    setLayout((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        ...textPlacementForZone(zone, field, aspect),
        color: prev[field]?.color || '#1A1A1A',
        bold: prev[field]?.bold ?? false,
      },
    }))
  }

  // ── Field-side assignment ──
  function assignSide(field, newSide) {
    // QR verification is a product guarantee — /qr/:studentId depends on the
    // code being physically on the card — so the QR may move sides but may
    // not be switched off. The server rejects this too.
    if (field === 'qr' && newSide === 'none') {
      setMsg({
        ok: false,
        text: 'The QR code cannot be removed from the card — public verification depends on it.',
      })
      setTimeout(() => setMsg(null), 6000)
      return
    }
    const next = { ...fieldSides, [field]: newSide }
    setFieldSides(next)
    // Deselect if the field no longer belongs to this side (including 'none',
    // where it belongs to no side at all).
    if (selected === field && newSide !== 'both' && newSide !== side) setSelected(null)
    if (onSaveFieldSides) onSaveFieldSides(next)
  }

  // ── Auto-Map ──
  function openAutoMap() {
    let proposed = null
    let rows = []
    if (resolvedSuggested && Object.keys(resolvedSuggested).length > 0) {
      proposed = resolvedSuggested
      rows = Object.keys(resolvedSuggested).map((field) => ({
        field,
        label: FIELD_META[field]?.label || field,
        zone: null,
      }))
    } else {
      const built = buildSuggestedLayout(zones, side, imgSize)
      if (built) {
        proposed = built.layout
        rows = built.rows
      }
    }
    if (!proposed) {
      setMsg({
        ok: false,
        text:
          zonesError
            ? 'No suggested layout available — the template could not be scanned. See the note under the card.'
            : 'No suggested layout available. Upload a template with printed field boxes first.',
      })
      setTimeout(() => setMsg(null), 6000)
      return
    }

    // Never propose a position for a field the admin has taken off the card,
    // or one that belongs to the other side.
    const placeable = new Set(activeFields)
    const filtered = Object.fromEntries(
      Object.entries(proposed).filter(([field]) => placeable.has(field)),
    )
    const filteredRows = rows.filter((r) => placeable.has(r.field))
    if (Object.keys(filtered).length === 0) {
      setMsg({
        ok: false,
        text: `Every field the boxes matched is either on the other side or set to "Not printed", so there is nothing to map on the ${side}.`,
      })
      setTimeout(() => setMsg(null), 6000)
      return
    }

    setAutoMap({ side, layout: filtered, rows: filteredRows })
  }

  function applyAutoMap() {
    if (!autoMap) return
    setLayout((prev) => ({ ...prev, ...autoMap.layout }))
    setAutoMap(null)
    setMsg({ ok: true, text: `Auto-mapped ${Object.keys(autoMap.layout).length} field(s) on ${autoMap.side}.` })
    setTimeout(() => setMsg(null), 2500)
  }

  const sel = selected ? layout[selected] : null
  const selMeta = selected ? FIELD_META[selected] : null

  // Both sides' layouts live in state simultaneously, so switching sides keeps
  // unsaved edits — only the stale status message needs clearing.
  function switchSide(next) {
    setSide(next)
    setSelected(null)
    setActiveZone(null)
    setAutoMap(null)
    setMsg(null)
  }

  function confirmReset() {
    setLayoutState({ ...defaultLayout })
    setDirty((prev) => ({ ...prev, [side]: true }))
    setSelected(null)
    setPendingAction(null)
    setMsg({ ok: true, text: `${side === 'front' ? 'Front' : 'Back'} layout reset to the calibrated default. Save to make it live.` })
    setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Toolbar ── */}
      <div className="layout-toolbar">
        <div className="layout-side-toggle">
          <button
            type="button"
            className={`mode-btn ${side === 'front' ? 'active' : ''}`}
            onClick={() => switchSide('front')}
            aria-pressed={side === 'front'}
          >
            Front
            {dirty.front && (
              <span className="layout-dirty-dot" title="Unsaved changes on the front" aria-hidden="true" />
            )}
            {dirty.front && <span className="sr-only"> — unsaved changes</span>}
          </button>
          <button
            type="button"
            className={`mode-btn ${side === 'back' ? 'active' : ''}`}
            onClick={() => switchSide('back')}
            aria-pressed={side === 'back'}
          >
            Back
            {dirty.back && (
              <span className="layout-dirty-dot" title="Unsaved changes on the back" aria-hidden="true" />
            )}
            {dirty.back && <span className="sr-only"> — unsaved changes</span>}
          </button>
        </div>
        <span
          className="layout-template-name"
          title={side === 'front' ? templateNameFront : templateNameBack}
        >
          {side === 'front' ? templateNameFront || 'Front template' : templateNameBack || 'Back template'}
        </span>
        <div className="layout-actions">
          {hasUnsaved && (
            <span className="layout-unsaved-note">
              Unsaved changes
            </span>
          )}
          <button type="button" className="btn-outline" onClick={openAutoMap}>
            Auto-Map
          </button>
          <button type="button" className="btn-outline" onClick={() => setPendingAction('reset')}>
            Reset
          </button>
          <button
            type="button"
            className={`btn-gold${hasUnsaved ? ' btn-gold--attention' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : hasUnsaved ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>

      {/* Status is announced, not just shown: the banner clears itself, and a
          screen-reader admin would otherwise never learn a save failed. */}
      <div aria-live="polite" role="status">
        {msg && (
          <div className={msg.ok ? 'success-box' : 'error-box'} style={{ fontSize: '12px' }}>
            {msg.text}
          </div>
        )}
      </div>

      <div className="layout-columns">
        {/* ── Left: template editor + its property panel ── */}
        <div className="layout-editor" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', flex: '1 1 480px' }}>
        {/* ── Card preview ── */}
        <div
          className="layout-canvas-col"
          style={{ flexShrink: 0, minWidth: 0, maxWidth: `${DISPLAY_W * zoom + 80}px` }}
        >
          <div className="layout-canvas-controls">
            <label className="layout-ctrl">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                style={{ accentColor: 'var(--gold)' }}
              />
              Grid
            </label>
            <label className="layout-ctrl">
              <input
                type="checkbox"
                checked={snapGrid}
                onChange={(e) => setSnapGrid(e.target.checked)}
                style={{ accentColor: 'var(--gold)' }}
              />
              Snap
            </label>
            <label className="layout-ctrl layout-ctrl--zoom">
              Zoom
              <input
                type="range"
                min="0.6"
                max="1.5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ accentColor: 'var(--gold)' }}
              />
              <span className="layout-zoom-val">{Math.round(zoom * 100)}%</span>
            </label>
          </div>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--muted)',
              marginBottom: '8px',
              lineHeight: '1.5',
              width: '100%',
              maxWidth: `${DISPLAY_W * zoom}px`,
              overflowWrap: 'break-word',
            }}
          >
            Drag each field into its spot on the card — text centers itself on the point where you drop it.
            Click a blue box, then choose a field to snap it in place.
          </p>

          <p
            aria-live="polite"
            style={{
              fontSize: '11px',
              lineHeight: '1.5',
              marginBottom: '8px',
              color: zonesLoading
                ? 'var(--muted)'
                : zonesError
                  ? '#B42318'
                  : zones.length > 0
                    ? 'var(--gold)'
                    : '#B45309',
              width: '100%',
              maxWidth: `${DISPLAY_W * zoom}px`,
              overflowWrap: 'break-word',
            }}
          >
            {zonesLoading
              ? 'Scanning the template for field boxes…'
              : zonesError === 'load'
                ? 'Could not read the template image, so it was not scanned for field boxes. This is usually a storage permission (CORS) problem rather than a problem with the artwork. You can still place every field by dragging.'
                : zonesError === 'detect'
                  ? 'The template loaded but could not be scanned for field boxes. You can still place every field by dragging — nothing is blocked.'
                  : zones.length > 0
                    ? `Detected ${zones.length} template box${zones.length === 1 ? '' : 'es'}. Click a blue box, then choose a field to snap it in place.`
                    : 'Scanned this template and found no printed field boxes. Drag each field to its spot — text centers itself on the drop point.'}
          </p>

          <div
            ref={containerRef}
            className="layout-canvas"
            style={{
              width: `${DISPLAY_W * zoom}px`,
              height: `${displayH * zoom}px`,
              position: 'relative',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#E8E8E8',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {showGrid && (
              <div
                className="layout-grid-overlay"
                aria-hidden="true"
                style={{
                  backgroundSize: `${GRID_STEP * 100}% ${GRID_STEP * 100}%`,
                }}
              />
            )}
            {templateUrl ? (
              <img
                src={templateUrl}
                alt="template"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: 'var(--muted)',
                }}
              >
                No template uploaded
              </div>
            )}

            {zones.map((z, i) => (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className="layout-chip-focus"
                aria-pressed={activeZone === i}
                aria-label={`Template box ${i + 1}: ${(z.width * widthMm).toFixed(0)} by ${(z.height * heightMm).toFixed(0)} millimetres, ${(z.left * widthMm).toFixed(0)} millimetres from the left and ${(z.top * heightMm).toFixed(0)} from the top. Press Enter to assign a field to it.`}
                onKeyDown={(e) => handleZoneKeyDown(e, i)}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setActiveZone(i)
                }}
                style={{
                  position: 'absolute',
                  left: `${z.left * 100}%`,
                  top: `${z.top * 100}%`,
                  width: `${z.width * 100}%`,
                  height: `${z.height * 100}%`,
                  border: activeZone === i ? '2px solid #0EA5E9' : '1.5px dashed #0EA5E9',
                  background: activeZone === i ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.04)',
                  borderRadius: '2px',
                  boxSizing: 'border-box',
                  zIndex: 4,
                  cursor: 'pointer',
                  touchAction: 'none',
                  pointerEvents: 'auto',
                }}
                title={`Template box ${i + 1} — ${(z.width * widthMm).toFixed(0)} × ${(z.height * heightMm).toFixed(0)} mm. Click to assign a field.`}
              />
            ))}

            {activeFields.map((field) => {
              const pos = layout[field] || defaultLayout[field]
              if (!pos) return null
              const { color, bg, label } = FIELD_META[field]
              const isImg = pos.type === 'image'
              const isSel = selected === field
              const align = pos.textAlign || 'left'
              const aspect = imgSize.height / imgSize.width
              const chipW = isImg ? pos.width : pos.maxWidth || 0.3
              const chipH = isImg ? pos.height : (pos.fontSize || 0.04) / aspect
              const anchorLeft =
                isImg || align === 'left' ? pos.x : align === 'right' ? pos.x - chipW : pos.x - chipW / 2
              // CardCanvas draws every text field with textBaseline 'middle',
              // so pos.y is the vertical CENTER of the glyph box for all three
              // alignments — textAlign only affects the horizontal anchor
              // above. Treating pos.y as the chip's top for left/right-aligned
              // text (the default alignment) drew those chips half a
              // line-height below where the card actually prints them.
              const anchorTop = isImg ? pos.y : pos.y - chipH / 2

              return (
                <div
                  key={field}
                  role="button"
                  tabIndex={0}
                  className="layout-chip-focus"
                  aria-pressed={isSel}
                  aria-label={`${label} field at ${(pos.x * widthMm).toFixed(1)} millimetres from the left, ${(pos.y * heightMm).toFixed(1)} from the top. Drag with the pointer, or use arrow keys to nudge and Shift with an arrow key for a fine step.`}
                  onKeyDown={(e) => handleFieldKeyDown(e, field)}
                  onPointerDown={(e) => startDrag(e, field)}
                  style={{
                    position: 'absolute',
                    left: `${anchorLeft * 100}%`,
                    top: `${anchorTop * 100}%`,
                    width: isImg ? `${pos.width * 100}%` : `${chipW * 100}%`,
                    height: isImg ? `${pos.height * 100}%` : `${chipH * 100}%`,
                    minWidth: isImg ? undefined : '34px',
                    background: bg + 'CC',
                    border: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} ${color}`,
                    // CardCanvas traces a CIRCULAR radius of
                    // borderRadius × cardWidth px. A CSS percentage resolves
                    // per-axis and draws an ELLIPSE on any non-square box, so
                    // the editor showed a different curve than it printed.
                    // Same pixel basis, same clamp (half the shorter side).
                    borderRadius: isImg
                      ? `${Math.min(
                          (pos.borderRadius || 0) * DISPLAY_W * zoom,
                          (Math.min(pos.width * DISPLAY_W, pos.height * displayH) * zoom) / 2,
                        )}px`
                      : '3px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                    boxSizing: 'border-box',
                    zIndex: isSel ? 10 : 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: '8px',
                      fontWeight: '700',
                      color,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Field legend */}
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {activeFields.map((f) => (
              <button
                key={f}
                type="button"
                className="layout-legend-chip"
                aria-pressed={selected === f}
                onClick={() => setSelected(f)}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: FIELD_META[f].color,
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{FIELD_META[f].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="layout-panel-col" style={{ flex: 1, minWidth: '200px' }}>
          {/* Field-side assignment */}
          <Panel
            icon="◫"
            title="Field sides"
            collapsible
            open={fieldSidesOpen}
            onToggle={() => setFieldSidesOpen((v) => !v)}
          >
            {fieldSidesOpen && (
              <>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.5' }}>
                  Choose which side each field is printed on. <strong>Not printed</strong> keeps the
                  field in the student&rsquo;s record and in the QR code, but leaves it off the card
                  entirely.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {LAYOUT_FIELD_ORDER.map((f) => {
                    const value = fieldSides[f] || 'front'
                    const isOff = value === 'none'
                    const selectId = `field-side-${f}`
                    return (
                      <div
                        key={f}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                      >
                        <label
                          htmlFor={selectId}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              background: isOff ? 'transparent' : FIELD_META[f].color,
                              border: isOff ? `1px dashed ${FIELD_META[f].color}` : 'none',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '11px',
                              color: isOff ? 'var(--muted)' : 'var(--text)',
                            }}
                          >
                            {FIELD_META[f].label}
                          </span>
                        </label>
                        <select
                          id={selectId}
                          className="field-input"
                          value={value}
                          onChange={(e) => assignSide(f, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 6px', flexShrink: 0 }}
                        >
                          <option value="front">Front</option>
                          <option value="back">Back</option>
                          <option value="both">Both</option>
                          {/* The QR must stay on the card: /qr/:studentId
                              verification depends on it being scannable. */}
                          {f !== 'qr' && <option value="none">Not printed</option>}
                        </select>
                      </div>
                    )
                  })}
                </div>
                {offFields.length > 0 && (
                  <p className="layout-off-summary">
                    Not printed on the card: {offFields.map((f) => FIELD_META[f].label).join(', ')}.
                    {' '}Still stored on the student record.
                  </p>
                )}
              </>
            )}
          </Panel>

          {/* Version history */}
          {onLoadLayoutHistory && (
            <Panel
              icon="↺"
              title="Version history"
              collapsible
              open={historyOpen}
              onToggle={() => setHistoryOpen((v) => !v)}
            >
              {historyOpen && (
                <>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.5' }}>
                    Recent saves for the {side} side. Reverting applies that version and saves it again.
                  </p>
                  {historyLoading ? (
                    <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Loading…</p>
                  ) : history.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No saved versions yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                      {history.map((entry, i) => (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            fontSize: '11px',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--text)' }}>
                              {new Date(entry.created_at).toLocaleString()}
                              {i === 0 && <span style={{ color: 'var(--muted)' }}> (current)</span>}
                            </div>
                            {entry.saved_by_email && (
                              <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {entry.saved_by_email}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn-outline"
                            disabled={i === 0 || revertingId === entry.id}
                            onClick={() => handleRevert(entry)}
                            style={{ fontSize: '10px', padding: '4px 8px', flexShrink: 0 }}
                          >
                            {revertingId === entry.id ? 'Reverting…' : 'Revert'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Panel>
          )}

          {activeZone !== null && zones[activeZone] && (
            <Panel icon="⌗" title={`Snap to template box #${activeZone + 1}`}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0EA5E9',
                  marginBottom: '8px',
                }}
              >
                Snap to template box #{activeZone + 1}
              </div>
              <select
                className="field-input"
                value=""
                onChange={(e) => {
                  const f = e.target.value
                  if (f) snapFieldToZone(f, zones[activeZone])
                  setActiveZone(null)
                }}
              >
                <option value="">Choose a field…</option>
                {activeFields.map((f) => (
                  <option key={f} value={f}>
                    {FIELD_META[f].label}
                  </option>
                ))}
              </select>
              <button
                className="btn-outline"
                onClick={() => setActiveZone(null)}
                style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </Panel>
          )}

          {sel && selMeta ? (
            <Panel icon="◉" title={selMeta.label}>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: selMeta.color,
                    flexShrink: 0,
                  }}
                />
                {side} side
              </div>
              <div className="layout-nudge">
                <span className="layout-nudge-label">Nudge</span>
                <button type="button" className="nudge-btn" onClick={(e) => nudge(selected, 0, -1, e.shiftKey)} aria-label="Nudge up">↑</button>
                <button type="button" className="nudge-btn" onClick={(e) => nudge(selected, -1, 0, e.shiftKey)} aria-label="Nudge left">←</button>
                <button type="button" className="nudge-btn" onClick={(e) => nudge(selected, 1, 0, e.shiftKey)} aria-label="Nudge right">→</button>
                <button type="button" className="nudge-btn" onClick={(e) => nudge(selected, 0, 1, e.shiftKey)} aria-label="Nudge down">↓</button>
              </div>
              <p className="layout-nudge-hint">
                Hold Shift for a fine step ({(FINE_STEP * widthMm).toFixed(2)} mm) instead of{' '}
                {((snapGrid ? GRID_STEP : COARSE_STEP) * widthMm).toFixed(2)} mm. Arrow keys work on a
                selected field too.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="field-group">
                  <label className="field-label">X pos (%)</label>
                  <input
                    type="number"
                    className="field-input"
                    style={{ fontSize: '12px', padding: '5px 8px' }}
                    min="0"
                    max={MAX_X * 100}
                    step="0.1"
                    value={Math.round(sel.x * 1000) / 10}
                    onChange={(e) => set(selected, 'x', clampX(parseFloat(e.target.value) / 100))}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {(sel.x * widthMm).toFixed(1)} mm from left
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Y pos (%)</label>
                  <input
                    type="number"
                    className="field-input"
                    style={{ fontSize: '12px', padding: '5px 8px' }}
                    min="0"
                    max={MAX_Y * 100}
                    step="0.1"
                    value={Math.round(sel.y * 1000) / 10}
                    onChange={(e) => set(selected, 'y', clampY(parseFloat(e.target.value) / 100))}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {(sel.y * heightMm).toFixed(1)} mm from top
                  </div>
                </div>

                {sel.type === 'image' && (
                  <>
                    <div className="field-group">
                      <label className="field-label">Width (%)</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="5"
                        max="95"
                        step="0.1"
                        value={Math.round(sel.width * 1000) / 10}
                        onChange={(e) => set(selected, 'width', parseFloat(e.target.value) / 100)}
                      />
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        {(sel.width * widthMm).toFixed(1)} mm wide
                      </div>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Height (%)</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="5"
                        max="95"
                        step="0.1"
                        value={Math.round(sel.height * 1000) / 10}
                        onChange={(e) => set(selected, 'height', parseFloat(e.target.value) / 100)}
                      />
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        {(sel.height * heightMm).toFixed(1)} mm tall
                      </div>
                    </div>
                    <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="field-label">Corner radius (%)</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="0"
                        max="50"
                        step="0.1"
                        value={Math.round((sel.borderRadius || 0) * 1000) / 10}
                        onChange={(e) => set(selected, 'borderRadius', parseFloat(e.target.value) / 100)}
                      />
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        {selected === 'qr'
                          ? 'Keep this at 0 for the QR code — rounding its corners can reduce scan reliability.'
                          : "Rounds the image's corners to match a rounded template frame — 0 keeps square corners, higher values round more."}
                      </div>
                    </div>
                  </>
                )}

                {sel.type === 'text' && (
                  <>
                    <div className="field-group">
                      <label className="field-label">Font size</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="1"
                        max="12"
                        step="0.5"
                        value={Math.round(sel.fontSize * 1000) / 10}
                        onChange={(e) => set(selected, 'fontSize', parseFloat(e.target.value) / 100)}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Font</label>
                      <select
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        value={sel.fontFamily || 'Arial, sans-serif'}
                        onChange={(e) => set(selected, 'fontFamily', e.target.value)}
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Color</label>
                      <input
                        type="color"
                        value={sel.color || '#000000'}
                        onChange={(e) => set(selected, 'color', e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          padding: '2px',
                          border: '0.5px solid var(--border)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Max Width (%)</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="10"
                        max="100"
                        step="1"
                        value={Math.round((sel.maxWidth || 1) * 100)}
                        onChange={(e) => set(selected, 'maxWidth', parseFloat(e.target.value) / 100)}
                      />
                    </div>
                    <div
                      style={{
                        gridColumn: '1/-1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`bold-${selected}`}
                        checked={sel.bold || false}
                        onChange={(e) => set(selected, 'bold', e.target.checked)}
                        style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                      />
                      <label
                        htmlFor={`bold-${selected}`}
                        style={{ fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}
                      >
                        Bold
                      </label>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="field-label">Text alignment</label>
                      <select
                        className="field-input"
                        value={sel.textAlign || 'left'}
                        onChange={(e) => set(selected, 'textAlign', e.target.value)}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </Panel>
          ) : (
            <Panel icon="◇" title="No field selected">
              <div style={{ fontSize: '12px', color: 'var(--hint)', lineHeight: '1.6' }}>
                Click a colored box on the card to select it, then adjust its position, size, and text
                style here. Use the Front/Back tabs above to edit each side.
              </div>
            </Panel>
          )}
        </div>
        </div>

        {/* ── Right: live preview — exactly what CardCanvas renders for
            students, fed straight from this component's own live state
            so it can never drift from what Save actually persists. ── */}
        <div className="layout-live" style={{ flexShrink: 0 }}>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--muted)',
              marginBottom: '8px',
              lineHeight: '1.5',
            }}
          >
            Live preview — what students see, with sample data. Click it to flip sides.
          </p>
          <CardCanvas
            key={side}
            initialSide={side}
            student={PREVIEW_STUDENT}
            templateUrlFront={templateUrlFront}
            templateUrlBack={templateUrlBack}
            layout={{ front: frontLayout, back: backLayout }}
            fieldSides={fieldSides}
            maxWidth={DISPLAY_W}
          />
        </div>
      </div>

      {/* ── Auto-Map dialog ── */}
      {autoMap && (
        <div
          onClick={() => setAutoMap(null)}
          className="modal-overlay"
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.45)' }}
        >
          <div
            ref={autoMapDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="automap-dialog-title"
            aria-describedby="automap-dialog-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div id="automap-dialog-title" style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
              Auto-Map {autoMap.side} layout
            </div>
            <p id="automap-dialog-desc" style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px', lineHeight: '1.5' }}>
              Proposed field positions from detected template boxes. Applying overwrites the current
              position of every field listed below on the {autoMap.side} side; fields not listed keep
              their positions. Nothing is saved until you press Save.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {autoMap.rows.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No fields could be matched to boxes.</div>
              )}
              {autoMap.rows.map((r) => (
                <div
                  key={r.field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 10px',
                    background: 'var(--bg)',
                    borderRadius: '6px',
                    border: '0.5px solid var(--border)',
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>{r.label}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    {r.zone ? `Box ${r.zone}` : 'template'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" onClick={() => setAutoMap(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn-gold" onClick={applyAutoMap} style={{ flex: 1 }}>
                Apply mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirmation ── Reset discards every position on this side,
          and version history only holds saved states, so an unsaved session's
          work would be unrecoverable. ── */}
      <ConfirmDialog
        open={pendingAction === 'reset'}
        title={`Reset the ${side} layout?`}
        confirmLabel="Reset layout"
        cancelLabel="Keep my layout"
        onConfirm={confirmReset}
        onCancel={() => setPendingAction(null)}
      >
        <p>
          Every field position on the <strong>{side}</strong> side goes back to the calibrated
          default.
          {dirty[side]
            ? ' This side has unsaved changes, and they cannot be recovered afterwards — version history only holds layouts that were saved.'
            : ' The last saved version stays in version history, so you can revert to it.'}
        </p>
        <p>Nothing changes for students until you press Save.</p>
      </ConfirmDialog>
    </div>
  )
}
