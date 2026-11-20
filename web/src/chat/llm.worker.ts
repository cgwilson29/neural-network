/// <reference lib="webworker" />
/**
 * WebLLM lives entirely in this dedicated worker: the page never imports the library, so it is
 * downloaded once (≈2 MB gzip), only after the visitor clicks "Enable chat".
 * Protocol: see WorkerIn / WorkerOut in engines/webllm.ts.
 */
import { MLCEngine, type ChatCompletionMessageParam } from '@mlc-ai/web-llm'

interface LoadMsg {
  type: 'load'
  modelId: string
}
interface GenerateMsg {
  type: 'generate'
  id: number
  messages: ChatCompletionMessageParam[]
  maxTokens: number
  temperature: number
  topP: number
  seed?: number
  thinking: boolean
}
type Incoming = LoadMsg | GenerateMsg | { type: 'interrupt' } | { type: 'unload' }

let engine: MLCEngine | null = null
const post = (m: unknown) => (self as unknown as Worker).postMessage(m)

self.onmessage = async (e: MessageEvent<Incoming>) => {
  const m = e.data
  try {
    if (m.type === 'load') {
      engine = new MLCEngine({
        initProgressCallback: (r) => post({ type: 'progress', fraction: r.progress, text: r.text }),
      })
      await engine.reload(m.modelId)
      post({ type: 'loaded' })
    } else if (m.type === 'generate') {
      if (!engine) throw new Error('Model not loaded')
      const t0 = performance.now()
      let first = 0
      let text = ''
      let usage: Record<string, unknown> | undefined
      const stream = await engine.chat.completions.create({
        messages: m.messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: m.maxTokens,
        temperature: m.temperature,
        top_p: m.topP,
        ...(m.seed !== undefined ? { seed: m.seed } : {}),
        // Only Qwen3 understands this; for other models WebLLM 0.2.89 would inject <think> tags.
        ...(m.thinking ? { extra_body: { enable_thinking: false } } : {}),
      })
      for await (const chunk of stream) {
        const d = chunk.choices[0]?.delta?.content ?? ''
        if (d) {
          if (!first) first = performance.now()
          text += d
          post({ type: 'delta', id: m.id, text })
        }
        if (chunk.usage) usage = chunk.usage as unknown as Record<string, unknown>
      }
      post({ type: 'done', id: m.id, text, usage, ttftMs: first ? first - t0 : undefined })
    } else if (m.type === 'interrupt') {
      await engine?.interruptGenerate()
    } else if (m.type === 'unload') {
      await engine?.unload()
      engine = null
      post({ type: 'unloaded' })
    }
  } catch (err) {
    post({ type: 'error', id: m.type === 'generate' ? m.id : undefined, message: err instanceof Error ? err.message : String(err) })
  }
}
