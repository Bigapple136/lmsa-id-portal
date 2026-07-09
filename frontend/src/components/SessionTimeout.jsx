import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_TIMEOUT = 30 * 60 * 1000
const WARNING_BEFORE = 60 * 1000

export default function SessionTimeout({ timeout = DEFAULT_TIMEOUT }) {
  const [showWarning, setShowWarning] = useState(false)
  const timerRef = useRef(null)
  const warningTimerRef = useRef(null)
  const events = useRef(['mousemove', 'keydown', 'click', 'touchstart', 'scroll'])

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
    startTimers()
  }, [startTimers])

  useEffect(() => {
    startTimers()
    const eventList = events.current
    eventList.forEach((ev) => document.addEventListener(ev, resetTimer))
    return () => {
      clearTimers()
      eventList.forEach((ev) => document.removeEventListener(ev, resetTimer))
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
