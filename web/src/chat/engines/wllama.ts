/**
 * CPU tier: a small GGUF model run by wllama (llama.cpp compiled to WebAssembly) — NOT WebLLM.
 * Used where WebLLM can't run (e.g., Firefox on macOS, whose WebGPU allows 9 storage buffers per
 * shader; WebLLM needs 10). Single-threaded here (GitHub Pages can't enable cross-origin isolation).
 * The wasm is self-hosted and compat mode is off, so nothing is fetched from a CDN.
 */
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url'
import type { CpuModelSpec } from '../models'
import type { ChatEngine, GenerateOptions, GenerateResult, Progress } from './types'

const mb = (b: number) => `${Math.round(b / 1e6)} MB`

export async function loadWllama(spec: CpuModelSpec, onProgress: (p: Progress) => void): Promise<ChatEngine> {
  const { Wllama } = await import('@wllama/wllama')
  const w = new Wllama({ default: wasmUrl }, { suppressNativeLog: true, parallelDownloads: 3 })
  w.setCompat(null)
  onProgress({ fraction: 0, text: `Fetching ${spec.file}…` })
  await w.loadModelFromHF(
    { repo: spec.repo, file: spec.file },
    {
      n_ctx: 2048,
      n_gpu_layers: 0,
      progressCallback: ({ loaded, total }: { loaded: number; total: number }) =>
        onProgress({ fraction: total ? Math.min(0.99, loaded / total) : 0, text: `Downloading ${spec.file}: ${mb(loaded)} / ${mb(total)}` }),
    },
  )
  onProgress({ fraction: 1, text: 'Model ready' })

  let abort: AbortController | null = null
  return {
    info: { kind: 'wllama', modelKey: spec.key, modelId: spec.file, label: spec.label, device: 'cpu' },
    async generate(o: GenerateOptions): Promise<GenerateResult> {
      abort = new AbortController()
      const t0 = performance.now()
      let first = 0
      let text = ''
      let promptTokens: number | undefined
      let completionTokens: number | undefined
      let prefillTps: number | undefined
      let decodeTps: number | undefined
      try {
        const stream = await w.createChatCompletion({
          messages: o.messages,
          stream: true,
          max_tokens: o.maxTokens,
          temperature: o.temperature,
          top_p: o.topP,
          ...(o.seed !== undefined ? { seed: o.seed } : {}),
          cache_prompt: true, // reuse the constant system-prompt prefix between questions
          abortSignal: abort.signal,
          ...(spec.thinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        })
        for await (const chunk of stream) {
          const d = chunk.choices[0]?.delta?.content ?? ''
          if (d) {
            if (!first) first = performance.now()
            text += d
            o.onDelta?.(text)
          }
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens
            completionTokens = chunk.usage.completion_tokens
          }
          if (chunk.timings) {
            prefillTps = chunk.timings.prompt_per_second
            decodeTps = chunk.timings.predicted_per_second
            promptTokens ??= chunk.timings.prompt_n
          }
        }
      } catch (err) {
        if (!abort.signal.aborted) throw err
      } finally {
        abort = null
      }
      return { text, promptTokens, completionTokens, ttftMs: first ? first - t0 : undefined, prefillTps, decodeTps }
    },
    interrupt() {
      abort?.abort()
    },
    async unload() {
      await w.exit()
    },
  }
}

async function cacheManager() {
  const { CacheManager } = await import('@wllama/wllama')
  return new CacheManager()
}

export async function isWllamaCached(spec: CpuModelSpec): Promise<boolean> {
  try {
    const entries = await (await cacheManager()).list()
    return entries.some((e) => e.name.endsWith(spec.file))
  } catch {
    return false
  }
}

export async function deleteWllamaModel(spec: CpuModelSpec): Promise<void> {
  await (await cacheManager()).deleteMany((e) => e.name.endsWith(spec.file))
}
