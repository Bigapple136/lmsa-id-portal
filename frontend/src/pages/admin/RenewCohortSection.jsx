import { useState } from 'react'
import { adminJson } from '../../lib/api'
import { useToast } from '../../components/Toast'
import { YEARS } from './constants'
import { useDashboard } from './DashboardContext'
import { runOptimistic } from '../../lib/optimistic'

function RenewCohortSection() {
  const toast = useToast()
  const dashboard = (() => {
    try {
      return useDashboard()
    } catch {
      return null
    }
  })()
  const bgJobs = dashboard?.bgJobs
  const [yearLevel, setYearLevel] = useState(YEARS[0])
  const [newValidUntil, setNewValidUntil] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRenew() {
    if (!newValidUntil) return toast.error('Please select an expiry date.')
    const dateSnapshot = newValidUntil
    const yearSnapshot = yearLevel

    // Optimistic: show success immediately, clear input, allow admin to continue
    setNewValidUntil('')
    toast.info(`Renewing ${yearSnapshot} cohort — syncing in background...`)

    if (bgJobs) {
      runOptimistic({
        label: `Renew ${yearSnapshot} cohort to ${dateSnapshot}`,
        optimisticUpdate: () => {},
        rollback: () => {
          setNewValidUntil(dateSnapshot)
          toast.error('Renewal failed — reverted')
        },
        action: async () => {
          const res = await adminJson('/api/students/renew-cohort', 'PUT', {
            year_level: yearSnapshot,
            new_valid_until: dateSnapshot,
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Renewal failed.')
          return data
        },
        onSuccess: (data) => {
          toast.success(`Renewed ${data.renewed} student(s) in ${yearSnapshot}.`)
        },
        onError: (err) => {
          toast.error(err.message || 'Renewal failed.')
        },
        jobsApi: bgJobs,
        toast,
        type: 'update',
      })
    } else {
      // Fallback without optimistic context (standalone usage)
      setLoading(true)
      try {
        const res = await adminJson('/api/students/renew-cohort', 'PUT', {
          year_level: yearLevel,
          new_valid_until: dateSnapshot,
        })
        const data = await res.json()
        if (res.ok) {
          toast.success(`Renewed ${data.renewed} student(s) in ${yearSnapshot}.`)
          setNewValidUntil('')
        } else {
          toast.error(data.error || 'Renewal failed.')
          setNewValidUntil(dateSnapshot)
        }
      } catch {
        toast.error('Network error.')
        setNewValidUntil(dateSnapshot)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
      <div className="field-group u-flex-none" >
        <label className="field-label" htmlFor="renew-year-level">Year level</label>
        <select
          id="renew-year-level"
          className="field-input u-fs-13 u-p-7-10"
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="field-group u-flex-none" >
        <label className="field-label" htmlFor="renew-new-expiry-date">New expiry date</label>
        <input
          id="renew-new-expiry-date"
          type="date"
          className="field-input u-fs-13 u-p-7-10"
          value={newValidUntil}
          onChange={(e) => setNewValidUntil(e.target.value)}
        />
      </div>
      <button
        className="btn-gold"
        onClick={handleRenew}
        disabled={loading}
        style={{ fontSize: '12px', padding: '7px 14px', marginBottom: '2px' }}
      >
        {loading ? 'Renewing...' : 'Renew Cohort'}
      </button>
    </div>
  )
}

export default RenewCohortSection
