import { useState, useEffect, useRef, useCallback } from 'react'
import { detectZonesFromImage } from '../lib/detectZones'
import {
  CALIBRATED_LAYOUT_FRONT,
  CALIBRATED_LAYOUT_BACK,
  FRONT_FIELDS,
  BACK_FIELDS,
  EST_CHARS,
  FRONT_FIELD_ORDER,
  BACK_FIELD_ORDER,
} from '../lib/layoutConstants'

const DISPLAY_W = 260

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

export default function LayoutMapper({ enabledFields, templateUrlFront, templateUrlBack, initialLayout, onSave }) {
  const [side, setSide] = useState('front') // 'front' | 'back'
  
  // Use the correct template URL for the current side
  const templateUrl = side === 'front' ? templateUrlFront : templateUrlBack
  
  // Separate layout state for each side
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
  const containerRef = useRef(null)

  const layout = side === 'front' ? frontLayout : backLayout
  const setLayout = side === 'front' ? setFrontLayout : setBackLayout
  const defaultLayout = side === 'front' ? CALIBRATED_LAYOUT_FRONT : CALIBRATED_LAYOUT_BACK

  // Merge new initialLayout without discarding unsaved edits
  // initialLayout is the authoritative persisted layout; spread it BEFORE
  // unsaved edits (prev) so the saved layout loads on mount, but pending
  // edits are preserved if the prop updates for any reason.
  useEffect(() => {
    if (initialLayout) {
      if (initialLayout.front) {
        setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...initialLayout.front, ...prev }))
      } else if (!initialLayout.back) {
        // Old flat format - apply to front only
        setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...initialLayout, ...prev }))
      }
      if (initialLayout.back) {
        setBackLayout((prev) => ({ ...CALIBRATED_LAYOUT_BACK, ...initialLayout.back, ...prev }))
      }
    }
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

  // Which fields are active for current side
  const sideFields = side === 'front' ? FRONT_FIELDS : BACK_FIELDS
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
      setLayout((prev) => ({
        ...prev,
        [dragging.field]: {
          ...prev[dragging.field],
          x: Math.max(0, Math.min(0.92, dragging.origX + dx)),
          y: Math.max(0, Math.min(0.95, dragging.origY + dy)),
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

  // ── Save ──
  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await onSave({ front: frontLayout, back: backLayout })
      setMsg({ ok: true, text: 'Layout saved successfully.' })
    } catch {
      setMsg({ ok: false, text: 'Failed to save layout.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  // ── Snap a field into a detected template box ──
  function snapFieldToZone(field, zone) {
    const isImage = ['photo', 'qr', 'signature'].includes(field)
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
    // fontSize is a fraction of card WIDTH in CardCanvas; clamp to box width and height
    const fontSize = Math.min(zone.width / (chars * 0.62), zone.height * aspect * 0.8, 0.12)
    // Center-aligned text is drawn with textBaseline 'middle', so (x, y) is the
    // exact center of the box — no manual offset needed
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

  const sel = selected ? layout[selected] : null
  const selMeta = selected ? FIELD_META[selected] : null

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Side tabs ── */}
      <div style={{ width: '100%', marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <button
          className={`mode-btn ${side === 'front' ? 'active' : ''}`}
          onClick={() => { setSide('front'); setSelected(null); }}
          style={{ flex: 1 }}
        >
          🎨 Front
        </button>
        <button
          className={`mode-btn ${side === 'back' ? 'active' : ''}`}
          onClick={() => { setSide('back'); setSelected(null); }}
          style={{ flex: 1 }}
        >
          🔙 Back
        </button>
      </div>

      {/* ── Card preview ── */}
      <div style={{ flexShrink: 0 }}>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--muted)',
            marginBottom: '8px',
            lineHeight: '1.5',
          }}
        >
          Drag each field into its spot on the card — text centers itself on the point where you drop it.
          Click Front/Back tabs to switch sides.
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
          style={{
            width: `${DISPLAY_W}px`,
            height: `${displayH}px`,
            position: 'relative',
            border: '0.5px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#E8E8E8',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
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
            // Chip mirrors the renderer: centered text is anchored at its center,
            // left text at its top-left, right text at its top-right
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
      <div style={{ flex: 1, minWidth: '180px' }}>
        {activeZone !== null && zones[activeZone] && (
          <div
            style={{
              background: 'var(--bg)',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
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
          </div>
        )}

        {sel && selMeta ? (
          <div
            style={{
              background: 'var(--bg)',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: 'var(--text)',
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
              {selMeta.label} ({side})
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
          </div>
        ) : (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--hint)',
              padding: '12px',
              background: 'var(--bg)',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              marginBottom: '12px',
              lineHeight: '1.6',
            }}
          >
            Click a colored box on the card to select it, then adjust its position, size, and text
            style here. Use the Front/Back tabs above to edit each side.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="btn-gold"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? 'Saving...' : 'Save layout'}
          </button>
          <button
            className="btn-outline"
            onClick={() => {
              setLayout({ ...defaultLayout })
              setSelected(null)
            }}
            style={{ width: '100%', fontSize: '12px' }}
          >
            Reset {side} to defaults
          </button>
          {msg && (
            <div className={msg.ok ? 'success-box' : 'error-box'} style={{ fontSize: '12px' }}>
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}