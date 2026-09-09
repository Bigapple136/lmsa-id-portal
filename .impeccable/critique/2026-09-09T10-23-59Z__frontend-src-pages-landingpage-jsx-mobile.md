---
target: landing page (mobile rendering)
total_score: 22
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/lmsa-id-portal/frontend/src/pages/LandingPage.jsx"
target_fingerprint: "sha256:496a4bb05679303438c0707d2dda8c24a9574aaaf77b9c4b71f95532ed2d1d3d"
target_path: /home/user/lmsa-id-portal/frontend/src/pages/LandingPage.jsx
timestamp: 2026-09-09T10-23-59Z
slug: frontend-src-pages-landingpage-jsx-mobile
closed: true
---
Target: `frontend/src/pages/LandingPage.jsx` with landing styles in `frontend/src/index.css`. Scope of this pass is the **mobile experience** the user flagged ("on mobile devices it renders as a three column and looks bad").

## Headline finding

There is **no literal three‑column main grid** on the landing page. The DOM is exactly two blocks:

```jsx
<main className="split-landing">
  <div className="split-brand" />        {/* emblem + title + sub + desc */}
  <div className="split-form-panel">      {/* mobile brand + .split-card */}
    <div className="landing-mobile-brand" />
    <div className="split-card"> … <ul className="verification-steps"> 3 × <li> </ul> … </div>
  </div>
</main>
```

`.split-landing` is a two‑child flex that correctly collapses to a single column at `max-width: 900px` (`index.css:2995`). So the *page skeleton* is fine on a phone.

The persistent **three‑column element is `.verification-steps`** — the three pills *"Preview card / Confirm details / Report corrections"*:

```css
.verification-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); … }  /* index.css:4656 */
@media (max-width: 480px) { .verification-steps { grid-template-columns: 1fr; } }            /* index.css:4768 */
```

It only collapses to one column at **≤480px**. Across the entire **481–900px band** (large phones in landscape, small tablets, and any "mobile" preview wider than 480px) those three pills stay side‑by‑side as a cramped 3‑up strip. This is almost certainly what the user is reading as "the layout is a three column." It is a **breakpoint orphan**: the rest of the page reflows at 900px and again at 600px, but the steps hold three columns until 480px.

A second, compounding defect makes mobile "look bad": the brand identity is shown **twice** on small screens (details below). Together they produce the busy, three‑across, dead‑weight look the user reported.

## Design Health Score (mobile lens)

| # | Heuristic | Score | Key Issue (mobile) |
|---|-----------|-------|--------------------|
| 1 | Visibility of System Status | 3 | Async states work, but "what happens after lookup" is not surfaced near the top on mobile. |
| 2 | Match System / Real World | 3 | Copy is fine; brand is repeated rather than consolidated. |
| 3 | User Control and Freedom | 3 | Form is editable/recoverable; mobile adds nothing broken here. |
| 4 | Consistency and Standards | 2 | `.verification-steps` 3‑col breakpoint (480px) is inconsistent with the 900/600px reflow used everywhere else. |
| 5 | Error Prevention | 2 | No mobile‑specific guidance added; same as desktop. |
| 6 | Recognition Rather Than Recall | 2 | Three cramped pills communicate little at 481–900px. |
| 7 | Flexibility and Efficiency of Use | 2 | Task works, but the redundant brand panel wastes the first screens of scroll. |
| 8 | Aesthetic and Minimalist Design (mobile) | 1 | The specific complaint: 3‑up pill strip + double brand + oversized ceremony = "looks bad." |
| 9 | Error Recovery | 2 | Recovery block exists; not mobile‑degraded. |
| 10 | Help and Documentation | 2 | Hint present; not mobile‑optimized. |
| **Total** | | **22/40** | **Mobile is the weak axis: one orphaned 3‑column element + redundant branding.** |

## Priority Issues

### 1. **[P1] `.verification-steps` stays a three‑column grid on mobile (481–900px)**

**Where:** `index.css:4656` (base `repeat(3, minmax(0,1fr))`) and `index.css:4768` (only collapses at `max-width: 480px`).

**Why it matters:** On any "mobile" viewport wider than 480px — which includes the majority of phones held in landscape and all small tablets — the three pills render as a tight 3‑across strip with 11px text and 8px gaps. Inside a `max-width: 480px` card that is itself centered in a 600px panel, each pill gets ~150px and the labels wrap awkwardly. This is the concrete "three column" the user sees: it is the only multi‑column construct on the page, and it is the one that fails to collapse with the rest of the layout.

**Fix:** Make the steps collapse at the same 600px breakpoint the rest of the page uses, not 480px. Either raise the existing override or add a 600px rule:

```css
/* index.css — align the steps with the 600px mobile breakpoint */
@media (max-width: 600px) {
  .verification-steps { grid-template-columns: 1fr; gap: 6px; }
  .verification-steps li { justify-content: flex-start; min-height: 38px; padding-inline: 12px; }
}
```

Optionally, also consider a 2‑column layout in the 481–600px range if you want to keep them visually grouped rather than stacking — but 1‑column is the safest, most readable choice for touch.

