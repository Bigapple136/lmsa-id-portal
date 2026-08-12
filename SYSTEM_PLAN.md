# ID Card Template & Layout System - Complete Plan

## 🎯 Overall Goal
Enable admins to upload ID card templates (front/back), map student fields to specific positions, and have students see exact previews of what will be printed.

---

## 📊 System Architecture Overview

```
ADMIN WORKFLOW                      STUDENT WORKFLOW
├─ Upload Template (front/back)      ├─ Receive QR Preview Link
├─ Zone Detection (automatic)        ├─ Fetch Student Data
├─ LayoutMapper (drag & drop)        ├─ Fetch Active Templates
├─ Map Fields to Positions           ├─ Fetch Saved Layout
├─ Assign Field Sides                ├─ Fetch Field Sides Config
├─ Save Layout                       ├─ CardCanvas Renders
└─ Broadcast Updates                 ├─ View Preview (flip front/back)
                                     ├─ Open Print Preview
                                     └─ Validate & Report Issues
```

---

## 📝 Current State Assessment

### ✅ What's Working:
1. Templates can be uploaded and zone-detected
2. Layout can be saved/loaded from database
3. CardCanvas can render both front and back
4. FieldSides configuration exists
5. Admin can drag & drop fields

### ⚠️ Current Issues to Solve:

**Issue 1: Card Preview Not Using Saved Map**
- Symptoms: Student sees default layout instead of admin's custom mapping
- Status: Partially fixed, but layout data integrity issues remain

**Issue 2: Print Preview Shows Front Twice**
- Symptoms: Back side of print preview shows front template instead of back
- Status: Fixed (now passes templateUrlFront AND templateUrlBack)

**Issue 3: Config Keys Contaminating Layout**
- Symptoms: Layout saves fontFamily, logoPosition, primaryColor, secondaryColor
- Status: Fixed (filtering both frontend and backend)

---

## 🔍 System Components Deep Dive

### 1️⃣ **TEMPLATE SYSTEM**
**What It Does:**
- Admin uploads PNG/JPG image (one side)
- Backend detects zones (printed boxes) automatically
- Generates suggested field layout based on zone positions
- Stores in Supabase Storage + templates table
- Returns zones and suggested layout to frontend

**Inputs:**
- File: PNG/JPG image (CR-80 size ~590×1004px)
- Side: 'front' or 'back'

**Outputs:**
- file_url: Public URL of uploaded image
- zones: Detected boxes as rectangles
- suggested_layout: Auto-proposed field positions

**Current State:** ✅ Working correctly

---

### 2️⃣ **LAYOUTMAPPER (Admin UI)**
**What It Does:**
- Shows template image at 260px scaled display
- Displays detected zones as blue boxes
- Allows admin to drag field labels onto positions
- Provides "Snap to Zone" feature for precise alignment
- Shows "Auto-Map" to apply suggested layout
- Allows front/back switching
- Allows field-side assignment (front/back/both)
- Saves layout to database

**Data Structure:**
```javascript
{
  front: {
    photo: { x: 0.127, y: 0.167, width: 0.745, height: 0.329, type: 'image' },
    full_name: { x: 0.5, y: 0.590, fontSize: 0.068, color: '#1A1A1A', type: 'text', ... },
    // ... 7 fields total on front
  },
  back: {
    qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
    blood_type: { x: 0.5, y: 0.15, fontSize: 0.05, type: 'text', ... },
    // ... 5 fields total on back
  }
}
```

**Key Behaviors:**
- Only saves layouts for sides with uploaded templates (no blank overwriting)
- Filters out config keys (fontFamily, logoPosition, etc.)
- Merges with defaults on initialization
- Re-syncs when new templates are uploaded
- Cannot save without at least one template uploaded

**Current Issues:**
- ⚠️ Sometimes contains extra keys that shouldn't be there
- ⚠️ Potential race conditions with template changes

---

### 3️⃣ **CARDCANVAS (Renderer)**
**What It Does:**
- Loads template image
- For each field in layout, draws on canvas
- Photo: center-crop and clip
- QR/Signature: draw at coordinates
- Text: measure and shrink font if needed
- Handles front/back with flip animation

**Inputs:**
- student: { photo_url, full_name, student_id, ... }
- templateUrlFront/Back: Public URLs
- layout: { front: {...}, back: {...} }
- fieldSides: { field: 'front'|'back'|'both' }
- side: 'front' or 'back' (current)

