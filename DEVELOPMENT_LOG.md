# LMSA ID Portal — Development Log

## Overview
This document tracks significant fixes and architectural changes made to the LMSA ID Portal codebase. It serves as a reference for team members to understand recent changes and their rationale.

---

## 1. Fix: `detectZones` Garbage Output (commit `70f30a1`)

### Problem
The `detectZones` algorithm in `frontend/src/lib/detectZones.js` was producing ~200 tiny sliver rectangles instead of the 4 real template zones on the LMSA card template (`frontend/public/card-template.png`).

### Root Cause
The `mergeLineRuns` function used a greedy "last-only" merge strategy:
- It compared each run against only the **last** line in the current group
- Solid regions (photo, bands) have multiple runs per row (main + right-side)
- Each row produced a separate "line" → ~63 lines consumed `maxLines=60` cap
- Remaining capacity filled with 0.04-wide slivers from header band

### Solution
Replaced `mergeLineRuns` with `mergeBands`:
- Groups **overlapping** runs into bands (not just adjacent)
- Keeps `Lo..Hi` extent (full vertical/horizontal span of the band)
- Band edges become border-line candidates (thick borders keep both edges)
- Added overlap dedupe: sort rects by area descending, keep largest representative, drop overlapping (>50% area)

### Validation
- Python mirror (`/tmp/opencode/sim_final.py`, `test_pipeline.py`) verified:
  - All 5 existing `findBoxes` test cases pass (T1–T5)
  - Real template: 200 slivers → 4 boxes:
    - `(0,12,282,124)` — top-left
    - `(389,12,410,124)` — top-right
    - `(95,167,315,398)` — middle (main content)
    - `(0,655,410,699)` — bottom bar

### Files Changed
- `frontend/src/lib/detectZones.js` — core algorithm rewrite
- `frontend/src/test/detectZones.test.js` — updated tests for `mergeBands` + solid-region regression test

---

## 2. Fix: Notification Panel Desktop Spacing (commit `e9e33c8`)

### Problem
On desktop view, the notification filter pills (All, Submissions, Self-Corrections, Photo Issues) appeared with no visual separation from the notification list below.

### Solution
Added desktop-only media query (`@media (min-width: 1025px)`) in `frontend/src/index.css`:
```css
.nc-filter-tabs {
  padding-bottom: 12px;  /* was 10px */
  margin-bottom: 10px;   /* was 6px */
}
.nc-list {
  padding-top: 8px;      /* new */
}
```
Tablet/mobile unchanged — only desktop affected per user report.

### Files Changed
- `frontend/src/index.css` (lines 2671–2681)

---

## 3. Fix: Unified Card Layout Coordinates (commit `394e1e3`)

### Problem
Admin layout edits in the **Layout tab** did not match the student **Preview** rendering.

**Coordinate mismatch:**
| Field | LayoutMapper (old) | CardCanvas/Backend (calibrated) |
|-------|-------------------|--------------------------------|
| photo | x:0.06, y:0.08, w:0.4, h:0.3 | x:0.1271, y:0.1673, w:0.7458, h:0.3287 |
| full_name | y:0.42 | y:0.5896 |
| student_id | x:0.06, y:0.53 | x:0.2441, y:0.6614 |
| qr (front) | x:0.68, y:0.78 | x:0.0593, y:0.8187 |

LayoutMapper had arbitrary defaults; CardCanvas & backend shared "pixel-calibrated" coordinates for the 590×1004 LMSA template.

### Solution
Created **single source of truth** at `frontend/src/lib/layoutConstants.js`:
- Exports `CALIBRATED_LAYOUT_FRONT`, `CALIBRATED_LAYOUT_BACK`
- Exports `FRONT_FIELD_ORDER`, `BACK_FIELD_ORDER`, `FRONT_FIELDS`, `BACK_FIELDS`, `EST_CHARS`

**Updated consumers:**
- `LayoutMapper.jsx` — imports calibrated layouts, uses as defaults & for reset
- `CardCanvas.jsx` — imports from shared constants (removed duplicate definitions)
- Backend (`backend/routes/settings.js`) — updated to match frontend constants

