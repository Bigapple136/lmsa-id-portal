import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_TIMEOUT = 30 * 60 * 1000
const WARNING_BEFORE = 60 * 1000
const DEBOUNCE_MS = 1000

export default function SessionTimeout({ timeout = DEFAULT_TIMEOUT }) {
  const [showWarning, setShowWarning] = useState(false)
  const timerRef = useRef(null)
  const warningTimerRef = useRef(null)
  const lastResetRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    timerRef.current = null
    warningTimerRef.current = null
  }, [])

  const startTimers = useCallback(() => {
    clearTimers()
    setShowWarning(false)

    warningTimerRef.current = setTimeout(() => setShowWarning(true), timeout - WARNING_BEFORE)
    timerRef.current = setTimeout(() => {
      supabase.auth.signOut()
      window.location.href = '/admin'
    }, timeout)
  }, [timeout, clearTimers])

  const resetTimer = useCallback(() => {
    const now = Date.now()
    if (now - lastResetRef.current < DEBOUNCE_MS) return
    lastResetRef.current = now
    startTimers()
  }, [startTimers])

  useEffect(() => {
    startTimers()
    const handler = () => resetTimer()
    document.addEventListener('mousemove', handler)
    document.addEventListener('keydown', handler)
    document.addEventListener('click', handler)
    document.addEventListener('touchstart', handler)
    document.addEventListener('scroll', handler)
    return () => {
      clearTimers()
      document.removeEventListener('mousemove', handler)
      document.removeEventListener('keydown', handler)
      document.removeEventListener('click', handler)
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('scroll', handler)
    }
  }, [startTimers, clearTimers, resetTimer])

  function handleStayLoggedIn() {
    resetTimer()
  }

  function handleLogoutNow() {
    clearTimers()
    supabase.auth.signOut()
    window.location.href = '/admin'
  }

  if (!showWarning) return null

  return (
    <div className="modal-overlay">
      <div className="modal session-timeout-modal">
        <div className="session-timeout-icon">⏰</div>
        <div className="session-timeout-title">Session Expiring Soon</div>
        <div className="session-timeout-text">
          Your session will expire in less than 1 minute due to inactivity.
        </div>
        <div className="session-timeout-actions">
          <button className="btn-gold" onClick={handleStayLoggedIn} style={{ flex: 1 }}>
            Stay Logged In
          </button>
          <button className="btn-outline" onClick={handleLogoutNow} style={{ flex: 1 }}>
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  )
}
