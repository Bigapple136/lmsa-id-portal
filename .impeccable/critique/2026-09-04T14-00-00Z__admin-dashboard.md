---
target: admin dashboard
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: "file:/home/user/lmsa-id-portal/admin-dashboard"
timestamp: 2026-09-04T14-00-00Z
slug: admin-dashboard
closed: true
---
⚠️ DEGRADED: static review only. `.github/skills/impeccable/scripts/detect.mjs` is absent from this checkout (the hook in `.github/hooks/impeccable.json` no-ops on its `[ ! -f ]` guard), and no Chromium/Playwright/Puppeteer binary is exposed. No screenshots were taken and none are claimed. Findings are derived from source plus targeted greps and counts.

Scope: the authenticated admin surface — `pages/AdminDashboard.jsx` (3,427 lines, six tabs), `pages/AdminManagementPage.jsx` (479), `pages/QrKeyManagement.jsx`, `components/LayoutMapper.jsx` (1,502, already audited and closed separately), and the shared admin components (`Toast`, `ConfirmDialog`, `Panel`, `EmptyState`, `StatusBadge`, `NotificationCenter`, `SessionTimeout`). These pages were explicitly out of scope for the two public-facing audits.

The public pages have now had two polish passes. The admin surface has had none, and it shows: this is where the codebase's remaining structural debt is concentrated.

## Design Health Score

**Score: 24 / 40** — **P0 = 1, P1 = 5**

| # | Nielsen heuristic | Score | Admin-facing read |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Skeletons on load, a toast system, per-action busy states. But toasts are not announced to assistive tech (P1-2), so a screen-reader admin gets no confirmation an action succeeded. |
| 2 | Match between system and real world | 3 | Language is operational and correct. Undermined by 44 emoji used as UI iconography (P1-5) — the exact pattern the public audit flagged and removed. |
| 3 | User control and freedom | 3 | Destructive actions route through `ConfirmDialog` in four places — genuinely good. But no tab is addressable by URL (P1-1), so there is no back button, no bookmark, and no deep link. |
| 4 | Consistency and standards | 2 | 147 inline `style={{}}` blocks in `AdminDashboard.jsx` alone, 29 more in `AdminManagementPage`, against **0** on every public page after this week's pass. The nav is duplicated verbatim (P0-1). |
| 5 | Error prevention | 3 | Confirm dialogs on deletes and bulk regeneration. Filters reset pagination correctly. |
| 6 | Recognition over recall | 3 | Six labelled tabs, a search box, two filter selects, a stat row that clicks through to filtered views. Reasonable. |
| 7 | Flexibility and efficiency | 2 | No bulk selection on the student table, no keyboard shortcuts, no saved views. Bulk QR generation exists but is all-or-nothing. |
| 8 | Aesthetic and minimalist design | 3 | The sidebar/topbar shell is clean. Density is high but appropriate for an operator tool. |
| 9 | Help users recover from errors | 3 | Toast errors carry a longer 5s duration and real messages. |
| 10 | Help and documentation | — | N/A for an internal operator tool with six trained users. |

## Assessment A — design review findings

### P0-1 — The primary navigation is duplicated verbatim, and neither copy is a tab

`AdminDashboard.jsx:1564-1601` renders the six-item nav twice: once as `.admin-sidebar-item` buttons inside `<nav className="admin-sidebar-nav">`, then again immediately below as `.admin-tab` buttons in `<div className="admin-tabs">`. The two lists are byte-identical in their tab array, their click handlers, and their label-casing ternary. Only CSS distinguishes them — `.admin-sidebar { display: none }` and `.admin-tabs { display: flex }` swap at the 900px breakpoint (`index.css:893-897`).

Three separate defects fall out of this:

1. **Both copies are always in the DOM.** A screen-reader user hears every navigation item twice, with no indication that one set is visually hidden. `display: none` removes the sidebar from the tree at narrow widths, but at wide widths `.admin-tabs` is `display: none` while still being announced — no, worse: it is *not* announced because `display:none` does remove it. The real cost is the maintenance one plus the second point below.
2. **Neither copy uses the tab pattern.** `grep -c 'role="tab'` returns **0**, and `aria-selected` / `aria-current` return **0**. The active state is communicated by a CSS class alone. A screen-reader admin cannot tell which of the six sections they are in.
3. **Any change must be made twice.** The "Admins" and "QR Keys" entries are already appended separately to each list, and the `userRole === 'admin'` guard is repeated. This is precisely how the two lists drift.