### Result
Admin saves layout → coordinates persist → student preview renders **identically**.

### Files Changed
- `frontend/src/lib/layoutConstants.js` (new)
- `frontend/src/components/LayoutMapper.jsx`
- `frontend/src/components/CardCanvas.jsx`
- `backend/routes/settings.js` (aligned textAlign defaults)

---

## 4. Fix: Backend/Frontend Default Alignment (commit `6558846`)

### Problem
When no layout was saved in the database, the backend returned its `DEFAULT_LAYOUT_FRONT` with `textAlign: 'left'` for `student_id` and `year_level`, while the frontend `layoutConstants.js` used `textAlign: 'center'`. This caused inconsistent rendering between admin Layout tab (frontend defaults) and student Preview (backend defaults when no saved layout).

### Solution
Updated `backend/routes/settings.js` `DEFAULT_LAYOUT_FRONT` to match `frontend/src/lib/layoutConstants.js`:
- `student_id.textAlign`: `'left'` → `'center'`
- `year_level.textAlign`: `'left'` → `'center'`

Now both frontend and backend share identical default coordinates.

### Files Changed
- `backend/routes/settings.js`

---

## 5. Note: Arena/Redesign-Team Branch (Not Merged)

The `arena/redesign-team` branch contains a **simplified single-layout architecture** that would **remove**:
- Front/Back dual-sided card support
- Zone detection (`detectZonesFromImage`) and snap-to-template
- Font family selection, text alignment, and advanced field property controls
- Shared `layoutConstants.js` single source of truth

**Do not merge** — it is a regression. Our `main` branch has the superior architecture with dual-sided support, zone detection, and unified constants. The merge would have conflicts (`LayoutMapper.jsx`, `backend/routes/settings.js`).

---

## 6. Current Work: Template/Layout/Preview Integration Recreation (Completed — migration pending)

### Problem
The template → layout mapper → preview integration has gaps:
1. Backend/frontend default mismatch (partially fixed, but template upload doesn't auto-generate layout)
2. Zone detection only runs client-side in LayoutMapper, not server-side on template upload
3. No auto-map from detected zones to field layout
4. No field-side mapping configuration (which fields on front vs back)
5. Preview doesn't strictly use saved layout (falls back to calibrated)

### Phase 1: Single Source of Truth (Backend Alignment) ✅ COMPLETED
- Updated `backend/routes/settings.js` `DEFAULT_LAYOUT_FRONT`:
  - `student_id.textAlign: 'center'`
  - `year_level.textAlign: 'center'`
- Added comment referencing `frontend/src/lib/layoutConstants.js` as canonical source

### Phase 2: Node.js Zone Detection using Sharp (Full Resolution) ✅ COMPLETED
**New File:** `backend/utils/detectZones.js` (created)
- Port of `frontend/src/lib/detectZones.js` to Node.js using Sharp
- Uses Sharp `raw()` buffer from full-resolution image
- Same algorithm: `mergeBands`, `verticalStrokes`, `horizontalStrokes`, `findBoxes`
- Exposes `detectZonesFromBuffer(buffer)` → `{ zones, width, height }`

**Modified:** `backend/routes/templates.js` (pending)
- `POST /api/templates` (upload): Download via signed URL → buffer → run detection → store zones in `templates.zones_front/back` (JSONB)
- `PUT /api/templates/:id/activate`: If zones missing, re-detect. Generate `suggestedLayout` using canonical heuristics (backend-owned). Return `{ template, suggestedLayout, zones }`

**DB Migration:** `supabase/migrations/20260812_add_template_zones_and_layout.sql` (created)
```sql
ALTER TABLE templates ADD COLUMN zones_front JSONB;
ALTER TABLE templates ADD COLUMN zones_back JSONB;
ALTER TABLE templates ADD COLUMN suggested_layout_front JSONB;
ALTER TABLE templates ADD COLUMN suggested_layout_back JSONB;

-- Add field-side mapping setting
INSERT INTO portal_settings (key, value) VALUES 
  ('card_field_sides', '{"photo":"front","full_name":"front","student_id":"front","position":"front","year_level":"front","signature":"front","qr":"both","blood_type":"back","emergency_contact_phone":"back","issue_date":"back","valid_until":"back"}')
ON CONFLICT (key) DO NOTHING;
```

### Phase 3: LayoutMapper UI/UX Redesign (Complete Rewrite) ✅ COMPLETED
**File:** `frontend/src/components/LayoutMapper.jsx`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Front] [Back]          Template: "LMSA 2024"               [Save]  │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │ FIELDS (Checkbox list per side): │
│   TEMPLATE PREVIEW               │                                  │
│   (260px, full-width zones)      │ Front:  [☑] Photo  [☑] Name ... │
│   Zone overlays clickable        │ Back:   [☑] QR    [☑] Blood ... │
│                                  │                                  │
│   [Auto-Map] [Reset]             │ Selected Field Properties:       │
│                                  │ [Position] [Size] [Style] [Type] │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Key Features:**
- **Template Preview**: 260px wide, detected zones as clickable semi-transparent overlays with zone numbers
- **Field-Side Checkboxes**: Simple list under template preview (per side)
- **Auto-Map Button**: Opens preview dialog showing proposed field→zone mapping; on confirm, applies server `suggestedLayout`
- **Zone Assignment**: Click zone → dropdown to pick field
- **Property Editor**: Right panel (position, size, style, type toggle)
- **Front/Back Tabs**: Independent layout state

