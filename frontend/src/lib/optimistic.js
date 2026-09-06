/**
 * Optimistic UI helpers
 * 
 * Provides utilities for implementing optimistic UI pattern where
 * the frontend shows the intended result immediately while the
 * backend operation completes in the background.
 */

let jobIdCounter = 0

export function generateJobId() {
  return `job_${Date.now()}_${++jobIdCounter}`
}

/**
 * Creates a background job entry
 */
export function createJob({ label, type = 'default' }) {
  return {
    id: generateJobId(),
    label,
    type,
    status: 'pending', // pending | success | error | syncing
    createdAt: Date.now(),
    error: null,
  }
}

/**
 * Helper to run an optimistic operation
 * 
 * @param {Object} params
 * @param {string} params.label - Human readable label for the job
 * @param {Function} params.optimisticUpdate - Function that applies optimistic state immediately
 * @param {Function} params.rollback - Function that reverts optimistic state on failure
 * @param {Function} params.action - Async function that performs the real backend operation
 * @param {Function} params.onSuccess - Optional callback on success with result
 * @param {Function} params.onError - Optional callback on error
 * @param {Object} params.jobsApi - { addJob, updateJob, removeJob } from useBackgroundJobs
 * @param {Object} params.toast - toast instance
 * @returns {Promise} - The background promise (not blocking UI)
 */
export async function runOptimistic({
  label,
  optimisticUpdate,
  rollback,
  action,
  onSuccess,
  onError,
  jobsApi,
  toast,
  type = 'default',
}) {
  const job = createJob({ label, type })
  
  // Apply optimistic update immediately - this is the key UX improvement
  // Admin sees the result instantly without waiting
  try {
    if (optimisticUpdate) {
      optimisticUpdate()
    }
  } catch (err) {
    console.warn('[Optimistic] optimisticUpdate failed', err)
  }

  // Add to background jobs tracker
  if (jobsApi?.addJob) {
    jobsApi.addJob(job)
  }

  // Show immediate feedback - operation is happening in background
  if (toast) {
    toast.info(`${label} — syncing in background...`)
  }

  // Run the real operation in background without blocking UI
  // This promise is intentionally not awaited by the caller for UI purposes
  // but we handle its result for rollback/reconciliation
  const backgroundPromise = (async () => {
    try {
      const result = await action()
      
      // Success - update job status
      if (jobsApi?.updateJob) {
        jobsApi.updateJob(job.id, { status: 'success' })
        // Auto-remove successful jobs after 3 seconds
        setTimeout(() => {
          jobsApi.removeJob?.(job.id)
        }, 3000)
      }

      if (toast) {
        toast.success(`${label} — completed`)
      }

      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (err) {
      console.error(`[Optimistic] ${label} failed:`, err)
      
      // Failure - rollback optimistic update
      try {
        if (rollback) {
          rollback()
        }
      } catch (rollbackErr) {
        console.warn('[Optimistic] rollback failed', rollbackErr)
      }

      // Update job status to error
      if (jobsApi?.updateJob) {
        jobsApi.updateJob(job.id, { status: 'error', error: err.message || 'Failed' })
        // Keep error jobs visible longer - 6 seconds
        setTimeout(() => {
          jobsApi.removeJob?.(job.id)
        }, 6000)
      }

      if (toast) {
        toast.error(`${label} — failed: ${err.message || 'Please try again'}`)
      }

      if (onError) {
        onError(err)
      }

      throw err
    }
  })()

  // Return background promise for optional chaining, but UI should NOT await it
  return backgroundPromise
}

/**
 * Creates a debounced optimistic saver for settings that change frequently
 * Applies optimistic update immediately, debounces the actual save
 */
export function createOptimisticSaver({ delay = 500, jobsApi, toast }) {
  let timeoutId = null
  let pendingSave = null

  return function optimisticSave({ label, optimisticUpdate, saveAction, rollback, onSuccess }) {
    // Apply optimistic immediately
    if (optimisticUpdate) {
      optimisticUpdate()
    }

    // Clear previous debounced save
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Debounce the actual backend call
    timeoutId = setTimeout(async () => {
      const job = createJob({ label, type: 'save' })
      if (jobsApi?.addJob) jobsApi.addJob(job)

      try {
        const result = await saveAction()
        if (jobsApi?.updateJob) {
          jobsApi.updateJob(job.id, { status: 'success' })
          setTimeout(() => jobsApi.removeJob?.(job.id), 2000)
        }
        if (onSuccess) onSuccess(result)
      } catch (err) {
        if (rollback) rollback()
        if (jobsApi?.updateJob) {
          jobsApi.updateJob(job.id, { status: 'error', error: err.message })
          setTimeout(() => jobsApi.removeJob?.(job.id), 4000)
        }
        if (toast) toast.error(`${label} — save failed`)
      }
    }, delay)
  }
}
