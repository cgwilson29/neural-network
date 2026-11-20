/**
 * Which chat engine this browser gets — a pure function of the capability probe (unit-tested).
 *   1. WebLLM on WebGPU when the GPU meets WebLLM's limits (incl. 10 storage buffers per shader).
 *   2. wllama on the CPU when WebAssembly has SIMD + JSPI + Memory64 (not WebLLM).
 *   3. Guide search (no AI) otherwise — and always available as an option.
 */
import type { EngineKind } from './models'
import type { Probe } from './probe'

const MB = 1 << 20
export const WEBLLM_NEEDS = {
  maxStorageBuffersPerShaderStage: 10,
  maxBufferSize: 256 * MB,
  maxStorageBufferBindingSize: 128 * MB,
  maxComputeWorkgroupStorageSize: 32768,
} as const

export interface TierChoice {
  tier: EngineKind
  /** Every engine this browser can run, best first (search is always last). */
  available: EngineKind[]
  /** One-sentence explanation of the choice. */
  reason: string
  /** Facts behind it, for the "Why this mode?" disclosure. */
  facts: string[]
  /** Phones / low-memory devices get the smallest passing GPU model by default. */
  smallDevice: boolean
}

export function webllmProblems(p: Probe): string[] {
  if (!p.webgpu.api) return ['This browser has no WebGPU.']
  if (!p.webgpu.adapter || !p.webgpu.limits) return ['WebGPU is present, but no usable graphics adapter was found.']
  const L = p.webgpu.limits
  const out: string[] = []
  if (L.maxStorageBuffersPerShaderStage < WEBLLM_NEEDS.maxStorageBuffersPerShaderStage)
    out.push(
      `WebGPU here allows ${L.maxStorageBuffersPerShaderStage} storage buffers per shader; WebLLM needs ${WEBLLM_NEEDS.maxStorageBuffersPerShaderStage} (a current Firefox-on-Mac limit).`,
    )
  if (L.maxBufferSize < WEBLLM_NEEDS.maxBufferSize) out.push('The GPU’s maximum buffer size is below 256 MB.')
  if (L.maxStorageBufferBindingSize < WEBLLM_NEEDS.maxStorageBufferBindingSize) out.push('The GPU’s storage-buffer size is below 128 MB.')
  if (L.maxComputeWorkgroupStorageSize < WEBLLM_NEEDS.maxComputeWorkgroupStorageSize) out.push('The GPU’s workgroup memory is too small.')
  return out
}

export function cpuProblems(p: Probe): string[] {
  const out: string[] = []
  if (!p.wasm.simd) out.push('WebAssembly SIMD is unavailable.')
  if (!p.wasm.jspi) out.push('WebAssembly JSPI is unavailable (needs Chrome 137+, Firefox 153+ or Safari 27.3+).')
  if (!p.wasm.memory64) out.push('WebAssembly Memory64 is unavailable.')
  return out
}

export function chooseTier(p: Probe): TierChoice {
  const gpuIssues = webllmProblems(p)
  const cpuIssues = cpuProblems(p)
  const available: EngineKind[] = []
  if (gpuIssues.length === 0) available.push('webllm')
  if (cpuIssues.length === 0) available.push('wllama')
  available.push('search')

  const L = p.webgpu.limits
  const facts = [
    `WebGPU: ${p.webgpu.api ? (p.webgpu.adapter ? 'yes' : 'no usable adapter') : 'not available'}`,
    ...(L
      ? [
          `Storage buffers per shader: ${L.maxStorageBuffersPerShaderStage} (WebLLM needs ${WEBLLM_NEEDS.maxStorageBuffersPerShaderStage})`,
          `16-bit GPU shaders: ${p.webgpu.f16 ? 'yes' : 'no (uses the larger q4f32 build)'}`,
        ]
      : []),
    `WebAssembly SIMD / JSPI / Memory64: ${[p.wasm.simd, p.wasm.jspi, p.wasm.memory64].map((b) => (b ? 'yes' : 'no')).join(' / ')}`,
    ...(p.device.saveData ? ['Data saver is on'] : []),
  ]
  const smallDevice = p.device.coarse || (p.device.memoryGB !== undefined && p.device.memoryGB <= 4)

  if (p.device.saveData)
    return { tier: 'search', available, reason: 'Data saver is on, so the guide bot starts in search mode (no download). You can still enable a model.', facts, smallDevice }
  if (available[0] === 'webllm')
    return { tier: 'webllm', available, reason: 'Your browser can run WebLLM on the GPU.', facts, smallDevice }
  if (available[0] === 'wllama')
    return {
      tier: 'wllama',
      available,
      reason: `WebLLM can’t run here (${gpuIssues[0]}) A smaller model can run on your processor instead.`,
      facts,
      smallDevice,
    }
  return {
    tier: 'search',
    available,
    reason: `Neither WebLLM nor the CPU model can run here (${[gpuIssues[0], cpuIssues[0]].filter(Boolean).join(' ')}). Guide search still answers instantly.`,
    facts,
    smallDevice,
  }
}