### Phase 4: Template Activation with Suggested Layout ✅ COMPLETED
**Backend:** `PUT /api/templates/:id/activate` returns:
```js
{ 
  template: updatedTemplate, 
  suggestedLayout: { front: {...}, back: {...} },
  zones: { front: [...], back: [...] }
}
```

**Frontend (`AdminDashboard.jsx`):**
- On activate, if `suggestedLayout` present:
  - Store in state
  - Toast: "Layout suggestions ready. Open Layout tab → Auto-Map to apply."
  - LayoutMapper receives `templateSuggestedLayoutFront/Back`

### Phase 5: Backward Compatibility (Lazy Migration) ✅ COMPLETED
**Backend (`backend/routes/settings.js` - `GET /layout`):**
```js
// If no front/back layout but legacy card_layout exists:
if (!frontLayout && !backLayout) {
  const legacy = await supabase.from('portal_settings')
    .select('value').eq('key', 'card_layout').maybeSingle()
  
  if (legacy?.data?.value) {
    frontLayout = legacy.data.value
    backLayout = DEFAULT_LAYOUT_BACK
    
    // Async migration (fire-and-forget)
    supabase.from('portal_settings').upsert([
      { key: 'card_layout_front', value: frontLayout },
      { key: 'card_layout_back', value: backLayout }
    ]).then(() => {
      supabase.from('portal_settings').delete().eq('key', 'card_layout')
    })
  }
}
```

**Frontend (LayoutMapper):**
- `initialFieldSides` from `card_field_sides` setting
- Fresh start: defaults → `photo: 'front', qr: 'both', blood_type: 'back', ...`
- On save, persist `card_field_sides` to `portal_settings`

### Phase 6: Preview/Print Consistency ✅ COMPLETED
**`frontend/src/components/CardCanvas.jsx`:**
- Strict mode: if `layout.front` exists (even `{}`), don't fall back to calibrated
- Only use calibrated if `layout` is completely null/undefined

**`PreviewPage.jsx` & `PrintPreviewModal.jsx`:**
- Pass full `{front, back}` layout to CardCanvas

---

## 7. Bug Sweep (Pre-Push) ✅ COMPLETED

Caught and fixed during a final review before pushing the integration work:

### 7.1 Stale server echo clobbering field-side edits (`LayoutMapper.jsx`)
The `initialFieldSides` effect re-merged the prop on every change, so a delayed
`saveFieldSides` HTTP response could overwrite a newer local toggle. Now
initialized once via a `useRef` guard — local state is authoritative afterward,
and `AdminDashboard`'s `fieldSides` stays fresh for remounts.

### 7.2 Side effect inside a `setState` updater (`assignSide`)
`assignSide` called `onSaveFieldSides` *inside* the `setFieldSides` updater
(impure; double-invoked under React StrictMode). Moved the call outside the
updater.

