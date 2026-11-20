/**
 * Thin wrapper around WebLLM. The library (≈6 MB) is only imported when the visitor clicks
 * "Enable chat", so the exhibit's first load never pays for it.
 */
import type { ChatCompletionMessageParam, InitProgressReport, MLCEngineInterface } from '@mlc-ai/web-llm'

export type Engine = MLCEngineInterface

export interface Progress {
  fraction: number
  text: string
}

export async function createEngine(modelId: string, onProgress: (p: Progress) => void): Promise<Engine> {
  const webllm = await import('@mlc-ai/web-llm')
  const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (r: InitProgressReport) => onProgress({ fraction: r.progress, text: r.text }),
    })
  } catch (err) {
    worker.terminate()
    throw err
  }
}

/**
 * Has this model been downloaded before? Peeks at WebLLM's Cache Storage bucket directly so that
 * opening the chat panel doesn't load the WebLLM library (nothing is fetched before "Enable chat").
 */
export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined' || !(await caches.has('webllm/model'))) return false
    const cache = await caches.open('webllm/model')
    const keys = await cache.keys()
    return keys.some((req) => req.url.includes(`/${modelId}/`))
  } catch {
    return false
  }
}

export async function deleteModel(modelId: string): Promise<void> {
  const webllm = await import('@mlc-ai/web-llm')
  await webllm.deleteModelAllInfoInCache(modelId)
}

export interface StreamOptions {
  messages: ChatCompletionMessageParam[]
  onDelta: (fullText: string) => void
}

export const GENERATION = {
  temperature: 0.3,
  top_p: 0.8,
  max_tokens: 256,
} as const

/** Streams a reply; resolves with the final text (think-tags stripped by the caller's onDelta). */
export async function streamReply(engine: Engine, { messages, onDelta }: StreamOptions): Promise<string> {
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    ...GENERATION,
    // Qwen3: answer directly, no hidden "thinking" pass.
    extra_body: { enable_thinking: false },
  } as Parameters<Engine['chat']['completions']['create']>[0] & { stream: true })
  let text = ''
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? ''
    onDelta(text)
  }
  return text
}

export function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/quota|NO_DEVICE_SPACE|QuotaExceeded/i.test(msg))
    return 'Your browser ran out of storage space for the model. Free some space, try the Lite model, or avoid private windows.'
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg))
    return 'The model download was interrupted. Check your connection and try again.'
  if (/device.*lost|DeviceLost|out of memory|OOM/i.test(msg))
    return 'The graphics device ran out of memory. Close other GPU-heavy tabs or try the Lite model.'
  return `The chat model could not start: ${msg.slice(0, 220)}`
}
