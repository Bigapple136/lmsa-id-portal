// Template box detection for the layout mapper.
//
// Strategy: threshold the template's luminance, extract long horizontal and
// vertical dark runs (printed box borders), merge thickness into single lines,
// then find rectangles by pairing top/bottom horizontal lines with left/right
// vertical lines. Pure functions are exported so they can be unit-tested
// without a real canvas.

export function mergeLineRuns(runs, axisKey, startKey, endKey, gap = 2) {
  const sorted = runs.slice().sort((a, b) => a[axisKey] - b[axisKey])
  const lines = []
  for (const r of sorted) {
    const last = lines[lines.length - 1]
    const sameLine =
      last &&
      r[axisKey] - last[axisKey] <= gap &&
      r[startKey] <= last[endKey] &&
      r[endKey] >= last[startKey]
    if (sameLine) {
      last[startKey] = Math.min(last[startKey], r[startKey])
      last[endKey] = Math.max(last[endKey], r[endKey])
    } else {
      lines.push({ [axisKey]: r[axisKey], [startKey]: r[startKey], [endKey]: r[endKey] })
    }
  }
  return lines
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

export function findBoxes(lum, width, height, opts = {}) {
  const threshold = opts.threshold ?? 150
  const minRunH = opts.minRunH ?? Math.round(width * 0.06)
  const minRunV = opts.minRunV ?? Math.round(height * 0.03)
  const minW = opts.minW ?? Math.round(width * 0.04)
  const minH = opts.minH ?? Math.round(height * 0.02)
  const maxAreaFrac = opts.maxAreaFrac ?? 0.85

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

  // Re-join corners (2px) that stroke filtering clipped off
  const hLines = mergeLineRuns(hRuns, 'y', 'x0', 'x1').map((l) => ({
    y: l.y,
    x0: l.x0 - 2,
    x1: l.x1 + 2,
  }))
  const vLines = mergeLineRuns(vRuns, 'x', 'y0', 'y1').map((l) => ({
    x: l.x,
    y0: l.y0 - 2,
    y1: l.y1 + 2,
  }))

  const rects = []
  const seen = new Set()
  for (const t of hLines) {
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
        }
      }
    }
  }
  return rects
}

function luminanceData(canvas, width, height) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const data = ctx.getImageData(0, 0, width, height).data
  const lum = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    lum[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  return lum
}

export async function detectZonesFromImage(img) {
  const width = img.naturalWidth
  const height = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const lum = luminanceData(canvas, width, height)
  const boxes = findBoxes(lum, width, height)
  return {
    width,
    height,
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
