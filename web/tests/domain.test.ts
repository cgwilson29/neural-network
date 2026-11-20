import { describe, expect, it } from 'vitest'
import { clampScenario, gridIndex, surfaceRows, weekRows, formatHour } from '../src/lib/domain'
import { gridWait, testVisits, typicalRange, metrics } from '../src/lib/artifacts'

describe('domain helpers', () => {
  it('indexes the prediction grid in hour, day, staff, queue order', () => {
    expect(gridIndex(8, 0, 1, 0)).toBe(0)
    expect(gridIndex(8, 0, 1, 1)).toBe(1)
    expect(gridIndex(8, 0, 2, 0)).toBe(21)
    expect(gridIndex(17, 4, 5, 20)).toBe(5249)
    expect(gridWait.length).toBe(5250)
  })

  it('lookup agrees with the notebook’s test predictions', () => {
    for (const v of testVisits.slice(0, 50)) {
      expect(Math.abs(gridWait[gridIndex(v.hour, v.day, v.staff, v.queue)] - v.nn)).toBeLessThan(0.011)
    }
  })

  it('clamps and rounds scenarios into the trained ranges', () => {
    expect(clampScenario({ hour: 20, day: -1, staff: 0, queue: 25.4 })).toEqual({ hour: 17, day: 0, staff: 1, queue: 20 })
  })

  it('builds surface and week batches', () => {
    expect(surfaceRows(9, 0)).toHaveLength(105)
    expect(surfaceRows(9, 0)[21]).toEqual([9, 0, 2, 0])
    expect(weekRows(2, 12)).toHaveLength(50)
  })

  it('formats hours', () => {
    expect([8, 12, 13, 17].map(formatHour)).toEqual(['8 am', '12 pm', '1 pm', '5 pm'])
  })

  it('gives a typical range that contains the prediction', () => {
    for (const p of [5, 45, 100, 250]) {
      const [lo, hi] = typicalRange(p)
      expect(lo).toBeLessThanOrEqual(p)
      expect(hi).toBeGreaterThanOrEqual(p)
    }
    expect(metrics.residualBands.length).toBeGreaterThan(0)
  })
})
