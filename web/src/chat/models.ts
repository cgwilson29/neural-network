/**
 * Chat model catalog.
 * - GPU tier: WebLLM prebuilt models (IDs from @mlc-ai/web-llm 0.2.89's prebuilt list).
 * - CPU tier: GGUF files for wllama (llama.cpp WebAssembly), downloaded from Hugging Face.
 * Defaults are chosen by the bake-off recorded in docs/chatbot-test-log.md (round 5).
 */

export type EngineKind = 'webllm' | 'wllama' | 'search'

interface BaseSpec {
  key: string
  label: string
  downloadMB: number
  /** Qwen3 / Qwen3.5 "thinking" models: ask for a direct answer (sending this to other models corrupts output). */
  thinking: boolean
}

export interface GpuModelSpec extends BaseSpec {
  engine: 'webllm'
  f16: string
  /** q4f32 build for GPUs without shader-f16 (some models only ship f16). */
  f32?: string
}

export interface CpuModelSpec extends BaseSpec {
  engine: 'wllama'
  repo: string
  file: string
}

export type ModelSpec = GpuModelSpec | CpuModelSpec

/** Ascending by download size. */
export const GPU_MODELS: GpuModelSpec[] = [
  { engine: 'webllm', key: 'lfm2.5-350m', label: 'LFM2.5 350M', f16: 'LFM2.5-350M-q4f16_1-MLC', f32: 'LFM2.5-350M-q4f32_1-MLC', downloadMB: 204, thinking: false },
  { engine: 'webllm', key: 'smollm2-360m', label: 'SmolLM2 360M', f16: 'SmolLM2-360M-Instruct-q4f16_1-MLC', f32: 'SmolLM2-360M-Instruct-q4f32_1-MLC', downloadMB: 207, thinking: false },
  { engine: 'webllm', key: 'qwen2.5-0.5b', label: 'Qwen2.5 0.5B', f16: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', downloadMB: 290, thinking: false },
  { engine: 'webllm', key: 'qwen3-0.6b', label: 'Qwen3 0.6B', f16: 'Qwen3-0.6B-q4f16_1-MLC', f32: 'Qwen3-0.6B-q4f32_1-MLC', downloadMB: 352, thinking: true },
  { engine: 'webllm', key: 'qwen3.5-0.8b', label: 'Qwen3.5 0.8B', f16: 'Qwen3.5-0.8B-q4f16_1-MLC', f32: 'Qwen3.5-0.8B-q4f32_1-MLC', downloadMB: 447, thinking: true },
  { engine: 'webllm', key: 'gemma3-1b', label: 'Gemma 3 1B', f16: 'gemma3-1b-it-q4f16_1-MLC', downloadMB: 602, thinking: false },
  { engine: 'webllm', key: 'lfm2.5-1.2b', label: 'LFM2.5 1.2B', f16: 'LFM2.5-1.2B-Instruct-q4f16_1-MLC', f32: 'LFM2.5-1.2B-Instruct-q4f32_1-MLC', downloadMB: 663, thinking: false },
  { engine: 'webllm', key: 'llama3.2-1b', label: 'Llama 3.2 1B', f16: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', downloadMB: 705, thinking: false },
  { engine: 'webllm', key: 'qwen3-1.7b', label: 'Qwen3 1.7B', f16: 'Qwen3-1.7B-q4f16_1-MLC', f32: 'Qwen3-1.7B-q4f32_1-MLC', downloadMB: 984, thinking: true },
]

/** Ascending by download size (GGUF Q4_K_M). */
export const CPU_MODELS: CpuModelSpec[] = [
  { engine: 'wllama', key: 'lfm2.5-350m-cpu', label: 'LFM2.5 350M', repo: 'LiquidAI/LFM2.5-350M-GGUF', file: 'LFM2.5-350M-Q4_K_M.gguf', downloadMB: 229, thinking: false },
  { engine: 'wllama', key: 'smollm2-360m-cpu', label: 'SmolLM2 360M', repo: 'bartowski/SmolLM2-360M-Instruct-GGUF', file: 'SmolLM2-360M-Instruct-Q4_K_M.gguf', downloadMB: 271, thinking: false },
  { engine: 'wllama', key: 'qwen3-0.6b-cpu', label: 'Qwen3 0.6B', repo: 'unsloth/Qwen3-0.6B-GGUF', file: 'Qwen3-0.6B-Q4_K_M.gguf', downloadMB: 397, thinking: true },
  { engine: 'wllama', key: 'qwen2.5-0.5b-cpu', label: 'Qwen2.5 0.5B', repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF', file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', downloadMB: 491, thinking: false },
]

/**
 * Bake-off winners (docs/chatbot-test-log.md, round 5): the smallest model per engine whose answers to
 * all 6 core and 6 reworded questions were supported in 3 of 3 seeds. No WebLLM build under 1 GB passed
 * (Qwen2.5-0.5B 10/18, Qwen3-0.6B 9/18, Llama-3.2-1B 14/18…); on the CPU, Qwen3-0.6B (GGUF) did.
 */
export const DEFAULT_GPU_MODEL = 'qwen3-1.7b'
/** Smallest GPU model that passed — used on phones / low-memory devices too. */
export const SMALL_GPU_MODEL = 'qwen3-1.7b'
export const DEFAULT_CPU_MODEL = 'qwen3-0.6b-cpu'

/** Models shown in the picker for each engine (passing models first). */
export const OFFERED: Record<'webllm' | 'wllama', string[]> = {
  webllm: [DEFAULT_GPU_MODEL],
  wllama: [DEFAULT_CPU_MODEL],
}

export function findModel(key: string): ModelSpec | undefined {
  return [...GPU_MODELS, ...CPU_MODELS].find((m) => m.key === key)
}

/** WebLLM model ID for this GPU: q4f16 when the GPU has shader-f16, else q4f32 (null if not built). */
export function webllmId(spec: GpuModelSpec, f16: boolean): string | null {
  return f16 ? spec.f16 : (spec.f32 ?? null)
}