### 7.3 Missing `sharp` crashed the entire templates route
`backend/utils/detectZones.js` did `require('sharp')` at module top. If `sharp`
is not installed, the `templates.js` route module fails to load — breaking
`GET /active` (used by Preview and AdminDashboard) too. Now `require('sharp')` is
lazy/`try-catch`'d; detection simply fails gracefully and upload continues.

### 7.4 Auto-Mapped image fields misplaced
Image fields render from their **top-left** corner in `CardCanvas` (and in the
LayoutMapper preview), but both the server `zoneToImageLayout` and the frontend
`buildSuggestedLayout` stored image `x/y` as the box **center**. Auto-Mapped
photo/QR fields were therefore offset. Both now store top-left, matching drag/
snap and the calibrated defaults.

### 7.5 Live field-side updates
`saveFieldSides` now broadcasts over the `layout-changes` BroadcastChannel so
open Preview/Print tabs refresh when an admin reassigns a field's side.

---

## 8. Fix: Layout Mapper Discarding Saved Layout on Async Load (commit `1fdb2b8`)

### Problem
Admin-saved layout coordinates from the Layout tab were not showing up in the
ID card Preview. Opening the Layout tab would sometimes show default field
positions instead of the previously saved map, and saving from that state
silently overwrote the real saved layout in the database with defaults. No
error was raised in either direction, since the defaults are a valid layout
object and pass `checkLayoutConfig` on the backend.

### Root Cause
`AdminDashboard.jsx` fetches the saved layout asynchronously (`loadLayout()`,
part of `loadAll()`) and passes it into `LayoutMapper` as `initialLayout`.
Because that fetch is async, `LayoutMapper` frequently mounts before it
resolves, most reliably when the dashboard restores the admin's last-used tab
as `layout` on reload. `frontLayout`/`backLayout` state then initializes to
the hardcoded `CALIBRATED_LAYOUT_FRONT`/`CALIBRATED_LAYOUT_BACK` defaults.

The effect meant to hydrate that state once the real `initialLayout` prop
arrived spread local state last:

```js
setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...initialLayout.front, ...prev }))
```

Since `prev` won the merge, the incoming saved layout was discarded every
time it arrived, and the mapper stayed on defaults. Any save from that state
pushed the defaults back to the database, overwriting whatever the admin had
actually mapped, for every field, not just the one they last touched.

### Solution
Hydrate `frontLayout`/`backLayout` from `initialLayout` once, using the same
ref-guarded pattern already used for `fieldSides` (`sidesInitialized`, see
7.1), with the server data spread last so it actually wins on that first
load:

```js
const layoutInitialized = useRef(false)
useEffect(() => {
  if (layoutInitialized.current || !initialLayout) return
  if (initialLayout.front) {
    setFrontLayout((prev) => ({ ...CALIBRATED_LAYOUT_FRONT, ...prev, ...initialLayout.front }))
  }
  // ...back handled the same way
  layoutInitialized.current = true
}, [initialLayout])
```

After the first hydration, local state stays authoritative, so in-progress
edits still survive a later prop update (e.g. the echo after Save).

### Operational Note
This fix stops future clobbering but does not restore lost data. Any layout
saved while affected by this bug may currently be sitting at default
coordinates in `portal_settings` (`card_layout_front` / `card_layout_back`).
After deploying, re-open the Layout tab, re-map, and save once to restore
the real coordinates.

### Files Changed
- `frontend/src/components/LayoutMapper.jsx`

---

## 9. Rebuild: Card Preview System Around One Shared Layout Resolver (commit `2dad3bd`)

### Problem
Even after item 8's fix, the card preview still didn't reliably reflect
the admin's saved layout. Between item 8 and this entry, a separate
debugging effort (see `QUICK_FIX_SUMMARY.md`, `LAYOUT_MAPPING_FIX.md`,
`DATA_FLOW_DIAGRAM.md`, `FINAL_IMPLEMENTATION_PLAN.md`, `SYSTEM_PLAN.md`
for that trail) had added a second, independent "is this layout empty,
fall back to defaults" check in `GET /api/settings/layout`, and a third
one in an `isLayoutComplete()` gate that required BOTH front and back to
be mapped before ANY custom layout would render in Preview/Print at all.
Combined with `CardCanvas`'s own pre-existing empty-check, there were
three copies of essentially the same defaulting decision, patched
independently, each capable of masking bugs in the others. That's why
fixes kept appearing to not work.

