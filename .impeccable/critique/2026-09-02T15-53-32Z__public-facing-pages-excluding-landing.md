---
target: public-facing pages excluding landing
total_score: 23
max_score: 40
na_heuristics:
p0_count: 1
p1_count: 3
target_identity: "file:/home/user/lmsa-id-portal/public-facing-pages-excluding-landing"
timestamp: 2026-09-02T15-53-32Z
slug: public-facing-pages-excluding-landing
closed: true
---
⚠️ DEGRADED: single-context (no sub-agent/Task tool exposed)

Scope: public-facing pages except the landing page already critiqued/polished. Reviewed `PreviewPage.jsx`, `QrViewPage.jsx`, `StudentSubmissionForm.jsx`, `StudentStatusCheck.jsx`, `StudentStatusPage.jsx`, `AboutPage.jsx`, `TermsPage.jsx`, `PrivacyPage.jsx`, plus shared `Navbar.jsx`, `Footer.jsx`, and relevant `index.css` rules.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Submission, preview, status, and QR pages all have loading/error states, but many are not announced semantically and some dead-end states give no next action. |
| 2 | Match System / Real World | 3 | Student-facing copy is mostly plain, but QR/status routes expose implementation ambiguity and About/legal pages shift from LMSA service to GoldWay vendor framing. |
| 3 | User Control and Freedom | 2 | Preview and submission flows have back/cancel controls, but invalid/expired status and QR states lack strong recovery paths; long forms do not preserve student progress. |
| 4 | Consistency and Standards | 2 | Navy/gold/teal tokens are present, but public pages vary heavily in header model, inline styling, icons/emoji, form semantics, and LMSA/GoldWay emphasis. |
| 5 | Error Prevention | 2 | Dynamic “required” fields can be skipped, QR/correction fields can submit empty values, and several forms rely on late server rejection instead of client-side prevention. |
| 6 | Recognition Rather Than Recall | 2 | The flows expose useful fields, but students must infer exact name/ID conventions, token meaning, QR route behavior, and what to do after missing/expired links. |
| 7 | Flexibility and Efficiency of Use | 2 | Students have multiple routes (`/preview`, `/submit`, `/check-status`, `/status`), but they are not consistently cross-linked at failure points. |
| 8 | Aesthetic and Minimalist Design | 2 | The stronger pages follow the design system; QR/status/About pages drift into emoji/glyph iconography, inline one-off layouts, and mixed service/vendor hierarchy. |
| 9 | Error Recovery | 2 | Errors are readable, but recovery is often generic: “contact LMSA/admin,” “Access Denied,” or “Invalid or expired credential” without task-specific next steps. |
| 10 | Help and Documentation | 3 | Terms and Privacy are substantial, and some inline guidance exists; contextual help near sensitive verification/correction decisions remains thin. |
| **Total** | | **23/40** | **Acceptable — useful public workflows exist, but the QR path, validation, and cross-page consistency need hardening before this feels production-finished.** |

## Design Specificity Verdict

**LLM assessment:** The public surface is clearly not generic: it carries LMSA/A.M. Dogliotti identity, student card language, correction flows, QR details, and a privacy-aware institutional palette. The strongest areas are the submission wizard and preview flow, which understand the actual ID-card workflow. The weak point is consistency and operational truth. Some pages feel like an official LMSA student-service portal; others feel like a vendor brochure, an admin-derived utility page, or a styled technical status page. That fragmentation matters because this is a live identity/verification product: public pages must feel like one controlled service.

**Deterministic scan:** Static scan of the public JSX files returned **0 findings**. A broader scan including `frontend/src/index.css` returned **15 advisory warnings**: 13 `overused-font` findings for Inter usage and 2 `side-tab` findings in admin/settings CSS. These are not the highest-risk issues here. Inter is already part of the documented design system, and the side-tab warnings point at non-public admin/settings styling rather than the reviewed public flows.

**Visual overlays:** No reliable user-visible detector overlay is available. I attempted URL detection against the running local Vite server at `http://localhost:5173/submit`, but the detector reported `puppeteer is required for URL scanning. Install: npm install puppeteer`. This tool surface does not expose a mutable browser automation tab/evaluate API, so browser injection/overlay was skipped after a real attempt. The frontend preview server remains running for your manual review.

