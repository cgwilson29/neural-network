import { create } from 'zustand'
import { TOUR_STEPS } from './steps'
import { readTourMemory, writeTourMemory } from './storage'

interface TourState {
  /** First-visit welcome card visible. */
  welcome: boolean
  /** Index of the current step, or null when the tour isn't running. */
  step: number | null
  showWelcomeIfNew: () => void
  start: () => void
  next: () => void
  back: () => void
  /** End the tour; `completed` marks it done, otherwise dismissed. */
  end: (completed?: boolean) => void
  dismissWelcome: () => void
}

export const useTour = create<TourState>((set, get) => ({
  welcome: false,
  step: null,
  showWelcomeIfNew: () => {
    if (readTourMemory() === null && get().step === null) set({ welcome: true })
  },
  start: () => set({ welcome: false, step: 0 }),
  next: () => {
    const s = get().step
    if (s === null) return
    if (s >= TOUR_STEPS.length - 1) get().end(true)
    else set({ step: s + 1 })
  },
  back: () => {
    const s = get().step
    if (s !== null && s > 0) set({ step: s - 1 })
  },
  end: (completed = false) => {
    writeTourMemory(completed ? 'done' : 'dismissed')
    set({ step: null, welcome: false })
  },
  dismissWelcome: () => {
    writeTourMemory('dismissed')
    set({ welcome: false })
  },
}))