### Root Cause
No single bug this time — architectural drift. Three call sites each
independently decided "does this layout have real data, or should I
show defaults," with slightly different rules:
1. `CardCanvas`'s `resolvedLayout` memo: per-key length check.
2. Backend `GET /layout`: substituted `DEFAULT_LAYOUT_FRONT/BACK`
   server-side whenever a saved side was empty, meaning a genuinely
   broken save (empty by mistake) was indistinguishable from a healthy
   default from the frontend's point of view.
3. `isLayoutComplete()` in `PreviewPage`/`PrintPreviewModal`: required
   BOTH sides mapped before using ANY custom layout — so mapping only
   the front and leaving the back at defaults (a completely normal
   admin workflow) would silently discard the front mapping too.

The Layout Mapper also had no rendered-card preview of its own — only a
drag-and-drop box overlay — so admins had no way to see whether what
they'd mapped actually matched what `CardCanvas` would render for
students until they navigated to a separate preview page.

### Solution
Collapsed all three checks into one function, called from one place:

```js
// lib/layoutConstants.js
export function resolveLayoutSide(savedSide, defaults) {
  const hasFields = savedSide && Object.keys(savedSide).some((key) => VALID_LAYOUT_FIELDS.has(key))
  return hasFields ? savedSide : defaults
}
export function resolveCardLayout(saved) {
  return {
    front: resolveLayoutSide(saved?.front, CALIBRATED_LAYOUT_FRONT),
    back: resolveLayoutSide(saved?.back, CALIBRATED_LAYOUT_BACK),
  }
}
```

- `GET /api/settings/layout` now returns the real saved values (`null`
  for an unmapped side) instead of substituting defaults server-side.
- `CardCanvas` calls `resolveCardLayout()` instead of its own copy of
  the logic.
- `isLayoutComplete()` and its both-sides gate are removed from
  `PreviewPage`/`PrintPreviewModal` — each side activates independently
  as soon as it has real saved data, matching how admins actually map
  templates (usually one side at a time).
- `LayoutMapper` now embeds a live `CardCanvas` preview, fed directly
  from its own in-progress `frontLayout`/`backLayout` state (not a
  separate fetch), using placeholder student data. What the admin sees
  while dragging fields is the exact same render path students get —
  no second implementation left to drift out of sync.

### Verification
Backend test suite (31/31 passing), frontend `eslint`, and frontend
production `build` all clean.

### Files Changed
- `frontend/src/lib/layoutConstants.js`
- `backend/routes/settings.js`
- `frontend/src/components/CardCanvas.jsx`
- `frontend/src/components/LayoutMapper.jsx`
- `frontend/src/pages/PreviewPage.jsx`
- `frontend/src/components/PrintPreviewModal.jsx`

---

## 10. Fix: renew-cohort No Longer Auto-Confirms; Analytics Counts Real Confirmations Only (commit `0cae9d5`)

### Problem
Students were showing as "Confirmed" in the Overview stat card and status
doughnut with zero students having actually gone through the confirm
flow.

### Root Cause
Every writer of `students.status = 'confirmed'` was traced. There were
three: a student confirming their own card, an admin manually confirming
one, and `PUT /api/students/renew-cohort` (the Settings > Card expiry /
renewal tool), which stamped `status: 'confirmed'` on every student in
the chosen year level as a side effect of extending `valid_until`,
unconditionally and regardless of whether that student had ever seen
their preview link. This was documented in the Settings UI copy itself,
so it was intentional, just conflating two unrelated concerns: "the card
is still valid" and "the student reviewed and confirmed it's correct."
Running the renewal tool for a cohort was the actual explanation for the
reported symptom.

