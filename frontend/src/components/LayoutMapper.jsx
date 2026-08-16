import { useState, useEffect, useRef, useCallback } from 'react'
import { detectZonesFromImage } from '../lib/detectZones'
import CardCanvas from './CardCanvas'
import Panel from './Panel'
import {
  CALIBRATED_LAYOUT_FRONT,
  CALIBRATED_LAYOUT_BACK,
  EST_CHARS,
  VALID_LAYOUT_FIELDS,
} from '../lib/layoutConstants'

const DISPLAY_W = 260

// Placeholder data for the live preview panel — never real student data.
const PREVIEW_STUDENT = {
  full_name: 'Jane K. Doe',
  student_id: 'AMD-2024-0001',
  year_level: '3rd Year',
  position: 'Class President',
  blood_type: 'O+',
  emergency_contact_phone: '+231 77 000 0000',
  issue_date: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
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

const IMAGE_FIELDS = ['photo', 'qr', 'signature']

// Build a proposed layout from detected zones using canonical heuristics.
// Returns { layout, rows } where rows describe the field→zone mapping for the
// Auto-Map preview dialog. Mirrors backend/utils/detectZones.js generateSuggestedLayout.
function buildSuggestedLayout(zones, side, imgSize) {
  if (!zones || zones.length === 0) return null
  const aspect = imgSize.height / imgSize.width
  const charEstimates = {
    full_name: 18, student_id: 16, year_level: 14, position: 20,
    blood_type: 6, emergency_contact_phone: 12, issue_date: 10, valid_until: 10,
    signature: 20,
  }
  const sorted = zones
    .map((z, i) => ({ ...z, area: z.width * z.height, zoneIndex: i }))
    .sort((a, b) => b.area - a.area)

  const layout = {}
  const rows = []
  const used = new Set()

  const placeImage = (z, field) => {
    // Image fields render from their top-left corner in CardCanvas, so store
    // the box's top-left (not its center) to match drag/snap behavior.
    layout[field] = {
      type: 'image',
      x: z.left,
      y: z.top,
      width: z.width,
      height: z.height,
    }
    rows.push({ field, label: FIELD_META[field].label, zone: z.zoneIndex + 1 })
  }
  const placeText = (z, field) => {
    const chars = charEstimates[field] || 12
    const fontSize = Math.min(z.width / (chars * 0.62), z.height * aspect * 0.8, 0.12)
    layout[field] = {
      type: 'text',
      x: z.left + z.width / 2,
      y: z.top + z.height / 2,
      fontSize,
      textAlign: 'center',
      maxWidth: z.width,
      color: '#1A1A1A',
      bold: field === 'full_name' || field === 'position' || field === 'blood_type',
    }
    rows.push({ field, label: FIELD_META[field].label, zone: z.zoneIndex + 1 })
  }

  if (side === 'front') {
    if (sorted[0]) { placeImage(sorted[0], 'photo'); used.add(0) }
    let qrIdx = -1
    for (let i = 1; i < sorted.length; i++) {
      const z = sorted[i]
      const a = z.width / z.height
      if (a > 0.7 && a < 1.4 && z.top > 0.6 && z.area < 0.1) { qrIdx = i; break }
    }
    if (qrIdx >= 0) { placeImage(sorted[qrIdx], 'qr'); used.add(qrIdx) }
    const textFields = ['full_name', 'student_id', 'position', 'year_level', 'signature']
    const remaining = sorted
      .map((z, i) => ({ ...z, origIdx: i }))
      .filter((z) => !used.has(z.origIdx))
      .sort((a, b) => a.top - b.top)
    remaining.forEach((z, i) => {
      if (textFields[i]) placeText(z, textFields[i])
    })
  } else {
    if (sorted[0]) { placeImage(sorted[0], 'qr'); used.add(0) }
    const textFields = ['blood_type', 'emergency_contact_phone', 'issue_date', 'valid_until']
    const remaining = sorted
      .map((z, i) => ({ ...z, origIdx: i }))
      .filter((z) => !used.has(z.origIdx))
      .sort((a, b) => a.top - b.top)
    remaining.forEach((z, i) => {
      if (textFields[i]) placeText(z, textFields[i])
    })
  }

  return { layout, rows }
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
  const [activeZone, setActiveZone] = useState(null)
  const [autoMap, setAutoMap] = useState(null) // { side, layout, rows }
  const [fieldSidesOpen, setFieldSidesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [revertingId, setRevertingId] = useState(null)
  const containerRef = useRef(null)

  // Editing aids
  const [showGrid, setShowGrid] = useState(false)
  const [snapGrid, setSnapGrid] = useState(false)
  const [zoom, setZoom] = useState(1)
  const GRID_STEP = 0.05

  const templateUrl = side === 'front' ? templateUrlFront : templateUrlBack
  const layout = side === 'front' ? frontLayout : backLayout
  const setLayout = side === 'front' ? setFrontLayout : setBackLayout
  const defaultLayout = side === 'front' ? CALIBRATED_LAYOUT_FRONT : CALIBRATED_LAYOUT_BACK
  const resolvedSuggested = side === 'front' ? suggestedLayoutFront : suggestedLayoutBack

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
        .catch(() => {
          /* detection failed — fields can still be dragged manually */
        })
        .finally(() => {
          if (!cancelled) setZonesLoading(false)
        })
    }
    img.onerror = () => {
      if (!cancelled) setZonesLoading(false)
    }
    img.src = templateUrl
    return () => {
      cancelled = true
    }
  }, [templateUrl])

  // Fields assigned to the current side
  const sideFields = LAYOUT_FIELD_ORDER.filter(
    (f) => fieldSides[f] === side || fieldSides[f] === 'both',
  )
  const activeFields = sideFields.filter(
    (k) => k === 'qr' || enabledFields?.[k]?.enabled !== false,
  )

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
          x: Math.max(0, Math.min(0.92, nx)),
          y: Math.max(0, Math.min(0.95, ny)),
        },
      }))
    },
    [dragging, setLayout],
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

  // ── Nudge a field by a small step (snaps to grid when enabled) ──
  function nudge(field, dx, dy) {
    const step = snapGrid ? GRID_STEP : 0.01
    setLayout((prev) => {
      const cur = prev[field] || {}
      return {
        ...prev,
        [field]: {
          ...cur,
          x: Math.max(0, Math.min(0.92, (cur.x ?? 0) + dx * step)),
          y: Math.max(0, Math.min(0.95, (cur.y ?? 0) + dy * step)),
        },
      }
    })
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
      setMsg({ ok: true, text: '✓ Layout saved — live for students now.' })
      if (historyOpen) loadHistory()
    } catch {
      setMsg({ ok: false, text: 'Failed to save layout.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
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
      setMsg({ ok: true, text: `✓ Reverted to ${new Date(entry.created_at).toLocaleString()}` })
      loadHistory()
    } catch {
      setMsg({ ok: false, text: 'Failed to revert.' })
    } finally {
      setRevertingId(null)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  // ── Snap a field into a detected template box ──
  function snapFieldToZone(field, zone) {
    const isImage = IMAGE_FIELDS.includes(field)
    if (isImage) {
      setLayout((prev) => ({
        ...prev,
        [field]: {
          ...prev[field],
          type: 'image',
          x: zone.left,
          y: zone.top,
          width: zone.width,
          height: zone.height,
        },
      }))
      return
    }
    const aspect = imgSize.height / imgSize.width
    const chars = EST_CHARS[field] || 12
    const fontSize = Math.min(zone.width / (chars * 0.62), zone.height * aspect * 0.8, 0.12)
    const y = zone.top + zone.height / 2
    setLayout((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        type: 'text',
        x: zone.left + zone.width / 2,
        y,
        fontSize,
        textAlign: 'center',
        maxWidth: zone.width,
        color: prev[field]?.color || '#1A1A1A',
        bold: prev[field]?.bold ?? false,
      },
    }))
  }

  // ── Field-side assignment ──
  function assignSide(field, newSide) {
    const next = { ...fieldSides, [field]: newSide }
    setFieldSides(next)
    // Deselect if the field no longer belongs to this side
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
      setMsg({ ok: false, text: 'No suggested layout available. Detect zones first or upload a template.' })
      setTimeout(() => setMsg(null), 2500)
      return
    }
    setAutoMap({ side, layout: proposed, rows })
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

  function switchSide(next) {
    setSide(next)
    setSelected(null)
    setActiveZone(null)
    setAutoMap(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Toolbar ── */}
      <div className="layout-toolbar">
        <div className="layout-side-toggle">
          <button
            className={`mode-btn ${side === 'front' ? 'active' : ''}`}
            onClick={() => switchSide('front')}
          >
            🎨 Front
          </button>
          <button
            className={`mode-btn ${side === 'back' ? 'active' : ''}`}
            onClick={() => switchSide('back')}
          >
            🔙 Back
          </button>
        </div>
        <span
          className="layout-template-name"
          title={side === 'front' ? templateNameFront : templateNameBack}
        >
          {side === 'front' ? templateNameFront || 'Front template' : templateNameBack || 'Back template'}
        </span>
        <div className="layout-actions">
          <button className="btn-outline" onClick={openAutoMap}>
            ✨ Auto-Map
          </button>
          <button
            className="btn-outline"
            onClick={() => {
              setLayout({ ...defaultLayout })
              setSelected(null)
            }}
          >
            Reset
          </button>
          <button className="btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={msg.ok ? 'success-box' : 'error-box'} style={{ fontSize: '12px' }}>
          {msg.text}
        </div>
      )}

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
            style={{
              fontSize: '11px',
              lineHeight: '1.5',
              marginBottom: '8px',
              color: zonesLoading
                ? 'var(--muted)'
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
              : zones.length > 0
                ? `Detected ${zones.length} template box${zones.length === 1 ? '' : 'es'}. Click a blue box, then choose a field to snap it in place.`
                : 'No field boxes detected. Drag each field to its spot — text centers itself on the drop point.'}
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
                title={`Template box ${i + 1} — click to assign a field`}
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
              const anchorTop = isImg || align !== 'center' ? pos.y : pos.y - chipH / 2

              return (
                <div
                  key={field}
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
                    borderRadius: '3px',
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
              <div
                key={f}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                onClick={() => setSelected(f)}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: FIELD_META[f].color,
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{FIELD_META[f].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="layout-panel-col" style={{ flex: 1, minWidth: '200px' }}>
          {/* Field-side assignment */}
          <Panel
            icon="🧩"
            title="Field sides"
            collapsible
            open={fieldSidesOpen}
            onToggle={() => setFieldSidesOpen((v) => !v)}
          >
            {fieldSidesOpen && (
              <>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.5' }}>
                  Choose which side each field is printed on.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {LAYOUT_FIELD_ORDER.map((f) => (
                    <div
                      key={f}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '2px',
                            background: FIELD_META[f].color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text)' }}>{FIELD_META[f].label}</span>
                      </div>
                      <select
                        className="field-input"
                        value={fieldSides[f] || 'front'}
                        onChange={(e) => assignSide(f, e.target.value)}
                        style={{ fontSize: '11px', padding: '4px 6px', flexShrink: 0 }}
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {/* Version history */}
          {onLoadLayoutHistory && (
            <Panel
              icon="🕑"
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
            <Panel icon="📐" title={`Snap to template box #${activeZone + 1}`}>
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
            <Panel icon="⚙️" title={selMeta.label}>
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
                <button type="button" className="nudge-btn" onClick={() => nudge(selected, 0, -1)} aria-label="Nudge up">↑</button>
                <button type="button" className="nudge-btn" onClick={() => nudge(selected, -1, 0)} aria-label="Nudge left">←</button>
                <button type="button" className="nudge-btn" onClick={() => nudge(selected, 1, 0)} aria-label="Nudge right">→</button>
                <button type="button" className="nudge-btn" onClick={() => nudge(selected, 0, 1)} aria-label="Nudge down">↓</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="field-group">
                  <label className="field-label">X pos (%)</label>
                  <input
                    type="number"
                    className="field-input"
                    style={{ fontSize: '12px', padding: '5px 8px' }}
                    min="0"
                    max="95"
                    step="1"
                    value={Math.round(sel.x * 100)}
                    onChange={(e) => set(selected, 'x', parseFloat(e.target.value) / 100)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Y pos (%)</label>
                  <input
                    type="number"
                    className="field-input"
                    style={{ fontSize: '12px', padding: '5px 8px' }}
                    min="0"
                    max="95"
                    step="1"
                    value={Math.round(sel.y * 100)}
                    onChange={(e) => set(selected, 'y', parseFloat(e.target.value) / 100)}
                  />
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
                        step="1"
                        value={Math.round(sel.width * 100)}
                        onChange={(e) => set(selected, 'width', parseFloat(e.target.value) / 100)}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Height (%)</label>
                      <input
                        type="number"
                        className="field-input"
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                        min="5"
                        max="95"
                        step="1"
                        value={Math.round(sel.height * 100)}
                        onChange={(e) => set(selected, 'height', parseFloat(e.target.value) / 100)}
                      />
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
            <Panel icon="👆" title="No field selected">
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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
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
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
              Auto-Map {autoMap.side} layout
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px', lineHeight: '1.5' }}>
              Proposed field positions from detected template boxes. Confirm to apply, or close to keep your current layout.
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
    </div>
  )
}
