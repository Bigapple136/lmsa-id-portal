import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RealtimeNotifications({ onNotification }) {
  useEffect(() => {
    let channel
    try {
      channel = supabase
        .channel('public:notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
          onNotification?.(payload.new)
        })
        .subscribe()
    } catch {
      console.warn('[RealtimeNotifications] Subscription failed')
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [onNotification])
  return null
}
