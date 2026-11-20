import { useMemo } from 'react'
import { QUEUE_MAX, QUEUE_MIN, STAFF_MAX, STAFF_MIN, surfaceRows, toRow, type Scenario } from './domain'
import { usePrediction } from './usePrediction'
import type { ModelSource } from './predictor'
import { useExhibit } from '../state/store'

const Q = QUEUE_MAX - QUEUE_MIN + 1
const S = STAFF_MAX - STAFF_MIN + 1

export interface CorePredictions {
  scenario: Scenario
  /** staff 1..5 × queue 0..20 at the scenario's hour/day (staff-major) */
  surface: Float32Array
  scenarioWait: number
  plusOneWait: number | null
  /** predicted wait for staff 1..5 at the scenario's hour/day/queue */
  staffCurve: number[]
  pinned: Scenario | null
  pinnedWait: number | null
  /** hidden activations for the scenario (null until ONNX Runtime has run) */
  hidden: { h1: Float32Array; h2: Float32Array } | null
  source: ModelSource
}

/** One batched model run per scenario change: the whole surface + the pinned scenario. */
export function useCorePredictions(): CorePredictions {
  const scenario = useExhibit((s) => s.scenario)
  const pinned = useExhibit((s) => s.pinned)
  const { hour, day } = scenario
  const rows = useMemo(() => {
    const r = surfaceRows(hour, day)
    if (pinned) r.push(toRow(pinned))
    return r
  }, [hour, day, pinned])
  const key = `${hour}|${day}|${pinned ? toRow(pinned).join(',') : '-'}`
  const pred = usePrediction(rows, key)

  return useMemo(() => {
    const surface = pred.wait.slice(0, S * Q)
    const at = (staff: number, queue: number) => surface[(staff - STAFF_MIN) * Q + (queue - QUEUE_MIN)]
    const idx = (scenario.staff - STAFF_MIN) * Q + (scenario.queue - QUEUE_MIN)
    let hidden: CorePredictions['hidden'] = null
    if (pred.hidden) {
      const { h1, h2, h1Size, h2Size } = pred.hidden
      hidden = { h1: h1.slice(idx * h1Size, (idx + 1) * h1Size), h2: h2.slice(idx * h2Size, (idx + 1) * h2Size) }
    }
    return {
      scenario,
      surface,
      scenarioWait: at(scenario.staff, scenario.queue),
      plusOneWait: scenario.staff < STAFF_MAX ? at(scenario.staff + 1, scenario.queue) : null,
      staffCurve: Array.from({ length: S }, (_, k) => at(STAFF_MIN + k, scenario.queue)),
      pinned,
      pinnedWait: pinned ? pred.wait[S * Q] : null,
      hidden,
      source: pred.source,
    }
  }, [pred, scenario, pinned])
}
