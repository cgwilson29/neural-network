import { useEffect, useState } from 'react'
import type { InputRow } from './domain'
import { lookup, predict, type Prediction } from './predictor'
import { useExhibit } from '../state/store'

/**
 * Runs the model on `rows` whenever `key` changes (and again once ONNX Runtime is ready).
 * Returns the lookup-table answer synchronously on first render so nothing flashes empty.
 */
export function usePrediction(rows: InputRow[], key: string): Prediction {
  const modelStatus = useExhibit((s) => s.modelStatus)
  const [result, setResult] = useState<{ key: string; value: Prediction }>(() => ({
    key,
    value: { wait: lookup(rows), source: 'lookup' },
  }))

  useEffect(() => {
    let cancelled = false
    predict(rows).then((value) => {
      if (!cancelled) setResult({ key, value })
    })
    return () => {
      cancelled = true
    }
    // rows is derived from key by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, modelStatus])

  // While a new key is in flight, answer from the lookup table (same network, precomputed).
  if (result.key !== key) return { wait: lookup(rows), source: 'lookup' }
  return result.value
}
