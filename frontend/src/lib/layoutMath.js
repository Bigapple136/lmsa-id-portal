// Single source of truth for "where should this field sit inside this box".
//
// This math previously existed twice inside LayoutMapper.jsx —
// buildSuggestedLayout() carried its own copy of the character-width table and
// the fit formula, and snapFieldToZone() carried another — so click-to-snap
// and Auto-Map could drift apart the moment either was edited. Both now import
// from here. Anything server-side that proposes a layout (the stored
// suggested_layout_* columns) must agree with this module.

import { EST_CHARS } from './layoutConstants'

// Widest font size (as a fraction of card width) that fits `field`'s expected
// text inside `zone`, bounded by the zone's height and a hard ceiling so a
// large box can never produce absurd type.
//
// `aspect` is the template's height/width ratio: zone heights are fractions of
// card height, font sizes are fractions of card width, so the height term has
// to be converted between the two before they can be compared.
export const CHAR_WIDTH_RATIO = 0.62
export const MAX_FONT_SIZE = 0.12
export const HEIGHT_FILL_RATIO = 0.8

export function fitTextToZone(zone, field, aspect) {
  const chars = EST_CHARS[field] || 12
  return Math.min(
    zone.width / (chars * CHAR_WIDTH_RATIO),
    zone.height * aspect * HEIGHT_FILL_RATIO,
    MAX_FONT_SIZE,
  )
}

// Image fields render from their top-left corner in CardCanvas, so an image
// placed in a zone stores the zone's top-left, not its center.
export function imagePlacementForZone(zone) {
  return {
    type: 'image',
    x: zone.left,
    y: zone.top,
    width: zone.width,
    height: zone.height,
  }
}

// Text fields are drawn with textBaseline 'middle' in CardCanvas, so (x, y) is
// always the true center of the glyph box, on both axes, regardless of
// textAlign. Text placed in a zone therefore stores the zone's center.
export function textPlacementForZone(zone, field, aspect) {
  return {
    type: 'text',
    x: zone.left + zone.width / 2,
    y: zone.top + zone.height / 2,
    fontSize: fitTextToZone(zone, field, aspect),
    textAlign: 'center',
    maxWidth: zone.width,
  }
}

// Fields that place as images rather than text.
export const IMAGE_FIELDS = ['photo', 'qr', 'signature']

export function isImageField(field) {
  return IMAGE_FIELDS.includes(field)
}

// Fields rendered bold by default when auto-placed.
const BOLD_BY_DEFAULT = new Set(['full_name', 'position', 'blood_type'])

// Build a whole proposed layout from detected zones, for one side. Returns
// { layout, rows } where rows describe the field→zone mapping for the Auto-Map
// preview dialog.
const FRONT_TEXT_FIELDS = ['full_name', 'student_id', 'position', 'year_level', 'signature']
const BACK_TEXT_FIELDS = ['blood_type', 'emergency_contact_phone', 'issue_date', 'valid_until']

export function suggestLayout(zones, side, aspect, labelFor = (f) => f) {
  if (!zones || zones.length === 0) return null

  const sorted = zones
    .map((z, i) => ({ ...z, area: z.width * z.height, zoneIndex: i }))
    .sort((a, b) => b.area - a.area)

  const layout = {}
  const rows = []
  const used = new Set()

  const placeImage = (z, field) => {
    layout[field] = imagePlacementForZone(z)
    rows.push({ field, label: labelFor(field), zone: z.zoneIndex + 1 })
  }
  const placeText = (z, field) => {
    layout[field] = {
      ...textPlacementForZone(z, field, aspect),
      color: '#1A1A1A',
      bold: BOLD_BY_DEFAULT.has(field),
    }
    rows.push({ field, label: labelFor(field), zone: z.zoneIndex + 1 })
  }

  if (side === 'front') {
    if (sorted[0]) {
      placeImage(sorted[0], 'photo')
      used.add(0)
    }
    // The QR is the roughly-square, small, low-on-the-card box.
    //
    // "Square" has to be measured visually. Zone width and height are
    // fractions of two different edges, so on the portrait production card
    // (aspect ≈ 1.70) a visually square box has a fractional w/h of ≈ 1.70,
    // not 1.0 — the old unconverted `z.width / z.height` test could never
    // match a real QR box on a portrait template, and Auto-Map silently left
    // the QR unplaced on every front it scanned.
    let qrIdx = -1
    for (let i = 1; i < sorted.length; i++) {
      const z = sorted[i]
      const visualAspect = (z.width / z.height) / aspect
      if (visualAspect > 0.7 && visualAspect < 1.4 && z.top > 0.6 && z.area < 0.1) {
        qrIdx = i
        break
      }
    }
    if (qrIdx >= 0) {
      placeImage(sorted[qrIdx], 'qr')
      used.add(qrIdx)
    }
    assignRemaining(sorted, used, FRONT_TEXT_FIELDS, placeText)
  } else {
    if (sorted[0]) {
      placeImage(sorted[0], 'qr')
      used.add(0)
    }
    assignRemaining(sorted, used, BACK_TEXT_FIELDS, placeText)
  }

  return { layout, rows }
}

function assignRemaining(sorted, used, textFields, placeText) {
  const remaining = sorted
    .map((z, i) => ({ ...z, origIdx: i }))
    .filter((z) => !used.has(z.origIdx))
    .sort((a, b) => a.top - b.top)
  remaining.forEach((z, i) => {
    if (textFields[i]) placeText(z, textFields[i])
  })
}
