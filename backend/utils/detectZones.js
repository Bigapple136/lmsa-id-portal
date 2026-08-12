// Sharp is an optional dependency used only for best-effort zone detection on
// template upload/activate. Require it lazily so a missing install never breaks
// the templates route module (which would also break GET /active). The caller
// already try/catches detection failures and continues without zones.
let sharp
try {
  sharp = require('sharp')
} catch {
  sharp = null
}

// Template box detection for the layout mapper (Node.js port using Sharp).
// Strategy: threshold the template's luminance, extract long horizontal and
// vertical dark runs (printed box borders), collapse parallel runs into bands,
// use each band's outer edges as border lines, then find rectangles by pairing
// top/bottom horizontal lines with left/right vertical lines. Overlapping
// rectangles are deduped to their largest representative.

/**
 * Group collinear stroke runs into "bands". A solid filled region or a thick
 * (3px+) border produces a run on every parallel row/column; collapsing them
 * into a single band keeps only the outer edges, so filled areas don't spawn
 * hundreds of near-identical box candidates.
 */
function mergeBands(runs, axisKey, startKey, endKey, gap = 2) {
  const loKey = axisKey + 'Lo'
  const hiKey = axisKey + 'Hi'
  const sorted = runs.slice().sort((a, b) => a[axisKey] - b[axisKey])
  const bands = []
  for (const r of sorted) {
    let best = null
    for (const b of bands) {
      if (
        b[loKey] - gap <= r[axisKey] &&
        r[axisKey] <= b[hiKey] + gap &&
        r[startKey] <= b[endKey] &&
        r[endKey] >= b[startKey]
      ) {
        best = b
        break
      }
    }
    if (best) {
      best[loKey] = Math.min(best[loKey], r[axisKey])
      best[hiKey] = Math.max(best[hiKey], r[axisKey])
      best[startKey] = Math.min(best[startKey], r[startKey])
      best[endKey] = Math.max(best[endKey], r[endKey])
    } else {
      bands.push({
        [loKey]: r[axisKey],
        [hiKey]: r[axisKey],
        [startKey]: r[startKey],
        [endKey]: r[endKey],
      })
    }
  }
  return bands
}

function verticalStrokes(lum, width, height, threshold) {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (lum[y * width + x] >= threshold) continue
      let up = false
      let down = false
      for (let k = 1; k <= 2 && !up; k++) {
        if (y - k >= 0 && lum[(y - k) * width + x] < threshold) up = true
      }
      for (let k = 1; k <= 2 && !down; k++) {
        if (y + k < height && lum[(y + k) * width + x] < threshold) down = true
      }
      if (up && down) out[y * width + x] = 1
    }
  }
  return out
}

function horizontalStrokes(lum, width, height, threshold) {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (lum[y * width + x] >= threshold) continue
      let left = false
      let right = false
      for (let k = 1; k <= 2 && !left; k++) {
        if (x - k >= 0 && lum[y * width + x - k] < threshold) left = true
      }
      for (let k = 1; k <= 2 && !right; k++) {
        if (x + k < width && lum[y * width + x + k] < threshold) right = true
      }
      if (left && right) out[y * width + x] = 1
    }
  }
  return out
}

/**
 * Main box detection function. Returns array of boxes in pixel coordinates.
 * Each box: { x0, y0, x1, y1 }
 */
