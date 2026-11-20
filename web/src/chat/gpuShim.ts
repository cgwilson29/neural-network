/**
 * Firefox compatibility shim for WebLLM.
 *
 * WebLLM's runtime refuses to start unless the adapter reports maxStorageBuffersPerShaderStage ≥ 10,
 * but Firefox (160, macOS) reports 9. The Qwen3 models used here never need more than 9, so we
 * report max(real, 10) to WebLLM's pre-check while clamping the actual device request to the real
 * limits. If a shader ever did need more, WebGPU validation would reject it with an error (it could
 * not silently compute wrong results). Verified in Firefox 160: both Qwen3 models load and answer.
 */

interface AdapterLike {
  limits: Record<string, number>
  requestDevice: (desc?: { requiredLimits?: Record<string, number | undefined> }) => Promise<unknown>
}
interface GpuLike {
  requestAdapter: (opts?: unknown) => Promise<AdapterLike | null>
}

const REQUIRED = 10

export function installStorageBufferShim(gpu: unknown): void {
  const g = gpu as GpuLike | undefined
  if (!g || typeof g.requestAdapter !== 'function') return
  const original = g.requestAdapter.bind(g)
  g.requestAdapter = async (opts?: unknown) => {
    const adapter = await original(opts)
    if (!adapter || adapter.limits.maxStorageBuffersPerShaderStage >= REQUIRED) return adapter
    if (adapter.limits.maxStorageBuffersPerShaderStage < 9) return adapter // don't paper over bigger gaps
    const real = adapter.limits
    const limits = new Proxy(real, {
      get: (t, p) => (p === 'maxStorageBuffersPerShaderStage' ? REQUIRED : Reflect.get(t, p, t)),
    })
    return new Proxy(adapter, {
      get(t, p) {
        if (p === 'limits') return limits
        if (p === 'requestDevice') {
          return (desc: { requiredLimits?: Record<string, number | undefined> } = {}) => {
            const req = { ...(desc.requiredLimits ?? {}) }
            for (const k of Object.keys(req)) {
              const v = req[k]
              if (v !== undefined && v > real[k]) req[k] = real[k]
            }
            return t.requestDevice({ ...desc, requiredLimits: req })
          }
        }
        const v = Reflect.get(t, p, t)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
  }
}
