/**
 * WebGPU capability check — runs on the main thread WITHOUT importing WebLLM, so checking costs
 * nothing and downloads nothing.
 */

export interface GpuCheck {
  /** WebGPU exists and an adapter was found. */
  supported: boolean
  /** Adapter offers 16-bit floats in shaders (lets us use the smaller q4f16 model builds). */
  f16: boolean
  /** Hard blockers (chat can't run). */
  problems: string[]
  /** Soft notes shown alongside the Enable button. */
  notes: string[]
  limits?: Record<string, number>
}

const MB = 1 << 20

interface AdapterInfo {
  features: Set<string>
  limits: Record<string, number>
}

export async function checkWebGPU(): Promise<GpuCheck> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: (o?: unknown) => Promise<unknown> } }).gpu
  if (!gpu) {
    return {
      supported: false,
      f16: false,
      problems: ['This browser doesn’t support WebGPU (try a recent Chrome, Edge, Firefox or Safari on a laptop or desktop).'],
      notes: [],
    }
  }
  let adapter: AdapterInfo | null = null
  try {
    adapter = (await gpu.requestAdapter({ powerPreference: 'high-performance' })) as AdapterInfo | null
  } catch {
    adapter = null
  }
  if (!adapter) {
    return {
      supported: false,
      f16: false,
      problems: ['WebGPU is present, but no compatible graphics adapter was found on this device.'],
      notes: [],
    }
  }
  const L = adapter.limits
  const limits = {
    maxBufferSize: L.maxBufferSize,
    maxStorageBufferBindingSize: L.maxStorageBufferBindingSize,
    maxComputeWorkgroupStorageSize: L.maxComputeWorkgroupStorageSize,
    maxStorageBuffersPerShaderStage: L.maxStorageBuffersPerShaderStage,
  }
  const problems: string[] = []
  const notes: string[] = []
  if (limits.maxBufferSize < 256 * MB) problems.push('The GPU’s maximum buffer size is below the 256 MB the language model needs.')
  if (limits.maxStorageBufferBindingSize < 128 * MB) problems.push('The GPU’s storage-buffer limit is below the 128 MB the language model needs.')
  if (limits.maxComputeWorkgroupStorageSize < 32768) problems.push('The GPU’s workgroup memory limit is too small for the language model.')
  // Every WebLLM model library includes paged-attention shaders that bind 10 storage buffers
  // (we counted them in the compiled WGSL). Firefox currently exposes 9. Faking the limit makes those
  // shaders fail validation silently and the model writes nonsense, so we refuse instead.
  if (limits.maxStorageBuffersPerShaderStage < 10)
    problems.push(
      `This browser’s WebGPU allows ${limits.maxStorageBuffersPerShaderStage} storage buffers per shader, but the chat model needs 10. This is a current Firefox limit; chat works in Chrome, Edge or Safari.`,
    )

  return { supported: problems.length === 0, f16: adapter.features.has('shader-f16'), problems, notes, limits }
}