Separately, `GET /api/analytics` counted every row in the `confirmations`
activity-log table as a confirmation, including `'issue'`,
`'photo_issue'`, and `'self_corrected'` actions logged by the student
self-correct flow (`students.js`). Not wired into any current UI, but
wrong regardless of whether it's displayed.

### Solution
- `renew-cohort` now only updates `valid_until`; confirmation status is
  untouched. Settings copy updated to match.
- `GET /api/analytics`'s confirmations count now filters
  `.eq('action', 'confirmed')`.

### Operational Note
This stops future auto-confirms; it does not retroactively fix students
already renewed under the old behavior, who still have
`status = 'confirmed'` in the DB. If none of those students have
separately confirmed for real, this resets them:

```sql
update students set status = 'pending', confirmed_at = null
where status = 'confirmed';
```

Skip it if there's any chance some of those students separately clicked
confirm for real, since it can't distinguish the two — let those
students re-confirm naturally instead.

### Files Changed
- `backend/routes/students.js`
- `backend/routes/analytics.js`
- `frontend/src/pages/AdminDashboard.jsx`

---

## 11. Fix: Student Preview Crash, and the Real Reason Layouts Weren't Rendering (commits `15d954e`, `e98be23`)

### Problem
After item 9's rebuild, the admin's saved layout still wasn't appearing
on the student-facing preview/print pages, even though the Layout
Mapper's own live preview looked correct.

### Root Cause — two separate bugs, found in sequence

**1. `15d954e` — a real crash.** The item 9 rebuild removed the
`useCustomLayout` variable from `PreviewPage.jsx` but missed one
remaining reference to it further down the file, in a conditional
status message. Every load of the student preview page threw
`ReferenceError: useCustomLayout is not defined` and fell back to the
error boundary — it wasn't rendering the wrong layout, it wasn't
rendering *anything*. This wasn't caught by `npm run build` (referencing
an undeclared identifier is valid JS syntax, so it's a runtime error,
not a build error) or by `eslint` — this project's ESLint config only
spread `eslint-plugin-react`'s recommended rules and never enabled the
base `no-undef` rule. Added `no-undef: 'error'` (plus a
`globals.vitest` override for test files, since `vitest.config.js` has
`globals: true` and `no-undef` needs to know about `describe`/`it`/
`expect`) so this class of bug fails lint going forward.

**2. `e98be23` — the actual data bug**, found after fixing the crash and
still seeing stale data. `GET /api/settings/layout` destructures
`{ data: frontData }` / `{ data: backData }` directly from the
`Promise.all` results, meaning `frontData`/`backData` are already the
unwrapped row (e.g. `{ value: {...} }`). The code then read
`frontData?.data?.value` — accessing a `.data` property that doesn't
exist on an already-unwrapped row — always resolving to `undefined`.
Confirmed empirically against the installed `@supabase/supabase-js`
client: `maybeSingle()` resolves to `{ data, error, count, status,
statusText }`, a single-level `data` key.

Effect: `backLayout` was unconditionally `null` on every GET, since
nothing else in the handler ever touches it — confirmed by browser
console logs showing `back: null` on every `loadLayout` call, including
immediately after a save whose own response had just confirmed
persisting 5 real fields. `frontLayout` showed *some* data some of the
time only because the legacy-migration fallback branch (which reads a
differently-shaped, correctly-unwrapped `legacyData` object) kept
kicking in whenever the buggy check thought front/back were empty —
masking the bug by serving stale legacy data (mixed with old
`fontFamily`/`primaryColor`/etc. config keys from the original schema
seed) instead of a clean `null`, which is why front looked "partially
working" rather than reliably broken like back.

The `PUT` handler was never affected by this specific bug — its
`results[i]` is the raw, non-destructured response, so
`results[i]?.data?.value` was already correct there, which is why every
save's own immediate response always looked fine and made the bug so
confusing to chase.

### Solution
`frontData?.value` / `backData?.value` (single unwrap, matching what
the destructuring already did). `legacyData` was never pre-destructured
so its existing `legacyData?.data?.value` access was already correct
and left unchanged.

