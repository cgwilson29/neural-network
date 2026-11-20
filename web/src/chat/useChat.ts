import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { probe, type Probe } from './probe'
import { chooseTier, type TierChoice } from './tiers'
import {
  DEFAULT_CPU_MODEL,
  DEFAULT_GPU_MODEL,
  findModel,
  OFFERED,
  SMALL_GPU_MODEL,
  webllmId,
  type EngineKind,
  type GpuModelSpec,
  type CpuModelSpec,
} from './models'
import { buildRagMessages, cleanAnswer, isRefusal, type ChatTurn } from './prompt'
import { formatPassages, selectPassages } from './retrieval'
import { GUIDE_INDEX } from '../content/guide'
import { createGuideSearch } from './engines/guideSearch'
import { GENERATION, MAX_TOKENS, type ChatEngine, type Progress } from './engines/types'
import { describeError } from './engines/errors'
import { useExhibit } from '../state/store'

/**
 * probing → idle (search answers; a model can be enabled) → loading → checking (WebLLM only) → ready ⇄ generating
 *                                                                    ↘ error (search still answers)
 */
export type ChatPhase = 'probing' | 'idle' | 'loading' | 'checking' | 'ready' | 'generating' | 'error'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  source?: EngineKind
  modelLabel?: string
  /** Guide section quoted by guide search. */
  from?: string | null
  refusal?: boolean
}

export function defaultModelFor(kind: EngineKind, smallDevice = false): string {
  if (kind === 'webllm') return smallDevice ? SMALL_GPU_MODEL : DEFAULT_GPU_MODEL
  if (kind === 'wllama') return DEFAULT_CPU_MODEL
  return 'guide'
}

async function isCached(key: string, f16: boolean): Promise<boolean> {
  const spec = findModel(key)
  if (!spec) return false
  if (spec.engine === 'webllm') {
    const id = webllmId(spec, f16)
    return id ? (await import('./engines/webllm')).isWebllmCached(id) : false
  }
  return (await import('./engines/wllama')).isWllamaCached(spec)
}

