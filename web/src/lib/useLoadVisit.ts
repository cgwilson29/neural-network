import type { TestVisit } from './artifacts'
import { useExhibit } from '../state/store'

/** Load a test visit into the simulator, highlight it on the map, and scroll up to it. */
export function useLoadVisit() {
  const setScenario = useExhibit((s) => s.setScenario)
  const focusVisit = useExhibit((s) => s.focusVisit)
  const setPointFilter = useExhibit((s) => s.setPointFilter)
  return (v: TestVisit) => {
    focusVisit(v.id)
    setPointFilter('hourday')
    setScenario({ hour: v.hour, day: v.day, staff: v.staff, queue: v.queue })
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })
  }
}
