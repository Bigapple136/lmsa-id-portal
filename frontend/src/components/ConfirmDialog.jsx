import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  loading = false,
  variant = 'danger',
}) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    if (!open) return undefined
    const previousActive = document.activeElement
    window.setTimeout(() => cancelRef.current?.focus(), 0)

    function onKeyDown(event) {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault()
        onCancelRef.current?.()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus()
    }
  }, [loading, open])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="modal-overlay confirm-dialog-overlay" onMouseDown={(event) => event.stopPropagation()}>
      <div
        className="modal confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <div className="modal-header">
          <h3 id={titleId} className="confirm-dialog-title">
            {title}
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label={`Cancel ${title}`}
          >
            ×
          </button>
        </div>
        <div id={bodyId} className="confirm-dialog-body">
          {children}
        </div>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDanger ? 'btn-danger' : 'btn-gold'}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