### 2. **[P1] Brand identity is rendered twice on mobile (compact + full ceremony)**

**Where:** `index.css:4683` sets `.split-form-panel { order: 1 }` and `.split-brand { order: 2 }`; `.landing-mobile-brand { display: flex }` at the same breakpoint; the full `.split-brand` panel still renders below the form.

**Why it matters:** On a phone the user sees (top→bottom): compact logo + "LMSA ID PORTAL / A.M. Dogliotti College of Medicine" → the form card → **then a second, full ceremonial brand panel** with a 104px emblem, a large Georgia title, an uppercase subtitle, and a description. The identity is shown twice. The bottom panel is mostly dead vertical space on a small screen and pushes the footer (and any reassurance/"what happens next" content) far down. It is the other half of the "looks bad" complaint: a long, redundant scroll with a heavy visual block the user did not need twice.

**Fix:** On mobile, demote the bottom `.split-brand` to a slim, quiet footer‑style identity strip (or hide the heavy ceremony entirely and keep only `.landing-mobile-brand`). For example:

```css
@media (max-width: 900px) {
  .split-brand {
    order: 2;
    padding: 20px 22px;            /* was 34px 22px 38px */
    flex-direction: row;           /* emblem + text in a single calm row */
    gap: 14px;
    text-align: left;
  }
  .split-emblem {
    width: 56px; height: 56px;     /* was 104px */
    margin-bottom: 0; padding: 6px;
  }
  .split-emblem img { width: 44px; height: 44px; }
  .split-title { font-size: 1.05rem; margin-bottom: 2px; }
  .split-sub { margin-bottom: 4px; }
  .split-desc { display: none; }   /* redundant on mobile; compact brand already says this */
}
```

This keeps the official seal present (good for institutional trust) without spending ~300px of scroll repeating it.

### 3. **[P2] Inconsistent breakpoint strategy across the landing surface**

**Where:** The page mixes 900 / 700 / 600 / 480 / 360px breakpoints; the most mobile‑broken element (`.verification-steps`) only responds at 480px, while `.split-landing` reflows at 900px and the panel paddings shrink at 600px.

**Why it matters:** The mismatch is *why* issue #1 slipped through — the steps were tuned for a 480px floor that no longer matches how the rest of the page behaves. Standardizing on 900 / 600 / 480 makes future mobile regressions easier to spot.

**Fix:** Adopt 900px (stack) and 600px (phone) as the two authoritative landing breakpoints and route every landing‑specific override through them; treat 480px only for fine‑tuning text sizes.

### 4. **[P2] Floaty card with large side gutters at ~600px**

**Where:** `.split-card { max-width: 480px }` centered inside `.split-form-panel { padding: 28px 18px 34px }` (`index.css:4683`).

**Why it matters:** At ~600px the form card sits in a wide panel with big empty side margins, which can read as "unanchored." Minor, but contributes to the uneven mobile feel. Lower the card max‑width or the panel padding at 600px so the card fills more comfortably.

## What is actually working on mobile

1. **The core skeleton collapses correctly.** `.split-landing` goes from a 2‑block flex to a single column at ≤900px, and the form panel is ordered first (`index.css:4683`), so the lookup task is reachable without scrolling past the brand.
2. **Form controls are touch‑sized.** Inputs get `min-height: 44px` and `font-size: 16px` under `@media (max-width: 768px)` (`index.css` P3 block), preventing iOS zoom and meeting the 44px tap target.
3. **The viewport meta is correct** (`width=device-width, initial-scale=1.0` in `frontend/index.html`), so this is *not* a "page renders at desktop width" problem — the defects above are real CSS issues, not a missing meta tag.
4. **`.landing-alt-actions` and `.landing-recovery-links` correctly switch to a column at ≤480px**, so the secondary links do not overflow.

## Persona Red Flags (mobile)

**Casey (Distracted Mobile User):** Casey lands and immediately sees the compact brand + form (good), but then has to scroll past a *second* full brand ceremony before reaching the footer. The three pills above the button read as a cramped 3‑across strip on a landscape phone. Cognitive load is fine; visual tidiness is not.

**Jordan (First‑Timer on a tablet/landscape phone, 481–900px):** Jordan is the one most likely to hit the 3‑column steps bug, because that width band is exactly where the pills refuse to stack.

**Sam (Accessibility‑Dependent User):** No new mobile‑specific a11y regression here — the labels/ids added in the earlier landing pass remain intact — but the redundant brand block adds extra swipe/scroll noise for screen‑reader and switch users.

## Recommended remediation (in priority order)

1. Collapse `.verification-steps` at **≤600px**, not 480px (fixes the literal "three column" symptom).
2. On **≤900px**, shrink and flatten the bottom `.split-brand` instead of rendering the full ceremony a second time (fixes "looks bad" / dead weight).
3. Standardize landing breakpoints on **900 / 600 / 480** so the steps can never drift out of sync again.

Suggested command to apply the fixes:
`/impeccable adapt landing page mobile` — or tell me and I will edit `frontend/src/index.css` directly.
