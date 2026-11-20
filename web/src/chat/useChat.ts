import { useCallback, useEffect, useRef, useState } from 'react'
import { checkWebGPU, type GpuCheck } from './capabilities'
import { CHAT_MODELS, defaultTier, pickModelId, type ChatTier } from './models'
import { createEngine, deleteModel, describeError, isModelCached, streamReply, type Engine, type Progress } from './engineClient'
import { buildMessages, buildSystemPrompt, isRefusal, stripThink, type ChatTurn } from './prompt'
import { GUIDE_TEXT } from '../content/guide'
import { useExhibit } from '../state/store'

/**
 * idle → checking → unsupported | gated → loading → ready ⇄ generating
 *                                         ↘ error (exhibit unaffected; recorded answers shown)
 */
export type ChatPhase = 'idle' | 'checking' | 'unsupported' | 'gated' | 'loading' | 'ready' | 'generating' | 'error'

export interface ChatMessage extends ChatTurn {
  id: number
  refusal?: boolean
}

export function useChat(scenarioText: string) {
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [gpu, setGpu] = useState<GpuCheck | null>(null)
  const [tier, setTier] = useState<ChatTier>(defaultTier)
  const [progress, setProgress] = useState<Progress>({ fraction: 0, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cached, setCached] = useState<Partial<Record<ChatTier, boolean>>>({})
  const [loadedModel, setLoadedModel] = useState<string | null>(null)
  const engine = useRef<Engine | null>(null)
  const scenarioRef = useRef(scenarioText)
  const nextId = useRef(1)
  const setChatGenerating = useExhibit((s) => s.setChatGenerating)
  scenarioRef.current = scenarioText

  const check = useCallback(async () => {
    if (phase !== 'idle') return
    setPhase('checking')
    const g = await checkWebGPU()
    setGpu(g)
    if (!g.supported) {
      setPhase('unsupported')
      return
    }
    setPhase('gated')
    // Only peeks at the browser cache (imports the library, downloads no model files).
    const entries = await Promise.all(
      (Object.keys(CHAT_MODELS) as ChatTier[]).map(async (t) => [t, await isModelCached(pickModelId(t, g.f16))] as const),
    )
    setCached(Object.fromEntries(entries))
  }, [phase])

  const enable = useCallback(async () => {
    if (!gpu?.supported) return
    const modelId = pickModelId(tier, gpu.f16)
    setError(null)
    setProgress({ fraction: 0, text: 'Starting…' })
    setPhase('loading')
    try {
      engine.current = await createEngine(modelId, setProgress)
      setLoadedModel(modelId)
      setCached((c) => ({ ...c, [tier]: true }))
      setPhase('ready')
    } catch (err) {
      console.error(err)
      setError(describeError(err))
      setPhase('error')
    }
  }, [gpu, tier])

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      const e = engine.current
      if (!q || !e || phase !== 'ready') return
      const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }))
      const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: q }
      const botId = nextId.current++
      setMessages((m) => [...m, userMsg, { id: botId, role: 'assistant', content: '' }])
      setPhase('generating')
      setChatGenerating(true)
      const system = buildSystemPrompt(GUIDE_TEXT, scenarioRef.current)
      try {
        const full = await streamReply(e, {
          messages: buildMessages(system, history, q),
          onDelta: (t) => {
            const shown = stripThink(t)
            setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: shown } : x)))
          },
        })
        const final = stripThink(full).trim() || '(no answer)'
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: final, refusal: isRefusal(final) } : x)))
        setPhase('ready')
      } catch (err) {
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: `⚠ ${describeError(err)}` } : x)))
        setPhase('ready')
      } finally {
        setChatGenerating(false)
      }
    },
    [messages, phase, setChatGenerating],
  )

  const stop = useCallback(() => {
    engine.current?.interruptGenerate()
  }, [])

  const clearConversation = useCallback(() => {
    setMessages([])
    engine.current?.resetChat().catch(() => undefined)
  }, [])

  const forgetModel = useCallback(async () => {
    const id = loadedModel ?? (gpu ? pickModelId(tier, gpu.f16) : null)
    try {
      await engine.current?.unload()
    } catch {
      /* ignore */
    }
    engine.current = null
    setLoadedModel(null)
    setMessages([])
    if (id) await deleteModel(id).catch(() => undefined)
    setCached((c) => ({ ...c, [tier]: false }))
    setPhase(gpu?.supported ? 'gated' : 'unsupported')
  }, [gpu, loadedModel, tier])

  useEffect(
    () => () => {
      engine.current?.unload().catch(() => undefined)
    },
    [],
  )

  return { phase, gpu, tier, setTier, progress, error, messages, cached, loadedModel, check, enable, ask, stop, clearConversation, forgetModel, setPhase }
}
