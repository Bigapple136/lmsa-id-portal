import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let toastId = 0

const DURATIONS = { success: 3000, error: 5000, info: 4000, warn: 4000 }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback(
    (type, message) => {
      const id = ++toastId
      setToasts((prev) => {
        const next = [...prev, { id, type, message }]
        return next.length > 5 ? next.slice(-5) : next
      })
      timers.current[id] = setTimeout(() => remove(id), DURATIONS[type] || 4000)
    },
    [remove],
  )

  const toast = {
    success: (msg) => add('success', msg),
    error: (msg) => add('error', msg),
    info: (msg) => add('info', msg),
    warn: (msg) => add('warn', msg),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toasts are the only feedback channel for most admin actions, so the
          container is a live region; errors escalate to role="alert". It is
          rendered unconditionally: a live region has to exist in the DOM
          before content is inserted into it, or the insertion is not
          announced. */}
      <div className="toast-container" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role={t.type === 'error' ? 'alert' : undefined}
          >
            <span className="toast-icon" aria-hidden="true">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'info' && 'i'}
              {t.type === 'warn' && '!'}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
