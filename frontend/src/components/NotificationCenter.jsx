import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/api'

const TYPE_ICONS = {
  submission: '📩',
  self_correction: '✏️',
  photo_issue: '📷',
}

const TYPE_LABELS = {
  submission: 'Submissions',
  self_correction: 'Self-Corrections',
  photo_issue: 'Photo Issues',
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
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'submission' | 'self_correction' | 'photo_issue'
  const [realtimeStatus, setRealtimeStatus] = useState('connecting') // 'connected' | 'disconnected' | 'connecting'
  const panelRef = useRef(null)
  const bellRef = useRef(null)
  const intervalRef = useRef(null)

  const fetchNotifications = useCallback(async (off = 0, append = false) => {
    setLoading(true)
    setApiError(false)
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(off),
      })
      if (activeFilter !== 'all') params.set('type', activeFilter)

      const res = await adminFetch(`/api/notifications?${params}`)
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
  }, [activeFilter])

  // Initial load + filter changes
  useEffect(() => {
    setOffset(0)
    fetchNotifications()
  }, [fetchNotifications])

  // Polling fallback — ONLY when Realtime is NOT connected
  useEffect(() => {
    if (realtimeStatus === 'connected') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Start polling when disconnected
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        fetchNotifications()
      }, 30000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [realtimeStatus, fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    let channel
    const seenIds = new Set()
    setRealtimeStatus('connecting')

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

            // Unread/total are global (server counts ignore the list filter),
            // so bump them BEFORE the client-side filter check — otherwise the
            // bell badge goes stale for types filtered out of this list.
            setUnread((prev) => prev + 1)
            setTotal((prev) => prev + 1)

            // Apply client-side filter (list membership only)
            if (activeFilter !== 'all' && payload.new.type !== activeFilter) return

            setNotifications((prev) => [payload.new, ...prev])
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notification_reads' },
          (payload) => {
            // A read-record was inserted. We can't tell from the payload which
            // admin it belongs to, and is_read_by_me is per-admin via auth.uid(),
            // so blindly decrementing is wrong in both directions: other admins'
            // reads don't affect us, and our own markRead/markAllRead already
            // decremented locally (double-decrement). Refetch the authoritative
            // list + counts instead.
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === payload.new.notification_id ? { ...n, is_read_by_me: true } : n,
              ),
            )
            fetchNotifications()
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('[NotificationCenter] Realtime unavailable, using polling')
            setRealtimeStatus('disconnected')
          }
        })
    } catch {
      console.warn('[NotificationCenter] Realtime subscription failed, using polling')
      setRealtimeStatus('disconnected')
    }

    return () => {
      seenIds.clear()
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [activeFilter, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  async function markAllRead() {
    try {
      const res = await adminFetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read_by_me: true })))
        setUnread(0)
      }
    } catch {
      // silent
    }
  }

  async function markRead(id) {
    try {
      const res = await adminFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read_by_me: true } : n)))
        setUnread((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // silent
    }
  }

  async function deleteOne(id) {
    try {
      const res = await adminFetch(`/api/notifications/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotifications((prev) => {
          const target = prev.find((n) => n.id === id)
          if (target && !target.is_read_by_me) setUnread((u) => Math.max(0, u - 1))
          return prev.filter((n) => n.id !== id)
        })
        setTotal((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // silent
    }
  }

  async function clearAll() {
    try {
      const res = await adminFetch('/api/notifications', { method: 'DELETE' })
      if (res.ok) {
        setNotifications([])
        setUnread(0)
        setTotal(0)
        setOffset(0)
      }
    } catch {
      // silent
    }
  }

  function loadMore() {
    if (loading || notifications.length >= total) return
    fetchNotifications(offset, true)
  }

  const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'submission', label: TYPE_LABELS.submission },
    { value: 'self_correction', label: TYPE_LABELS.self_correction },
    { value: 'photo_issue', label: TYPE_LABELS.photo_issue },
  ]

  return (
    <div className="nc-wrapper">
      <button
        ref={bellRef}
        className="nc-bell"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
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
            <div className="nc-header-actions">
              {unread > 0 && (
                <button className="nc-mark-read" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
              {notifications.length > 0 && (
                <button className="nc-clear" onClick={clearAll} title="Clear all notifications">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Type filter tabs */}
          <div className="nc-filter-tabs" role="tablist" aria-label="Filter notifications by type">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={activeFilter === f.value}
                className={`nc-filter-tab ${activeFilter === f.value ? 'active' : ''}`}
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="nc-list">
            {apiError && (
              <div className="nc-empty" style={{ color: 'var(--error-text)' }}>
                Notifications unavailable. Please try again later.
              </div>
            )}
            {!apiError && notifications.length === 0 && !loading && (
              <div className="nc-empty">
                {activeFilter === 'all' ? 'No notifications yet' : `No ${TYPE_LABELS[activeFilter]?.toLowerCase() || 'notifications'} yet`}
              </div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`nc-item ${n.is_read_by_me ? '' : 'nc-unread'}`}>
                <span className="nc-item-icon">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="nc-item-body">
                  <div className="nc-item-title">{n.title}</div>
                  <div className="nc-item-msg">{n.message}</div>
                  <div className="nc-item-time">{timeAgo(n.created_at)}</div>
                </div>
                <div className="nc-item-actions">
                  {!n.is_read_by_me && (
                    <button
                      className="nc-read-btn"
                      onClick={() => markRead(n.id)}
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 4L4 12M4 4l8 8" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="nc-delete-btn"
                    onClick={() => deleteOne(n.id)}
                    aria-label="Delete notification"
                    title="Delete notification"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10" />
                    </svg>
                  </button>
                </div>
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