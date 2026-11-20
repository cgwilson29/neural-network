import { create } from 'zustand'
import { clampScenario, DEFAULT_SCENARIO, type Scenario } from '../lib/domain'
import { getModelStatus, onModelStatus, type ModelStatus } from '../lib/predictor'

export type PointFilter = 'all' | 'hour' | 'hourday' | 'none'

interface ExhibitState {
  scenario: Scenario
  /** Scenario A for comparison (the live scenario is B). */
  pinned: Scenario | null
  pointFilter: PointFilter
  /** A test visit highlighted on the map (e.g., from the scatter plot or the biggest-miss card). */
  focusVisitId: number | null
  modelStatus: ModelStatus
  chatGenerating: boolean
  setScenario: (patch: Partial<Scenario>) => void
  pin: () => void
  clearPin: () => void
  setPointFilter: (f: PointFilter) => void
  focusVisit: (id: number | null) => void
  setChatGenerating: (b: boolean) => void
}

export const useExhibit = create<ExhibitState>((set, get) => ({
  scenario: DEFAULT_SCENARIO,
  pinned: null,
  pointFilter: 'hour',
  focusVisitId: null,
  modelStatus: getModelStatus(),
  chatGenerating: false,
  setScenario: (patch) => set({ scenario: clampScenario({ ...get().scenario, ...patch }) }),
  pin: () => set({ pinned: get().scenario }),
  clearPin: () => set({ pinned: null }),
  setPointFilter: (pointFilter) => set({ pointFilter }),
  focusVisit: (focusVisitId) => set({ focusVisitId }),
  setChatGenerating: (chatGenerating) => set({ chatGenerating }),
}))

onModelStatus((modelStatus) => useExhibit.setState({ modelStatus }))
