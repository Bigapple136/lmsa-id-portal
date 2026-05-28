import { useEffect, useRef, useState } from 'react'

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

function getFieldText(field, student) {
  const map = {
    full_name:  student.full_name  || '',
    student_id: student.student_id || '',
    year_level: student.year_level || '',
    position:   student.position   || '',
  }
  return map[field] || ''
}

// Pixel-calibrated layout for LMSA portrait template (590×1004 px)
// All values are fractional (0–1) relative to card width/height
export const CALIBRATED_LAYOUT = {
  photo:      { x:0.1271, y:0.1673, width:0.7458, height:0.3287, type:'image' },
  full_name:  { x:0.5,    y:0.5896, fontSize:0.0678, color:'#1A1A1A', bold:true,  textAlign:'center', type:'text', maxWidth:0.88 },
  student_id: { x:0.2441, y:0.6614, fontSize:0.0576, color:'#CC0000', bold:false, textAlign:'left',   type:'text', maxWidth:0.50 },
  position:   { x:0.5,    y:0.7231, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'center', type:'text', maxWidth:0.70 },
  year_level: { x:0.0593, y:0.7749, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'left',   type:'text', maxWidth:0.50 },
  signature:  { x:0.5254, y:0.8386, width:0.3898, height:0.0896, type:'image' },
  qr:         { x:0.0593, y:0.8187, width:0.2542, height:0.1394, type:'image' },
}

const FIELD_ORDER = ['photo', 'full_name', 'student_id', 'position', 'year_level', 'signature', 'qr']

export default function CardCanvas({ student, templateUrl, layout, maxWidth = 300 }) {
  const canvasRef = useRef(null)
  const [rendered, setRendered] = useState(false)
  const [failed, setFailed] = useState(false)

  // Use calibrated layout as fallback for any missing field
  const resolvedLayout = { ...CALIBRATED_LAYOUT, ...(layout || {}) }

  useEffect(() => {
    if (!templateUrl || !student) return
    setRendered(false)
    setFailed(false)
    let cancelled = false

    async function draw() {
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        const template = await loadImg(templateUrl)
        if (cancelled) return

        const W = template.naturalWidth
        const H = template.naturalHeight
        canvas.width  = W
        canvas.height = H

        // Draw background template
        ctx.drawImage(template, 0, 0)

        for (const field of FIELD_ORDER) {
          const pos = resolvedLayout[field]
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
            } catch { /* photo not available — placeholder already on template */ }

          } else if (field === 'signature') {
            if (!student.signature_url) continue
            try {
              const img = await loadImg(student.signature_url)
              if (cancelled) return
              ctx.drawImage(img, pos.x * W, pos.y * H, pos.width * W, pos.height * H)
            } catch { /* signature not available */ }

          } else if (field === 'qr') {
            if (!student.qr_url) continue
            try {
              const img = await loadImg(student.qr_url)
              if (cancelled) return
              ctx.drawImage(img, pos.x * W, pos.y * H, pos.width * W, pos.height * H)
            } catch { /* QR not available yet */ }

          } else {
            const text = getFieldText(field, student)
            if (!text) continue

            let fontSize = Math.round((pos.fontSize || 0.04) * W)
            const weight = pos.bold ? 'bold ' : ''
            ctx.font = `${weight}${fontSize}px Arial, sans-serif`
            ctx.fillStyle = pos.color || '#000000'
            ctx.textBaseline = 'top'

            if (pos.maxWidth) {
              const maxPx = pos.maxWidth * W
              while (ctx.measureText(text).width > maxPx && fontSize > 6) {
                fontSize--
                ctx.font = `${weight}${fontSize}px Arial, sans-serif`
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
    return () => { cancelled = true }
  }, [student, templateUrl, JSON.stringify(resolvedLayout)])

  if (failed) return null // Parent will show IDCardDisplay fallback

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: `${maxWidth}px`,
        height: 'auto',
        display: 'block',
        borderRadius: '8px',
        opacity: rendered ? 1 : 0,
        transition: 'opacity 0.25s ease',
        margin: '0 auto',
      }}
    />
  )
}