The fix is one array, rendered once, with `role="tablist"` / `role="tab"` / `aria-selected`, and CSS handling the sidebar-vs-scrolling-strip presentation.

### P1-1 — Tab state is invisible to the URL

`activeTab` is React state (`:235`) persisted to a draft object, and `useNavigate` is imported only to push to `/admin/admins` and `/admin/qr-keys`. There is no `useSearchParams`. Consequences for a daily operator: the browser Back button leaves the dashboard entirely rather than returning to the previous tab; a tab cannot be bookmarked or shared with a colleague ("look at the submissions queue" requires spoken instructions); a refresh restores from the draft blob rather than from an addressable location. For a tool people live in all day, this is the single biggest efficiency defect after the nav.

### P1-2 — Toasts are the primary feedback channel and are not announced

`Toast.jsx:41-58` renders `.toast-container` with no `role`, no `aria-live`, and no `aria-atomic`. `grep -c 'aria-live|role="alert"|role="status"'` across `AdminDashboard.jsx` returns **0**. Every success and failure message in the admin surface — CSV import results, QR generation, student saves, deletions — is delivered exclusively through this component. A blind admin performs a destructive bulk action and receives no confirmation of any kind. `.toast-container` also sets `pointer-events: none`; the dismiss button inside needs `pointer-events: auto` or it is unclickable (worth verifying in a browser, which this pass cannot do).

### P1-3 — 147 inline style blocks, immediately after the public pages reached zero

`AdminDashboard.jsx` carries 147 `style={{}}` blocks, `AdminManagementPage.jsx` 29, `LayoutMapper.jsx` 76. The public-pages pass just removed the last 31 from `PreviewPage.jsx` on the grounds that they defeat theming, cannot be overridden by the responsive media queries, and hide duplication. All of that reasoning applies here at roughly five times the volume. Note the trap found during the PreviewPage extraction: appending the extracted base rule *after* an existing media query silently defeats that override. Any extraction here must be checked against `index.css:890-940`, which already contains admin-specific responsive rules.

### P1-4 — The student table is not a table

The students tab renders rows as `<div>`s: `grep -c '<table'` and `grep -c '<th'` both return **0**. With search, two filters, and pagination over a paged student list, this is a data grid in everything but markup. No column headers are programmatically associated with cells, there is no row/column navigation, and sorting cannot be expressed. Seven `<div>` elements across the file also carry `onClick` without a `role` or `tabIndex` — including the clickable "Issues" and "Photo Issues" stat cards (`:1657-1680`), which are keyboard-unreachable shortcuts to filtered views.

### P1-5 — 44 emoji used as interface iconography

`AdminDashboard.jsx` contains 44 emoji/symbol characters, including 🎨 ×4, ⬆ ×4, 🔲 ×3, 📋 ×3, ⬇ ×3, 👤, 📊, 📄, 📦, 🔄. They appear as section markers ("🔲 QR Code Management", `:2972`) and inside button labels ("⚡ Generate missing QR codes", `:2984`). Screen readers pronounce these — "white square button QR Code Management" — and they render inconsistently across platforms. The public audit flagged exactly this pattern and its removal was recorded as resolved; the admin surface never got the same treatment.

## Assessment B — deterministic scan and browser evidence

No detector script and no browser binary in this checkout, so this section is grep- and count-based only. No overlay, contrast, or focus-order evidence is claimed.

| Signal | Command | Result |
|---|---|---|
| Inline styles | `grep -c "style={{"` | 147 / 29 / 76 across dashboard, management, mapper |
| Tab semantics | `grep -c 'role="tab'` | 0 |
| Active-state semantics | `grep -c 'aria-selected\|aria-current'` | 0 |
| Live regions | `grep -c 'aria-live\|role="alert"\|role="status"'` | 0 |
| Table markup | `grep -c '<table'` | 0 |
| Emoji | scripted scan | 44 |
| Page titles | `grep -c useDocumentTitle` | 0 in both admin pages |
| `<h1>` | `grep -n '<h1'` | 1, and it is on the *logged-out* login card only |
| Destructive-action guards | `grep -c ConfirmDialog` | 9 references / 4 dialogs — a genuine strength |

The `<h1>` count deserves emphasis: once an admin logs in, the page has **no `<h1>` at all** and no `<main>` landmark. The public pages were just fixed for exactly this.

## Persona red flags

