---
name: "LIMSA ID Card Portal"
description: "A secure institutional ID-card verification portal for LMSA students and administrators."
colors:
  dogliotti-navy: "#071b3a"
  navy-mid: "#12345d"
  navy-light: "#1b4b7d"
  student-gold: "#d5a83d"
  gold-light: "#f4d483"
  help-desk-teal: "#087f8c"
  teal-dark: "#06636f"
  registry-ink: "#10213f"
  record-gray: "#61708b"
  hint-gray: "#8b98ad"
  rule-border: "#dfe5ed"
  campus-mist: "#f5f7fb"
  field-paper: "#fbfcfe"
  white: "#ffffff"
  success-bg: "#E6F4EC"
  success-text: "#1A5C30"
  success-border: "#2A7A42"
  error-bg: "#FCEBEB"
  error-text: "#7A1A1A"
  error-border: "#E24B4A"
  warn-bg: "#FEF6E4"
  warn-text: "#8A5C0A"
  info-bg: "#DBEAFE"
  info-text: "#1E40AF"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 3.5vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  xs: "3px"
  sm: "4px"
  button: "9px"
  md: "10px"
  card: "14px"
  lg: "18px"
  xl: "20px"
  pill: "20px"
  circle: "50%"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.help-desk-teal}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "11px 13px"
    height: "46px"
  button-gold:
    backgroundColor: "{colors.student-gold}"
    textColor: "{colors.dogliotti-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 18px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.record-gray}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "9px 18px"
  field-input:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.registry-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "11px 13px"
    height: "46px"
  surface-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.registry-ink}"
    rounded: "{rounded.lg}"
    padding: "22px"
  nav-shell:
    backgroundColor: "{colors.dogliotti-navy}"
    textColor: "{colors.gold-light}"
    typography: "{typography.label}"
    height: "64px"
  status-pill:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
---

# Design System: LIMSA ID Card Portal

## Overview

**Creative North Star: "The Registrar's Seal"**

The LIMSA ID Card Portal looks and behaves like an official student-services desk backed by a registrar's seal: verified, orderly, and accountable, but not cold. The incumbent system uses deep navy as the institutional field, credential gold as a restrained mark of authority, and teal as the clearest signal for progress, verification, and action. White cards, cool form-paper backgrounds, and visible borders make operational state legible for admins while keeping student-facing forms calm on phones.

The system is warm and student-first in its tone: forms explain what is happening, errors are direct, and student flows avoid ornamental complexity. The formal navy-and-gold frame carries trust; the teal action layer carries reassurance and momentum. Components should feel restrained and confident: crisp, readable, durable, and easy to scan under real campus conditions.

**Key Characteristics:**

- Official institutional frame: navy chrome, gold identity marks, and real LMSA/A.M. Dogliotti content.
- Student-service clarity: generous form targets, plain-language status messages, and mobile-safe layouts.
- Operational density without clutter: dashboard cards, tables, tabs, filters, and export actions sit in structured white panels.
- Soft credential depth: cards layer like official documents, using borders first and quiet shadows second.
- Verification accents: teal marks forward action; green, amber, red, and blue remain reserved for status semantics.

## Colors

The palette is an institutional navy-and-gold system softened by campus-service neutrals and a teal action color.

### Primary

- **Dogliotti Navy** (`dogliotti-navy`): The primary institutional field for nav bars, admin chrome, credential previews, and official headers. It should remain the most authoritative color in the system.
- **Navy Mid** (`navy-mid`): Secondary dark surface for sidebars, active dark hover states, card placeholders, and gradients inside navy regions.
- **Navy Light** (`navy-light`): Supporting stroke or tonal layer on dark surfaces, especially light-outline buttons and ID-card internals.

### Secondary

- **Student Gold** (`student-gold`): The LMSA credential accent for brand names, badges, completed steps, secondary admin actions, and official emphasis. Use it sparingly so it keeps the feel of a seal rather than decoration.
- **Soft Student Gold** (`gold-light`): Brighter gold for dark navy headers, hero text, and brand marks that need better contrast on the institutional field.

