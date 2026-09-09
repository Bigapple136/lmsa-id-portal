import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Read the stylesheet from disk: Vitest mocks CSS imports, so `?raw` would
// come back empty and these guards would assert against nothing.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.css'), 'utf8')

// Matches a flat CSS rule whose declaration block contains the given
// `prop: value` pairs. Values may be prefixes and matching is
// whitespace-tolerant so formatting changes can't break it.
function rule(selector, declarations) {
  const sel = selector.replace(/\./g, '\\.')
  const body = declarations.map(([prop, value]) => `${prop}:\\s*${value}[^;]*;`).join('.*?')
  return new RegExp(`${sel}\\s*\\{[^}]*?${body}`, 's')
}

// Returns the inner text of every `@media (query) { ... }` block,
// brace-matched so nested rules can't leak across blocks.
function mediaBlocks(query) {
  const blocks = []
  const marker = `@media (${query})`
  let from = 0
  for (;;) {
    const at = css.indexOf(marker, from)
    if (at === -1) return blocks
    let depth = 0
    let end = at
    for (; end < css.length; end += 1) {
      if (css[end] === '{') depth += 1
      else if (css[end] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    blocks.push(css.slice(at, end))
    from = end + 1
  }
}

describe('students filter bar mobile CSS', () => {
  it('lets the filter row wrap instead of crushing its controls', () => {
    // Regression guard: the row was a single non-wrapping flex line, so the
    // search input shrank to nothing on a phone.
    expect(css).toMatch(rule('.students-filter-row', [['flex-wrap', 'wrap']]))
  })

  it('gives the search field its own full-width row on mobile', () => {
    const mobile = mediaBlocks('max-width: 600px')
    expect(mobile.length).toBeGreaterThan(0)
    expect(mobile.some((b) => rule('.students-filter-search', [['flex', '1 1 100%']]).test(b))).toBe(
      true,
    )
  })

  it('gives the Add button its own full-width, comfortable tap target on mobile', () => {
    const mobile = mediaBlocks('max-width: 600px')
    expect(
      mobile.some(
        (b) =>
          rule('.students-filter-add', [['flex', '1 1 100%']]).test(b) &&
          rule('.students-filter-add', [['min-height', '44px']]).test(b),
      ),
    ).toBe(true)
  })
})
