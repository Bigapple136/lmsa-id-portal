---
target: landing page
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/lmsa-id-portal/frontend/src/pages/LandingPage.jsx"
target_fingerprint: "sha256:d9b0ef380f53556b28e2c5f943d7c56062c9e8188cbec1a02bb76b14027e3b59"
target_path: /home/user/lmsa-id-portal/frontend/src/pages/LandingPage.jsx
timestamp: 2026-09-02T15-37-25Z
slug: frontend-src-pages-landingpage-jsx
closed: true
---
⚠️ DEGRADED: single-context (no sub-agent/Task tool exposed)

Target: `frontend/src/pages/LandingPage.jsx` with landing-specific styles in `frontend/src/index.css`.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Submit has loading/disabled/error states, but the landing page does not explain the post-lookup state before the user commits. |
| 2 | Match System / Real World | 3 | Student ID and full name are plain-language fields; “faculty office” is vague and LMSA/LIMSA naming is not fully normalized. |
| 3 | User Control and Freedom | 3 | The two-field form is easy to edit and recover from; there is no alternate path when lookup fails. |
| 4 | Consistency and Standards | 3 | Uses the documented navy/gold/teal system and shared form primitives; the green LMSA logo and copy hierarchy are not fully reconciled with the registrar-seal world. |
| 5 | Error Prevention | 2 | Only blank fields are prevented. There is no formatting help, inline validation, autocomplete strategy, or “what name format should I use?” guidance. |
| 6 | Recognition Rather Than Recall | 2 | Users must remember the exact student ID and exact name spelling; the page gives one ID example but no recovery or alternate recognition path. |
| 7 | Flexibility and Efficiency of Use | 2 | One path only: type ID + name. That is acceptable for a lookup page, but it offers no saved/status/self-submission shortcut despite nearby product routes existing. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and focused, but the large brand panel may overpower the action and become dead visual weight on mobile. |
| 9 | Error Recovery | 2 | Errors preserve input and speak plainly, but failed lookup and network failure messages do not give a concrete next step. |
| 10 | Help and Documentation | 2 | A help hint exists, but it is not actionable: no contact, office detail, support link, or self-submission/status alternative. |
| **Total** | | **25/40** | **Acceptable — strong foundation, but student guidance and mobile priority need work.** |

## Design Specificity Verdict

**LLM assessment:** The page is meaningfully branded for LMSA through the logo, institution name, navy field, gold accents, and the formal split composition. It is not category-interchangeable in the same way a generic SaaS login page would be. The weakness is that it still stops short of the “Registrar’s Seal” authority captured in `DESIGN.md`: the left panel says “institution,” but the right panel behaves like a basic lookup card; the page does not explain the verification ritual, reassure students about privacy, or make the next state tangible.

**Deterministic scan:** Static scan of `frontend/src/pages/LandingPage.jsx` returned **0 findings**. A broader landing-relevant scan including `frontend/src/index.css` returned **15 warnings**: 13 `overused-font` warnings for Inter usage and 2 `side-tab` warnings in CSS. The overused-font warning is partially relevant because the landing page relies on Inter for the form, though the page also uses Georgia for institutional display type. The two `side-tab` findings are not landing-page blockers: they refer to settings/admin/sidebar CSS (`frontend/src/index.css:482`, `frontend/src/index.css:3363`), not the public landing surface.

**Visual overlays:** No reliable user-visible overlay is available. I started the Vite frontend locally and attempted URL detection at `http://localhost:5173/`, but the detector reported: `puppeteer is required for URL scanning. Install: npm install puppeteer`. This tool surface also exposes no browser automation tab/evaluate API for mutable injection, so the browser overlay step was skipped after a real attempt.

## Overall Impression

The landing page is clean, credible, and already aligned with the project’s institutional palette. Its biggest opportunity is not more decoration; it needs a stronger student-service journey. A student landing here should answer, in one glance: “Am I in the right place, what exactly do I need, what happens after I submit, and what do I do if the portal cannot find me?” Right now the page mostly answers the first two.

## What’s Working

1. **The task is visually simple.** Two fields and one primary CTA keep the cognitive load low for a student who already has their ID and knows the exact enrollment name.
2. **The brand frame is credible.** The navy panel, circular LMSA mark, institution subtitle, and formal typography give the page more authority than a generic login form.
3. **Basic async states are present.** The submit button disables while loading, shows a spinner, and keeps the entered values after errors.

## Priority Issues

### 1. **[P1] Mobile users may not see the form first**

**Why it matters:** The CSS stacks `.split-brand` above `.split-form-panel` below 900px. On phones, the user likely sees the large emblem, institution title, and description before the actual lookup card. For a distracted student on mobile, the primary task can start below the first viewport.

