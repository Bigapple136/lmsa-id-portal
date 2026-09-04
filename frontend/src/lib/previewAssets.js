// Bundled sample assets for the layout mapper's live preview.
//
// The preview is fed to CardCanvas, which skips photo / signature / QR
// entirely when the student record has no URL for them — which meant the one
// ground-truth view in the mapper was blind for exactly the three fields that
// have width, height and corner-radius controls and that clip or overflow.
//
// These are inline SVG data URIs so they load synchronously, need no network
// or storage permissions, and can never be mistaken for a real student's
// photo, signature, or scannable credential. Each is visibly marked SAMPLE.

function svgUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// Neutral portrait silhouette on a soft grey field.
export const SAMPLE_PHOTO_URL = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="300" height="380">
  <rect width="300" height="380" fill="#dfe5ec"/>
  <circle cx="150" cy="138" r="62" fill="#a9b6c6"/>
  <path d="M40 380c0-64 49-116 110-116s110 52 110 116z" fill="#a9b6c6"/>
  <text x="150" y="366" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="22" font-weight="bold" fill="#6d7f93" letter-spacing="3">SAMPLE</text>
</svg>`)

// A handwriting-like scrawl on transparent ground, as a real signature scan is.
export const SAMPLE_SIGNATURE_URL = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 110" width="320" height="110">
  <path d="M14 78c22-46 34-52 41-30s-2 44 10 44 20-30 27-46 16-20 20-4 0 34 10 36 18-16 26-32 18-22 24-10 2 30 12 34 22-10 34-26"
        fill="none" stroke="#16273f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="160" y="104" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="13" fill="#8494a8" letter-spacing="2">SAMPLE SIGNATURE</text>
</svg>`)

// A QR-shaped placeholder: three finder patterns and a fixed pseudo-random
// field. Deliberately not a decodable code — it stands in for the real one's
// footprint and quiet zone so an admin can judge size and placement.
function sampleQrModules() {
  const size = 21
  const cells = []
  const isFinder = (x, y) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
  // Deterministic fill so the preview never flickers between renders.
  let seed = 7
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isFinder(x, y)) continue
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      if ((seed >> 16) % 100 < 46) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
    }
  }
  return cells.join('')
}

function finder(x, y) {
  return `
    <rect x="${x}" y="${y}" width="7" height="7"/>
    <rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/>
    <rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`
}

export const SAMPLE_QR_URL = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 25 25" width="200" height="200"
     shape-rendering="crispEdges">
  <rect x="-2" y="-2" width="25" height="25" fill="#fff"/>
  <g fill="#16273f">
    ${finder(0, 0)}
    ${finder(14, 0)}
    ${finder(0, 14)}
    ${sampleQrModules()}
  </g>
</svg>`)