### Tertiary

- **Help Desk Teal** (`help-desk-teal`): The primary action color for student progress, submission, save/continue controls, and active verification states.
- **Deep Teal** (`teal-dark`): Text or active-state companion for teal UI, used when the action color needs a more anchored readable tone.

### Neutral

- **Registry Ink** (`registry-ink`): Main text and dashboard numbers.
- **Record Gray** (`record-gray`): Supporting text, metadata, helper copy, inactive controls, and secondary labels.
- **Hint Gray** (`hint-gray`): Low-emphasis hints and form assistance.
- **Rule Border** (`rule-border`): Dividers, card borders, input borders, table rows, and structure lines.
- **Campus Mist** (`campus-mist`): Page background and recessed dashboard panels.
- **Field Paper** (`field-paper`): Slightly brighter input and form-card background.
- **White** (`white`): Primary card/container surface.

### State Colors

- **Confirmed Green** (`success-bg`, `success-text`, `success-border`): Confirmation, secure handling, approved records, and healthy status.
- **Issue Red** (`error-bg`, `error-text`, `error-border`): Blocking errors, rejected states, destructive actions, and student-reported problems.
- **Pending Amber** (`warn-bg`, `warn-text`): Pending review, warning context, and non-blocking attention.
- **Information Blue** (`info-bg`, `info-text`): Informational callouts and secondary system notices.

### Named Rules

**The Seal Accent Rule.** Gold is an institutional mark, not a fill color for every action. Use it for brand, completed state, official emphasis, and secondary actions; let navy and teal do most of the work.

**The Verification Action Rule.** Teal owns the forward path: continue, submit, save, verify, and selected progress. Do not make critical student actions compete with gold, red, or generic blue.

**The Status Color Rule.** Green, amber, red, and blue are semantic. Do not reuse them for decorative cards or marketing blocks where users might read operational meaning.

## Typography

**Display Font:** Georgia with Times New Roman and serif fallbacks.
**Body Font:** Inter with system UI fallbacks.
**Label/Mono Font:** Inter for labels; Courier New only for compact ID-card numbers and credential-like codes.

**Character:** The pairing is institutional but modern: a serif display voice appears only where the brand needs ceremony, while Inter carries nearly every form, dashboard, table, and student-service interaction. Type is compact, high-contrast, and slightly tightened to support dense admin workflows.

### Hierarchy

- **Display** (700, `clamp(2rem, 3.5vw, 3.25rem)`, 1.2): Landing-page institution name and rare ceremonial brand moments.
- **Headline** (700-800, 22-26px, about 1.2): Form section titles, split-card titles, submission wizard headings, and high-level page headings.
- **Title** (600-700, 13-17px, about 1.3): Card titles, chart titles, topbar names, settings cards, and dashboard section headers.
- **Body** (400-500, 13-16px, 1.45-1.7): Form helper copy, metadata, status details, paragraph text, admin descriptions, and review rows.
- **Label** (600-700, 11-13px, `0.01em` to `0.08em`): Field labels, pills, nav items, toolbar controls, and metadata labels. Uppercase is common in compact admin and lookup fields; sentence case is preferred in longer student submission flows.
- **Credential Code** (Courier New, 11px): Student IDs inside card previews or QR/credential contexts only.

### Named Rules

**The Ceremony Is Rare Rule.** Serif display type belongs to brand ceremony, not routine controls. Admin dashboards, forms, settings, and tables stay in Inter.

**The Label Ledger Rule.** Labels should be short, sturdy, and scan-friendly. Use uppercase for compact record fields; switch to sentence case when the label is part of a friendly student form.

## Layout

The spatial model alternates between official frames and service panels. Public landing uses a two-panel split: navy institution panel on the left, white verification card on a cool paper field on the right. Admin screens use a fixed navy topbar and left sidebar with a broad white/campus-mist work area. Student submission uses a centered wizard card with a top progress rail and a three-column form grid that collapses to one column on mobile.