## Overall Impression

The public pages have the right ingredients: student lookup, preview, correction reporting, self-submission, status checking, QR verification, and legal/privacy disclosure. The problem is that the experience is not yet orchestrated like one public service. The landing page now points students to related paths, but the downstream pages still vary in quality: some are polished workflows, some are visually patched screens, and one public QR route appears functionally mismatched with the backend security model.

The single biggest opportunity is to turn the public area into a coherent student journey: lookup → preview → confirm/report → submit/check status → understand privacy. Every public page should make its role in that chain explicit.

## What’s Working

1. **Core workflows exist.** The app covers more than a brochure: students can preview cards, report corrections, submit details, check status, and review QR/public verification pages.
2. **The submission wizard has a strong structure.** Four steps, visible progress, review summary, disabled submit until terms agreement, and resilient loading/retry handling create a good foundation.
3. **The privacy/legal content is unusually concrete.** It names QR data, emergency fields, admin logs, deletion, jurisdiction, and contact details, which is appropriate for a student identity system.

## Priority Issues

### 1. **[P0] `/qr/:studentId` is public-facing in the router but fetches an admin-only raw-student endpoint**

**Why it matters:** `QrViewPage.jsx` calls `adminFetch('/api/students/:studentId')`, and the backend route `GET /api/students/:studentId` requires `requireAdmin`. A public scanner hitting `/qr/:studentId` is likely to fail unless an admin session exists. Even worse, if someone “fixes” it by opening that endpoint publicly, the route would expose sensitive student data by raw student ID rather than a signed QR token. This is both a broken public task and a privacy/security footgun.

**Fix:** Decide the canonical QR public route and make every layer agree. Prefer signed-token verification only: either remove/redirect the React `/qr/:studentId` route to the existing backend signed-token HTML flow, or rebuild it around a public token-inspection endpoint that accepts signed QR tokens, never raw IDs. Update `README.md`, `App.jsx`, admin “View page” affordances, and privacy copy to match the chosen route.

**Suggested command:** `/impeccable harden public QR verification`

### 2. **[P1] Required student-submission fields are visually required but not consistently enforced**

**Why it matters:** In `StudentSubmissionForm.jsx`, dynamic fields such as programme, email, blood type, emergency contact, date of birth, county, and address can display `*`, but `canNext()` returns `true` for steps 1 and 2. The final submit is a button calling `doSubmit`, not a native form submit that would enforce HTML validity. A student can advance and submit records that the UI itself described as required.

**Fix:** Build a single validation model from `fieldsConfig` and `qrFieldsConfig`, validate each step before advancing, show inline errors near fields, and announce the first error. If some enabled fields are optional, remove the `*`; if they are required, enforce them before the server call. Preserve the existing wizard design.

**Suggested command:** `/impeccable harden student submission form`

### 3. **[P1] Preview/correction forms can submit ambiguous or empty corrections**

**Why it matters:** The preview correction flow is high-stakes: students are changing identity-card details. QR correction submission enables “wrong” toggles, but the submit guard checks only whether a field is toggled, not whether a corrected value is filled. Name/year corrections also rely on uncontrolled semantic labeling and late validation. Empty or unclear correction payloads will create admin work and student confusion.

**Fix:** Require a changed, non-empty corrected value for every selected issue except photo-only reporting. Show a review row before submitting corrections, label every field with `htmlFor`/`id`, connect helper/error text with `aria-describedby`, and make success state explain whether the student still needs to confirm after correction.

**Suggested command:** `/impeccable audit preview correction flow`

### 4. **[P1] Shared public navigation and status recovery have accessibility and journey gaps**

**Why it matters:** `Navbar` uses a clickable `<div>` for the brand/home action, which is not keyboard-accessible as a link/button. `Footer` uses buttons for Terms/Privacy/About navigation, which works but does not expose true link semantics. `StudentStatusPage` and QR error states can land users on “Access Denied” / “Invalid or expired credential” without clear recovery routes. These are small implementation choices that become large trust problems when a student is blocked.

