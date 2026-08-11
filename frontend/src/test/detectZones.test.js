import { describe, it, expect } from 'vitest'
import { findBoxes, mergeBands } from '../lib/detectZones'

function drawBox(lum, width, x0, y0, x1, y1) {
  for (let x = x0; x <= x1; x++) {
    lum[y0 * width + x] = 0
    lum[y1 * width + x] = 0
  }
  for (let y = y0; y <= y1; y++) {
    lum[y * width + x0] = 0
    lum[y * width + x1] = 0
  }
}

describe('findBoxes', () => {
  it('detects rectangular borders', () => {
    const W = 120
    const H = 90
    const lum = new Uint8Array(W * H).fill(255)
    drawBox(lum, W, 10, 10, 60, 30)
    drawBox(lum, W, 70, 40, 110, 70)
    const boxes = findBoxes(lum, W, H)
    expect(boxes).toHaveLength(2)
    expect(boxes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x0: 10, y0: 10, x1: 60, y1: 30 }),
        expect.objectContaining({ x0: 70, y0: 40, x1: 110, y1: 70 }),
      ]),
    )
  })

  it('ignores a full-card outer border', () => {
    const W = 120
    const H = 90
    const lum = new Uint8Array(W * H).fill(255)
    drawBox(lum, W, 0, 0, 119, 89)
    drawBox(lum, W, 20, 20, 100, 60)
    const boxes = findBoxes(lum, W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toEqual(expect.objectContaining({ x0: 20, y0: 20, x1: 100, y1: 60 }))
  })

  it('treats 3px-thick borders as a single box', () => {
    const W = 120
    const H = 90
    const lum = new Uint8Array(W * H).fill(255)
    for (let t = 0; t < 3; t++) drawBox(lum, W, 10 + t, 10 + t, 60 - t, 30 - t)
    const boxes = findBoxes(lum, W, H)
    expect(boxes).toHaveLength(1)
  })

  it('ignores short runs that are not box borders (text noise)', () => {
    const W = 120
    const H = 90
    const lum = new Uint8Array(W * H).fill(255)
    drawBox(lum, W, 20, 20, 100, 60)
    // A short horizontal dash well under minRunH
    for (let x = 40; x < 50; x++) lum[70 * W + x] = 0
    const boxes = findBoxes(lum, W, H)
    expect(boxes).toHaveLength(1)
  })

  it('treats a solid filled region as a single bounding box, not slivers', () => {
    const W = 120
    const H = 90
    const lum = new Uint8Array(W * H).fill(255)
    // A filled block: every interior row/column is dark, so without band
    // collapsing it would pair into dozens of tiny nested rectangles.
    for (let y = 10; y <= 40; y++) {
      for (let x = 10; x <= 40; x++) lum[y * W + x] = 0
    }
    drawBox(lum, W, 50, 10, 110, 40)
    const boxes = findBoxes(lum, W, H)
    expect(boxes).toEqual([
      expect.objectContaining({ x0: 10, y0: 10, x1: 40, y1: 40 }),
      expect.objectContaining({ x0: 50, y0: 10, x1: 110, y1: 40 }),
    ])
  })
})

describe('mergeBands', () => {
  it('collapses adjacent rows into one band and unions their spans', () => {
    const bands = mergeBands(
      [
        { y: 10, x0: 5, x1: 50 },
        { y: 11, x0: 6, x1: 49 },
        { y: 12, x0: 5, x1: 48 },
      ],
      'y',
      'x0',
      'x1',
    )
    expect(bands).toEqual([{ yLo: 10, yHi: 12, x0: 5, x1: 50 }])
  })

  it('keeps distinct bands whose runs do not overlap in span', () => {
    const bands = mergeBands(
      [
        { y: 10, x0: 5, x1: 50 },
        { y: 11, x0: 70, x1: 100 },
      ],
      'y',
      'x0',
      'x1',
    )
    expect(bands).toHaveLength(2)
  })

  it('splits bands separated by more than the gap', () => {
    const bands = mergeBands(
      [
        { y: 10, x0: 5, x1: 50 },
        { y: 15, x0: 6, x1: 49 },
      ],
      'y',
      'x0',
      'x1',
    )
    expect(bands).toHaveLength(2)
  })
})