Containers generally use 16-24px internal spacing for compact admin surfaces, 28-48px for form/wizard sections, and 32-64px for hero or split-screen framing. Dashboard stats use 4- or 6-column grids on desktop, reduce to 3 or 2 columns at intermediate widths, and collapse complex chart/bottom regions to one column around tablet sizes.

Responsive behavior is concrete and defensive: mobile breakpoints at 900px, 768px, 700px, 600px, 480px, 440px, 420px, and 380px progressively reduce padding, stack controls, and preserve 44px touch targets. Small screens may remove side borders from full-page cards, open mobile nav as a fixed dropdown, and stack action rows so student flows remain usable on narrow phones.

**The One Workflow Surface Rule.** Every screen should expose the current workflow state first: where the user is, what record or submission is being handled, what action is next, and what status is safe or unsafe.

## Elevation & Depth

Depth follows an official card stack: white panels sit on cool paper; borders define most surfaces; soft shadows lift cards, nav bars, modals, and important action controls only when they need separation. The system should feel layered like credential paperwork and admin files, not glassy or floating.

### Shadow Vocabulary

- **Subtle Panel Shadow** (`0 2px 8px rgba(7, 27, 58, 0.06)`): Default card, settings panel, chart, stat, and list-container lift.
- **Raised Workflow Shadow** (`0 14px 36px rgba(7, 27, 58, 0.1)`): Split landing cards, submission wizard, modals, and major elevated panels.
- **Navy Chrome Shadow** (`0 4px 18px rgba(7, 27, 58, 0.12)`): Navigation bars and sticky/fixed institutional chrome.
- **Action Lift** (`0 7px 16px rgba(8, 127, 140, 0.16)` to `rgba(8, 127, 140, 0.2)`): Teal primary actions and submission buttons.
- **Seal Emblem Shadow** (`0 12px 30px rgba(0, 0, 0, 0.2)`): Round logo/emblem treatments on dark ceremonial surfaces.

### Named Rules

**The Official Stack Rule.** Start with background tone, border, and spacing; add shadows only when a surface must read as a separate document, modal, nav layer, or committed action.

**The No Floating Dashboard Rule.** Dashboard panels can lift softly, but they must still feel anchored to the work surface. Avoid oversized blurred shadows or glassmorphism.

## Shapes

The form language is gently rounded and official. Standard controls use 9-10px corners, cards use 14-20px corners depending on hierarchy, and badges use pill radii. Circular forms are reserved for identity marks, avatars, step indicators, chart dots, and emblem frames. Borders are usually 0.5-1px in Rule Border, giving forms and cards structure without heavy outlines.

Photo and card details use tighter radii: 3-4px for QR placeholders, image thumbnails, and credential sub-elements. Modals and wizard containers use larger 16-18px radii so they feel like contained official packets rather than loose dialogs.

**The Rounded Credential Rule.** Use rounded corners to make workflows approachable, but keep radii disciplined. Pills and circles are state/identity shapes; routine cards should not become bubbly.

## Components

### Buttons

- **Shape:** Gently rounded controls (8-10px) with minimum 44-50px touch height on mobile and primary student flows.
- **Primary:** Teal gradient or teal fill, white text, 700 weight, and a soft teal action shadow for submit/continue/save flows.
- **Gold:** Gold fill with navy text for secondary official actions, completed emphasis, and admin affordances that benefit from institutional accent.
- **Outline:** White or transparent background with Rule Border stroke and muted text; hover may move toward Campus Mist or navy/gold when used inside dark chrome.
- **Hover / Focus:** Hover uses brightness, border-color, or slight translateY. Focus-visible uses a 3px translucent teal ring; high-contrast mode switches to a gold outline.

### Chips

