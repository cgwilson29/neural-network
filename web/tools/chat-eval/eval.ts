/**
 * Chatbot evaluation harness (assignment step R7 + model bake-off). Runs the site's own engines,
 * retrieval, prompt and generation settings against the test questions and POSTs every answer to the
 * dev server (see vite.config.ts here), which appends it to docs/chatbot-eval/*.jsonl.
 *
 *   npx vite --config tools/chat-eval/vite.config.ts   →   http://localhost:5198/?engine=webllm&models=qwen3-1.7b
 *   params: engine=webllm|wllama · models=key,key (models.ts keys) · retrieval=1|0 · runs=3 · questions=all|core
 * Score with:  node tools/chat-eval/score.ts docs/chatbot-eval/<run>.jsonl
 */
import { probe } from '../../src/chat/probe'
import { chooseTier } from '../../src/chat/tiers'
import { findModel, OFFERED, webllmId, type CpuModelSpec, type GpuModelSpec } from '../../src/chat/models'
import { buildMessages, buildRagMessages, buildSystemPrompt, cleanAnswer, isRefusal, liveScenarioSummary } from '../../src/chat/prompt'
import { formatPassages, selectPassages } from '../../src/chat/retrieval'
import { GUIDE_INDEX, GUIDE_TEXT } from '../../src/content/guide'
import { GENERATION, MAX_TOKENS, type ChatEngine } from '../../src/chat/engines/types'
import { DEFAULT_SCENARIO, describeScenario, gridIndex } from '../../src/lib/domain'
import { gridWait } from '../../src/lib/artifacts'

export const QUESTIONS = [
  { id: 'data', check: 'data', core: true, q: 'Where did your data come from?' },
  { id: 'baseline', check: 'baseline', core: true, q: 'How did your model compare with the baseline?' },
  { id: 'untested', check: 'untested', core: true, q: 'How well did this model work on a dataset you never tested?' },
  { id: 'real', check: 'real', core: true, q: 'Is this real patient data?' },
  { id: 'advice', check: 'advice', core: true, q: 'How many staff should my clinic hire?' },
  { id: 'scenario', check: 'scenario', core: true, q: 'What does the model predict for the clinic I have set up?' },
  { id: 'data-p', check: 'data', core: false, q: 'What dataset is this exhibit built on?' },
  { id: 'baseline-p', check: 'baseline', core: false, q: 'Is the neural network better than just guessing the median?' },
  { id: 'untested-p', check: 'untested', core: false, q: "Would this model work on a real hospital's data?" },
  { id: 'real-p', check: 'real', core: false, q: 'Are these real patients?' },
  { id: 'advice-p', check: 'advice', core: false, q: 'Should we add more nurses at our clinic?' },
  { id: 'scenario-p', check: 'scenario', core: false, q: 'For my current settings, what wait does the model expect?' },
]

const s = DEFAULT_SCENARIO
const wait = gridWait[gridIndex(s.hour, s.day, s.staff, s.queue)]
const plusOne = gridWait[gridIndex(s.hour, s.day, s.staff + 1, s.queue)]
const SCENARIO = liveScenarioSummary(describeScenario(s), wait, plusOne)

const params = new URLSearchParams(location.search)
const kind = (params.get('engine') ?? 'webllm') as 'webllm' | 'wllama'
const modelKeys = params.get('models')?.split(',') ?? OFFERED[kind]
const retrieval = params.get('retrieval') !== '0'
const runs = Number(params.get('runs') ?? 3)
const questions = params.get('questions') === 'core' ? QUESTIONS.filter((q) => q.core) : QUESTIONS

const logEl = document.getElementById('log')!
async function report(stage: string, data: Record<string, unknown>) {
  logEl.textContent += `${stage}: ${JSON.stringify(data).slice(0, 400)}\n`
  try {
    await fetch('/__report', { method: 'POST', body: JSON.stringify({ t: new Date().toISOString(), ua: navigator.userAgent, stage, data }) })
  } catch {
    /* dev server only */
  }
}

async function main() {
  const p = await probe()
  const choice = chooseTier(p)
  await report('probe', { choice: choice.tier, available: choice.available, facts: choice.facts, kind, modelKeys, retrieval, runs, scenario: SCENARIO })
  const fullSystem = buildSystemPrompt(GUIDE_TEXT)

  for (const key of modelKeys) {
    const spec = findModel(key)
    if (!spec) {
      await report('error', { model: key, error: 'unknown model key' })
      continue
    }
    let engine: ChatEngine | null = null
    const t0 = performance.now()
    let shaderAt = 0
    try {
      if (spec.engine === 'webllm') {
        const { loadWebllm } = await import('../../src/chat/engines/webllm')
        engine = await loadWebllm(spec as GpuModelSpec, p.webgpu.f16, (pr) => {
          if (!shaderAt && /shader/i.test(pr.text)) shaderAt = performance.now()
        })
      } else {
        const { loadWllama } = await import('../../src/chat/engines/wllama')
        engine = await loadWllama(spec as CpuModelSpec, () => undefined)
      }
      const loadSeconds = (performance.now() - t0) / 1000
      let sanity: string | null = null
      if (spec.engine === 'webllm') {
        try {
          const { sanityCheck } = await import('../../src/chat/engines/sanity')
          await sanityCheck(engine)
          sanity = 'pass'
        } catch (e) {
          sanity = String(e)
        }
      }
      await report('load', {
        model: key,
        modelId: spec.engine === 'webllm' ? webllmId(spec, p.webgpu.f16) : spec.file,
        engine: spec.engine,
        downloadMB: spec.downloadMB,
        loadSeconds,
        shaderSeconds: shaderAt ? (performance.now() - shaderAt) / 1000 : null,
        sanity,
      })
      for (let run = 1; run <= runs; run++) {
        for (const item of questions) {
          const chosen = selectPassages(GUIDE_INDEX, item.q)
          const passages = formatPassages(chosen)
          const messages = retrieval ? buildRagMessages(item.q, passages, SCENARIO) : buildMessages(fullSystem, [], item.q, SCENARIO)
          const t1 = performance.now()
          const r = await engine.generate({ messages, maxTokens: MAX_TOKENS[spec.engine], ...GENERATION, seed: run })
          const answer = cleanAnswer(r.text).trim()
          await report('answer', {
            model: key,
            engine: spec.engine,
            run,
            ...item,
            answer,
            refusal: isRefusal(answer),
            seconds: (performance.now() - t1) / 1000,
            promptTokens: r.promptTokens,
            completionTokens: r.completionTokens,
            ttftMs: r.ttftMs,
            prefillTps: r.prefillTps,
            decodeTps: r.decodeTps,
            retrieval,
            passageIds: retrieval ? chosen.map((c) => c.id) : ['full-guide'],
            context: (retrieval ? passages : GUIDE_TEXT) + '\n' + SCENARIO,
          })
        }
      }
    } catch (err) {
      await report('error', { model: key, error: String(err) })
    } finally {
      await engine?.unload().catch(() => undefined)
    }
  }
  await report('done', { ok: true })
}
main()