- **Registrar doing a Monday submissions sweep.** Opens the queue, clicks into a student, hits Back to return to the list — and lands outside the dashboard, because no tab is a URL (P1-1). Does this several times a day.
- **Admin using a screen reader.** Hears the six-item navigation without knowing which item is current (P0-1), triggers a bulk QR regeneration, and receives no spoken confirmation that anything happened (P1-2).
- **Keyboard-only operator.** Can reach the six nav buttons, but not the "Issues" stat card that is the fastest route to the students who need attention (P1-4).
- **New staff member handed the tool.** Sees 🔲, 📦, ⚡ and 🎨 as section markers and has to learn a private icon vocabulary that carries no consistent meaning (P1-5).

## Minor observations

- `toLocaleDateString` is called at 6 sites with locally-specified options rather than a shared formatter; the public pages hit the same inconsistency.
- No `useDocumentTitle` on either admin page, so every admin tab is titled identically in the browser and in history. The hook now exists and is a one-line addition per page.
- `AdminDashboard.jsx` at 3,427 lines with six tab bodies inline is the root cause of most of the above; splitting each tab into its own component is the structural fix that makes the rest tractable.
- Bulk QR generation is all-or-nothing with no selection model, and no progress indication beyond a single busy flag.

## Trend and persistence

The public surface went 23 → 29 across two passes. The admin surface enters at **24** with the same defect classes the public pages have already retired — emoji iconography, missing landmarks and `<h1>`, absent page titles, inline styles. This is not coincidence: fixes were applied page-by-page on the public routes and never propagated inward. The lesson for the fix order below is to prefer the shared-component fixes (Toast live region, one nav component) that cannot drift again.

## Recommended fix order

1. **P0-1** — collapse the duplicated nav into one component with real `role="tablist"` semantics and `aria-selected`. Fixes the duplication and the missing active-state announcement together.
2. **P1-2** — add `role="status"` / `aria-live="polite"` to `.toast-container` (and `aria-live="assertive"` for the error type), plus `pointer-events: auto` on the dismiss button. One shared component, fixes every admin action at once.
3. **P1-1** — drive `activeTab` from `useSearchParams` so tabs are addressable, bookmarkable, and Back-navigable.
4. **P1-4** — real `<table>` markup for the student list, and `role="button"` + `tabIndex` + key handlers on the clickable stat cards.
5. **P1-5** — strip the 44 emoji, matching what the public pages already did.
6. **P1-3** — extract the 147 inline style blocks, checking each against the existing admin media queries at `index.css:890-940`.
7. Then the structural work: split the six tab bodies out of the 3,427-line file, and add `useDocumentTitle` + `<main>` + an `<h1>` to the authenticated view.

## Targeted questions

1. Should tab state live in the query string (`/admin?tab=students`) or in real nested routes (`/admin/students`)? Routes are cleaner and match the existing `/admin/admins` and `/admin/qr-keys` pages, but the migration touches the draft-restore logic at `:334`.
2. The student table has search, two filters, and pagination but no bulk selection. Is multi-select with bulk approve/delete wanted, or is single-student review the deliberate workflow?
3. Bulk QR regeneration currently regenerates for everyone. Should it be scoped to the current filter, which would make it far less dangerous?
4. Is the 900px sidebar/tab-strip switch still the right breakpoint, and do admins actually use this on tablets? It determines whether the unified nav keeps two presentations or collapses to one.

## Progress — 2026-09-04, first implementation pass

Items 1–5 of the fix order are shipped. **P1-3 (inline styles) and the item-7 structural work remain open, so this snapshot stays `closed: false`.**

| Item | State | What shipped |
|---|---|---|
| P0-1 duplicated nav | **Fixed** | One `ADMIN_TABS` array and one `<AdminNav>` component render both presentations. Real `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`, roving `tabIndex`, and Arrow-Left/Right movement per the WAI-ARIA tabs pattern. Sibling routes (Admins, QR Keys) stay plain buttons — they are navigation, not tabs. |
| P1-2 silent toasts | **Fixed** | `.toast-container` is `role="status"` `aria-live="polite"` and is now rendered **unconditionally** — a live region must exist in the DOM before content is inserted or the insertion is not announced. Errors escalate to `role="alert"`. The decorative glyph is `aria-hidden`. |
| P1-1 unaddressable tabs | **Fixed** | `activeTab` derives from `useSearchParams` (`/admin?tab=students`), validated against `ADMIN_TABS` with a fallback to `overview`. `overview` clears the param rather than writing a redundant one. Uses `replace` so tab switching does not bloat history. |
| P1-4 keyboard-unreachable shortcuts | **Partly fixed** | The two clickable stat cards are now real `<button>`s with a `disabled` state when the count is zero. **The student list is still `<div>`-based; real `<table>` markup is not done.** |
| P1-5 emoji | **Fixed** | Every emoji embedded in a *visible text label* is gone (section titles, button labels, filename chips, the `QR ✓` badge → `QR ready`). The remainder sit in dedicated decorative slots and are now `aria-hidden="true"`, so none are announced. |
| Landmarks / title | **Fixed** | The authenticated view gained `<main>` and a real `<h1>`; `useDocumentTitle` reflects the active tab, so history entries are distinguishable. |

