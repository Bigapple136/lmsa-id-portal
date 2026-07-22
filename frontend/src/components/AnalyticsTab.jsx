import { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await adminFetch('/api/analytics')
        if (res.ok) setData(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="loading">Loading analytics...</div>
  if (!data) return <div className="error-box">Failed to load analytics.</div>

  return (
    <div>
      <h2 className="section-title">Analytics Overview</h2>
      <div className="stats-grid">
        <div className="stat-box"><div className="stat-num">{data.confirmations}</div><div className="stat-lbl">Confirmations</div></div>
        <div className="stat-box"><div className="stat-num issue">{data.corrections_by_field?.name || 0}</div><div className="stat-lbl">Name Corrections</div></div>
        <div className="stat-box"><div className="stat-num issue">{data.corrections_by_field?.year || 0}</div><div className="stat-lbl">Year Corrections</div></div>
        <div className="stat-box"><div className="stat-num issue">{data.photo_issues}</div><div className="stat-lbl">Photo Issues</div></div>
      </div>
      <p className="section-desc">Data refreshes on page load. Integration with Realtime planned.</p>
    </div>
  )
}
