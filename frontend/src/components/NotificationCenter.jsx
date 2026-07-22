import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'

const TYPE_ICONS = {
  submission: '📩',
  self_correction: '✏️',
  photo_issue: '📷',
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(false)
  const panelRef = useRef(null)
  const bellRef = useRef(null)

  const fetchNotifications = useCallback(async (off = 0, append = false) => {
    setLoading(true)
    setApiError(false)
    try {
      const res = await adminFetch(`/api/notifications?limit=50&offset=${off}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications((prev) => (append ? [...prev, ...data.notifications] : data.notifications))
        setTotal(data.total || 0)
        setUnread(data.unread || 0)
        setOffset(off + 50)
      } else {
        setApiError(true)
      }
    } catch {
      setApiError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Polling fallback — refresh every 30s to catch events even without Realtime
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Realtime subscription — wrapped in try/catch so CSP blocks don't crash the app
  useEffect(() => {
    let channel
    const seenIds = new Set()
    try {
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            const id = payload.new?.id
            if (id && seenIds.has(id)) return
            if (id) seenIds.add(id)
            setNotifications((prev) => [payload.new, ...prev])
            setUnread((prev) => prev + 1)
            setTotal((prev) => prev + 1)
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[NotificationCenter] Realtime unavailable, using polling')
          }
        })
    } catch {
      console.warn('[NotificationCenter] Realtime subscription failed, using polling')
    }

    return () => {
      seenIds.clear()
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAllRead() {
    try {
      await adminFetch('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {
      // silent
    }
  }

  function loadMore() {
    if (loading || notifications.length >= total) return
    fetchNotifications(offset, true)
  }

  return (
    <div className="nc-wrapper">
      <button
        ref={bellRef}
        className="nc-bell"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="nc-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div ref={panelRef} className="nc-panel">
          <div className="nc-header">
            <span className="nc-title">Notifications</span>
            {unread > 0 && (
              <button className="nc-mark-read" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="nc-list">
            {apiError && (
              <div className="nc-empty" style={{ color: 'var(--error-text)' }}>
                Notifications unavailable. Please try again later.
              </div>
            )}
            {!apiError && notifications.length === 0 && !loading && (
              <div className="nc-empty">No notifications yet</div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`nc-item ${n.is_read ? '' : 'nc-unread'}`}>
                <span className="nc-item-icon">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="nc-item-body">
                  <div className="nc-item-title">{n.title}</div>
                  <div className="nc-item-msg">{n.message}</div>
                  <div className="nc-item-time">{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <span className="nc-dot" />}
              </div>
            ))}
            {loading && <div className="nc-loading">Loading...</div>}
          </div>

          {notifications.length < total && (
            <button className="nc-load-more" onClick={loadMore} disabled={loading}>
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