export function useChat(liveScenario: string) {
  const [phase, setPhase] = useState<ChatPhase>('probing')
  const [probeResult, setProbe] = useState<Probe | null>(null)
  const [choice, setChoice] = useState<TierChoice | null>(null)
  const [engineKind, setEngineKind] = useState<EngineKind>('search')
  const [modelKey, setModelKey] = useState<string>(DEFAULT_GPU_MODEL)
  const [progress, setProgress] = useState<Progress>({ fraction: 0, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cached, setCached] = useState<Record<string, boolean>>({})
  const engine = useRef<ChatEngine | null>(null)
  const started = useRef(false)
  const nextId = useRef(1)
  const scenarioRef = useRef(liveScenario)
  scenarioRef.current = liveScenario
  const setChatGenerating = useExhibit((s) => s.setChatGenerating)
  const search = useMemo(() => createGuideSearch(() => scenarioRef.current), [])

  const refreshCached = useCallback(async (p: Probe, kinds: EngineKind[]) => {
    const keys = kinds.flatMap((k) => (k === 'webllm' || k === 'wllama' ? OFFERED[k] : []))
    const entries = await Promise.all(keys.map(async (k) => [k, await isCached(k, p.webgpu.f16)] as const))
    setCached((c) => ({ ...c, ...Object.fromEntries(entries) }))
  }, [])

  /** Probe once, when the chat panel first opens. Downloads nothing. */
  const start = useCallback(async () => {
    if (started.current) return
    started.current = true
    const p = await probe()
    const c = chooseTier(p)
    setProbe(p)
    setChoice(c)
    setEngineKind(c.tier)
    setModelKey(defaultModelFor(c.tier, c.smallDevice))
    setPhase('idle')
    refreshCached(p, c.available).catch(() => undefined)
  }, [refreshCached])

  const selectEngine = useCallback(
    (kind: EngineKind) => {
      setEngineKind(kind)
      setModelKey(defaultModelFor(kind, choice?.smallDevice))
      setError(null)
      if (phase === 'error') setPhase('idle')
    },
    [choice, phase],
  )

  const enable = useCallback(async () => {
    if (!probeResult || engineKind === 'search') return
    const spec = findModel(modelKey)
    if (!spec) return
    setError(null)
    setProgress({ fraction: 0, text: 'Starting…' })
    setPhase('loading')
    try {
      if (engine.current) await engine.current.unload().catch(() => undefined)
      engine.current = null
      if (spec.engine === 'webllm') {
        const { loadWebllm } = await import('./engines/webllm')
        const e = await loadWebllm(spec as GpuModelSpec, probeResult.webgpu.f16, setProgress)
        engine.current = e
        setPhase('checking')
        const { sanityCheck } = await import('./engines/sanity')
        await sanityCheck(e)
      } else {
        const { loadWllama } = await import('./engines/wllama')
        engine.current = await loadWllama(spec as CpuModelSpec, setProgress)
      }
      // Ask to keep the download. Chrome/Safari decide silently; Firefox would show a prompt, so skip it there.
      if (!/firefox/i.test(navigator.userAgent)) navigator.storage?.persist?.().catch(() => undefined)
      setCached((c) => ({ ...c, [modelKey]: true }))
      setPhase('ready')
    } catch (err) {
      console.error(err)
      await engine.current?.unload().catch(() => undefined)
      engine.current = null
      setError(describeError(err))
      setPhase('error')
    }
  }, [engineKind, modelKey, probeResult])

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || phase === 'generating') return
      const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: q }
      const botId = nextId.current++
      const e = engine.current

      if (!e || phase !== 'ready') {
        const a = search.answer(q)
        setMessages((m) => [
          ...m,
          userMsg,
          { id: botId, role: 'assistant', content: a.text, source: 'search', from: a.from, refusal: isRefusal(a.text) },
        ])
        return
      }

      // One earlier model exchange of context, as plain question/answer.
      const history: ChatTurn[] = []
      for (let i = messages.length - 1; i > 0; i--) {
        const a = messages[i]
        const u = messages[i - 1]
        if (a.role === 'assistant' && u.role === 'user' && a.source === e.info.kind) {
          history.push({ role: 'user', content: u.content }, { role: 'assistant', content: a.content })
          break
        }
      }
      const passages = formatPassages(selectPassages(GUIDE_INDEX, q))
      setMessages((m) => [...m, userMsg, { id: botId, role: 'assistant', content: '', source: e.info.kind, modelLabel: e.info.label }])
      setPhase('generating')
      setChatGenerating(true)
      try {
        const { text } = await e.generate({
          messages: buildRagMessages(q, passages, scenarioRef.current, history),
          maxTokens: MAX_TOKENS[e.info.kind],
          ...GENERATION,
          onDelta: (t) => {
            const shown = cleanAnswer(t)
            setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: shown } : x)))
          },
        })
        const final = cleanAnswer(text).trim() || '(no answer)'
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: final, refusal: isRefusal(final) } : x)))
      } catch (err) {
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: `⚠ ${describeError(err)}` } : x)))
      } finally {
        setPhase('ready')
        setChatGenerating(false)
      }
    },
    [messages, phase, search, setChatGenerating],
  )

  const stop = useCallback(() => engine.current?.interrupt(), [])
  const clearConversation = useCallback(() => setMessages([]), [])

  const forgetModel = useCallback(async () => {
    const spec = findModel(modelKey)
    await engine.current?.unload().catch(() => undefined)
    engine.current = null
    if (spec?.engine === 'webllm' && probeResult) {
      const id = webllmId(spec, probeResult.webgpu.f16)
      if (id) await (await import('./engines/webllm')).deleteWebllmModel(id).catch(() => undefined)
    } else if (spec?.engine === 'wllama') {
      await (await import('./engines/wllama')).deleteWllamaModel(spec).catch(() => undefined)
    }
    setCached((c) => ({ ...c, [modelKey]: false }))
    setPhase('idle')
  }, [modelKey, probeResult])

  useEffect(
    () => () => {
      engine.current?.unload().catch(() => undefined)
    },
    [],
  )

  const activeInfo = phase === 'ready' || phase === 'generating' ? (engine.current?.info ?? null) : null
  const modelChoices = engineKind === 'search' ? [] : OFFERED[engineKind].map((k) => findModel(k)!).filter(Boolean)

  return {
    phase,
    probe: probeResult,
    choice,
    engineKind,
    modelKey,
    modelChoices,
    progress,
    error,
    messages,
    cached,
    activeInfo,
    start,
    selectEngine,
    setModelKey,
    enable,
    ask,
    stop,
    clearConversation,
    forgetModel,
  }
}
