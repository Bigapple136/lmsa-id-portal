import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Read the stylesheet from disk: Vitest mocks CSS imports, so `?raw` would
// come back empty and these guards would assert against nothing.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.css'), 'utf8')

// Matches a flat CSS rule whose declaration block contains the given
// `prop: value` pairs. Values may be prefixes (`repeat[(]3` matches
// `repeat(3, minmax(0, 1fr));`) and matching is whitespace-tolerant so
// formatting changes can't break it.
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

describe('landing mobile CSS', () => {
  it('stacks the form panel full-width at the mobile breakpoint', () => {
    // Regression guard: without flex-direction: column this row flex squeezes
    // the lookup card side-by-side on every phone — the broken multi-column
    // mobile layout.
    expect(css).toMatch(
      rule('.split-form-panel', [
        ['flex-direction', 'column'],
        ['align-items', 'center'],
      ]),
    )
  })

  it('lets the stacked panels wrap their content instead of splitting the viewport', () => {
    expect(css).toMatch(rule('.split-brand', [['flex', 'none']]))
  })

  it('stacks the verification pills on mobile but keeps 3-up on desktop', () => {
    expect(css).toMatch(rule('.verification-steps', [['grid-template-columns', '1fr']]))
    expect(css).toMatch(rule('.verification-steps', [['grid-template-columns', 'repeat[(]3']]))
  })

  it('collapses the pills at the same 900px breakpoint as the rest of the page', () => {
    // The pills must live in the same media block as the stacked panel, so
    // they can never drift into a breakpoint orphan that stays 3-across on
    // tablets and landscape phones.
    const landing = mediaBlocks('max-width: 900px').filter((b) =>
      rule('.split-form-panel', [['flex-direction', 'column']]).test(b),
    )
    expect(landing).toHaveLength(1)
    expect(landing[0]).toMatch(rule('.verification-steps', [['grid-template-columns', '1fr']]))
  })

  it('has no duplicate mobile-brand styles left', () => {
    expect(css).not.toMatch(/landing-mobile/)
  })
})