- **Style:** Small rounded pills with 5px 10px padding, 10-11px label type, and semantic background/text pairings.
- **State:** Confirmed uses green, pending uses amber, issue/photo issue uses red, inactive/unknown uses Campus Mist and Record Gray, and informational QR states may use blue.
- **Behavior:** Chips should read as status, not buttons, unless they are in a toggle group with clear selected/unselected treatment.

### Cards / Containers

- **Corner Style:** Standard panels use 14-18px corners; compact cards may use 10-12px; ceremonial landing cards can reach 20px.
- **Background:** White on Campus Mist, Field Paper, or navy gradients depending on context.
- **Shadow Strategy:** Use Subtle Panel Shadow for routine cards and Raised Workflow Shadow for major cards or modals.
- **Border:** Use Rule Border at 0.5-1px. Admin-only or special sections may add a small navy or gold accent rail.
- **Internal Padding:** 18-24px for dashboard cards; 28-48px for wizard bodies; tighter 12-16px for rows and compact lists.

### Inputs / Fields

- **Style:** Field Paper or white fill, 1-1.5px border, 9-10px radius, 46-50px minimum height, and clear 13-16px text.
- **Labels:** Short and sturdy. Use uppercase compact labels for lookup/admin; use friendlier sentence case inside long student submission flows.
- **Focus:** Teal border plus a 4px translucent teal ring. Do not rely on color alone in high-contrast contexts.
- **Error / Disabled:** Error boxes use red background/border/text; disabled buttons reduce opacity and remove pointer affordance.

### Navigation

- **Style:** Navy chrome with gold-light brand text and cool gray-blue nav links. Active/hover links use white text on a translucent white or gold-tinted surface.
- **Desktop:** Public nav stays horizontal; admin uses fixed topbar plus fixed sidebar with active indicator rail.
- **Mobile:** Public nav switches to hamburger; menu opens as a navy fixed panel with full-width touch targets. Admin compresses topbar/spacing and uses horizontal tabs where side navigation is not practical.

### Admin Dashboard

The dashboard system is dense but calm: stat cards, charts, quick actions, student rows, filters, and settings panels use the same white-card language. Use numbers in Registry Ink with semantic color only for status counts. Quick actions pair a small icon tile with a clear task label; filters and segmented controls should use the same rounded field/control grammar as forms.

### Submission Wizard

The wizard is the warmest expression of the system. It uses a navy topbar, gold underline, large white workflow card, teal current step, gold completed step, and one-column mobile fallback. Security notes use green callouts and should stay concise. The current step, progress, next action, and review state should be obvious without needing admin context.

### Credential Preview

ID-card previews are navy credential miniatures with gold-light names, gold ID values, compact code typography, small QR/photo placeholders, and tight internal dividers. Treat these as representations of official cards; do not restyle them into generic profile cards.

## Do's and Don'ts

### Do:

- **Do** preserve the LMSA/A.M. Dogliotti identity, real logo asset, and navy + gold institutional frame.
- **Do** use teal for primary forward actions and verification progress.
- **Do** keep student-facing forms mobile-safe, plain-spoken, and tolerant of long names, IDs, addresses, and campus-network delays.
- **Do** build admin surfaces from white cards, cool backgrounds, visible dividers, compact metadata, and semantic status colors.
- **Do** keep focus-visible states strong and consistent across buttons, links, inputs, selects, and textareas.
- **Do** keep QR, photo, signature, emergency-contact, and student-record details visibly controlled and privacy-aware.

### Don't:

- **Don't** strip the interface down to anonymous gray admin tables; every major surface should still carry LMSA institutional identity.
- **Don't** replace confirmed product/institution names with placeholders or invent testimonials, metrics, enrollment totals, pricing, or production URLs.
- **Don't** use gold as the default CTA color across the app; it should remain a credential accent and secondary action color.
- **Don't** introduce unrelated bright palettes, playful consumer SaaS gradients, decorative confetti, or novelty animations that weaken official trust.
- **Don't** blur status semantics by using green, amber, red, or blue as decoration.
- **Don't** remove loading, empty, error, disabled, rejected, pending, issue, confirmed, or expired states while making visual changes.