### Verification

- Frontend: **95 passed / 15 files** — 13 new tests in `adminTabs.test.jsx` (tablist semantics, single-selected invariant, roving tabindex, arrow-key wrap, role-gated links) and `adminNav.test.jsx` (live region mounted before first toast, polite vs assertive, dismissal).
- Backend: **55 passed** — untouched by this pass.
- `npx vite build` clean; dev server boots and `/admin` returns 200.
- `npm run lint`: **0 errors, 131 warnings** — 121 pre-existing plus 10 `react/prop-types` on the new `AdminNav`. No component in this repo declares PropTypes, so matching the house convention was preferred over introducing a lone exception. One `exhaustive-deps` warning was resolved with a documented disable on the mount-only draft-restore effect, where re-running would resurrect a discarded draft.

### Still open

- **P1-3** — 147 + 29 + 76 inline style blocks. Untouched. Check each against the admin media queries at `index.css:890-940`.
- **P1-4 remainder** — the student list needs real `<table>` markup.
- **Item 7** — splitting the six tab bodies out of the now ~3,500-line `AdminDashboard.jsx`.
- All four targeted questions above are still unanswered. Tab state was implemented as a **query string** rather than nested routes (question 1) because it left the draft-restore logic intact; that decision is reversible.

## Progress — 2026-09-04, second implementation pass (item 7: file split)

`AdminDashboard.jsx` **3,497 → 1,560 lines**. The six tab bodies and the shared pieces now live in `frontend/src/pages/admin/`:

| Module | Lines | Notes |
|---|---:|---|
| `UploadTab.jsx` | 634 | Largest tab; 32 context bindings. |
| `StudentsTab.jsx` | 509 | 29 bindings. Still `<div>`-based — see below. |
| `OverviewTab.jsx` | 328 | |
| `SettingsTab.jsx` | 298 | |
| `SubmissionsTab.jsx` | 128 | |
| `LayoutTab.jsx` | 45 | |
| `ActivityLogSection.jsx` | 112 | Was already a standalone component. |
| `AdminNav.jsx` | 94 | Moved out whole; its test now imports it directly and no longer needs supabase/api mocks. |
| `RenewCohortSection.jsx` | 71 | Was already standalone. |
| `constants.js` | 29 | `YEARS`, `LIBERIA_COUNTIES`, `FIELD_META`. |
| `DashboardContext.jsx` | 25 | |

### Why context rather than props

Dependencies were measured with an AST pass, not guessed: the tabs need **13 / 32 / 9 / 9 / 18 / 29** bindings respectively, 93 unique in total. Prop-drilling that would have replaced one long file with an unreadable prop list at every call site. `DashboardProvider` keeps each tab a plain component while **all state remains owned by `AdminDashboard`** — no state moved, no ownership changed, no change to when anything updates.

### Correctness check

The refactor was performed with an AST tool rather than by hand, then **verified by re-parsing the pre-refactor file (`734cc5d`) and diffing each tab body against the extracted component**. All six are textually identical, whitespace-normalised:

```
IDENTICAL  overview     299 lines
IDENTICAL  upload       583 lines
IDENTICAL  layout        25 lines
IDENTICAL  submissions  108 lines
IDENTICAL  settings     259 lines
IDENTICAL  students     465 lines
```

Two defects surfaced during the move, both caught by lint's `no-undef` rather than by the build (Vite happily bundled both):

- The generated `dashboard` context object was inserted at the first textual match for `if (!session)` — which was **inside a `useEffect`**, not the render guard. It compiled and shipped a broken effect body. Relocated ahead of the render guard.
- `ActivityLogSection` used `useEffect` without importing it once separated from the parent's import list.

This is the argument for running lint as a gate on mechanical refactors: `vite build` passed in both broken states.

### Verification

- Frontend **97 passed / 16 files** (2 new context tests: value delivery, and a loud failure when a tab renders outside the provider).
- Backend **55 passed** — untouched.
- `npm run lint`: **0 errors**, 141 warnings (up from 131; the +10 are `react/prop-types` on the newly-separated components, matching the existing house convention).
- Clean build; dev server serves `/`, `/admin`, `/admin?tab=students`, `/admin?tab=settings`, and every new module transforms without error.

