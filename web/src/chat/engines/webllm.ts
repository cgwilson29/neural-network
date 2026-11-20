/**
 * GPU tier: WebLLM on WebGPU. Runs in llm.worker.ts; this side only speaks a tiny message protocol
 * (no WebLLM import here, so the page never downloads the library twice).
 */
import type { GpuModelSpec } from '../models'
import { webllmId } from '../models'
import type { ChatEngine, GenerateOptions, GenerateResult, Progress } from './types'

type WorkerOut =
  | { type: 'progress'; fraction: number; text: string }
  | { type: 'loaded' }
  | { type: 'unloaded' }
  | { type: 'delta'; id: number; text: string }
  | { type: 'done'; id: number; text: string; usage?: Record<string, unknown>; ttftMs?: number }
  | { type: 'error'; id?: number; message: string }

export async function loadWebllm(spec: GpuModelSpec, f16: boolean, onProgress: (p: Progress) => void): Promise<ChatEngine> {
  const modelId = webllmId(spec, f16)
  if (!modelId) throw new Error(`${spec.label} needs 16-bit GPU shaders, which this device doesn't support.`)
  const worker = new Worker(new URL('../llm.worker.ts', import.meta.url), { type: 'module' })

  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data
      if (m.type === 'progress') onProgress({ fraction: m.fraction, text: m.text })
      else if (m.type === 'loaded') resolve()
      else if (m.type === 'error') reject(new Error(m.message))
    }
    worker.onerror = (e) => reject(new Error(e.message || 'The chat worker failed to start'))
    worker.postMessage({ type: 'load', modelId })
  }).catch((err) => {
    worker.terminate()
    throw err
  })

  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (r: GenerateResult) => void; reject: (e: Error) => void; onDelta?: (t: string) => void }
  >()
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    const m = e.data
    if (m.type === 'delta') pending.get(m.id)?.onDelta?.(m.text)
    else if (m.type === 'done') {
      const p = pending.get(m.id)
      pending.delete(m.id)
      const u = (m.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number; extra?: Record<string, number> }
      p?.resolve({
        text: m.text,
        promptTokens: u.prompt_tokens,
        completionTokens: u.completion_tokens,
        ttftMs: m.ttftMs,
        prefillTps: u.extra?.prefill_tokens_per_s,
        decodeTps: u.extra?.decode_tokens_per_s,
      })
    } else if (m.type === 'error' && m.id !== undefined) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      p?.reject(new Error(m.message))
    }
  }

  return {
    info: { kind: 'webllm', modelKey: spec.key, modelId, label: spec.label, device: 'webgpu' },
    generate(o: GenerateOptions) {
      const id = nextId++
      return new Promise<GenerateResult>((resolve, reject) => {
        pending.set(id, { resolve, reject, onDelta: o.onDelta })
        worker.postMessage({
          type: 'generate',
          id,
          messages: o.messages,
          maxTokens: o.maxTokens,
          temperature: o.temperature,
          topP: o.topP,
          seed: o.seed,
          thinking: spec.thinking,
        })
      })
    },
    interrupt() {
      worker.postMessage({ type: 'interrupt' })
    },
    async unload() {
      worker.postMessage({ type: 'unload' })
      await new Promise((r) => setTimeout(r, 50))
      worker.terminate()
    },
  }
}

/** Has this WebLLM model been downloaded before? (Peeks at Cache Storage; loads nothing.) */
export async function isWebllmCached(modelId: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined' || !(await caches.has('webllm/model'))) return false
    const keys = await (await caches.open('webllm/model')).keys()
    return keys.some((req) => req.url.includes(`/${modelId}/`))
  } catch {
    return false
  }
}

/** Remove a WebLLM model's weights and config from Cache Storage. */
export async function deleteWebllmModel(modelId: string): Promise<void> {
  if (typeof caches === 'undefined') return
  for (const name of ['webllm/model', 'webllm/config']) {
    if (!(await caches.has(name))) continue
    const cache = await caches.open(name)
    for (const req of await cache.keys()) if (req.url.includes(`/${modelId}/`)) await cache.delete(req)
  }
}
