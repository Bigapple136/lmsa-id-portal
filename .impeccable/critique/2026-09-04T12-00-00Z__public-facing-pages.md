---
target: public-facing pages
total_score: 29
max_score: 40
na_heuristics:
p0_count: 1
p1_count: 4
target_identity: "file:/home/user/lmsa-id-portal/public-facing-pages"
timestamp: 2026-09-04T12-00-00Z
slug: public-facing-pages
closed: false
---
⚠️ DEGRADED: static review only. `.github/skills/impeccable/scripts/detect.mjs` is absent from this checkout (the hook in `.github/hooks/impeccable.json` no-ops on its `[ ! -f ]` guard), and no Chromium/Playwright/Puppeteer binary is exposed. No screenshots were taken and none are claimed; no detector or overlay evidence. Findings are derived from source plus targeted greps.

Scope: every route a student or stranger can reach without logging in — `LandingPage.jsx` (`/`), `PreviewPage.jsx` (`/preview/:token`), `QrViewPage.jsx` (`/qr/:token`), `StudentSubmissionForm.jsx` (`/submit`), `StudentStatusPage.jsx` (`/status`), `StudentStatusCheck.jsx` (`/check-status`), `AboutPage.jsx`, `TermsPage.jsx`, `PrivacyPage.jsx`, plus shared `Navbar.jsx`, `Footer.jsx`, the public read paths in `backend/routes/qr.js`, and the relevant `index.css` rules.

This is a **re-audit**, not a baseline. Two prior snapshots cover this ground: `2026-09-02T15-37-25Z__frontend-src-pages-landingpage-jsx` and `2026-09-02T15-53-32Z__public-facing-pages-excluding-landing` (23/40, P0=1, P1=3), both marked closed after a polish pass. The first job was verifying that what was recorded as fixed actually shipped.

## Prior findings — verified against current source

| Prior finding | State | Evidence |
|---|---|---|
| P0: `/qr/:studentId` hit an admin-only raw-student endpoint | **Resolved** | Route is now `/qr/:token` (`App.jsx:95`); `QrViewPage.jsx:87` calls `apiFetch('/api/qr/verify/:token')`; `backend/routes/qr.js:131-133` carries an explicit comment that it never accepts raw student IDs. |
| P1: required submission fields not enforced | **Resolved** | `validateFields` / `validateStep` / `validateAllSteps` (`StudentSubmissionForm.jsx:165-243`), per-step field maps, `aria-invalid` and `aria-describedby` on inputs, and a jump-to-first-error-step on submit. |
| P1: corrections could submit empty/ambiguous values | **Resolved** | `buildValidatedCorrectionBody` (`PreviewPage.jsx:266+`) rejects empty values *and* values identical to the current record, per field. |
| P1: Navbar brand was a clickable `div`; weak recovery states | **Resolved** | `Navbar.jsx:14` is a real `<Link>` with `aria-label`; hamburger has `aria-expanded`/`aria-controls`; QR, status, and preview error states all carry recovery actions. |
| P2: emoji icons, vendor-first About | **Resolved** | Zero emoji across all nine public pages (scripted scan). `AboutPage.jsx:37-45` now leads with the LMSA portal; GoldWay appears as attribution below. |

The polish pass was real. Score moves 23 → 29. What follows is what a fresh pass finds underneath.

## Design Health Score

**Score: 29 / 40** — **P0 = 1, P1 = 4**

| # | Nielsen heuristic | Score | Public-facing read |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Loading, error, and busy states are consistent and mostly announced. The gap is the *credential's* status: a verifier cannot see whether a card is current (P0-1). |
| 2 | Match between system and real world | 3 | Copy is plain and student-appropriate. "Credential verified" overstates what was actually checked — a signature, not a card's validity. |
| 3 | User control and freedom | 2 | Every dead end now offers recovery routes. But a 4-step form with no draft persistence means one interruption costs the whole submission (P1-2). |
| 4 | Consistency and standards | 3 | Strong convergence since the polish pass. `PreviewPage` remains the outlier with 31 inline `style={{}}` blocks against 0 on every other public page. |
| 5 | Error prevention | 3 | Client validation is now genuine on both the wizard and corrections. No confirm step before a student submits identity data they cannot edit afterwards. |
| 6 | Recognition rather than recall | 3 | The journey is cross-linked at failure points. Every route still shares one static browser title, so tabs and history are indistinguishable (P1-4). |
| 7 | Flexibility and efficiency of use | 3 | Multiple entry paths, sensible autocomplete, mobile menu. No way to resume anything. |
| 8 | Aesthetic and minimalist design | 3 | The Registrar's Seal reads clearly and consistently now. |
| 9 | Help users recognize, diagnose, recover | 3 | Recovery actions are specific and well-placed. |
| 10 | Help and documentation | 3 | Legal pages are concrete; contextual help sits near forms and errors. |

