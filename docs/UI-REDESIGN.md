# UI Redesign Notes

This document records the visual redesign decisions for the LIMSA ID Card Portal. The redesign is intentionally presentation-focused: existing routes, API behavior, validation, authentication, and admin actions remain unchanged.

## Current status

### Completed

- Added a shared visual foundation in `frontend/src/index.css`.
- Refined public navigation and added the LMSA logo to the shared header.
- Modernized the student landing page surfaces, forms, buttons, focus states, and responsive layout.
- Refreshed the admin shell, sidebar, cards, badges, upload areas, and modal surfaces.
- Added responsive refinements for tablet and mobile layouts.
- Refined the student submission wizard with a clearer step indicator, stronger section hierarchy, review summary surfaces, and mobile action layout.
- Refined the student card preview and correction flow with clearer verification details, issue selection states, and mobile actions.
- Refined the admin dashboard with stronger summary cards, sidebar active states, student rows, filters, upload surfaces, and responsive spacing.
- Added reusable `StatusBadge` and `EmptyState` components for repeated admin states.
- Added focused tests for known and unknown status badge rendering.
- Refined the secondary admin views: analytics summaries, submission filters, settings toggles, upload/manual-entry panels, and loading/notice states.

### Verification

- Frontend lint completed with no errors. Existing warnings remain in unrelated components.
- Frontend tests passed: 2 test files, 4 tests.
- Production build passed with Vite.
- Automated UI verification is complete. Local visual QA was attempted, but the preview could not render because `frontend/.env` is not present and the required Supabase environment variables are not configured in this workspace. No UI runtime conclusion was drawn from the blank preview.

## Design direction

The interface uses a formal but approachable institutional style:

- Navy communicates trust and institutional identity.
- Gold is reserved for branding, emphasis, and secondary actions.
- Teal is used for primary actions and interactive feedback.
- White cards and soft gray page backgrounds keep forms and administrative data readable.
- Rounded corners, restrained shadows, and visible focus states provide a modern feel without making the portal look like a consumer app.

## Shared tokens

The main tokens live in `frontend/src/index.css`:

| Token | Purpose |
| --- | --- |
| `--navy` | Primary institutional color and admin chrome |
| `--navy-mid` | Secondary dark surface |
| `--gold` | Accent and institutional highlight |
| `--teal` | Primary action color |
| `--text` | Main readable text |
| `--muted` | Supporting text |
| `--border` | Field and card borders |
| `--bg` | Application background |
| `--radius` / `--radius-lg` | Shared component rounding |
| `--shadow-sm` / `--shadow-md` | Surface elevation |

New UI work should use these tokens instead of introducing page-specific colors or shadows.

## Component guidance

When adding or changing a screen:

1. Reuse existing shared classes for fields, buttons, cards, alerts, pills, and modals.
2. Keep business logic and API calls separate from visual changes.
3. Preserve loading, error, empty, success, and disabled states.
4. Add visible keyboard focus states for interactive controls.
5. Check the layout at desktop, tablet, and narrow mobile widths.
6. Use the real LMSA branding and avoid placeholder institution names.

## Next redesign tasks

1. Perform a page-by-page visual QA pass in the running app.
2. Refine the student submission wizard with clearer step progression and review summaries.
3. Refine the student card preview and correction-report flow.
4. Improve admin dashboard information hierarchy, filters, table density, and empty states.
5. Standardize repeated inline styles into reusable components where doing so does not affect behavior.
6. Add targeted UI tests for the most important states and responsive regressions.

## Change history

### 2026-07-23

- Added the first shared visual refresh.
- Added the LMSA logo to `Navbar`.
- Refined the student submission wizard presentation.
- Refined the student card preview and correction-report presentation.
- Refined the admin dashboard presentation.
- Extracted repeated status and empty-state UI into reusable components and added coverage.
- Refined the remaining admin subviews to share the dashboard’s spacing, surfaces, controls, and responsive behavior.
- Documented the visual system, verification results, and follow-up work.
