import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RealtimeNotifications({ onNotification }) {
  useEffect(() => {
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        onNotification?.(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [onNotification])
  return null
}
