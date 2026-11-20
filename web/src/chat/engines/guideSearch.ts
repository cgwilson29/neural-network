/**
 * Last-resort tier (and instant answers while a model downloads): non-AI guide search.
 * Returns the best-matching guide text verbatim — it cannot make anything up.
 */
import { GUIDE_INDEX } from '../../content/guide'
import { isAdviceQuestion, NOT_COVERED, wantsLivePrediction } from '../prompt'
import type { ChatEngine, GenerateResult } from './types'

export interface SearchAnswer {
  text: string
  /** Guide section the text came from (null for refusals). */
  from: string | null
}

const firstSentences = (text: string, n: number) =>
  text
    .replace(/^- /gm, '')
    .replace(/\n+/g, ' ')
    .match(/[^.!?]+[.!?]+(\s|$)/g)
    ?.slice(0, n)
    .join('')
    .trim() ?? text

export function searchGuide(question: string, liveScenario?: string): SearchAnswer {
  const q = question.trim()
  if (isAdviceQuestion(q)) {
    return { text: `${NOT_COVERED} This exhibit is built on synthetic data and is not staffing, medical or business advice.`, from: null }
  }
  if (liveScenario && wantsLivePrediction(q)) {
    return { text: `For your current settings: ${liveScenario}`, from: 'the map (live prediction)' }
  }
  const ranked = GUIDE_INDEX.score(q)
  const best = ranked[0]
  if (!best || GUIDE_INDEX.retrieve(q).lowConfidence) {
    return {
      text: `${NOT_COVERED} It covers where the data came from, what the model sees and predicts, how it was tested, its results, what visitors can discover, one mistake, and its limitations.`,
      from: null,
    }
  }
  const c = best.chunk
  return c.quick ? { text: c.answer!, from: 'Quick answers' } : { text: firstSentences(c.text, 2), from: c.title }
}

/** Guide search wrapped in the common engine interface (answers instantly). */
export function createGuideSearch(getLiveScenario: () => string | undefined): ChatEngine & {
  answer(q: string): SearchAnswer
} {
  return {
    info: { kind: 'search', modelKey: 'guide', modelId: 'guide-search', label: 'Guide search', device: 'none' },
    answer: (q) => searchGuide(q, getLiveScenario()),
    async generate(o): Promise<GenerateResult> {
      const q = [...o.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      const { text } = searchGuide(q.replace(/^[\s\S]*QUESTION:\s*/, ''), getLiveScenario())
      o.onDelta?.(text)
      return { text }
    },
    interrupt() {},
    async unload() {},
  }
}
