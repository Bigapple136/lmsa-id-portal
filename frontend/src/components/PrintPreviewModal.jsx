import { useState, useEffect } from 'react'
import IDCardDisplay from './IDCardDisplay'
import { apiFetch } from '../lib/api'
import CardCanvas from './CardCanvas'

export default function PrintPreviewModal({ student, onClose }) {
  const [templateUrl, setTemplateUrl] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [tRes, lRes] = await Promise.all([
          fetch('/api/templates/active'),
          fetch('/api/settings/layout')
        ])
        if (tRes.ok) { const t = await tRes.json(); setTemplateUrl(t.file_url) }
        if (lRes.ok) { setCardLayout(await lRes.json()) }
      } catch { /* use fallback */ }
      setReady(true)
    }
    load()
  }, [])

  const useCanvas = ready && templateUrl && cardLayout

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Print preview — CR-80</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Card — full template render or fallback */}
        <div className="print-card-wrapper">
          {!ready && (
            <div style={{ padding:'24px', textAlign:'center', fontSize:'13px', color:'var(--muted)' }}>
              Loading card...
            </div>
          )}
          {ready && useCanvas && (
            <CardCanvas
              student={student}
              templateUrl={templateUrl}
              layout={cardLayout}
              maxWidth={340}
            />
          )}
          {ready && !useCanvas && (
            <IDCardDisplay student={student}/>
          )}
          <p className="print-size-note">
            {useCanvas
              ? 'This is exactly how your card will look when printed.'
              : 'Actual card size: 85.6 × 54 mm (CR-80 standard)'}
          </p>
        </div>

        <div className="info-box">
          If any detail looks wrong, close this and tap <strong>Report an issue</strong>.
        </div>

        <div className="btn-row">
          <button className="btn-gold" onClick={onClose}>Looks good</button>
          <button className="btn-outline" onClick={onClose}>Report issue</button>
        </div>
      </div>
    </div>
  )
}
