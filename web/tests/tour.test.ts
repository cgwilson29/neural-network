import { describe, expect, it } from 'vitest'
import { TOUR_STEPS } from '../src/tour/steps'
import { readTourMemory, writeTourMemory } from '../src/tour/storage'
import { useExhibit } from '../src/state/store'
import { DEFAULT_SCENARIO } from '../src/lib/domain'

describe('tour steps', () => {
  it('has ~10 steps with unique ids, ending at the guide bot', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(9)
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length)
    expect(TOUR_STEPS.at(-1)?.final).toBe(true)
    expect(TOUR_STEPS.filter((s) => s.action).length).toBeGreaterThanOrEqual(3)
  })

  it('learn-by-doing steps complete only after the visitor acts', () => {
    const start = { ...useExhibit.getState(), scenario: DEFAULT_SCENARIO, pinned: null }
    const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!.action!
    expect(step('staff').done(start, start)).toBe(false)
    expect(step('staff').done({ ...start, scenario: { ...DEFAULT_SCENARIO, staff: 3 } }, start)).toBe(true)
    expect(step('queue').done({ ...start, scenario: { ...DEFAULT_SCENARIO, queue: 13 } }, start)).toBe(false)
    expect(step('queue').done({ ...start, scenario: { ...DEFAULT_SCENARIO, queue: 15 } }, start)).toBe(true)
    expect(step('pin').done({ ...start, pinned: DEFAULT_SCENARIO }, start)).toBe(true)
  })
})

describe('tour memory', () => {
  it('reads and writes, and tolerates storage that throws', () => {
    const store = new Map<string, string>()
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readTourMemory(fake)).toBeNull()
    writeTourMemory('done', fake)
    expect(readTourMemory(fake)).toBe('done')
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readTourMemory(broken)).toBeNull()
    expect(() => writeTourMemory('dismissed', broken)).not.toThrow()
  })
})
