import { describe, expect, it } from 'vitest'
import { CHAT_MODELS, pickModelId } from '../src/chat/models'
import { installStorageBufferShim } from '../src/chat/gpuShim'

describe('chat model choice', () => {
  it('uses q4f16 builds when shader-f16 is available, q4f32 otherwise', () => {
    expect(pickModelId('standard', true)).toBe('Qwen3-1.7B-q4f16_1-MLC')
    expect(pickModelId('standard', false)).toBe('Qwen3-1.7B-q4f32_1-MLC')
    expect(pickModelId('lite', false)).toBe('Qwen3-0.6B-q4f32_1-MLC')
    expect(CHAT_MODELS.lite.downloadMB).toBeLessThan(CHAT_MODELS.standard.downloadMB)
  })
})

describe('Firefox storage-buffer shim', () => {
  function fakeGpu(limit: number) {
    const requested: Record<string, number | undefined>[] = []
    const adapter = {
      limits: { maxStorageBuffersPerShaderStage: limit, maxBufferSize: 1 << 30 },
      features: new Set<string>(),
      requestDevice: async (d?: { requiredLimits?: Record<string, number | undefined> }) => {
        requested.push(d?.requiredLimits ?? {})
        return {}
      },
    }
    return { gpu: { requestAdapter: async () => adapter }, requested }
  }

  it('reports 10 to WebLLM but requests only the real limit from the device', async () => {
    const { gpu, requested } = fakeGpu(9)
    installStorageBufferShim(gpu)
    const a = (await gpu.requestAdapter()) as unknown as {
      limits: { maxStorageBuffersPerShaderStage: number }
      requestDevice: (d: unknown) => Promise<unknown>
    }
    expect(a.limits.maxStorageBuffersPerShaderStage).toBe(10)
    await a.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 10, maxBufferSize: 1 << 28 } })
    expect(requested[0]).toEqual({ maxStorageBuffersPerShaderStage: 9, maxBufferSize: 1 << 28 })
  })

  it('leaves capable adapters untouched', async () => {
    const { gpu } = fakeGpu(10)
    installStorageBufferShim(gpu)
    const a = (await gpu.requestAdapter()) as { limits: { maxStorageBuffersPerShaderStage: number } }
    expect(a.limits.maxStorageBuffersPerShaderStage).toBe(10)
  })
})
