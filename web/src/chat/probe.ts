/**
 * Capability probe: what this browser can run. Imports no chat library and downloads nothing.
 */

export interface Probe {
  webgpu: {
    api: boolean
    adapter: boolean
    f16: boolean
    limits?: {
      maxBufferSize: number
      maxStorageBufferBindingSize: number
      maxComputeWorkgroupStorageSize: number
      maxStorageBuffersPerShaderStage: number
    }
  }
  wasm: { simd: boolean; jspi: boolean; memory64: boolean; threads: boolean }
  device: { coarse: boolean; memoryGB?: number; saveData: boolean }
}

// Smallest module using a v128 SIMD instruction (from wasm-feature-detect).
const SIMD_TEST = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])

function hasMemory64(): boolean {
  for (const desc of [{ address: 'i64', initial: 1 }, { index: 'i64', initial: 1 }]) {
    try {
      new WebAssembly.Memory(desc as unknown as WebAssembly.MemoryDescriptor)
      return true
    } catch {
      /* try the older spelling */
    }
  }
  return false
}

export function probeWasm(): Probe['wasm'] {
  const W = typeof WebAssembly !== 'undefined' ? WebAssembly : undefined
  return {
    simd: !!W && W.validate(SIMD_TEST),
    jspi: !!W && typeof (W as unknown as { Suspending?: unknown }).Suspending === 'function',
    memory64: !!W && hasMemory64(),
    threads: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
  }
}

export async function probe(): Promise<Probe> {
  const nav = navigator as Navigator & {
    gpu?: { requestAdapter(o?: unknown): Promise<{ features: Set<string>; limits: Record<string, number> } | null> }
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  const webgpu: Probe['webgpu'] = { api: !!nav.gpu, adapter: false, f16: false }
  if (nav.gpu) {
    try {
      const a = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (a) {
        webgpu.adapter = true
        webgpu.f16 = a.features.has('shader-f16')
        webgpu.limits = {
          maxBufferSize: a.limits.maxBufferSize,
          maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupStorageSize: a.limits.maxComputeWorkgroupStorageSize,
          maxStorageBuffersPerShaderStage: a.limits.maxStorageBuffersPerShaderStage,
        }
      }
    } catch {
      /* no adapter */
    }
  }
  return {
    webgpu,
    wasm: probeWasm(),
    device: {
      coarse: typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
      memoryGB: nav.deviceMemory,
      saveData: !!nav.connection?.saveData,
    },
  }
}
