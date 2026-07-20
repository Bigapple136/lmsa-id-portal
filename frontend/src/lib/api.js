// Central API helper
// In dev: uses relative /api paths (proxied by Vite to localhost:4000)
// In production: uses VITE_API_URL env var pointing to Render backend

import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const REQUEST_TIMEOUT = 30000

function withTimeout(signal, ms) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  if (signal) signal.addEventListener('abort', () => controller.abort())
  return { signal: controller.signal, cleanup: () => clearTimeout(id) }
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
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  return fetchWithTimeout(url, options)
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
