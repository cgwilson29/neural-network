import { describe, expect, it } from 'vitest'
import { CHAT_MODELS, pickModelId } from '../src/chat/models'

describe('chat model choice', () => {
  it('uses q4f16 builds when shader-f16 is available, q4f32 otherwise', () => {
    expect(pickModelId('standard', true)).toBe('Qwen3-1.7B-q4f16_1-MLC')
    expect(pickModelId('standard', false)).toBe('Qwen3-1.7B-q4f32_1-MLC')
    expect(pickModelId('lite', false)).toBe('Qwen3-0.6B-q4f32_1-MLC')
    expect(CHAT_MODELS.lite.downloadMB).toBeLessThan(CHAT_MODELS.standard.downloadMB)
  })
})

describe('WebGPU capability check', () => {
  async function check(limit: number, f16 = true) {
    const adapter = {
      features: new Set(f16 ? ['shader-f16'] : []),
      limits: {
        maxBufferSize: 1 << 30,
        maxStorageBufferBindingSize: 1 << 30,
        maxComputeWorkgroupStorageSize: 32768,
        maxStorageBuffersPerShaderStage: limit,
      },
    }
    const g = globalThis as unknown as { navigator?: unknown }
    const saved = g.navigator
    Object.defineProperty(globalThis, 'navigator', { value: { gpu: { requestAdapter: async () => adapter } }, configurable: true })
    try {
      const { checkWebGPU } = await import('../src/chat/capabilities')
      return await checkWebGPU()
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: saved, configurable: true })
    }
  }

  it('accepts adapters with 10+ storage buffers per shader stage', async () => {
    const r = await check(10)
    expect(r.supported).toBe(true)
    expect(r.f16).toBe(true)
  })

  it('refuses adapters with 9 (current Firefox) instead of running a broken model', async () => {
    const r = await check(9)
    expect(r.supported).toBe(false)
    expect(r.problems.join(' ')).toMatch(/needs 10/)
  })
})