**Fix:** Convert brand/footer navigation to real links or buttons with full keyboard semantics. Add route-specific recovery actions to token/status/QR error pages: back to lookup, check status, submit details, or contact LMSA. Use `role="alert"` or live regions for async errors.

**Suggested command:** `/impeccable audit public navigation and recovery states`

### 5. **[P2] Public pages drift visually through inline styling, emoji/glyph icons, and mixed authority hierarchy**

**Why it matters:** The design system says “Registrar’s Seal”: official, warm, controlled. Several public pages still use emoji as icons (`🎨`, `📸`, `🖨`, `💻`, `📷`, `⏳`, `✏️`), many inline styles, one-off SVG shields, and different header structures. About leads with GoldWay as the hero rather than LMSA/student service, which may feel vendor-first in a public student portal.

**Fix:** Extract shared public-page shells and status/card primitives; replace emoji with the existing SVG/icon language; normalize status cards, error pages, and headers; revise About so it starts with the portal/institution relationship and moves GoldWay credentials below it.

**Suggested command:** `/impeccable polish public pages`

## Cognitive Load

Cognitive load is **moderate** across the public area and **high in the correction/QR edge cases**. The submission wizard chunks the task well, but it asks students to trust required markers that are not enforced. The preview correction flow can branch into name/year/QR/photo combinations and exposes many QR fields at once when enabled. The legal pages are long but structurally clear. The main cognitive-load failures are not too many pages; they are missing continuity and unclear recovery when a token, QR code, or record is wrong.

## Emotional Journey

The intended emotional arc is strong: official portal → student finds their record → reviews card → confirms or corrects → feels protected. Current valleys interrupt that arc. A failed QR route, expired token, closed submission form, or invalid status link can feel like rejection rather than guided recovery. The public experience needs more “you are still in the right place; here is the next safe step” messaging.

## Persona Red Flags

**Jordan (First-Timer):** Jordan can follow the landing and submission wizard, but may not understand the difference between preview link, QR verification link, status token, and status lookup. If a link is expired or a QR route fails, Jordan gets technical-sounding denial instead of a safe next step.

**Sam (Accessibility-Dependent User):** Sam encounters keyboard/focus risk in the clickable Navbar brand, button-as-link footer navigation, many labels without programmatic association in submission/preview forms, non-announced error states, and emoji/glyph status indicators that may not communicate the intended meaning reliably.

**Casey (Distracted Mobile User):** Casey benefits from large controls in the wizard, but long public forms do not preserve progress on interruption. QR/status errors do not give obvious thumb-friendly next actions. Multi-step correction flows can require careful reading at exactly the moment a student is likely stressed.

**Riley (Stress Tester):** Riley will find mismatches quickly: `/qr/:studentId` looks public but hits admin-only data, “required” fields can be skipped, QR correction toggles can submit empty values, and About/legal/support wording does not always align with the operational flows.

## Minor Observations

- `StudentStatusCheck.jsx` imports `useEffect`, `useNavigate`, and `useToast` but does not use them; that file also has heavy inline styling compared with the documented system.
- `StudentStatusPage.jsx` has no Navbar/Footer, so it feels disconnected from the rest of the public site.
- The legal pages name `lmsa-id-portal.vercel.app`; verify this is still the intended production URL before relying on it as legal copy.
- Privacy copy says QR data can include sensitive emergency information; the QR UI should make the signed-token/public-access model extremely clear.
- Some loading states say `Loading...` with three dots while others use ellipses or fuller status text. Standardize public loading language.
- `AboutPage` says students can correct issues “without visiting an office,” while other copy says contact LMSA/faculty office for help. Both can be true, but the edge cases should be reconciled.

## Questions to Consider

- Is `/qr/:studentId` still meant to be a public route, or should signed backend QR pages be the only scanner-facing route?
- Should the public pages read primarily as an LMSA student-service portal, with GoldWay as operator credit, or as a GoldWay service site for institutional clients?
- Which fields are truly required in the student-submission form when admins enable them?
- What is the official recovery path for a student with an expired link, missing QR, missing photo, or failed lookup?
