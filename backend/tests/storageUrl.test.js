import { describe, it, expect } from 'vitest'
const { withVersion, stripVersion } = require('../utils/storageUrl')

const BASE =
  'https://abc.supabase.co/storage/v1/object/public/id-cards/photos/3rd-year/AMD-2024-0001.jpg'

describe('storageUrl.withVersion', () => {
  it('appends a v query param to a plain URL', () => {
    const out = withVersion(BASE, 123)
    expect(out).toBe(`${BASE}?v=123`)
  })

  it('replaces an existing v param instead of stacking them', () => {
    const out = withVersion(`${BASE}?v=1`, 2)
    expect(out).toBe(`${BASE}?v=2`)
    expect(out.match(/v=/g)).toHaveLength(1)
  })

  it('preserves unrelated query params', () => {
    const out = withVersion(`${BASE}?download=1`, 9)
    const u = new URL(out)
    expect(u.searchParams.get('download')).toBe('1')
    expect(u.searchParams.get('v')).toBe('9')
  })

  it('produces a different URL on successive calls with default version', async () => {
    const a = withVersion(BASE)
    await new Promise((r) => {
      setTimeout(r, 2)
    })
    const b = withVersion(BASE)
    expect(a).not.toBe(b)
    expect(stripVersion(a)).toBe(stripVersion(b))
  })

  it('returns falsy input untouched', () => {
    expect(withVersion(null)).toBeNull()
    expect(withVersion('')).toBe('')
    expect(withVersion(undefined)).toBeUndefined()
  })

  it('handles relative / non-absolute strings', () => {
    expect(withVersion('/photos/a.jpg', 5)).toBe('/photos/a.jpg?v=5')
  })
})

describe('storageUrl.stripVersion', () => {
  it('removes only the v param', () => {
    expect(stripVersion(`${BASE}?v=42`)).toBe(BASE)
    expect(stripVersion(`${BASE}?download=1&v=42`)).toBe(`${BASE}?download=1`)
  })

  it('is a no-op when there is no v param', () => {
    expect(stripVersion(BASE)).toBe(BASE)
  })
})
