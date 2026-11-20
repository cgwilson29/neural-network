import type { ChatMsg } from '../prompt'
import type { EngineKind } from '../models'

export interface EngineInfo {
  kind: EngineKind
  /** Catalog key (models.ts); 'guide' for guide search. */
  modelKey: string
  /** Exact model build (WebLLM model ID / GGUF file). */
  modelId: string
  label: string
  device: 'webgpu' | 'cpu' | 'none'
}

export interface Progress {
  fraction: number
  text: string
}

export interface GenerateOptions {
  messages: ChatMsg[]
  maxTokens: number
  temperature: number
  topP: number
  seed?: number
  /** Called with the full text so far (raw — callers strip think tags). */
  onDelta?: (text: string) => void
}

export interface GenerateResult {
  text: string
  promptTokens?: number
  completionTokens?: number
  ttftMs?: number
  prefillTps?: number
  decodeTps?: number
}

/** The one interface the chat UI and the evaluation harness drive, whatever runs underneath. */
export interface ChatEngine {
  readonly info: EngineInfo
  generate(opts: GenerateOptions): Promise<GenerateResult>
  interrupt(): void
  unload(): Promise<void>
}

export const GENERATION = { temperature: 0.2, topP: 0.8 } as const
export const MAX_TOKENS: Record<EngineKind, number> = { webllm: 220, wllama: 160, search: 0 }
