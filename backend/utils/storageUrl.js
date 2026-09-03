// Helpers for building public storage URLs that never go stale.
//
// Student photos, signatures and QR codes are uploaded to deterministic
// paths (e.g. `photos/3rd-year/AMD-2024-0001.jpg`) with `upsert: true`, so
// replacing a file does not change its public URL. Both the Supabase CDN
// (default max-age=3600) and the browser cache the object under that URL,
// which means a freshly uploaded photo keeps rendering as the OLD one in
// the admin list, the edit modal and the student's ID-card preview.
//
// Appending a version query param that changes on every upload gives every
// consumer a brand-new URL, forcing a fresh fetch, while the underlying
// storage path stays stable so cleanup/migration logic keeps working.

/**
 * Append (or replace) a cache-busting `v` query parameter on a URL.
 * @param {string} url      Public URL returned by supabase getPublicUrl()
 * @param {string|number} [version=Date.now()]
 * @returns {string}
 */
function withVersion(url, version = Date.now()) {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.set('v', String(version))
    return u.toString()
  } catch {
    // Not an absolute URL — fall back to simple string handling
    const [base, query = ''] = url.split('?')
    const params = new URLSearchParams(query)
    params.set('v', String(version))
    return `${base}?${params.toString()}`
  }
}

/**
 * Strip the version param again (useful when a caller needs the canonical URL).
 * @param {string} url
 * @returns {string}
 */
function stripVersion(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('v')
    return u.toString()
  } catch {
    const [base, query = ''] = url.split('?')
    const params = new URLSearchParams(query)
    params.delete('v')
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }
}

module.exports = { withVersion, stripVersion }
