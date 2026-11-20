/** WebLLM prebuilt models offered to visitors (IDs from @mlc-ai/web-llm 0.2.89's prebuilt list). */

export type ChatTier = 'standard' | 'lite'

export interface ChatModelOption {
  tier: ChatTier
  label: string
  detail: string
  f16: string
  f32: string
  downloadMB: number
}

export const CHAT_MODELS: Record<ChatTier, ChatModelOption> = {
  standard: {
    tier: 'standard',
    label: 'Standard · Qwen3 1.7B',
    detail: 'Best answers. About 1 GB, downloaded once and cached.',
    f16: 'Qwen3-1.7B-q4f16_1-MLC',
    f32: 'Qwen3-1.7B-q4f32_1-MLC',
    downloadMB: 984,
  },
  lite: {
    tier: 'lite',
    label: 'Lite · Qwen3 0.6B',
    detail: 'Faster to load on slower connections or smaller GPUs; more likely to miss answers.',
    f16: 'Qwen3-0.6B-q4f16_1-MLC',
    f32: 'Qwen3-0.6B-q4f32_1-MLC',
    downloadMB: 352,
  },
}

/** q4f16 builds need the GPU's `shader-f16` feature; otherwise use the q4f32 build of the same model. */
export function pickModelId(tier: ChatTier, f16: boolean): string {
  const m = CHAT_MODELS[tier]
  return f16 ? m.f16 : m.f32
}

/** Small/touch devices default to Lite. */
export function defaultTier(): ChatTier {
  if (typeof window === 'undefined') return 'standard'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (coarse || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)) return 'lite'
  return 'standard'
}
