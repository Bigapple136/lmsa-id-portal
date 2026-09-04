import { describe, it, expect } from 'vitest'
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  CR80_LONG_EDGE_MM,
  CR80_SHORT_EDGE_MM,
  cardDimensionsMm,
} from '../lib/layoutConstants'
import {
  fitTextToZone,
  imagePlacementForZone,
  isImageField,
  suggestLayout,
  textPlacementForZone,
} from '../lib/layoutMath'

// The mapper's millimetre readouts are the only bridge between the fractional
// coordinates it stores and the physical card an admin measures with a ruler.
// They were wrong by ~1.59x because a portrait card was measured with
// landscape constants, and nothing caught it.
describe('card dimensions in mm', () => {
  it('defaults to portrait, matching the production LMSA template', () => {
    expect(CARD_WIDTH_MM).toBe(CR80_SHORT_EDGE_MM)
    expect(CARD_HEIGHT_MM).toBe(CR80_LONG_EDGE_MM)
    expect(CARD_HEIGHT_MM).toBeGreaterThan(CARD_WIDTH_MM)
  })

  it('derives portrait dimensions from a portrait template', () => {
    // The calibrated LMSA template.
    expect(cardDimensionsMm({ width: 590, height: 1004 })).toEqual({
      widthMm: CR80_SHORT_EDGE_MM,
      heightMm: CR80_LONG_EDGE_MM,
    })
  })

  it('derives landscape dimensions from a landscape template', () => {
    expect(cardDimensionsMm({ width: 1004, height: 590 })).toEqual({
      widthMm: CR80_LONG_EDGE_MM,
      heightMm: CR80_SHORT_EDGE_MM,
    })
  })

  it('keeps the mm aspect ratio consistent with the pixel aspect ratio', () => {
    for (const size of [
      { width: 590, height: 1004 },
      { width: 1004, height: 590 },
      { width: 638, height: 1011 },
    ]) {
      const { widthMm, heightMm } = cardDimensionsMm(size)
      const pixelIsPortrait = size.height >= size.width
      const mmIsPortrait = heightMm >= widthMm
      expect(mmIsPortrait).toBe(pixelIsPortrait)
    }
  })

  it('falls back to the portrait default for a missing or degenerate size', () => {
    expect(cardDimensionsMm(undefined)).toEqual({
      widthMm: CARD_WIDTH_MM,
      heightMm: CARD_HEIGHT_MM,
    })
    expect(cardDimensionsMm({ width: 0, height: 0 })).toEqual({
      widthMm: CARD_WIDTH_MM,
      heightMm: CARD_HEIGHT_MM,
    })
  })
})

// CardCanvas draws all text with textBaseline 'middle' and images from their
// top-left corner. Every placement helper has to agree with that, and so does
// the mapper's editing chip — the editor and the renderer disagreeing is the
// worst defect a WYSIWYG tool can have.
describe('zone placement matches the CardCanvas anchor model', () => {
  const zone = { left: 0.2, top: 0.4, width: 0.5, height: 0.1 }

  it('anchors an image at the zone top-left, as CardCanvas draws it', () => {
    expect(imagePlacementForZone(zone)).toEqual({
      type: 'image',
      x: 0.2,
      y: 0.4,
      width: 0.5,
      height: 0.1,
    })
  })

  it('anchors text at the zone centre on both axes', () => {
    const placed = textPlacementForZone(zone, 'full_name', 1.7)
    expect(placed.x).toBeCloseTo(0.45, 10)
    expect(placed.y).toBeCloseTo(0.45, 10)
    expect(placed.type).toBe('text')
    expect(placed.maxWidth).toBe(zone.width)
  })

  it('classifies image fields consistently', () => {
    expect(isImageField('photo')).toBe(true)
    expect(isImageField('qr')).toBe(true)
    expect(isImageField('signature')).toBe(true)
    expect(isImageField('full_name')).toBe(false)
  })
})

// This is the geometry the mapper's editing chip must reproduce. The chip is
// positioned by its top-left corner, so for text its top is y - height/2 for
// EVERY alignment: textAlign moves the horizontal anchor only, because the
// canvas baseline is 'middle' regardless.
describe('editor chip geometry agrees with the render anchor', () => {
  const aspect = 1004 / 590

  function chipRect(pos) {
    const isImg = pos.type === 'image'
    const align = pos.textAlign || 'left'
    const chipW = isImg ? pos.width : pos.maxWidth || 0.3
    const chipH = isImg ? pos.height : (pos.fontSize || 0.04) / aspect
    const left =
      isImg || align === 'left' ? pos.x : align === 'right' ? pos.x - chipW : pos.x - chipW / 2
    const top = isImg ? pos.y : pos.y - chipH / 2
    return { left, top, width: chipW, height: chipH }
  }

  for (const align of ['left', 'center', 'right']) {
    it(`centres the chip vertically on the drawn y for ${align}-aligned text`, () => {
      const pos = { type: 'text', x: 0.5, y: 0.6, fontSize: 0.05, maxWidth: 0.4, textAlign: align }
      const rect = chipRect(pos)
      // The renderer draws the glyph centre at pos.y; the chip's centre must
      // land on the same point, whatever the horizontal alignment is.
      expect(rect.top + rect.height / 2).toBeCloseTo(pos.y, 10)
    })
  }

  it('anchors the chip horizontally according to textAlign', () => {
    const base = { type: 'text', x: 0.5, y: 0.6, fontSize: 0.05, maxWidth: 0.4 }
    expect(chipRect({ ...base, textAlign: 'left' }).left).toBeCloseTo(0.5, 10)
    expect(chipRect({ ...base, textAlign: 'center' }).left).toBeCloseTo(0.3, 10)
    expect(chipRect({ ...base, textAlign: 'right' }).left).toBeCloseTo(0.1, 10)
  })

  it('anchors an image chip at its top-left, matching drawImage', () => {
    const pos = { type: 'image', x: 0.1, y: 0.2, width: 0.3, height: 0.25 }
    expect(chipRect(pos)).toEqual({ left: 0.1, top: 0.2, width: 0.3, height: 0.25 })
  })
})

