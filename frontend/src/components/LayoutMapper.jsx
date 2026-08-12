import { useState, useEffect, useRef, useCallback } from 'react'

const DISPLAY_W = 260

const FIELD_META = {
  photo: { label: 'Photo', color: '#3B82F6', bg: '#DBEAFE' },
  full_name: { label: 'Name', color: '#22C55E', bg: '#DCFCE7' },
  student_id: { label: 'ID#', color: '#F59E0B', bg: '#FEF3C7' },
  year_level: { label: 'Level', color: '#8B5CF6', bg: '#EDE9FE' },
  position: { label: 'Position', color: '#F43F5E', bg: '#FFE4E6' },
  signature: { label: 'Signature', color: '#14B8A6', bg: '#CCFBF1' },
  qr: { label: 'QR Code', color: '#6B7280', bg: '#F3F4F6' },
}

const DEFAULT_LAYOUT = {
  photo: { x: 0.06, y: 0.08, width: 0.4, height: 0.3, type: 'image' },
  full_name: {
    x: 0.5,
    y: 0.42,
    fontSize: 0.05,
    color: '#1A1A2E',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.88,
  },
  student_id: {
    x: 0.06,
    y: 0.53,
    fontSize: 0.038,
    color: '#C9A84C',
    bold: false,
    type: 'text',
    maxWidth: 0.5,
  },
  year_level: {
    x: 0.06,
    y: 0.61,
    fontSize: 0.035,
    color: '#444444',
    bold: false,
    type: 'text',
    maxWidth: 0.5,
  },
  position: {
    x: 0.5,
    y: 0.7231,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.7,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

export default function LayoutMapper({ enabledFields, templateUrl, initialLayout, onSave }) {
  const [layout, setLayout] = useState(() => ({ ...DEFAULT_LAYOUT, ...(initialLayout || {}) }))
  const [selected, setSelected] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [displayH, setDisplayH] = useState(413)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const containerRef = useRef(null)

  // Merge new initialLayout without discarding unsaved edits
  useEffect(() => {
    if (initialLayout) {
      setLayout((prev) => ({ ...DEFAULT_LAYOUT, ...initialLayout, ...prev }))
    }
  }, [initialLayout])

  // Calculate display height from template aspect ratio
  useEffect(() => {
    if (!templateUrl) return
    const img = new Image()
    img.onload = () => setDisplayH(Math.round((DISPLAY_W * img.naturalHeight) / img.naturalWidth))
    img.src = templateUrl
  }, [templateUrl])

  // Which fields are active
  const activeFields = Object.keys(FIELD_META).filter(
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
    [dragging],
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
      await onSave(layout)
      setMsg({ ok: true, text: 'Layout saved successfully.' })
    } catch {
      setMsg({ ok: false, text: 'Failed to save layout.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const sel = selected ? layout[selected] : null
  const selMeta = selected ? FIELD_META[selected] : null

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
          Drag the colored boxes to position each field on your card.
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

          {activeFields.map((field) => {
            const pos = layout[field] || DEFAULT_LAYOUT[field]
            if (!pos) return null
            const { color, bg, label } = FIELD_META[field]
            const isImg = pos.type === 'image'
            const isSel = selected === field

            return (
              <div
                key={field}
                onPointerDown={(e) => startDrag(e, field)}
                style={{
                  position: 'absolute',
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  width: isImg
                    ? `${pos.width * 100}%`
                    : pos.maxWidth
                      ? `${pos.maxWidth * 100}%`
                      : 'auto',
                  height: isImg ? `${pos.height * 100}%` : 'auto',
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
              {selMeta.label}
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
            style here.
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
              setLayout({ ...DEFAULT_LAYOUT })
              setSelected(null)
            }}
            style={{ width: '100%', fontSize: '12px' }}
          >
            Reset to defaults
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