## Design-specificity verdict

**Qualified pass — materially improved, one trust defect open.** The public area now reads as one service rather than a set of screens: shared navigation, a consistent seal-and-card language, real recovery routes at every dead end, and genuine client-side validation on the two flows that mutate identity data.

The remaining defect is not cosmetic. `/qr/:token` is the only surface an outsider ever sees — a clinic receptionist, a security officer, an examiner — and it renders an unqualified "Credential verified" badge for a card that may have expired months ago, because the payload deliberately withholds the dates that would say so. Everything else below it is craft.

## Assessment A — design review findings

### What is working

- **The QR verification page is the best-composed surface in the app.** Signed-token-only, `Cache-Control: no-store`, a field allow-list, an explicit privacy note, and a genuinely institutional card composition.
- **Correction validation understands the domain.** Rejecting a "correction" identical to the existing value (`PreviewPage.jsx:278`) is the kind of check that only gets written by someone thinking about the admin who receives the queue.
- **Recovery is now systematic.** Invalid QR, expired preview, bad status link, and failed lookup each offer two concrete next actions plus a human fallback.
- **The submission wizard's error handling is thorough.** It validates all steps on submit, finds the *first* step containing an error, and navigates there rather than failing in place.
- **The public/QR data boundary is explicitly modelled.** `buildPublicVerificationStudent` (`backend/routes/qr.js:104`) is an allow-list, not a deny-list.

### P0-1 — The QR page certifies "verified" without ever checking whether the card is still valid

Evidence:
- `buildPublicVerificationStudent` (`backend/routes/qr.js:104-129`) returns `full_name`, `student_id`, `year_level`, `photo_url`, and nine opt-in QR fields. It returns **neither `valid_until` nor `issue_date` nor `status`**.
- Those columns exist: `sql/010_issue_and_validity.sql:8` adds `valid_until DATE`; `sql/001_core_schema.sql:124` defines `status` with `CHECK (status IN ('pending','approved','rejected'))`.
- `GET /api/qr/verify/:token` (`:133-157`) verifies the token signature and that the student row exists. It applies no validity or status predicate whatsoever.
- On success the page renders a gold seal reading **"Credential verified"** (`QrViewPage.jsx:177-182`) and a footer reading "LMSA ID Verification".

Impact: the page conflates *this QR was signed by LMSA and the student exists* with *this student's card is currently valid* — and only displays the second, stronger claim. A card that expired last year, or a record set to `rejected`, produces an identical gold "Credential verified" badge to a current one. The signed-token architecture is sound; the presentation overstates it. For the one surface whose entire purpose is letting a stranger trust a card, that is a correctness defect, not a wording preference. It also silently defeats the admin renewal flow: renewing cohorts changes `valid_until`, which no verifier can see.

Recommendation: add `valid_until`, `issue_date`, and a derived validity state to the verification payload. Render the dates on the card and make the badge state-dependent — "Valid until 12 March 2027" in gold, "Expired 4 January 2026" in red with an unmistakable treatment, "Not currently active" for a non-approved record. Keep serving the record either way (a verifier needs to see *what* expired), but never label an expired card "verified". This is a backend + frontend change; the schema already holds everything required.

### P1-1 — `PreviewPage` has no heading at all, and no `<main>` landmark

Evidence:
- Scripted scan across the nine public pages: `PreviewPage.jsx` returns **`<h1>`: 0** and **`<main>`: 0**. It is the only public page with neither.
- `LandingPage.jsx`, `TermsPage.jsx`, and `PrivacyPage.jsx` also lack `<main>` (they do have an `<h1>`).
- No skip link exists anywhere in the app (`grep 'skip-link|Skip to'` across `src/` and `index.html`: no matches).