describe('fitTextToZone', () => {
  const aspect = 1004 / 590

  it('never exceeds the hard font-size ceiling', () => {
    const huge = { left: 0, top: 0, width: 1, height: 1 }
    expect(fitTextToZone(huge, 'blood_type', aspect)).toBeLessThanOrEqual(0.12)
  })

  it('shrinks type for a field with more expected characters', () => {
    const zone = { left: 0, top: 0, width: 0.6, height: 0.2 }
    const short = fitTextToZone(zone, 'blood_type', aspect)
    const long = fitTextToZone(zone, 'student_email', aspect)
    expect(long).toBeLessThan(short)
  })

  it('is bounded by a short zone height', () => {
    const flat = { left: 0, top: 0, width: 0.9, height: 0.01 }
    expect(fitTextToZone(flat, 'blood_type', aspect)).toBeCloseTo(0.01 * aspect * 0.8, 10)
  })

  it('gives identical results to the size chosen when placing text', () => {
    const zone = { left: 0.1, top: 0.1, width: 0.5, height: 0.08 }
    expect(textPlacementForZone(zone, 'full_name', aspect).fontSize).toBe(
      fitTextToZone(zone, 'full_name', aspect),
    )
  })
})

describe('suggestLayout', () => {
  const aspect = 1004 / 590

  it('returns null when there is nothing to map', () => {
    expect(suggestLayout([], 'front', aspect)).toBeNull()
    expect(suggestLayout(undefined, 'front', aspect)).toBeNull()
  })

  it('gives the largest box to the photo on the front', () => {
    const zones = [
      { left: 0.1, top: 0.5, width: 0.3, height: 0.05 },
      { left: 0.1, top: 0.1, width: 0.8, height: 0.35 }, // largest
    ]
    const { layout } = suggestLayout(zones, 'front', aspect)
    expect(layout.photo).toEqual(imagePlacementForZone(zones[1]))
  })

  it('recognises a small square box low on the front as the QR', () => {
    const zones = [
      { left: 0.1, top: 0.1, width: 0.8, height: 0.35 }, // photo
      { left: 0.05, top: 0.82, width: 0.16, height: 0.09 }, // square-ish, low, small
    ]
    const { layout } = suggestLayout(zones, 'front', aspect)
    expect(layout.qr).toEqual(imagePlacementForZone(zones[1]))
  })

  it('gives the largest box to the QR on the back', () => {
    const zones = [
      { left: 0.1, top: 0.13, width: 0.35, height: 0.3 }, // largest
      { left: 0.5, top: 0.15, width: 0.3, height: 0.05 },
    ]
    const { layout } = suggestLayout(zones, 'back', aspect)
    expect(layout.qr).toEqual(imagePlacementForZone(zones[0]))
    expect(layout.blood_type.type).toBe('text')
  })

  it('assigns remaining text fields top to bottom', () => {
    const zones = [
      { left: 0.1, top: 0.1, width: 0.8, height: 0.35 }, // photo
      { left: 0.1, top: 0.75, width: 0.6, height: 0.05 }, // lower
      { left: 0.1, top: 0.55, width: 0.6, height: 0.05 }, // upper
    ]
    const { layout } = suggestLayout(zones, 'front', aspect)
    // full_name is the first text field, so it takes the topmost leftover box.
    expect(layout.full_name.y).toBeCloseTo(0.55 + 0.05 / 2, 10)
    expect(layout.student_id.y).toBeCloseTo(0.75 + 0.05 / 2, 10)
  })

  it('reports each mapping as a labelled row for the confirmation dialog', () => {
    const zones = [{ left: 0.1, top: 0.1, width: 0.8, height: 0.35 }]
    const { rows } = suggestLayout(zones, 'front', aspect, (f) => `Label:${f}`)
    expect(rows).toEqual([{ field: 'photo', label: 'Label:photo', zone: 1 }])
  })

  it('produces placements that are all within the card', () => {
    const zones = [
      { left: 0.1, top: 0.1, width: 0.8, height: 0.35 },
      { left: 0.05, top: 0.82, width: 0.16, height: 0.09 },
      { left: 0.1, top: 0.55, width: 0.6, height: 0.05 },
    ]
    const { layout } = suggestLayout(zones, 'front', aspect)
    for (const pos of Object.values(layout)) {
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.x).toBeLessThanOrEqual(1)
      expect(pos.y).toBeLessThanOrEqual(1)
    }
  })
})
