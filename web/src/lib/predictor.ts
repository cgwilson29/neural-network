/**
 * One entry point for predictions. Visitor inputs run through the real network in the browser
 * (ONNX Runtime Web). Until the runtime has loaded — or if it can't load — answers come from the
 * precomputed grid of the same network's predictions, so the exhibit is never blank.
 */
import { gridWait } from './artifacts'
import { gridIndex, type InputRow } from './domain'
import { loadSession, runModel, type ModelOutput } from './ortModel'

export type ModelSource = 'onnx' | 'lookup'
export type ModelStatus = 'loading' | 'ready' | 'failed'

export interface Prediction {
  wait: Float32Array
  /** Hidden-layer activations (only when the ONNX model ran). */
  hidden?: Pick<ModelOutput, 'h1' | 'h2' | 'h1Size' | 'h2Size'>
  source: ModelSource
}

let status: ModelStatus = 'loading'
let failure: string | undefined
const listeners = new Set<(s: ModelStatus) => void>()

export function getModelStatus(): ModelStatus {
  return status
}
export function getModelFailure(): string | undefined {
  return failure
}
export function onModelStatus(fn: (s: ModelStatus) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function setStatus(s: ModelStatus) {
  status = s
  listeners.forEach((fn) => fn(s))
}

/** Start loading the runtime (call after first paint). */
export function warmUp(): void {
  if (status !== 'loading') return
  loadSession()
    .then(() => runModel([[9, 0, 2, 12]])) // first run compiles kernels
    .then(() => setStatus('ready'))
    .catch((err: unknown) => {
      failure = err instanceof Error ? err.message : String(err)
      console.warn('ONNX Runtime unavailable — using precomputed predictions.', err)
      setStatus('failed')
    })
}

export function lookup(rows: InputRow[]): Float32Array {
  return Float32Array.from(rows, ([h, d, s, q]) => gridWait[gridIndex(h, d, s, q)])
}

export async function predict(rows: InputRow[]): Promise<Prediction> {
  if (status === 'ready') {
    try {
      const out = await runModel(rows)
      return { wait: out.wait, hidden: out, source: 'onnx' }
    } catch (err) {
      console.warn('ONNX run failed; falling back to lookup', err)
    }
  }
  return { wait: lookup(rows), source: 'lookup' }
}
