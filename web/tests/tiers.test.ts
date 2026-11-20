import { describe, expect, it } from 'vitest'
import { chooseTier } from '../src/chat/tiers'
import type { Probe } from '../src/chat/probe'

const GB = 1 << 30
const gpu = (storage: number, f16 = true): Probe['webgpu'] => ({
  api: true,
  adapter: true,
  f16,
  limits: { maxBufferSize: 2 * GB, maxStorageBufferBindingSize: 2 * GB, maxComputeWorkgroupStorageSize: 32768, maxStorageBuffersPerShaderStage: storage },
})
const fullWasm = { simd: true, jspi: true, memory64: true, threads: false }
const desktop = { coarse: false, memoryGB: 16, saveData: false }

describe('chooseTier', () => {
  it('Safari / Chrome (≥10 storage buffers) → WebLLM, with CPU and search as alternatives', () => {
    const c = chooseTier({ webgpu: gpu(44), wasm: fullWasm, device: desktop })
    expect(c.tier).toBe('webllm')
    expect(c.available).toEqual(['webllm', 'wllama', 'search'])
  })

  it('Firefox on macOS (9 storage buffers) → CPU mode, explaining the limit', () => {
    const c = chooseTier({ webgpu: gpu(9), wasm: fullWasm, device: desktop })
    expect(c.tier).toBe('wllama')
    expect(c.available).not.toContain('webllm')
    expect(c.reason).toMatch(/9 storage buffers/)
    expect(c.facts.join(' ')).toMatch(/Storage buffers per shader: 9 \(WebLLM needs 10\)/)
  })

  it('no WebGPU adapter (e.g., headless Firefox, Linux) → CPU mode', () => {
    const c = chooseTier({ webgpu: { api: true, adapter: false, f16: false }, wasm: fullWasm, device: desktop })
    expect(c.tier).toBe('wllama')
  })

  it('no WebGPU and no JSPI (older browsers) → guide search only', () => {
    const c = chooseTier({ webgpu: { api: false, adapter: false, f16: false }, wasm: { ...fullWasm, jspi: false }, device: desktop })
    expect(c.tier).toBe('search')
    expect(c.available).toEqual(['search'])
    expect(c.reason).toMatch(/Guide search/)
  })

  it('data saver → starts in search mode but keeps the models available', () => {
    const c = chooseTier({ webgpu: gpu(10), wasm: fullWasm, device: { ...desktop, saveData: true } })
    expect(c.tier).toBe('search')
    expect(c.available).toContain('webllm')
  })

  it('phones and low-memory devices are flagged for the smallest model', () => {
    expect(chooseTier({ webgpu: gpu(10), wasm: fullWasm, device: { coarse: true, saveData: false } }).smallDevice).toBe(true)
    expect(chooseTier({ webgpu: gpu(10), wasm: fullWasm, device: { coarse: false, memoryGB: 4, saveData: false } }).smallDevice).toBe(true)
    expect(chooseTier({ webgpu: gpu(10), wasm: fullWasm, device: desktop }).smallDevice).toBe(false)
  })

  it('GPUs without 16-bit shaders still get WebLLM (q4f32 builds)', () => {
    const c = chooseTier({ webgpu: gpu(10, false), wasm: fullWasm, device: desktop })
    expect(c.tier).toBe('webllm')
    expect(c.facts.join(' ')).toMatch(/q4f32/)
  })
})
