// Central API helper
// In dev: uses relative /api paths (proxied by Vite to localhost:4000)
// In production: uses VITE_API_URL env var pointing to Render backend

import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// Public fetch — no auth header (student-facing routes)
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, options)
  return res
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
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders,
    },
  })
  return res
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
