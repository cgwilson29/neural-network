import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CPU_MODELS, DEFAULT_CPU_MODEL, DEFAULT_GPU_MODEL, findModel, GPU_MODELS, OFFERED, SMALL_GPU_MODEL, webllmId } from '../src/chat/models'

const webllmLib = readFileSync(new URL('../node_modules/@mlc-ai/web-llm/lib/index.js', import.meta.url), 'utf8')

describe('chat model catalog', () => {
  it('every WebLLM model ID exists in the installed prebuilt list', () => {
    for (const m of GPU_MODELS) {
      expect(webllmLib).toContain(`model_id: "${m.f16}"`)
      if (m.f32) expect(webllmLib).toContain(`model_id: "${m.f32}"`)
    }
  })

  it('picks q4f16 with shader-f16, q4f32 without, and nothing when no f32 build exists', () => {
    const qwen = findModel('qwen3-1.7b')
    expect(qwen?.engine).toBe('webllm')
    if (qwen?.engine !== 'webllm') return
    expect(webllmId(qwen, true)).toBe('Qwen3-1.7B-q4f16_1-MLC')
    expect(webllmId(qwen, false)).toBe('Qwen3-1.7B-q4f32_1-MLC')
    const gemma = findModel('gemma3-1b')
    if (gemma?.engine === 'webllm') expect(webllmId(gemma, false)).toBeNull()
  })

  it('only Qwen3 / Qwen3.5 models get the thinking switch (it corrupts other models in WebLLM 0.2.89)', () => {
    for (const m of [...GPU_MODELS, ...CPU_MODELS]) expect(m.thinking).toBe(/^qwen3/i.test(m.key))
  })

  it('defaults point at catalog entries of the right engine', () => {
    expect(findModel(DEFAULT_GPU_MODEL)?.engine).toBe('webllm')
    expect(findModel(SMALL_GPU_MODEL)?.engine).toBe('webllm')
    expect(findModel(DEFAULT_CPU_MODEL)?.engine).toBe('wllama')
    for (const k of [...OFFERED.webllm, ...OFFERED.wllama]) expect(findModel(k)).toBeDefined()
  })

  it('lists models in ascending download size', () => {
    for (const list of [GPU_MODELS, CPU_MODELS]) {
      const sizes = list.map((m) => m.downloadMB)
      expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
    }
  })
})
