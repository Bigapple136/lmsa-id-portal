import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import IDCardDisplay from './IDCardDisplay'

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

function formatClass(value) {
  const mdMap = {
    '1st Year': 'Year 1 . MD1',
    '2nd Year': 'Year 2 . MD2',
    '3rd Year': 'Year 3 . MD3',
    '4th Year': 'Year 4 . MD4',
    '5th Year': 'Year 5 . MD5',
    '6th Year': 'Year 6 . MD6',
  }
  return mdMap[value] || value || ''
}

function formatDate(value) {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[2]}/${match[3]}/${match[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function getFieldText(field, student) {
  const map = {
    full_name: student.full_name || '',
    student_id: student.student_id || '',
    year_level: formatClass(student.year_level),
    position: student.position || '',
    programme: student.programme || '',
    blood_type: student.blood_type || '',
    student_email: student.student_email || '',
    emergency_contact_name: student.emergency_contact_name || '',
    emergency_contact_phone: student.emergency_contact_phone || '',
    date_of_birth: student.date_of_birth || '',
    nationality: student.nationality || '',
    county_of_origin: student.county_of_origin || '',
    current_address: student.current_address || '',
    issue_date: formatDate(student.issue_date),
    valid_until: formatDate(student.valid_until),
  }
  return map[field] || ''
}

// Pixel-calibrated layout for LMSA portrait template (590×1004 px)
// All values are fractional (0–1) relative to card width/height
export const CALIBRATED_LAYOUT_FRONT = {
  photo: { x: 0.1271, y: 0.1673, width: 0.7458, height: 0.3287, type: 'image' },
  full_name: {
    x: 0.5,
    y: 0.5896,
    fontSize: 0.0678,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.88,
  },
  student_id: {
    x: 0.2441,
    y: 0.6614,
    fontSize: 0.0576,
    color: '#CC0000',
    bold: false,
    textAlign: 'center',
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
  year_level: {
    x: 0.0593,
    y: 0.7749,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

export const CALIBRATED_LAYOUT_BACK = {
  qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
  blood_type: {
    x: 0.5,
    y: 0.15,
    fontSize: 0.05,
    color: '#CC0000',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  emergency_contact_phone: {
    x: 0.5,
    y: 0.34,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  issue_date: {
    x: 0.5,
    y: 0.58,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  valid_until: {
    x: 0.5,
    y: 0.66,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
}

const FRONT_FIELD_ORDER = [
  'photo',
  'full_name',
  'student_id',
  'position',
  'year_level',
  'signature',
]

const BACK_FIELD_ORDER = [
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

export default function CardCanvas({ student, templateUrl, templateUrlFront, templateUrlBack, layout, maxWidth = 300 }) {
  const canvasRef = useRef(null)
  const [rendered, setRendered] = useState(false)
  const [failed, setFailed] = useState(false)
  const [side, setSide] = useState('front') // 'front' | 'back'
  const [isFlipping, setIsFlipping] = useState(false)

  // Determine template URL for current side
  const currentTemplateUrl = side === 'front' 
    ? (templateUrlFront || templateUrl) 
    : (templateUrlBack || templateUrl)

  // Support both old format (flat layout) and new format { front, back }
  const resolvedLayout = useMemo(() => {
    if (!layout) return { front: CALIBRATED_LAYOUT_FRONT, back: CALIBRATED_LAYOUT_BACK }
    if (layout.front || layout.back) {
      return {
        front: { ...CALIBRATED_LAYOUT_FRONT, ...(layout.front || {}) },
        back: { ...CALIBRATED_LAYOUT_BACK, ...(layout.back || {}) },
      }
    }
    // Old flat format - use as front only
    return {
      front: { ...CALIBRATED_LAYOUT_FRONT, ...layout },
      back: CALIBRATED_LAYOUT_BACK,
    }
  }, [layout])

  const currentLayout = resolvedLayout[side]
  const fieldOrder = side === 'front' ? FRONT_FIELD_ORDER : BACK_FIELD_ORDER

  const flipCard = useCallback(() => {
    if (isFlipping) return
    setIsFlipping(true)
    // At halfway point (300ms), switch the side content
    setTimeout(() => {
      setSide((prev) => (prev === 'front' ? 'back' : 'front'))
    }, 300)
    // Animation completes at 600ms
    setTimeout(() => setIsFlipping(false), 600)
  }, [isFlipping])

  useEffect(() => {
    if (!currentTemplateUrl || !student) return
    setRendered(false)
    setFailed(false)
    let cancelled = false

    async function draw() {
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        const template = await loadImg(currentTemplateUrl)
        if (cancelled) return

        // Make sure webfonts (e.g. Roboto) are ready before measuring/drawing text
        if (document.fonts?.ready) await document.fonts.ready
        if (cancelled) return

        const W = template.naturalWidth
        const H = template.naturalHeight
        canvas.width = W
        canvas.height = H

        // Draw background template
        ctx.drawImage(template, 0, 0)

        for (const field of fieldOrder) {
          const pos = currentLayout[field]
          if (!pos) continue

          if (field === 'photo') {
            if (!student.photo_url) continue
            try {
              const img = await loadImg(student.photo_url)
              if (cancelled) return
              const px = pos.x * W
              const py = pos.y * H
              const pw = pos.width * W
              const ph = pos.height * H
              // Clip to photo zone to prevent overflow
              ctx.save()
              ctx.beginPath()
              ctx.rect(px, py, pw, ph)
              ctx.clip()
              const imgRatio = img.naturalWidth / img.naturalHeight
              const fieldRatio = pw / ph
              let sx, sy, sw, sh
              if (imgRatio > fieldRatio) {
                sh = img.naturalHeight
                sw = img.naturalHeight * fieldRatio
                sx = (img.naturalWidth - sw) / 2
                sy = 0
              } else {
                sw = img.naturalWidth
                sh = img.naturalWidth / fieldRatio
                sx = 0
                sy = (img.naturalHeight - sh) / 2
              }
              ctx.drawImage(img, sx, sy, sw, sh, px, py, pw, ph)
              ctx.restore()
            } catch {
              /* photo not available — placeholder already on template */
            }
          } else if (field === 'signature') {
            if (!student.signature_url) continue
            try {
              const img = await loadImg(student.signature_url)
              if (cancelled) return
              ctx.drawImage(img, pos.x * W, pos.y * H, pos.width * W, pos.height * H)
            } catch {
              /* signature not available */
            }
          } else if (field === 'qr') {
            if (!student.qr_url) continue
            try {
              const img = await loadImg(student.qr_url)
              if (cancelled) return
              ctx.drawImage(img, pos.x * W, pos.y * H, pos.width * W, pos.height * H)
            } catch {
              /* QR not available yet */
            }
          } else {
            const text = getFieldText(field, student)
            if (!text) continue

            let fontSize = Math.round((pos.fontSize || 0.04) * W)
            const weight = pos.bold ? 'bold ' : ''
            const family = pos.fontFamily || 'Arial, sans-serif'
            ctx.font = `${weight}${fontSize}px ${family}`
            ctx.fillStyle = pos.color || '#000000'
            // Center-aligned text treats (x, y) as its true center so the text
            // stays centered on the drop point even when maxWidth shrinks it
            ctx.textBaseline = pos.textAlign === 'center' ? 'middle' : 'top'

            if (pos.maxWidth) {
              const maxPx = pos.maxWidth * W
              while (ctx.measureText(text).width > maxPx && fontSize > 6) {
                fontSize--
                ctx.font = `${weight}${fontSize}px ${family}`
              }
            }

            const align = pos.textAlign || 'left'
            ctx.textAlign = align

            const xPos = pos.x * W

            ctx.fillText(text, xPos, pos.y * H)
          }
        }

        if (!cancelled) setRendered(true)
      } catch (err) {
        if (!cancelled) setFailed(true)
        console.warn('CardCanvas draw error:', err.message)
      }
    }

    draw()
    return () => {
      cancelled = true
    }
  }, [student, currentTemplateUrl, resolvedLayout, side, fieldOrder])

  if (failed) return <IDCardDisplay student={student} />

  return (
    <div
      className="card-canvas-wrapper"
      style={{
        width: '100%',
        maxWidth: `${maxWidth}px`,
        margin: '0 auto',
        perspective: '1000px',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={flipCard}
      title="Click to flip"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          flipCard()
        }
      }}
    >
      <div
        className="card-inner"
        style={{
          position: 'relative',
          width: '100%',
          height: 0,
          paddingTop: '158.5%', // CR-80 aspect ratio (approx 1004/634 ≈ 1.585)
          transformStyle: 'preserve-3d',
          // Single-face flip: card swings out to edge-on (90deg) and back to
          // 0deg, while the canvas content swaps sides at the 300ms midpoint.
          // Resting at 0deg for both sides avoids the backface-visibility trap
          // of resting at 180deg (where a single face would be hidden/mirrored).
          animation: isFlipping ? 'cardFlip 600ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          transform: 'rotateY(0deg)',
        }}
      >
        {/* Single canvas - content changes based on side state */}
        <div
          className="card-face"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            backfaceVisibility: 'hidden',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: `${maxWidth}px`,
              display: 'block',
              borderRadius: '8px',
              opacity: rendered ? 1 : 0,
              transition: 'opacity 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Flip hint */}
      <div
        className="flip-hint"
        style={{
          position: 'absolute',
          bottom: '-24px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: 'var(--muted)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: isFlipping ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        Click to view {side === 'front' ? 'back' : 'front'}
      </div>
    </div>
  )
}