function findBoxes(lum, width, height, opts = {}) {
  const threshold = opts.threshold ?? 150
  const minRunH = opts.minRunH ?? Math.round(width * 0.06)
  const minRunV = opts.minRunV ?? Math.round(height * 0.03)
  const minW = opts.minW ?? Math.round(width * 0.04)
  const minH = opts.minH ?? Math.round(height * 0.02)
  const maxAreaFrac = opts.maxAreaFrac ?? 0.85
  const maxLines = opts.maxLines ?? 60
  const maxRects = opts.maxRects ?? 200

  const hMask = horizontalStrokes(lum, width, height, threshold)
  const vMask = verticalStrokes(lum, width, height, threshold)

  const hRuns = []
  for (let y = 0; y < height; y++) {
    const row = y * width
    let x0 = -1
    for (let x = 0; x <= width; x++) {
      const dark = x < width && hMask[row + x] === 1
      if (dark) {
        if (x0 < 0) x0 = x
      } else if (x0 >= 0) {
        if (x - x0 >= minRunH) hRuns.push({ y, x0, x1: x - 1 })
        x0 = -1
      }
    }
  }

  const vRuns = []
  for (let x = 0; x < width; x++) {
    let y0 = -1
    for (let y = 0; y <= height; y++) {
      const dark = y < height && vMask[y * width + x] === 1
      if (dark) {
        if (y0 < 0) y0 = y
      } else if (y0 >= 0) {
        if (y - y0 >= minRunV) vRuns.push({ x, y0, y1: y - 1 })
        y0 = -1
      }
    }
  }

  // Collapse runs into bands, then use each band's outer edges as box-border
  // candidates. Solid filled regions (photos, colour bars) and thick borders
  // collapse to their two outer edges, so they can no longer emit hundreds of
  // parallel "lines" that pair into tiny slivers.
  const hBands = mergeBands(hRuns, 'y', 'x0', 'x1')
  const vBands = mergeBands(vRuns, 'x', 'y0', 'y1')

  const expandBands = (bands, axisKey, startKey, endKey) => {
    const lines = []
    for (const b of bands) {
      const lo = b[axisKey + 'Lo']
      const hi = b[axisKey + 'Hi']
      lines.push({ [axisKey]: lo, [startKey]: b[startKey], [endKey]: b[endKey] })
      if (hi !== lo) {
        lines.push({ [axisKey]: hi, [startKey]: b[startKey], [endKey]: b[endKey] })
      }
    }
    // Drop duplicate edge lines (1px bands yield both edges at the same index)
    const unique = []
    const seen = new Set()
    for (const l of lines) {
      const key = `${l[axisKey]},${l[startKey]},${l[endKey]}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(l)
    }
    return unique
  }

  // Re-join corners (2px) that stroke filtering clipped off
  const hLines = expandBands(hBands, 'y', 'x0', 'x1')
    .map((l) => ({ y: l.y, x0: l.x0 - 2, x1: l.x1 + 2 }))
    .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))
    .slice(0, maxLines)
    .sort((a, b) => a.y - b.y)
  const vLines = expandBands(vBands, 'x', 'y0', 'y1')
    .map((l) => ({ x: l.x, y0: l.y0 - 2, y1: l.y1 + 2 }))
    .sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0))
    .slice(0, maxLines)
    .sort((a, b) => a.x - b.x)

  const rects = []
  const seen = new Set()
  outer: for (const t of hLines) {
    for (const b of hLines) {
      if (b.y - t.y < minH) continue
      for (const l of vLines) {
        if (l.x < t.x0 || l.x > t.x1) continue
        if (l.x < b.x0 || l.x > b.x1) continue
        if (t.y < l.y0 || t.y > l.y1) continue
        if (b.y < l.y0 || b.y > l.y1) continue
        for (const r of vLines) {
          if (r.x - l.x < minW) continue
          if (r.x < t.x0 || r.x > t.x1) continue
          if (r.x < b.x0 || r.x > b.x1) continue
          if (t.y < r.y0 || t.y > r.y1) continue
          if (b.y < r.y0 || b.y > r.y1) continue
          const key = `${l.x},${t.y},${r.x},${b.y}`
          if (seen.has(key)) continue
          seen.add(key)
          const area = (r.x - l.x) * (b.y - t.y)
          if (area > width * height * maxAreaFrac) continue
          rects.push({ x0: l.x, y0: t.y, x1: r.x, y1: b.y })
          if (rects.length >= maxRects) break outer
        }
      }
    }
  }

  // The same border produces several rectangles (inner and outer edges of a
  // thick border, or boxes sharing a rule). Keep the largest representative and
  // drop any rectangle that overlaps an already-kept one by more than half.
  rects.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))
  const kept = []
  for (const r of rects) {
    const area = (r.x1 - r.x0) * (r.y1 - r.y0)
    if (area <= 0) continue
    const overlapsKept = kept.some((k) => {
      const ox = Math.max(0, Math.min(r.x1, k.x1) - Math.max(r.x0, k.x0))
      const oy = Math.max(0, Math.min(r.y1, k.y1) - Math.max(r.y0, k.y0))
      const i = ox * oy
      return i > 0.5 * area || i > 0.5 * (k.x1 - k.x0) * (k.y1 - k.y0)
    })
    if (overlapsKept) continue
    kept.push(r)
    if (kept.length >= maxRects) break
  }
  kept.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  return kept
}

/**
 * Convert Sharp raw buffer to luminance array
 */
function luminanceFromBuffer(buffer, width, height) {
  const lum = new Uint8Array(width * height)
  // Sharp raw buffer is RGBA interleaved
  for (let i = 0; i < width * height; i++) {
    const r = buffer[i * 4]
    const g = buffer[i * 4 + 1]
    const b = buffer[i * 4 + 2]
    lum[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  return lum
}

/**
 * Main entry point: detect zones from image buffer at full resolution.
 * @param {Buffer} buffer - Image buffer (any format Sharp supports)
 * @returns {Promise<{zones: Array, width: number, height: number}>}
 */
async function detectZonesFromBuffer(buffer) {
  if (!sharp) {
    throw new Error('sharp is not installed — zone detection unavailable')
  }
  // Get image metadata
  const metadata = await sharp(buffer).metadata()
  const naturalW = metadata.width
  const naturalH = metadata.height

  // Process at full resolution (no downscaling)
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height

  const lum = luminanceFromBuffer(data, width, height)
  const boxes = findBoxes(lum, width, height)

  return {
    width: naturalW,
    height: naturalH,
    zones: boxes.map((b) => ({
      left: b.x0 / width,
      top: b.y0 / height,
      right: b.x1 / width,
      bottom: b.y1 / height,
      width: (b.x1 - b.x0) / width,
      height: (b.y1 - b.y0) / height,
    })),
  }
}

module.exports = { detectZonesFromBuffer, findBoxes, mergeBands }