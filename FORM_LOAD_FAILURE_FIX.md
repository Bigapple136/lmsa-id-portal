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
Verify the production **`ALLOWED_ORIGINS`** env var on Render includes the frontend's
origin. A cross-origin API without the origin whitelisted will be blocked by the
browser regardless of the code fix.