**Fix:** On mobile, lead with a compact brand header plus the form card, then move the ceremonial brand panel below or compress it to a 72-96px identity band. Keep the logo and institution name visible, but make “Verify Your ID” and the first field reachable immediately.

**Suggested command:** `/impeccable adapt landing page`

### 2. **[P1] Failed lookup recovery is too vague**

**Why it matters:** “Contact LMSA at your faculty office” is not enough when the page says no student was found. A real student needs to know whether to try a different name spelling, use a student-submission flow, check status, or contact a specific office/channel.

**Fix:** Add a structured recovery block after failed lookup: “Check spelling exactly as enrolled,” “Try your AMD ID format,” “Submit your details if you are missing,” and “Contact LMSA support/faculty office” with a concrete link or placeholder only if a real contact exists. If `/submit`, `/status`, or `/check-status` are valid user paths, surface them deliberately.

**Suggested command:** `/impeccable clarify landing page`

### 3. **[P1] Form semantics rely on visual labels but lack source-level label association**

**Why it matters:** The JSX renders `<label className="field-label">` as a sibling before each `<input>`, but the labels have no `htmlFor` and the inputs have no `id`. Placeholder text is not a reliable accessible name. Keyboard and screen-reader users may hear ambiguous edit fields instead of “Student ID Number” and “Full Name.”

**Fix:** Add `id`, `htmlFor`, `name`, `type`, and `aria-describedby` where appropriate. Connect errors to the form with `role="alert"` or an accessible live region. Preserve the visible design; this is a semantic hardening pass.

**Suggested command:** `/impeccable audit landing page`

### 4. **[P2] The page undersells the verification journey**

**Why it matters:** “Student ID verification and card management portal” and “Enter your details to view or confirm your student card” are accurate but thin. The page does not preview the value of the next step: confirming card details, reporting corrections, and protecting student identity.

**Fix:** Add a short three-part reassurance row or microcopy under the CTA: “Preview your card,” “Confirm or report corrections,” “Your details stay protected.” Keep it compact; do not turn the page into marketing. This would make the landing page feel more authored for this exact product.

**Suggested command:** `/impeccable onboard landing page`

## Cognitive Load

Cognitive load is **moderate-low**. The core decision point has only two inputs and one primary action, which is good. Failed checklist items: visual hierarchy on mobile, recognition rather than recall for exact ID/name, and recovery guidance after lookup failure. The interface does not overwhelm; it under-guides the high-stakes edge case.

## Emotional Journey

The first impression is trustworthy, but slightly distant. The navy/gold panel gives official confidence; the form card gives clarity. The emotional valley appears when a lookup fails: the user receives a dead-end message with no concrete next action. The peak-end rule should be improved by making both success expectation and failure recovery feel supported before the student presses the button.

## Persona Red Flags

**Jordan (First-Timer):** Jordan understands that the page is for ID verification, but may not know whether “full name” means legal name, enrollment spelling, middle initial included, or name on LMSA records. If lookup fails, Jordan gets no specific help path and may assume they are not in the system.

**Sam (Accessibility-Dependent User):** Sam gets visible focus styling from global CSS, but the form labels are not programmatically tied to their inputs. The error box is visual but not explicitly announced as a live alert. The spinner is visible but not announced as status text beyond the button label changing.

**Casey (Distracted Mobile User):** Casey may land on a tall brand section first and need to scroll before typing. The form itself has good touch-sized controls, but the first task should be closer to the top on narrow screens.

**LMSA Student With a Record Issue:** This student is the product-specific red flag. If their name spelling, photo, or roster status is wrong, the landing page does not point them to the correction/submission/status routes that the product already supports elsewhere.

## Minor Observations

- The CTA says “View My ID Card,” while the card title says “Verify Your ID.” Both are reasonable, but the page would be clearer if the sequence were explicit: look up → preview → confirm/report.
- `autoComplete="off"` may slow repeat visitors and mobile users; consider whether `name` and appropriate autocomplete behavior can help without compromising privacy.
- The logo asset is green while the surrounding system is navy/gold/teal. It is real LMSA branding, so keep it, but its relationship to the gold ceremonial frame should be more deliberate.
- The footer links are useful, but they are separated from the immediate help moment. Help should appear near the form and especially near errors.

## Questions to Consider

- What if mobile students saw the lookup card before the ceremonial brand panel?
- What should a student do if their official roster record is missing or misspelled?
- Could the page explain the verification journey in 12 words instead of adding another section?
- Should the landing page use “LMSA” consistently, or should docs/UI normalize “LIMSA” vs “LMSA” by context?