Impact: `/preview/:token` is the page the entire landing-page funnel delivers students to, and the page where they confirm or correct their identity record. A screen-reader user landing there gets no page title in the heading hierarchy and no landmark to jump to — they must traverse the navbar linearly on every visit, on the one page where careful reading matters most. The absent skip link compounds this across every public route.

Recommendation: add an `<h1>` to `PreviewPage` ("Your LMSA student ID card" or similar, visually styled to taste) and wrap the content in `<main>`. Add `<main>` to Landing, Terms, and Privacy. Add one shared skip link in `App.jsx` targeting a consistent `#main-content` id.

### P1-2 — A four-step identity submission with no draft persistence

Evidence:
- `STEPS` (`StudentSubmissionForm.jsx:27-32`) is four stages: Personal, Academic, Additional, Review.
- The review summary (`:273-290`) enumerates up to ~13 collected values.
- No `localStorage`, `sessionStorage`, or `beforeunload` handler exists in any public page. The only `beforeunload` in the codebase is the one I added to `LayoutMapper` in the admin area (`LayoutMapper.jsx:224`).
- All state is component-local `useState`, discarded on unmount.

Impact: this form is aimed at students who may be on shared devices, intermittent connections, or a phone that backgrounds the tab. A dropped connection, an accidental back gesture, or a mistaken tab close at step 3 costs everything — and the flow is *most* likely to be abandoned exactly where the most work has been invested. The prior snapshot flagged this for the "distracted mobile user" persona and it remains untouched.

Recommendation: persist the form to `sessionStorage` on change, restore on mount with a visible "We restored your draft — you can start over" affordance, and clear on successful submit. Deliberately exclude nothing sensitive — the student is entering their own data on their own device — but scope it to `sessionStorage` rather than `localStorage` so a shared browser does not retain it after the tab closes. Add a `beforeunload` guard once any field is dirty.

### P1-3 — Identity data is submitted with no final confirmation step

Evidence:
- The review step's submit is guarded only by `disabled={!agreed || submitting}` (`StudentSubmissionForm.jsx:742`) — a terms checkbox, not a review acknowledgement.
- The step is titled "Review & Submit" and does render a summary table, which is good — but a single click commits it.
- The student cannot subsequently edit: correcting a submitted record requires the separate preview-token correction flow, or contacting the faculty office.

Impact: the terms checkbox and the accuracy of a date of birth are unrelated concerns, but one checkbox currently stands for both. Given the record feeds a printed credential and the correction path is materially harder than the submission path, the asymmetry deserves one more beat of friction.

Recommendation: keep the single click, but make the review step earn its name — mark each summary row with an inline "Edit" link jumping back to its step, and change the submit affordance to state consequence plainly ("Submit — LMSA will use these details to print your card"). If a stronger gate is wanted, a separate "I have checked these details are correct" checkbox, distinct from the terms agreement.

### P1-4 — Every route shares one static browser title

Evidence:
- `index.html:6` sets `<title>LMSA ID Portal</title>`.
- No `document.title` assignment, `useDocumentTitle` hook, or `<title>` management exists anywhere in `src/` (scripted grep: single match, in `index.html`).

Impact: every tab, every bookmark, every browser-history entry, and every screen-reader page announcement is the identical string. A student with the portal open alongside their email cannot tell the preview tab from the submission tab. Returning to a bookmarked `/check-status` gives no indication of what it was. For screen-reader users the page title is the primary "where am I now" signal on navigation, and in a SPA it is the only one that fires.

Recommendation: a small `useDocumentTitle(title)` hook called once per public page — "Preview your ID card · LMSA", "Submit your details · LMSA", "Verify credential · LMSA", and so on. ~15 lines plus one call per page.

## Assessment B — deterministic scan and browser evidence

- **Detector:** unavailable (`.github/skills/` absent). The 2026-09-02 runs recorded 0 findings on public JSX and 15 CSS-only advisories (13 `overused-font` for Inter, 2 `side-tab` in admin/settings rules). Nothing in the current public markup would change that: the emoji and glyph-icon findings those runs described are gone.
- **Lint:** `npm run lint` — 0 errors, 121 warnings, all pre-existing (`react/prop-types` and `react/no-unescaped-entities`). None in the public pages are new.
- **Tests:** `npm test` — 71 passed / 12 files. `backend` — 45 passed / 5 files.
- **Browser:** no binary exposed; no screenshots taken, none claimed.
- **Scripted scans performed:** emoji census across nine public pages + Navbar/Footer (0 found); inline-`style` census (PreviewPage 31, all others 0); `aria-live`/`role="alert"` census (present on every async surface except the three static legal pages, which need none); `<main>`/`<h1>` landmark census (table in P1-1); skip-link grep (none); `document.title` grep (none); draft-persistence grep (none).

