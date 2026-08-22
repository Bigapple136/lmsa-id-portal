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

## 12. Fix: Notification "Mark as read" Never Stuck and Bell Counter Never Cleared; Missing Clear/Delete (commit `90bcb22`)

### Problem
Two related notification issues, reported together:
1. When an admin marked a notification as read, it kept showing as "new" and the
   bell counter never cleared.
2. There was no way to clear/remove notifications at all — they behaved as a
   permanent system log that could only be marked read.

### Root Cause — #1 (the real bug)
The backend connects with the **service-role** key (`backend/db.js:3`), but the
per-admin read state was computed inside the `admin_notifications` view using
`auth.uid()` (`sql/008_notification_reads.sql:48`). A service-role client has
`auth.uid() === NULL`, so `nr.admin_id = auth.uid()` never matched and the view
reported `is_read_by_me = false` for **every** notification, for **every** admin.

The `GET /api/notifications` handler (`backend/routes/notifications.js`) relied
on that view, so:
- Marking read *did* insert a correct `notification_reads` row, but the
  list/counter query never reflected it.
- The bell's unread count was therefore always equal to the total number of
  notifications and never dropped.

The mark-read endpoints themselves were correct — the read records are written
with the explicit `req.user.id` — only the read path that *displayed* them was
broken.

### Root Cause — #2 (missing feature)
There was simply no delete endpoint. The `notifications` table's own comment even
described it as a "Persistent notification log", and the only mutations were
mark-as-read. So "clearing" was impossible by design.

### Solution
**`backend/routes/notifications.js`:**
- `GET /api/notifications` no longer uses the `admin_notifications` view. It loads
  `notifications` directly and joins *this* admin's read records explicitly via
  `notification_reads` (filtered by `req.user.id`), computing `is_read_by_me` and
  the unread count correctly per admin.
- Added `DELETE /api/notifications/:id` — delete a single notification.
- Added `DELETE /api/notifications` — clear **all** notifications (deletes the
  underlying rows; `notification_reads` is `ON DELETE CASCADE`).

**`frontend/src/components/NotificationCenter.jsx`:**
- Added `deleteOne(id)` and `clearAll()` handlers calling the new DELETE endpoints.
- Added a **"Clear all"** button in the header and a **trash/delete** button per
  item (next to the existing mark-read button). Both update the list, badge
  counter, and total immediately.

**`frontend/src/index.css`:**
- Styled `.nc-header-actions`, `.nc-clear`, `.nc-item-actions`, `.nc-delete-btn`
  (mirroring the existing mark-read button styles).

### Design Note
`notifications` is a single shared table, so delete/clear is a **global** action —
clearing or deleting affects every admin's feed (consistent with "not a system
log"). If per-admin soft-delete is ever wanted, that requires a separate
`notification_dismissals` table; out of scope here.

### Verification
- `npx eslint routes/notifications.js` — clean.
- `npx eslint src/components/NotificationCenter.jsx` — clean.
- `node --check backend/routes/notifications.js` — clean.
- (No backend route-level test harness exists for Supabase mocking in this repo,
  so this was verified by code review + lint/syntax checks.)

### Files Changed
- `backend/routes/notifications.js`
- `frontend/src/components/NotificationCenter.jsx`
- `frontend/src/index.css`

---

## 13. Feature: Admin Action Audit Log + Layout Version History (commits `28b97a4`, `f4a7425`)

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

## 14. Production Readiness: RLS, CI, Migration Consolidation, Dependency Fixes, Code Splitting (commits `cb8c811`, `c7c33c0`, `1459379`, `2f9a943`, `65f47c4`, `0e05d6a`, `65feb9f`)

### Motivation
A full production-readiness review turned up several gaps that don't
block the app from running today but would matter at real scale or in
an incident. Fixed the ones that were safely fixable without live
database or dashboard access; documented the rest as needing manual
action (see Operational Notes).

### 1. RLS on the six core tables (`cb8c811`, `sql/013`)
`students`, `confirmations`, `student_submissions`, `admins`,
`templates`, and `portal_settings` had no Row Level Security enabled
anywhere in the schema. The backend exclusively uses the service role
key (bypasses RLS regardless of policy) and the frontend's anon-key
client is only ever used for `supabase.auth.*`, never direct table
queries — so this app's own behavior is unaffected either way. But
Supabase auto-exposes every table via a public REST API by default,
and the anon key is necessarily embedded in the shipped frontend
bundle; without RLS, anyone who extracts it could query student PII
directly, bypassing the backend's auth, rate limiting, and audit log
entirely. `sql/013` enables RLS with zero policies on all six —
matching the existing convention in this repo (`qr_audit`, `qr_keys`,
`admin_actions`, `layout_history`) — which denies anon/authenticated
access by default without touching a single existing row.

