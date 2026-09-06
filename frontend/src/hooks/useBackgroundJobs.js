import { useState, useCallback, useRef } from 'react'

/**
 * Hook to manage background jobs for optimistic UI
 * Tracks pending/success/error operations that run in background
 * while admin continues working
 */
export default function useBackgroundJobs() {
  const [jobs, setJobs] = useState([])
  const jobsRef = useRef([])

  const addJob = useCallback((job) => {
    setJobs((prev) => {
      const next = [...prev, job]
      jobsRef.current = next
      return next
    })
  }, [])

  const updateJob = useCallback((jobId, updates) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
      jobsRef.current = next
      return next
    })
  }, [])

  const removeJob = useCallback((jobId) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== jobId)
      jobsRef.current = next
      return next
    })
  }, [])

  const clearJobs = useCallback(() => {
    setJobs([])
    jobsRef.current = []
  }, [])

  const pendingCount = jobs.filter((j) => j.status === 'pending').length
  const hasPending = pendingCount > 0

  return {
    jobs,
    jobsRef,
    addJob,
    updateJob,
    removeJob,
    clearJobs,
    pendingCount,
    hasPending,
  }
}