### Operational Note
No data recovery needed — the saved layouts were correct in the
database the whole time; only the read path was broken. Both front and
back should render correctly immediately on deploy, no re-save
required. The stray legacy config keys still sitting in the current
`card_layout_front` row are harmless and will clear automatically on
the next normal save via `cleanLayout()`.

### Verification
Empirical `maybeSingle()` shape test against the real installed
`@supabase/supabase-js` client (no test harness exists in this repo for
mocking Supabase at the route level, so this was the most rigorous
check available short of a live DB). Backend eslint + syntax check,
backend test suite (31/31), frontend eslint (0 errors after the
`no-undef` fix), frontend build.

### Files Changed
- `frontend/src/pages/PreviewPage.jsx`
- `frontend/eslint.config.js`
- `backend/routes/settings.js`
- `frontend/src/pages/AdminDashboard.jsx`

---

## 12. Feature: Admin Action Audit Log + Layout Version History (commits `28b97a4`, `f4a7425`)

### Motivation
Directly motivated by item 10's investigation: explaining why students
showed as confirmed required reconstructing, from scratch, that the
renew-cohort tool had been used — nothing in the system recorded that
it had run, on what, or when. Two additions to close that gap for
future incidents.

### 1. Admin action audit log
New `admin_actions` table (`sql/012`) plus `backend/auditLog.js`'s
`logAdminAction(req, action, { targetType, targetId, details })` —
fails safe (logs its own errors, never throws), so a logging hiccup
can never break the action it's recording. Wired into a first-pass set
of the highest-value mutation points:
- `renew-cohort` — the actual incident that motivated this feature.
- Student delete — captures `full_name`/`year_level` *before* the
  record is gone, since `target_id` alone is useless to look up
  afterward.
- Admin manual-confirmation.
- Layout save (see below — ties into version history too).

Read-only `GET /api/admin-actions` (optionally filtered by `action`,
`target_type`, `target_id`) to browse it. Entries are only ever
written via the internal helper, never accepted directly over HTTP, so
the log can't be fabricated or tampered with through the API itself.

More endpoints (bulk import, QR field changes, field-side changes,
etc.) can be instrumented the same way later — `logAdminAction` is
generic, this was a deliberately-scoped first pass, not full coverage.

### 2. Layout version history
New `layout_history` table (`sql/012`). Every successful
`PUT /settings/layout` save now also writes a history row per side
(front/back tracked independently), via `recordLayoutHistory()`, which
also prunes anything beyond the most recent 20 entries per side.

- `GET /settings/layout/history?side=front|back` — list recent
  versions, most recent first.
- `POST /settings/layout/history/:id/revert` — re-applies a past
  entry as the current layout for its side. A revert is just another
  save: it goes through `cleanLayout()`, gets its own new
  `layout_history` entry (so the revert joins the timeline instead of
  erasing it), and is logged as a `layout_revert` admin action.

