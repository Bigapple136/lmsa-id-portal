# Form Load Failure — Investigation & Fix

## Symptom
On the student submission form (`/submit`), some users saw **"Unable to load the form"**
("We could not reach the server. Please check your connection and try again.") while
others loaded it fine. Retrying often worked.

## Root cause
The form's load gate in `frontend/src/pages/StudentSubmissionForm.jsx` fired three
parallel requests inside a single `Promise.all` wrapped in one broad `catch`:

```js
const [statusRes, fieldsRes, qrFieldsRes] = await Promise.all([...])
if (!statusRes.ok || typeof statusData.enabled !== 'boolean') throw new Error('invalid status')
} catch { setStatusError(true) }   // → "Unable to load the form"
```

**Any** failure of **any** of the three requests set `statusError = true`, and the
`catch` discarded the error object entirely — so the UI could never say *why* it failed.

### Why it was intermittent / device-specific
1. **Backend cold start vs. 30s timeout (most likely).** The service runs on Render
   (`render.yaml`), which spins down idle instances. The first request after inactivity
   can take >30s to boot, but `frontend/src/lib/api.js` had `REQUEST_TIMEOUT = 30000`.
   The fetch aborted → `AbortError` → caught → form blocked. The same user retrying a
   moment later (server now warm) succeeded. This produces exactly the
   "some fail, some don't" pattern.
2. **Per-IP rate limiting on shared campus networks.** `backend/index.js` defines
   `generalLimiter` = 500 requests / 15 min **per IP**. Many students behind one school
   NAT share a public IP; 3 requests each can exceed the limit → `429` →
   `statusRes.ok` is false → thrown → blocked. Intermittent and network-dependent.
3. **Transient 500 on `/api/submissions/status`** (`backend/routes/submissions.js`) —
   a Supabase hiccup returns `500` → `statusData.enabled` is `undefined` →
   `typeof !== 'boolean'` → thrown.
4. **Missing `submission_form` setting row** — the endpoint returns
   `{ enabled: undefined }` → `typeof !== 'boolean'` → thrown for *everyone*.
5. **Cross-origin blocking (CORS, not CSP).** If the API is served from a different
   origin than the frontend and that origin isn't in `ALLOWED_ORIGINS`
   (`backend/index.js`), the browser blocks the request at the network layer → same
   symptom. (The backend's `helmet` CSP governs its own responses, not the frontend's
   fetches, so CSP was a red herring.)

### Note on a prior review
A second-opinion report flagged `apiFetch` as calling `getAuthHeaders()`/Supabase and
blamed missing `VITE_SUPABASE_*` env vars. That is **incorrect**: `apiFetch`
(`frontend/src/lib/api.js`) is a public fetch that never touches Supabase — only
`adminFetch` calls `getAuthHeaders`. The student form uses `apiFetch`, so Supabase
env-var misconfiguration is irrelevant to this symptom.

## Fix
**`frontend/src/lib/api.js`**
- Raised `REQUEST_TIMEOUT` 30s → 45s (cold-start headroom).
- Added `fetchWithRetry` — retries on network/timeout errors and transient 5xx with
  exponential backoff. `apiFetch` accepts a `retries` option (off by default, so admin
  calls are unchanged).

**`frontend/src/pages/StudentSubmissionForm.jsx`**
- `fields` / `qr-fields` now load via `Promise.allSettled` and **degrade to defaults**
  (`null`) on failure — a settings hiccup no longer blocks the whole form.
- The status check **retries (2×)** and no longer throws on a missing
  `submission_form` row; it treats that as `enabled: false` (closed) instead.
- Replaced the silent `catch` with diagnostics: failures log to `console` + `Sentry`
  and surface an **accurate** message —
  - timeout / cold start: "The server took too long to respond…"
  - `429`: "Too many requests right now…"
  - `5xx`: "The form service is temporarily unavailable…"
  - network: "We couldn't reach the server…"

## Action item (config, not code)
**Resolved:** `ALLOWED_ORIGINS` is set to `https://lmsa-id-portal.vercel.app` (the
Vercel frontend origin). The CORS `origin` check in `backend/index.js` allows that
exact origin, and the fact that some users already load the form from it confirms
cross-origin requests succeed — so cause #5 is ruled out.

---

# Round 2 — still failing for some (device/network-specific)

The first fix didn't change the symptom, which points away from timeouts/5xx/settings
and toward something that fails **per device/network but not per server**: the API is
reached **cross-origin** at `https://lmsa-id-portal.onrender.com`.

## Root cause (two compounding issues)

### A. Cross-origin API blocked on restrictive networks / privacy browsers
`frontend/vercel.json` ships a CSP whose `connect-src` explicitly allows
`https://lmsa-id-portal.onrender.com` — confirming the frontend calls the API there
**cross-origin**. A shared host like `onrender.com` is exactly what gets blocked by:
- school / campus firewall or ISP filtering,
- DNS-level ad/tracker blockers,
- privacy browsers (Brave, Firefox ETP, Safari ITP).

