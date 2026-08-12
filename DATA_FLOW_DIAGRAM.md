# ID Card Layout Mapping - Data Flow & Fixes

## Before Fix: Data Flow With Issues ❌

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN UPLOADS TEMPLATE                       │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
        ┌──────────────────────────────────────┐
        │   LayoutMapper Initializes            │
        │   - frontLayout = CALIBRATED_DEFAULT  │
        │   - backLayout = CALIBRATED_DEFAULT   │
        │   - layoutInitialized.useRef = false  │
        └──────────────────────┬────────────────┘
                               │
                               ▼
              ┌────────────────────────────┐
              │  Admin Maps Fields          │
              │  (Drag to position)         │
              └────────────────┬────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Admin Clicks Save                    │
        │  Sends: { front: {...}, back: {...}} │
        └──────────────────────┬────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ ⚠️  ISSUE #2 HERE!          │
                │ If template changes before  │
                │ saving, old data persists   │
                └──────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Backend Saves to Database            │
        │  card_layout_front                   │
        │  card_layout_back                    │
        └──────────────────────┬────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ ⚠️  ISSUE #3 HERE!          │
                │ No validation - could save  │
                │ empty {} objects             │
                └──────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                   STUDENT VIEWS PREVIEW                          │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  PreviewPage Fetches Layout           │
        │  GET /api/settings/layout             │
        │  Receives: { front, back }            │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  CardCanvas Receives Layout           │
        │  if (layout.front || layout.back)     │
        └──────────────────────┬────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ ⚠️  ISSUE #1 HERE!          │
                │ If layout.back = {}         │
                │ (empty object, truthy!)     │
                │ Uses {} instead of defaults │
                └──────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Canvas Renders Card                  │
        │  ❌ BLANK SIDE (no fields!)          │
        └──────────────────────────────────────┘
```

---

## After Fix: Data Flow Working Correctly ✅

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN UPLOADS TEMPLATE                       │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
        ┌──────────────────────────────────────┐
        │   LayoutMapper Initializes            │
        │   - frontLayout = CALIBRATED_DEFAULT  │
        │   - backLayout = CALIBRATED_DEFAULT   │
        │   - layoutInitialized.useRef = false  │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  ✅ NEW: Reset useRef on template    │
        │  change - allows re-init of layout   │
        │  when new template uploaded           │
        └──────────────────────┬────────────────┘
                               │
                               ▼
              ┌────────────────────────────┐
              │  Admin Maps Fields          │
              │  (Drag to position)         │
              └────────────────┬────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Admin Clicks Save                    │
        │  Sends: { front: {...}, back: {...}} │
        │  ✅ Logs field count: (7) fields    │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Backend Validates Layout             │
        │  ✅ Checks: Object.keys().length > 0 │
        │  Warns if empty, logs field counts   │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Backend Saves to Database            │
        │  card_layout_front: {7 fields}       │
        │  card_layout_back: {4 fields}        │
        └──────────────────────┬────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                   STUDENT VIEWS PREVIEW                          │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  PreviewPage Fetches Layout           │
        │  GET /api/settings/layout             │
        │  ✅ Logs field counts received      │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Backend Returns Layout               │
        │  ✅ If empty, returns DEFAULTS       │
        │  front: {7 fields}, back: {4 fields} │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  CardCanvas Receives Layout           │
        │  ✅ Checks: Object.keys().length > 0 │
        │  If empty, uses DEFAULTS              │
        └──────────────────────┬────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  Canvas Renders Card                  │
        │  ✅ Uses custom layout positions!    │
        │  Fields at admin-mapped positions    │
        └──────────────────────────────────────┘
```

---

## Key Validation Points Added

```javascript
// Frontend: CardCanvas.jsx
if (layout.front && Object.keys(layout.front).length > 0) {
  use layout.front
} else {
  use CALIBRATED_LAYOUT_FRONT  // Fallback to defaults
}

// Backend: settings.js GET /layout
const frontResult = (frontLayout && Object.keys(frontLayout).length > 0)
  ? frontLayout
  : DEFAULT_LAYOUT_FRONT

// Backend: settings.js PUT /layout
if (Object.keys(front || {}).length === 0) {
  logger.warn('Front layout is empty')  // Alert admin
}
```

---

## Debug Trail with Console Logs

When working properly, follow the data with logs:

```
[Admin Dashboard] Save clicked
  ↓
[Admin saveLayout] front fields: 7, back: 4
  ↓
[Backend PUT] Saving layout frontFields: 7, backFields: 4
  ↓
[Backend PUT] Saved successfully savedFrontFields: 7, savedBackFields: 4
  ↓
[PreviewPage] Layout retrieved
  ↓
[Preview fetchTemplateAndLayout] front fields: 7, back: 4
  ↓
[CardCanvas] Receives layout with 7+4 fields
  ↓
✅ Card renders with custom mapping!
```

If any step shows 0 fields, that's where the issue is:
- 0 at Admin save → LayoutMapper didn't capture fields
- 0 at Backend save → Data corrupted in transmission
- 0 at Preview retrieve → Layout wasn't saved properly
- 0 at CardCanvas render → Frontend not displaying
