# Layout Integration Recreation Plan

## Overview
Complete recreation of the template → layout mapper → preview integration with server-side zone detection, auto-map, and field-side configuration.

---

## Decisions Confirmed

| Decision | Choice |
|----------|--------|
| Zone detection resolution | Full resolution (no downscaling) |
| Auto-map UX | Preview dialog with proposed field→zone mapping before applying |
| Field-side checkboxes | Simple list under template preview |
| Existing field-side mapping | Fresh start |
| Priority order | Phase 1 → 2 → 3 → 4 → 5 → 6 |

---

## Implementation Phases

### Phase 1: Single Source of Truth (Backend Alignment) ✅ COMPLETED
- Updated `backend/routes/settings.js` `DEFAULT_LAYOUT_FRONT`:
  - `student_id.textAlign: 'center'`
  - `year_level.textAlign: 'center'`
- Added comment referencing `frontend/src/lib/layoutConstants.js`

### Phase 2: Node.js Zone Detection using Sharp (Full Resolution) ✅ COMPLETED
**New File:** `backend/utils/detectZones.js` ✅ CREATED
- Port of frontend detection algorithm using Sharp
- Full resolution processing via Sharp `raw()` buffer
- Exports `detectZonesFromBuffer(buffer)` → `{ zones, width, height }`

**Modified:** `backend/routes/templates.js` ✅ COMPLETED
- `POST /api/templates`: Run detection on uploaded buffer, store `zones_front/back`, `suggested_layout_front/back`
- `PUT /api/templates/:id/activate`: Re-detect if missing, generate `suggestedLayout`, return in response

**DB Migration:** `supabase/migrations/20260812_add_template_zones_and_layout.sql` ✅ CREATED (apply before deploy)
```sql
ALTER TABLE templates ADD COLUMN zones_front JSONB;
ALTER TABLE templates ADD COLUMN zones_back JSONB;
ALTER TABLE templates ADD COLUMN suggested_layout_front JSONB;
ALTER TABLE templates ADD COLUMN suggested_layout_back JSONB;

INSERT INTO portal_settings (key, value) VALUES 
  ('card_field_sides', '{"photo":"front","full_name":"front","student_id":"front","position":"front","year_level":"front","signature":"front","qr":"both","blood_type":"back","emergency_contact_phone":"back","issue_date":"back","valid_until":"back"}')
ON CONFLICT (key) DO NOTHING;
```

### Phase 3: LayoutMapper UI/UX Redesign (Complete Rewrite) ✅ COMPLETED
**File:** `frontend/src/components/LayoutMapper.jsx` — rewritten with:
- Top bar: Front/Back tabs, template name, ✨ Auto-Map, Reset, Save
- 2-column layout: template preview (260px) + right panel
- Field-side checkboxes (Front/Back/Both) persisted via `card_field_sides`
- Auto-Map dialog: applies server `suggested_layout_*` or client-detected zones
- Preserved: drag-to-center, snap-to-zone, full property editor
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

**Features:**
- Template Preview (260px) with clickable zone overlays
- Field-side checkboxes (simple list under template)
- Auto-Map button → preview dialog → confirm → applies server `suggestedLayout`
- Zone click → field assignment dropdown
- Property editor panel (position, size, style, type)
- Front/Back tabs

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
- Active template objects carry `suggested_layout_front/back` (from upload + activate)
- `LayoutMapper` receives `suggestedLayoutFront/Back` → Auto-Map consumes them

### Phase 5: Backward Compatibility (Lazy Migration) ✅ COMPLETED
**Backend (`backend/routes/settings.js` - `GET /layout`):**
```js
if (!frontLayout && !backLayout) {
  const legacy = await supabase.from('portal_settings')
    .select('value').eq('key', 'card_layout').maybeSingle()
  
  if (legacy?.data?.value) {
    frontLayout = legacy.data.value
    backLayout = DEFAULT_LAYOUT_BACK
    supabase.from('portal_settings').upsert([...]).then(() => {
      supabase.from('portal_settings').delete().eq('key', 'card_layout')
    })
  }
}
```

**Frontend:** `fieldSides` from `card_field_sides` setting (new `GET/PUT /api/settings/field-sides`); persisted from LayoutMapper checkboxes

### Phase 6: Preview/Print Consistency ✅ COMPLETED
**`CardCanvas.jsx`:** Respects `fieldSides` (renders only fields on the current side)
**`PreviewPage.jsx` & `PrintPreviewModal.jsx`:** Fetch `card_field_sides` and pass `fieldSides` to `CardCanvas`

---

## Files to Create/Modify

| File | Status | Description |
|------|--------|-------------|
| `backend/utils/detectZones.js` | ✅ Created | Sharp-based full-res zone detection |
| `supabase/migrations/20260812_add_template_zones_and_layout.sql` | ✅ Created (apply) | DB schema |
| `backend/routes/templates.js` | ✅ Completed | Detection on upload/activate |
| `backend/routes/settings.js` | ✅ Completed | Lazy migration + field-sides GET/PUT |
| `frontend/src/components/LayoutMapper.jsx` | ✅ Completed | Complete rewrite |
| `frontend/src/pages/AdminDashboard.jsx` | ✅ Completed | Load/store field-sides, pass suggestedLayout |
| `frontend/src/components/CardCanvas.jsx` | ✅ Completed | Respects fieldSides |
| `frontend/src/pages/PreviewPage.jsx` | ✅ Completed | Fetch/pass fieldSides |
| `frontend/src/components/PrintPreviewModal.jsx` | ✅ Completed | Fetch/pass fieldSides |

---

## Next Steps
1. **Apply the DB migration** `supabase/migrations/20260812_add_template_zones_and_layout.sql` (adds `zones_*`/`suggested_layout_*` columns + `card_field_sides` row).
2. Re-upload templates so `suggested_layout_*`/`zones_*` are populated (or activate an existing template).
3. Test Auto-Map flow in the Layout tab and verify front/back rendering in Preview/Print.