### 2. CI workflow (`c7c33c0`, `.github/workflows/ci.yml`)
Directly motivated by item 11: a hard-crashing bug shipped straight to
the student preview page because nothing ran lint or tests before
Render/Vercel auto-deployed it. New GitHub Actions workflow runs
backend lint + test and frontend lint + test + build on every push and
PR to `main`, using placeholder env vars so `env.js`'s startup
validation passes without needing real secrets in CI. Doesn't deploy
anything — Render/Vercel still auto-deploy independently — it just
produces a visible pass/fail check. Verified by simulating the exact
CI environment locally (same env vars, same commands) before writing
it, not just written and assumed correct.

### 3. Migration consolidation (`1459379`, `sql/014`)
This repo had two disconnected migration locations: the numbered
`sql/` folder everything else is tracked from, and a separate
untracked `supabase/migrations/20260812_add_template_zones_and_layout.sql`
(the Supabase CLI's default folder) that had drifted out of sync with
it. Folded its content into `sql/014` and removed `supabase/`
entirely. Confirmed safe to fold in as-is — both statements are
idempotent (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), and
the columns it adds are already actively selected/inserted by
`backend/routes/templates.js` in production today, confirming it had
already been applied by some other means despite never being tracked.

### 4. Backup table list + render.yaml (`2f9a943`)
`backend/routes/backup.js`'s `TABLES` list was missing five tables
added to the schema after it was written: `admin_actions`,
`layout_history`, `notifications`, `notification_reads`, `qr_audit` —
silently excluded from every backup since. Added all five.
Deliberately did **not** add `qr_keys` — it holds QR signing secrets in
plaintext, and including it in a downloadable backup zip would be a
real secret-leakage risk; left out on purpose.

`render.yaml` was missing three env vars that `backend/env.js` treats
as required (`process.exit(1)` on boot if missing): `QR_SIGNING_SECRET`,
`FRONTEND_URL`, `BACKEND_URL`. Since the app runs today, these must
already be set by hand in Render's dashboard, invisible to version
control — a from-scratch redeploy would fail to boot until someone
remembered to add them. Added as `sync: false` placeholders, matching
every other secret's existing pattern. Also added `SENTRY_DSN` as an
optional placeholder, since Sentry is wired into the code but nothing
in the dashboard exists to configure it yet.

### 5. Dependency vulnerabilities (`65f47c4`)
16 known vulnerabilities (12 backend, 4 frontend) down to 4 via
non-breaking `npm audit fix` (no `--force`), reverified with a full
fresh install + lint + test (+ build for frontend) after, not just
trusted npm's success message. The remaining 4 are deliberate,
documented deferrals:
- **uuid** (moderate, backend) — transitive dependency of
  `exceljs@4.4.0`, already the latest stable release; the suggested
  fix downgrades exceljs three major versions. The CVE needs an
  unusual explicit `buf` argument exceljs is unlikely to use
  internally — low practical risk, not worth losing three majors of
  bug fixes over.
- **xlsx** (high, backend) — no fix available upstream at all. Checked
  actual exposure: used in exactly one place
  (`backend/scripts/generate_template.js`, a standalone script not
  wired into any route) and only ever *writes* a static template — no
  `XLSX.read`/`readFile` anywhere. Both CVEs need *parsing* an
  untrusted file to exploit, which this app's real usage never does.
- **react-router / react-router-dom** (moderate ×2, frontend) — fix is
  a v6→v7 major jump with known breaking changes, against zero
  navigation-level test coverage. Confirmed no SSR anywhere in this
  app (rules out one CVE entirely); the other (open-redirect via
  backslash in `Link`/`useNavigate`) is real, but forcing a blind
  major router upgrade with nothing to catch a broken nav flow before
  real users hit it is a worse risk than the bug itself.

### 6. Route-based code splitting (`0e05d6a`)
Every visitor downloaded one 649KB (184.66KB gzipped) bundle regardless
of which page they hit — chart.js, the Layout Mapper, and hCaptcha
included even for a student opening a bare preview link on mobile
data. Lazy-loaded every route except `LandingPage` (kept eager as the
primary entry point) via `React.lazy` + a single `Suspense` boundary.
Verified by inspecting the actual build output, not assuming: a
student hitting `/preview/:token` now downloads roughly 410KB
(~122KB gzipped) total, about a third smaller, with zero admin-only
code included. `AdminDashboard` (278KB) now ships only to `/admin`.

### 7. Repo cleanup (`65feb9f`)
Removed `backend/temp_check.xml` and `backend/temp_s1.xml` — stray
debug output from inspecting `generate_template.js`'s Excel output at
some point, not referenced anywhere in the codebase.

### Operational Notes — still need manual action
- `sql/012`, `sql/013`, and `sql/014` all still need to be run in the
  Supabase SQL Editor. Nothing in items 13, 14.1, or 14.3 above takes
  effect until they are.
- A staging environment (deploy previews before production, rather
  than every push going straight to real student data) was flagged in
  the readiness review but is an infra/process decision, not something
  fixable in a commit — still open.

### Verification
Backend: full fresh install + lint (0 errors) + test suite (31/31).
Frontend: full fresh install + lint (0 errors) + test suite (13/13) +
production build, with build output inspected directly to confirm the
code-split actually took effect. Re-verified again after merging in
four commits pushed directly to `origin/main` while this work was in
progress (`backend/routes/students.js`, `NotificationCenter.jsx`,
`AdminDashboard.jsx`, `StudentSubmissionForm.jsx`) — clean merge, no
conflicts, but re-ran the entire verification suite against the merged
result anyway rather than trusting a clean merge to mean a correct one.

### Files Changed
- `sql/013_enable_rls_core_tables.sql`
- `sql/014_template_zones_and_field_sides.sql`
- `supabase/migrations/20260812_add_template_zones_and_layout.sql` (removed)
- `.github/workflows/ci.yml`
- `backend/routes/backup.js`
- `render.yaml`
- `backend/package.json`, `backend/package-lock.json`
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/src/App.jsx`
- `backend/temp_check.xml`, `backend/temp_s1.xml` (removed)

---

## 15. Feature: Sub-Percent Layout Precision, mm Readouts, Rounded Corners for Image Fields (commit `0f6b513`)

### Problem
Two related reports about mapping image fields (photo/signature) to a
printed template:
1. X pos, Y pos, Width, and Height for image fields could only be set
   to the nearest whole percent — the number inputs had `step="1"` and
   displayed `Math.round(val * 100)`, so even though the underlying
   stored value is full-precision (confirmed real saved layouts have
   values like `0.2978167255108173`), the input boundary rounded it
   away. On an 85.6mm-wide CR-80 card, a whole-percent step is close
   to a millimeter — enough to visibly miss a precisely designed photo
   frame.
2. Image fields always clip to a hard rectangle. Templates commonly
   have a rounded top corner on the photo frame; with no way to round
   the field to match, the printed photo's square corner sits on top
   of the template's rounded one.

### Solution
- **Precision**: `step="1"` → `step="0.1"` and display rounding
  changed from `Math.round(val * 100)` to `Math.round(val * 1000) / 10`
  (one decimal place), matching the pattern already used for font
  size, on X pos, Y pos, Width, and Height.
- **Physical measurement**: added `CARD_WIDTH_MM` (85.6) and
  `CARD_HEIGHT_MM` (54) to `lib/layoutConstants.js` — these were
  already hardcoded as magic numbers in two other files, now
  centralized — and a live read-only mm readout under each input
  (e.g. "8.5 mm from left"), so an admin with a measurement from the
  template's design file or a ruler can dial the percentage in while
  watching it converge on the target, instead of doing the conversion
  by hand.
- **Rounded corners**: new "Corner radius (%)" input for image fields,
  stored as `borderRadius` (fraction of card width, consistent with
  the existing x/width unit). `0` — the default, and what every layout
  saved before this has — means square corners, exactly matching
  behavior before this change. `CardCanvas.jsx`'s photo clip now
  traces a rounded-rect path (native `ctx.roundRect`, with a manual
  arc-based fallback for older browsers) instead of always using a
  plain rectangle; signature got the same optional clip, applied only
  when `borderRadius` is actually set, so its existing stretch-fit
  behavior is unchanged by default. QR is deliberately discouraged
  (a caption warns that rounding can hurt scan reliability) but not
  blocked, in case there's a real design reason to. The drag-editor's
  box overlay approximates the real radius while dragging too, so
  editing doesn't look misleadingly square-cornered — the Live Preview
  panel next to it remains the exact-pixel authority.

No backend changes needed — `checkLayoutConfig` only validates
`type`/`x`/`y` on each layout item, so the new `borderRadius`
sub-property passes through untouched.

### Mistake caught during review (fixed before commit)
Renamed the signature block's destination-coordinate variables from
`sx/sy/sw/sh` to `dx/dy/dw/dh`, since the photo block just above it
uses `sx/sy/sw/sh` for something completely different (the *source*
crop rectangle) — confusing to read even though it's not a functional
bug (separate block scopes). The rename itself introduced a real bug:
one branch still referenced the old names. Caught by reading the diff
before running lint, though confirmed the `no-undef` rule added in
item 11 would have caught it regardless.

### Verification
eslint (0 errors, same 14 pre-existing prop-types warnings), production
build (chunk sizes unchanged from item 14's code-splitting work,
confirming no regression there), full test suite (13/13).

### Files Changed
- `frontend/src/lib/layoutConstants.js`
- `frontend/src/components/CardCanvas.jsx`
- `frontend/src/components/LayoutMapper.jsx`

---

## 16. Fix: "Name Corrections" Stat Counted New Registrations and Unrelated Self-Corrections (commit `f92f793`)

### Problem
Reported: the Overview "Name Corrections" stat showed a nonzero count
with no student having ever submitted a name correction.

### Root Cause
Two independent bugs in `GET /api/analytics`, both unconditionally
wrong (not just wrong under some conditions):

1. Every `approved` row in `student_submissions` incremented
   `corrections_by_field.name`, regardless of what the submission was
   about. `student_submissions` is the self-service *new student*
   registration form — `submissions.js`'s `/approve` route explicitly
   rejects (409) any submission whose `student_id` already exists, so
   every approved submission is, by construction, a brand new student
   being added. There's no sense in which that's ever a "name
   correction."
2. Every `notifications` row with `type = 'self_correction'` also
   incremented the same counter — but that notification is generic
   ("Detail correction") and fires for *any* combination of fields the
   self-correct route accepts (name, year, position, or any of 9
   QR-payload fields like blood type or emergency contact). A student
   correcting only their blood type, with no name change at all, was
   counted as a name correction.

### Solution
Stopped counting `student_submissions` approvals toward corrections at
all. Replaced the notification-based count with one sourced from
`confirmations` where `action = 'self_corrected'`, matching each row's
`note` text against the fixed per-field prefixes `students.js`'s
self-correct route already writes (`"Name corrected to:"`,
`"Year corrected to:"`) to attribute each correction to the field that
actually changed. This is coupled to that route's exact note wording —
flagged in a code comment, since there's no structured field-list to
read instead. As a side effect this also fixes
`corrections_by_field.year`, which was dead code before this (defined,
never incremented) — `AdminDashboard.jsx` was already reading it for a
chart dataset, silently always rendering zero.

Also moved `photo_issues` off the same fragile `notifications`-type
count onto `confirmations` where `action = 'photo_issue'` — more
reliable, since that insert is `await`ed in `students.js` while the
matching notification insert is fire-and-forget with errors only
logged, so the two could silently drift apart.

No frontend changes needed — the "Name Corrections" stat card and
chart dataset were already reading the correct response shape; only
the backend computation was wrong.

### Verification
Syntax check, eslint (0 errors), full test suite (31/31). Confirmed
`confirmations.note` is an unbounded `TEXT` column with no DB-level
truncation risk, and that `MAX_NOTE_LENGTH` (1000 chars) is generous
enough in practice that the `"Name corrected to:"` prefix — always
first in the note, since `full_name` is pushed to the notes array
before `year_level`/`position`/QR fields — is never at risk of
truncation.

### Files Changed
- `backend/routes/analytics.js`

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
| `90bcb22` | Fix notification per-admin read state (service-role `auth.uid()` bug); add clear/delete endpoints + UI | Pushed |
| `28b97a4` | Admin action audit log + layout version history (backend) | Pushed |
| `f4a7425` | Admin action audit log + layout version history (frontend) | Pushed |
| `cb8c811` | Track RLS-enablement migration for the six core tables | Pushed |
| `c7c33c0` | Add GitHub Actions CI — lint/test/build on every push/PR | Pushed |
| `1459379` | Consolidate orphaned supabase/migrations file into sql/ | Pushed |
| `2f9a943` | Fix backup route missing 5 tables; render.yaml missing 3 required env vars | Pushed |
| `65f47c4` | Apply non-breaking dependency vulnerability fixes (16 → 4) | Pushed |
| `0e05d6a` | Route-based code splitting — 649KB single chunk → per-route chunks | Pushed |
| `65feb9f` | Remove stray debug output files | Pushed |
| `0f6b513` | Sub-percent layout precision + mm readouts + rounded corners for image fields | Pushed |
| `f92f793` | Fix Name Corrections stat — was counting new registrations + unrelated corrections | Pushed |

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
3. **Notification UI**: Spacing controlled in `index.css` under `.nc-filter-tabs` / `.nc-list`. Per-admin read state is computed server-side in `backend/routes/notifications.js` (joins `notification_reads` by `req.user.id`) — do NOT reintroduce the `admin_notifications` view there, since the backend uses the service-role key and `auth.uid()` is always NULL. Clear/delete = `DELETE /api/notifications` and `DELETE /api/notifications/:id` (global, shared table).
4. **Templates**: Stored in Supabase `templates` table; active per side (front/back).
5. **Settings persistence**: `portal_settings` table with keys `card_layout_front`, `card_layout_back`, `card_field_sides`.
6. **Template zones**: Stored in `templates.zones_front/back`, suggested layouts in `suggested_layout_front/back`.

---

*Last updated: August 14, 2026*