### UI
- **Layout Mapper**: a new collapsible "Version history" panel,
  placed right after "Field sides" (both are occasional-use utility
  panels, grouped together, kept out of the way of the property editor
  that's used constantly while dragging fields). Lists recent saves
  for the currently active side with timestamp and who saved it; the
  current entry can't be reverted to itself. History loads lazily on
  first expand and on side switch while open. Reverting updates local
  layout state immediately, so the live preview reflects it without a
  reload.
- **Settings tab**: a new collapsed-by-default "Recent admin activity"
  section listing `admin_actions` entries with a human-readable action
  label, actor, target, and a compact JSON dump of the details.

### Mistakes caught while building this (fixed before commit)
- An edit accidentally deleted the `FRONTEND_URL` constant in
  `students.js` — restored, verified by grepping every usage site.
- The revert endpoint reproduced the *exact* double-unwrap bug from
  item 11 (`saved?.data?.value` instead of `saved?.value`) — caught by
  a full grep sweep of every file touched this session, confirmed it
  was the only instance.
- A `str_replace` anchor line (the `activeZone` conditional's opening)
  got consumed instead of preserved while inserting the history panel,
  breaking the JSX parse — caught immediately by eslint's parse error,
  fixed, re-verified.

### Operational Note
`sql/012_admin_actions_and_layout_history.sql` has **not** been run
against the live Supabase database yet — none of this works in
production until it is. Run it in the Supabase SQL Editor after
`011_students_confirmed_at.sql`, matching this repo's existing
migration convention.

### Verification
Backend: syntax check + eslint (0 errors) on every touched file, full
test suite (31/31). Frontend: eslint (0 errors), production build.

### Files Changed
- `sql/012_admin_actions_and_layout_history.sql`
- `backend/auditLog.js`
- `backend/routes/adminActions.js`
- `backend/index.js`
- `backend/routes/students.js`
- `backend/routes/confirmations.js`
- `backend/routes/settings.js`
- `frontend/src/components/LayoutMapper.jsx`
- `frontend/src/pages/AdminDashboard.jsx`

---

## Deployment Notes

| Commit | Description | Status |
|--------|-------------|--------|
| `70f30a1` | detectZones fix | Pushed |
| `e9e33c8` | Notification desktop spacing | Pushed |
| `394e1e3` | Unified layout coordinates | Pushed |
| `6558846` | Backend/frontend default alignment | Pushed |
| `56fd929` | Template/Layout/Preview integration + bug sweep | Pushed |
| `1fdb2b8` | Layout mapper discarding saved layout on async load | Pushed |
| `2dad3bd` | Card preview system rebuild — one shared layout resolver | Pushed |
| `0cae9d5` | renew-cohort no longer auto-confirms; analytics counts real confirmations only | Pushed |
| `15d954e` | Fix crash on student preview from leftover useCustomLayout reference; enable no-undef lint | Pushed |
| `e98be23` | Fix GET /layout double-unwrap — back was unconditionally null on every read | Pushed |
| `28b97a4` | Admin action audit log + layout version history (backend) | Pushed |
| `f4a7425` | Admin action audit log + layout version history (frontend) | Pushed |

**Apply before relying on server-side Auto-Map:**
1. `supabase/migrations/20260812_add_template_zones_and_layout.sql` (adds `zones_*`/`suggested_layout_*` columns + `card_field_sides` row).
2. `npm install` in `backend/` so `sharp` is present.
3. Re-upload (or activate) templates so `suggested_layout_*`/`zones_*` are populated.

**Vercel deployment:** Unblocked — push triggers deploy.

---

## Key Files Reference

```
frontend/
├── src/
│   ├── lib/
│   │   ├── detectZones.js           # Zone detection (fixed)
│   │   ├── detectZones.test.js      # Tests
│   │   └── layoutConstants.js       # Shared calibrated layouts
│   ├── components/
│   │   ├── LayoutMapper.jsx         # Admin layout editor + live CardCanvas preview
│   │   ├── CardCanvas.jsx           # Single rendering path — used by mapper, preview, print
│   │   ├── NotificationCenter.jsx   # Notification bell + panel
│   │   └── PrintPreviewModal.jsx    # Uses CardCanvas
│   └── index.css                    # Notification spacing fix
backend/
├── routes/
│   ├── settings.js                  # Layout storage (raw values; defaults resolved in lib/layoutConstants.js)
│   └── templates.js                 # Template upload/activate + zone detection
├── utils/
│   └── detectZones.js               # NEW - Sharp-based detection
supabase/
└── migrations/
    └── 20260812_add_template_zones_and_layout.sql  # NEW - DB schema
```

---

## For Future Contributors

1. **Layout changes**: Edit `frontend/src/lib/layoutConstants.js` — all consumers stay in sync.
2. **Zone detection**: Backend uses `backend/utils/detectZones.js` (Sharp), frontend uses `frontend/src/lib/detectZones.js` (Canvas) — keep algorithms in sync.
3. **Notification UI**: Spacing controlled in `index.css` under `.nc-filter-tabs` / `.nc-list`.
4. **Templates**: Stored in Supabase `templates` table; active per side (front/back).
5. **Settings persistence**: `portal_settings` table with keys `card_layout_front`, `card_layout_back`, `card_field_sides`.
6. **Template zones**: Stored in `templates.zones_front/back`, suggested layouts in `suggested_layout_front/back`.

---

*Last updated: August 12, 2026*