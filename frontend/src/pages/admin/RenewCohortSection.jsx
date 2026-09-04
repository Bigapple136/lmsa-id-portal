import { useState } from 'react'
import { adminJson } from '../../lib/api'
import { useToast } from '../../components/Toast'
import { YEARS } from './constants'

function RenewCohortSection() {
  const toast = useToast()
  const [yearLevel, setYearLevel] = useState(YEARS[0])
  const [newValidUntil, setNewValidUntil] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRenew() {
    if (!newValidUntil) return toast.error('Please select an expiry date.')
    setLoading(true)
    try {
      const res = await adminJson('/api/students/renew-cohort', 'PUT', {
        year_level: yearLevel,
        new_valid_until: newValidUntil,
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Renewed ${data.renewed} student(s) in ${yearLevel}.`)
        setNewValidUntil('')
      } else {
        toast.error(data.error || 'Renewal failed.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setLoading(false)
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
