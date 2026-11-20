/**
 * ONNX Runtime Web session for the trained network (web/public/model/wait_mlp.onnx).
 * The graph takes raw inputs x[N,4] = (hour, dayIdx, staff, queue) and returns
 * wait_minutes[N,1] plus hidden activations h1[N,16] and h2[N,8].
 */
import type { InferenceSession } from 'onnxruntime-web'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import type { InputRow } from './domain'

export interface ModelOutput {
  wait: Float32Array
  h1: Float32Array
  h2: Float32Array
  h1Size: number
  h2Size: number
}

let sessionPromise: Promise<InferenceSession> | undefined
let runQueue: Promise<unknown> = Promise.resolve()

export function loadSession(): Promise<InferenceSession> {
  sessionPromise ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    // GitHub Pages can't send the COOP/COEP headers that wasm threads need; a 433-parameter
    // network doesn't need them anyway.
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, location.href).href }
    return ort.InferenceSession.create(`${import.meta.env.BASE_URL}model/wait_mlp.onnx`, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  })()
  return sessionPromise
}

/** Runs one batch. Calls are serialized because a session handles one run at a time. */
export function runModel(rows: InputRow[]): Promise<ModelOutput> {
  const job = runQueue.then(async () => {
    const session = await loadSession()
    const ort = await import('onnxruntime-web/wasm')
    const data = new Float32Array(rows.length * 4)
    rows.forEach((r, i) => data.set(r, i * 4))
    const out = await session.run({ x: new ort.Tensor('float32', data, [rows.length, 4]) })
    const h1 = out.h1
    const h2 = out.h2
    return {
      wait: out.wait_minutes.data as Float32Array,
      h1: h1.data as Float32Array,
      h2: h2.data as Float32Array,
      h1Size: Number(h1.dims[1]),
      h2Size: Number(h2.dims[1]),
    }
  })
  runQueue = job.catch(() => undefined)
  return job
}
