// Central API helper
// In dev: uses relative /api paths (proxied by Vite to localhost:4000)
// In production: uses VITE_API_URL env var pointing to Render backend

import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const REQUEST_TIMEOUT = 45000

function withTimeout(signal, ms) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  if (signal) signal.addEventListener('abort', () => controller.abort())
  return { signal: controller.signal, cleanup: () => clearTimeout(id) }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Resilient fetch: retries on network/timeout errors and on transient 5xx
// responses (e.g. a backend cold start). Non-5xx errors and 4xx are returned
// as-is so callers can inspect the status.
async function fetchWithRetry(url, options = {}, { retries = 0, baseDelay = 800 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options)
      if (res.status >= 500 && attempt < retries) {
        await delay(baseDelay * 2 ** attempt)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await delay(baseDelay * 2 ** attempt)
        continue
      }
      throw err
    }
  }
  throw lastErr
}

async function getAuthHeaders() {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session
    if (!session) return {}
    return { Authorization: `Bearer ${session.access_token}` }
  } catch {
    return {}
  }
}

async function fetchWithTimeout(url, options = {}) {
  const { signal: parentSignal, ...rest } = options
  const { signal, cleanup } = withTimeout(parentSignal, REQUEST_TIMEOUT)
  try {
    const res = await fetch(url, { ...rest, signal })
    cleanup()
    return res
  } catch (err) {
    cleanup()
    if (err.name === 'AbortError') throw new Error('Request timed out')
    throw err
  }
}

// Public fetch — no auth header (student-facing routes)
// Pass `retries` to enable resilient retrying (see fetchWithRetry).
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const { retries, baseDelay, ...fetchOptions } = options
  if (retries) {
    return fetchWithRetry(url, fetchOptions, { retries, baseDelay })
  }
  return fetchWithTimeout(url, fetchOptions)
}

// Public fetch with JSON body
export async function apiJson(path, method, body) {
  return apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Admin fetch — automatically attaches the session token
export async function adminFetch(path, options = {}) {
  const authHeaders = await getAuthHeaders()
  const url = `${API_BASE}${path}`
  return fetchWithTimeout(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders,
    },
  })
}

// Admin fetch with JSON body
export async function adminJson(path, method, body) {
  return adminFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Admin fetch with FormData body (file uploads)
export async function adminForm(path, method, formData) {
  return adminFetch(path, { method, body: formData })
}

// Get current user info
export async function authMe() {
  return adminFetch('/api/auth/me')
}