**Outputs:**
- Canvas rendering (PNG if exported)

**Key Behaviors:**
- If layout side is empty `{}`, falls back to defaults
- Uses fieldSides to filter which fields to render on each side
- Handles missing images gracefully
- Flips with animation on click

**Current Issues:**
- ⚠️ Needs to handle both templateUrlFront AND templateUrlBack consistently
- ⚠️ Must ensure layout data has proper structure

---

### 4️⃣ **CARD PREVIEW (Student View)**
**What It Does:**
- Student sees their ID card before confirmation
- Can flip to see back side
- Can open print preview
- Can report issues

**Data Fetching:**
- Parallel requests: templates, layout, field-sides, qr-fields
- Each request independent (one failure doesn't block others)
- Falls back to basic IDCardDisplay if CardCanvas can't load

**Rendering:**
- If templateUrl AND cardLayout exist → CardCanvas
- Otherwise → IDCardDisplay (fallback)

**Current Issues:**
- ⚠️ Sometimes shows fallback when layout is still loading
- ⚠️ Layout data might not be properly formatted

---

### 5️⃣ **PRINT PREVIEW (Full Card View)**
**What It Does:**
- Shows larger view (340px) for printing
- Must show BOTH front and back
- Uses same CardCanvas component
- No fallback allowed (should always show proper card)

**Critical Requirements:**
- ✅ Must load BOTH templateUrlFront and templateUrlBack
- ✅ CardCanvas must flip to show back side
- ✅ Layout must apply to both sides correctly
- ✅ No config keys in layout

**Current Status:**
- ✅ Recently fixed to load both template URLs
- ✅ Config keys filtered
- ⚠️ Needs testing to ensure both sides render

---

## 🔄 Data Flow Diagram

```
ADMIN SIDE:
Upload Template → Detect Zones → Display in LayoutMapper
                                      ↓
                            Admin Maps Fields ↔ Snap to Zones
                            Admin Assigns Sides
                                      ↓
                            LayoutMapper Saves
                                      ↓
                    Backend Filters Config Keys
                                      ↓
Database (card_layout_front, card_layout_back)
                                      ↓
                            BroadcastChannel


STUDENT SIDE:
QR Link → PreviewPage Loads Data ← Database
                  ↓
        Fetch: templates, layout, field-sides
                  ↓
        CardCanvas Resolves Layout
                  ↓
        For each field:
          - Load image/text data
          - Apply position from layout
          - Render on canvas
                  ↓
        Student Sees Card (front)
                  ↓
        Click to Flip → Render Back
```

---

## ✅ Success Criteria - What Should Happen

### For Admins:
1. ✅ Upload front template → See detected zones
2. ✅ Drag fields to positions → Visual feedback
3. ✅ Click "Auto-Map" → Fields snap to suggested positions
4. ✅ Switch to back → Load back template with independent layout
5. ✅ Save → Only sends data for sides with templates
6. ✅ No config keys saved → Only valid student fields

### For Students:
1. ✅ Open preview link → See ID card with custom layout
2. ✅ Front side shows: photo, name, ID, position, year, signature, QR
3. ✅ Back side shows: QR, blood type, phone, issue date, valid until
4. ✅ Flip animation works smoothly
5. ✅ Print preview shows BOTH sides correctly
6. ✅ Positions match admin's mapping exactly

### For Backend:
1. ✅ Save layout with validation
2. ✅ Filter config keys before storing
3. ✅ Return empty object if layout is incomplete
4. ✅ Handle both front/back independently
5. ✅ Provide both template URLs to frontend
6. ✅ Log field counts for debugging

---

## 🔧 Technical Considerations

### Data Format:
- **Coordinates**: Fractional (0–1) relative to image width/height
- **Text Fields**: Position is CENTER point (x, y)
- **Image Fields**: Position is TOP-LEFT point (x, y) + width/height
- **Colors**: Hex format #RRGGBB
- **Font**: CSS font-family string

### Validation:
- Only 12 valid fields allowed (photo, full_name, student_id, position, year_level, signature, qr, blood_type, emergency_contact_phone, issue_date, valid_until)
- Config keys filtered both frontend AND backend
- At least one template required to save layout

### State Management:
- LayoutMapper: Local state, resets on template change
- PreviewPage: Fetches fresh on load, listens to BroadcastChannel
- CardCanvas: Stateless renderer
- PrintPreviewModal: Fetches once on open

### Performance:
- Parallel API requests (Promise.allSettled)
- Canvas rendering only when needed
- Image loading with cancellation support
- Web font preloading

---

## 📋 The Plan: Step-by-Step Fixes

### Phase 1: Ensure Data Integrity ✅
- [x] Filter config keys frontend + backend
- [x] Validate layout on save
- [x] Ensure both front and back URLs are loaded
- [x] Reset LayoutMapper on template change

### Phase 2: Fix Preview Issues
- [ ] **Ensure CardCanvas receives proper layout structure**
  - Both front and back should have valid field positions
  - Empty sides should use defaults
  - No config keys should be present

- [ ] **Verify layout propagates through all components**
  - AdminDashboard saves layout
  - PreviewPage loads layout
  - CardCanvas receives layout
  - Print preview receives layout

- [ ] **Ensure print preview shows both sides**
  - Load both templateUrlFront and templateUrlBack ✅
  - Pass both to CardCanvas
  - Flip animation should show both

### Phase 3: Robustness
- [ ] Handle edge cases (missing data, corrupted layout)
- [ ] Provide clear error messages
- [ ] Add defensive checks
- [ ] Comprehensive logging

### Phase 4: Testing & Validation
- [ ] Admin flow: upload → map → save
- [ ] Student flow: preview → flip → print
- [ ] Data integrity: no config keys, valid fields only
- [ ] Both sides rendering correctly

---

## 🎯 End State - What We're Building

When complete, the system should work like this:

**Admin Experience:**
```
1. Upload template image (front)
   ↓ (system detects zones automatically)
2. See zones on template
3. Click "Auto-Map" OR manually drag fields
4. See fields positioned on template
5. Switch to back side
6. Upload back template & map fields
7. Click Save → System validates & saves
8. ✅ Layout is now live for students
```

**Student Experience:**
```
1. Receive preview link
2. Click link → See their ID card
   - Front side shows: photo, name, ID, year, position, signature, QR
   - Positioned exactly as admin mapped them
3. Click to flip → Back side shows
   - Shows: QR code, blood type, emergency contact, dates
4. Click Print Preview → See exactly what will print
   - Shows both front and back
5. Validate & confirm OR report issues
```

**Technical Result:**
- ✅ Database stores only valid field positions
- ✅ No config data mixed with layout
- ✅ Both front and back handled independently
- ✅ Preview === Print === Actual Printed Card
- ✅ All data validated at every step

---

## 🔍 Questions for Validation

1. **Field Coordinate System**: 
   - Should text fields use center point (x, y) or top-left?
   - Should image fields always use top-left?
   - Are fractional coordinates (0–1) the right approach?

2. **Default Layouts**:
   - Should defaults be used as fallback if layout is missing?
   - Or should missing layout be an error?

3. **Field Sides**:
   - Should "both" mean the field appears on both front AND back?
   - Or should QR be special (appears once but on both)?

4. **Template Matching**:
   - Can layout from one template version be used with a different version?
   - Should we validate layout fields against current template?

5. **Configuration Keys**:
   - Are there other keys besides fontFamily, logoPosition, primaryColor, secondaryColor that might sneak in?
   - Where are these keys coming from?

6. **Error Handling**:
   - If layout is corrupted, should we show error or fallback to defaults?
   - Should admins be warned about configuration key contamination?

---

## 📌 Current Status Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Templates | ✅ Working | Zone detection functioning |
| LayoutMapper | ⚠️ Partial | Config keys still possible |
| CardCanvas | ✅ Working | Both sides render correctly |
| Card Preview | ⚠️ Partial | Layout may not sync properly |
| Print Preview | ✅ Fixed | Now loads both templates |
| Data Filtering | ✅ Fixed | Config keys filtered frontend + backend |
| Layout Saving | ✅ Improved | Only saves for existing templates |
| Layout Loading | ⚠️ Partial | Need to verify structure |

---

## 🚀 Next Steps (After Plan Review)

1. Verify plan aligns with vision
2. Identify any gaps or misunderstandings
3. Get answers to validation questions
4. Identify priority fixes vs. nice-to-haves
5. Create implementation roadmap