Students behind such a network get a failed fetch → "Unable to load the form", while
students on open networks (mobile data) succeed. This is device/network-consistent and
is **not** addressed by timeouts, retries, or CORS — which is why Round 1 didn't help.

### B. Per-IP rate limiter saturated on shared campus NATs
`backend/index.js` applies `generalLimiter` (500 req / 15 min) to **all** `/api`
routes. Many students behind one school NAT share a public IP → 3 requests each
exhausts the cap → `429` → "Unable to load the form" for the whole school.

## Fix (Round 2)

### Same-origin proxy (`frontend/vercel.json`)
Added a Vercel rewrite that proxies `/api/*` to the Render backend **before** the SPA
catch-all (Vercel matches rewrites top-to-bottom):
```json
{ "source": "/api/:path*", "destination": "https://lmsa-id-portal.onrender.com/api/:path*" }
```
Now the browser talks to its **own** origin (`lmsa-id-portal.vercel.app`), so the
request is no longer blockable by network/firewall/privacy tools and CORS is moot.

### Generous limiter for public reads (`backend/index.js`)
Added `publicReadLimiter` (3000 req / 15 min) for the three form-load GETs
(`/api/submissions/status`, `/api/settings/fields`, `/api/settings/qr-fields`) and
made `generalLimiter` `skip` those same paths so they aren't double-counted.

## REQUIRED deployment steps (the proxy only works if these are done)
1. **Clear `VITE_API_URL` in the Vercel project env** (or set it to empty). The
   frontend must use relative `/api` paths so requests hit the Vercel proxy. If
   `VITE_API_URL` still points at `onrender.com`, the browser calls the backend
   **directly (cross-origin)** and the proxy is bypassed — the fix does nothing.
   (Dev still works via the existing Vite `/api` proxy to localhost:4000.)
2. **Verify the proxy destination URL.** `vercel.json` uses
   `https://lmsa-id-portal.onrender.com` (the URL already whitelisted in the CSP
   `connect-src`). Confirm this exactly matches the Render backend URL in the Render
   dashboard — `render.yaml`'s service name is `lmsa-id-portal-backend`, which would
   normally yield `lmsa-id-portal-backend.onrender.com`. If the real URL differs,
   update the `destination` in `vercel.json` or the proxy will 404/500 for everyone.
3. **Redeploy both** Vercel (frontend + `vercel.json`) and confirm the Render service
   is awake.

## Note on rate limiter + proxy
With the proxy, Render sees requests from Vercel's edge. `trust proxy` is already `1`
in `backend/index.js`, so `x-forwarded-for` yields the real client IP and per-user
rate limiting is preserved. If that ever resolves to Vercel's IP instead, the
per-IP limits would pool all students together — the generous `publicReadLimiter`
(3000) keeps the form-load reads safe in that case.

---

# Round 3 — same symptom on the landing-page ID card view

## Confirmation, not a new bug
A report came in: students visiting the landing page to view their ID card got
`Failed to load resource: lmsa-id-portal.onrender.com`. This is the **same root
cause** — the ID card view (`PreviewPage.jsx`) loads the card via `apiFetch(...)`
→ `API_BASE = VITE_API_URL = https://lmsa-id-portal.onrender.com` → a cross-origin
`fetch` blocked on restrictive networks. The card *images* (template, photo, QR)
all come from **Supabase Storage** (`*.supabase.co`, allowed by the CSP
`img-src`), so those are not the failing resource — the failing resource is the
API `fetch` itself, which is exactly why the console names `onrender.com`.

So the Round 2 fix (Vercel proxy + rate limiter) covers **both** the submission
form and the landing-page card view.

## Hardening so the fix can't be bypassed
To remove any reliance on clearing `VITE_API_URL`, the frontend now forces
same-origin relative paths regardless of that env var:
- `frontend/src/lib/api.js`: `API_BASE` is now `''` (always relative). All
  `apiFetch`/`adminFetch` calls go to `/api/*` on the frontend's own origin.
- `frontend/src/pages/AdminDashboard.jsx`: the two raw `fetch` calls for
  `preview-url` / `verification-url` now use relative `/api/...` paths instead of
  `import.meta.env.VITE_API_URL || ''`.

With this, the Vercel proxy is always used — clearing `VITE_API_URL` is no longer
*required* (but still harmless). Deploying the new frontend is sufficient.

## Remaining edge case (admin-only, out of scope for the student report)
`backend/routes/qr.js:197` returns `${BACKEND_URL}/api/qr/html/${token}` for the
admin "verification URL", which `AdminDashboard` opens via `window.open`. On a
restrictive network that admin link would still open `onrender.com` cross-origin.
Low impact (few admin users, usually unblocked networks). Fix later by making that
URL relative (`/api/qr/html/${token}`) so it also flows through the proxy.

