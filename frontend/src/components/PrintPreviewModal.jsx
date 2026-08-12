import { useState, useEffect } from 'react'
import IDCardDisplay from './IDCardDisplay'
import { apiFetch } from '../lib/api'
import CardCanvas from './CardCanvas'
import { isLayoutComplete } from '../lib/layoutConstants'

export default function PrintPreviewModal({ student, onClose }) {
  const [templateUrl, setTemplateUrl] = useState(null)
  const [templateUrlFront, setTemplateUrlFront] = useState(null)
  const [templateUrlBack, setTemplateUrlBack] = useState(null)
  const [cardLayout, setCardLayout] = useState(null)
  const [fieldSides, setFieldSides] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [tRes, lRes, fsRes] = await Promise.all([
          apiFetch('/api/templates/active'),
          apiFetch('/api/settings/layout'),
          apiFetch('/api/settings/field-sides'),
        ])
        if (tRes.ok) {
          const t = await tRes.json()
          setTemplateUrlFront(t.front?.file_url || null)
          setTemplateUrlBack(t.back?.file_url || null)
          setTemplateUrl(t.front?.file_url || t.back?.file_url || null)
        }
        if (lRes.ok) {
          setCardLayout(await lRes.json())
        }
        if (fsRes.ok) {
          setFieldSides(await fsRes.json())
        }
      } catch (err) {
        console.warn('[PrintPreview] Failed to load card data:', err)
      }
      setReady(true)
    }
    load()
  }, [])

  const useCustomLayout = ready && isLayoutComplete(cardLayout)
  const useCanvas = useCustomLayout && templateUrl

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Print preview — CR-80</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Card — full template render or fallback */}
        <div className="print-card-wrapper">
          {!ready && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--muted)',
              }}
            >
              Loading card...
            </div>
          )}
          {ready && useCanvas && (
            <>
              <CardCanvas
                student={student}
                templateUrlFront={templateUrlFront}
                templateUrlBack={templateUrlBack}
                layout={cardLayout}
                fieldSides={fieldSides}
                maxWidth={340}
              />
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px', textAlign: 'center' }}>
                This is exactly how your card will look when printed (both sides shown).
              </p>
            </>
          )}
          {ready && !useCanvas && (
            <>
              <IDCardDisplay student={student} />
              {cardLayout && !useCustomLayout && (
                <p style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '12px', textAlign: 'center' }}>
                  Using default layout. Admin must map both sides for custom layout.
                </p>
              )}
            </>
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
          <button className="btn-gold" onClick={onClose}>
            Looks good
          </button>
          <button className="btn-outline" onClick={onClose}>
            Report issue
          </button>
        </div>
      </div>
    </div>
  )
}
