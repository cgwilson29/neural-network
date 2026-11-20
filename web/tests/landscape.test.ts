import { describe, expect, it } from 'vitest'
import { contourSegments, densify, monotoneAt, monotoneTangents, NQ, NS } from '../src/lib/landscape'

describe('landscape interpolation', () => {
  it('passes through the network’s predictions and never overshoots', () => {
    const ys = [198, 100, 76, 58, 51]
    const m = monotoneTangents(ys)
    ys.forEach((y, i) => expect(monotoneAt(ys, m, i)).toBeCloseTo(y, 6))
    for (let t = 0; t <= 4; t += 0.05) {
      const v = monotoneAt(ys, m, t)
      const i = Math.min(3, Math.floor(t))
      expect(v).toBeLessThanOrEqual(Math.max(ys[i], ys[i + 1]) + 1e-9)
      expect(v).toBeGreaterThanOrEqual(Math.min(ys[i], ys[i + 1]) - 1e-9)
    }
  })

  it('densifies 5 × 21 predictions onto the mesh grid, keeping exact values at whole numbers', () => {
    const coarse = new Float32Array(105)
    for (let s = 0; s < 5; s++) for (let q = 0; q < 21; q++) coarse[s * 21 + q] = (15 * q) / (s + 1) + 9
    const dense = densify(coarse)
    expect(dense.length).toBe(NS * NQ)
    // staff 1 (i=0), queue 20 (j=80) and staff 5 (i=40), queue 0 (j=0)
    expect(dense[80 * NS + 0]).toBeCloseTo(coarse[20], 3)
    expect(dense[0 * NS + 40]).toBeCloseTo(coarse[4 * 21], 3)
  })
})

describe('marching squares', () => {
  it('finds the crossing of a simple ramp', () => {
    // values increase along x: 0,10,20 in every row → level 15 crosses between i=1 and i=2
    const nx = 3
    const ny = 3
    const vals = [0, 10, 20, 0, 10, 20, 0, 10, 20]
    const segs = contourSegments(vals, nx, ny, 15)
    expect(segs.length).toBe(8) // two cells tall → two segments
    for (let k = 0; k < segs.length; k += 2) expect(segs[k]).toBeCloseTo(1.5, 6)
  })

  it('returns nothing when the level is outside the data', () => {
    expect(contourSegments([1, 2, 3, 4], 2, 2, 100)).toEqual([])
  })
})
