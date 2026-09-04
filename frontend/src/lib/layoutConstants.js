// Single source of truth for calibrated card layout coordinates.
// All values are fractional (0–1) relative to card width/height.
// Pixel-calibrated for LMSA portrait template (590×1004 px).

// CR-80 standard card edges (mm). The standard is 85.6 × 53.98mm; which of
// those is the width depends on the card's orientation, so they are named by
// edge length rather than by axis. Deriving the axis from the template's own
// aspect ratio is the only way the millimetre readouts can stay true for both
// a portrait and a landscape template.
export const CR80_LONG_EDGE_MM = 85.6
export const CR80_SHORT_EDGE_MM = 53.98

// LMSA's production card is portrait: the calibrated template is 590×1004px
// and CardCanvas renders at a 158.5% padding-top aspect. These two exports are
// the portrait defaults used when no template has been measured yet.
export const CARD_WIDTH_MM = CR80_SHORT_EDGE_MM
export const CARD_HEIGHT_MM = CR80_LONG_EDGE_MM

// Physical card dimensions for a template of a given pixel size. A template
// taller than it is wide is portrait (short edge horizontal); a wider one is
// landscape. Used to show admins a physical measurement alongside the
// fractional x/y/width/height values, since a template's real photo-frame
// dimensions are usually known in mm (from the design file or a ruler), not as
// a percentage of card width.
export function cardDimensionsMm(imgSize) {
  const w = imgSize?.width
  const h = imgSize?.height
  if (!w || !h || w <= 0 || h <= 0) {
    return { widthMm: CARD_WIDTH_MM, heightMm: CARD_HEIGHT_MM }
  }
  return h >= w
    ? { widthMm: CR80_SHORT_EDGE_MM, heightMm: CR80_LONG_EDGE_MM }
    : { widthMm: CR80_LONG_EDGE_MM, heightMm: CR80_SHORT_EDGE_MM }
}

export const CALIBRATED_LAYOUT_FRONT = {
  photo: { x: 0.1271, y: 0.1673, width: 0.7458, height: 0.3287, type: 'image' },
  full_name: {
    x: 0.5,
    y: 0.5896,
    fontSize: 0.0678,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.88,
  },
  student_id: {
    x: 0.2441,
    y: 0.6614,
    fontSize: 0.0576,
    color: '#CC0000',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  position: {
    x: 0.5,
    y: 0.7231,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.7,
  },
  year_level: {
    x: 0.0593,
    y: 0.7749,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

export const CALIBRATED_LAYOUT_BACK = {
  qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
  blood_type: {
    x: 0.5,
    y: 0.15,
    fontSize: 0.05,
    color: '#CC0000',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  emergency_contact_phone: {
    x: 0.5,
    y: 0.34,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  issue_date: {
    x: 0.5,
    y: 0.58,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  valid_until: {
    x: 0.5,
    y: 0.66,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
}

export const FRONT_FIELD_ORDER = [
  'photo',
  'full_name',
  'student_id',
  'position',
  'year_level',
  'signature',
]

export const BACK_FIELD_ORDER = [
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

// Valid student data fields (config keys like fontFamily, logoPosition get filtered out)
export const VALID_LAYOUT_FIELDS = new Set([
  'photo',
  'full_name',
  'student_id',
  'position',
  'year_level',
  'signature',
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
])

// Fields available for each side (used by LayoutMapper)
export const FRONT_FIELDS = [
  'photo',
  'full_name',
  'student_id',
  'year_level',
  'position',
  'signature',
]

export const BACK_FIELDS = [
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

// Resolve one side of a saved layout against its calibrated defaults. A
// side counts as customized only if it has at least one real field entry
// (stray config/meta keys don't count) — otherwise its calibrated defaults
// are used. This is the ONLY place that decision gets made; CardCanvas,
// the admin's live preview, and the student-facing preview/print pages all
// call this instead of each re-implementing their own empty-layout check.
export function resolveLayoutSide(savedSide, defaults) {
  const hasFields = savedSide && Object.keys(savedSide).some((key) => VALID_LAYOUT_FIELDS.has(key))
  return hasFields ? savedSide : defaults
}

// Resolve a full { front, back } saved layout (as returned by
// GET /api/settings/layout) against the calibrated defaults for each side.
// Front and back resolve independently — mapping only one side is enough
// to activate it for that side; the other side just uses defaults until
// it's mapped too.
export function resolveCardLayout(saved) {
  return {
    front: resolveLayoutSide(saved?.front, CALIBRATED_LAYOUT_FRONT),
    back: resolveLayoutSide(saved?.back, CALIBRATED_LAYOUT_BACK),
  }
}

// Estimated characters per field, used to auto-fit font size to a detected box
export const EST_CHARS = {
  full_name: 18,
  student_id: 16,
  year_level: 14,
  position: 20,
  programme: 18,
  date_of_birth: 10,
  nationality: 14,
  county_of_origin: 14,
  current_address: 20,
  student_email: 22,
  blood_type: 6,
  emergency_contact_phone: 12,
  issue_date: 10,
  valid_until: 10,
}