## Persona red flags

- **A clinic receptionist scanning a printed card:** sees "Credential verified" in gold and has no way to learn the card expired eleven months ago. This is the persona the QR page exists for, and the one it currently misleads.
- **Jordan (first-timer) on a phone, mid-submission:** takes a call at step 3, returns to an empty step 1. Most likely outcome is abandonment, and LMSA never learns the student tried.
- **Sam (screen-reader user) opening a preview link:** lands on a page with no heading and no landmark, and hears the same "LMSA ID Portal" title they heard on the landing page — no confirmation the navigation even succeeded.
- **A student with three portal tabs open:** all three are titled "LMSA ID Portal".
- **Riley (stress tester):** will scan an expired card first, and will find that the page's strongest claim is the one it never checks.

## Minor observations

- `PreviewPage.jsx` carries 31 inline `style={{}}` blocks — including the entire expiry-banner treatment at `:456-470` — while every other public page has zero. Token drift risk sits almost entirely in this one file.
- 63 CSS rules in `index.css` set a font size of 9–11px. Worth a contrast/legibility pass against the public pages specifically; small metadata text is fine, small *actionable* text is not.
- `QrViewPage` renders `year_level` with a fallback of the college name (`:218`) — a level and an institution are different facts and should not share a slot.
- `StudentStatusPage` shows `new Date(data?.updated_at || Date.now())` (`:143`) — if `updated_at` is ever missing, this silently renders *now* as the last-updated time. Prefer an explicit "Not recorded".
- The QR page's `isVerified` badge is gated behind a 300ms `setTimeout` (`QrViewPage.jsx:100-102`) purely for staging effect; harmless, but it means the badge and the data appear at different moments on a fast connection.
- Loading copy is now consistent across public pages ("Verifying credential", "Loading correction status") — the prior snapshot's "standardize loading language" observation has been addressed.
- Legal pages still cite `lmsa-id-portal.vercel.app`; worth confirming against the production domain before relying on it as legal copy. Carried forward unresolved from 2026-09-02.

## Trend and persistence

Trend: **23/40 → 29/40**, P0 1→1, P1 3→4. The prior P0 (public QR route hitting an admin endpoint) is genuinely resolved; the new P0 is a different defect on the same page, found only by comparing the payload against the schema rather than against the route's security. P1 count rises because three previously-open P1s closed and four new ones surfaced at the next level of scrutiny — landmarks, drafts, confirmation, and titles are all things a first pass reasonably defers.

Prior snapshots: `2026-09-02T15-37-25Z__frontend-src-pages-landingpage-jsx`, `2026-09-02T15-53-32Z__public-facing-pages-excluding-landing`.
Snapshot path: `/home/user/lmsa-id-portal/.impeccable/critique/2026-09-04T12-00-00Z__public-facing-pages.md`.

## Recommended fix order

1. **P0-1** — put validity in the QR payload and stop labelling expired cards "verified". Trust defect on the one page strangers see.
2. **P1-1** — `<h1>` and `<main>` on `PreviewPage`; `<main>` on Landing/Terms/Privacy; one shared skip link.
3. **P1-4** — per-page document titles (smallest effort of the four, immediate orientation benefit).
4. **P1-2** — `sessionStorage` draft persistence for the submission wizard.
5. **P1-3** — per-row Edit links on the review step and consequence-bearing submit copy.
6. Extract `PreviewPage`'s 31 inline style blocks into `index.css` classes.

## Targeted questions

1. Should an **expired** card's QR still show the record (marked expired), or refuse and direct the holder to LMSA? I recommend showing it — a verifier needs to know *what* expired — but this is a policy call.
2. Should a `rejected` or `pending` student record verify at all, or return the same "not verified" state as a bad signature?
3. For draft persistence, is `sessionStorage` acceptable given shared-device use, or should drafts be avoided entirely for identity data?
4. Is `lmsa-id-portal.vercel.app` still the production domain the legal pages should name?