### Still open

- **P1-3** — inline styles: 147 in the original dashboard (now distributed across the tab files), 29 in `AdminManagementPage`, 76 in `LayoutMapper`. Untouched.
- **P1-4 remainder** — `StudentsTab` still needs real `<table>` markup.

The split makes both of these materially easier: the student table work is now confined to a 509-line file instead of a 3,500-line one.

## Progress — 2026-09-04, third pass (P1-4: the student table)

The student list is now a real `<table>`, and the row moved into its own `StudentRow.jsx` (previously a `<div class="student-row">` stack inside the tab body).

- `<thead>` with five `<th scope="col">` columns; the two purely-visual columns carry `sr-only` labels rather than empty headers.
- The student's name is the row's `<th scope="row">`, so every cell is programmatically associated with the person it describes.
- A `<caption class="sr-only">` announces the page position and result count.
- **Every action now names its student.** Previously a screen-reader user met a page of identical "Edit", "Delete", and "Regenerate" buttons with no way to tell rows apart; each carries an `sr-only` suffix naming the student.
- The photo is `alt=""` and the initials fallback is `aria-hidden` — the row header already announces the name, so both would otherwise repeat it.
- Below 700px the table restyles into stacked cards, since a five-column table cannot hold its shape on a phone.
- The row's **22 inline style blocks became 0**, replaced by `.student-*` classes.

Also folded in: the three duplicated signed-URL fetches (preview, verification page) collapsed into one `openSignedUrl` helper, which encodes the student id — a student id containing `/` or a space previously produced a malformed request path. That is covered by a test.

**Verification:** frontend **107 passed / 17 files** (10 new `StudentRow` tests), backend 55, 0 lint errors, clean build, `/admin?tab=students` serves and both new modules transform.

### Still open

- **P1-3** — inline styles remain: `UploadTab` 38, `AdminManagementPage` 29, `StudentsTab` 25, `OverviewTab` 20, `SettingsTab` 15, `ActivityLogSection` 14, `AdminDashboard` 12, `SubmissionsTab` 7, `RenewCohortSection` 6, plus 76 in `LayoutMapper`.

## Progress — 2026-09-04, fourth pass (P1-3: inline styles). Snapshot closed.

Inline `style={{}}` blocks across the admin surface: **166 → 64**, and every one of the 102 removed was a *fully static* object.

The approach matters here. A naive pass would have invented a bespoke class per style object, trading 147 inline blocks for 147 single-use classes — no real improvement. Counting declarations instead showed heavy token-level repetition (`fontSize: '12px'` ×31, `color: 'var(--muted)'` ×30, `display: 'flex'` ×21), so the fix is a small **75-rule utility layer** and a transformer that only rewrites style objects whose declarations *all* map. Anything unmapped was left alone.

**The 64 that remain are deliberate**, and fall into two groups:

1. **Genuinely dynamic** — e.g. `transform: open ? 'rotate(180deg)' : 'none'`. These are computed from state and belong inline.
2. **One-off geometry** — `width: '60%'`, `maxHeight: '320px'`, `width: '180px', height: '180px'` on the chart doughnut. A utility class for a value used once adds indirection without buying anything.

### Verification

Rather than trust the transformer, the conversion was checked by re-reading each file at the pre-conversion commit (`4707067`), recomputing which style objects were fully mappable, and confirming that (a) none remain inline and (b) no emitted class lacks a CSS rule:

```
Total fully-mappable inline styles before: 102
Still inline and mappable after:            0
unknown classes: none, in any file
```

Lint caught 7 `react/jsx-no-duplicate-props` errors the build did not: the transformer merged utilities into an existing `className="..."` string, but 7 tags carried a *dynamic* `className={...}` expression it didn't match, so both attributes were emitted. React silently keeps the last one — these tags would have lost their `info-box` / `success-box` / `error-box` styling entirely. Merged into template literals. **This is the second time in this workstream that lint caught a mechanical-refactor defect that `vite build` accepted.**

Final state: frontend **107 passed / 17 files**, backend **55 passed**, **0 lint errors** (173 warnings, all pre-existing categories), clean build, every admin module transforms and serves, and the utility rules are present in source, in dev, and minified into the production bundle.

All seven items in the recommended fix order are now complete, so this snapshot is **closed**. Score moves **24 → 34/40** on re-read: the P0 and all five P1s are resolved; remaining deductions are the unaddressed efficiency items (no bulk selection on the student table, no saved views, all-or-nothing QR regeneration) and the four still-unanswered policy questions.
