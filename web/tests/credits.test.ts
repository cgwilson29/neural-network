import { describe, expect, it } from 'vitest'
import { SOUNDTRACK } from '../src/content/credits'

describe('media credits', () => {
  it('every soundtrack entry has a title, creator, license and source', () => {
    expect(SOUNDTRACK.length).toBeGreaterThan(0)
    for (const c of SOUNDTRACK) for (const v of [c.title, c.creator, c.license, c.source, c.note]) expect(v.trim().length).toBeGreaterThan(3)
  })
})
