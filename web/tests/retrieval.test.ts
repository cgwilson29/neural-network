import { describe, expect, it } from 'vitest'
import { GUIDE_INDEX, GUIDE_TEXT } from '../src/content/guide'
import { chunkGuide, formatPassages, NOT_COVERED_SECTION_ID, selectPassages, tokenize } from '../src/chat/retrieval'
import { buildRagMessages, RAG_SYSTEM } from '../src/chat/prompt'
import questions from './fixtures/retrieval-questions.json'

describe('guide chunking', () => {
  it('splits the guide into sections, with one chunk per quick answer', () => {
    const chunks = chunkGuide(GUIDE_TEXT)
    expect(chunks.filter((c) => c.quick)).toHaveLength(5)
    expect(chunks).toHaveLength(15)
    expect(chunks.map((c) => c.id)).toContain(NOT_COVERED_SECTION_ID)
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length)
  })

  it('tokenizes numbers and stems words', () => {
    expect(tokenize('The median baseline was 46.14 minutes, 90% lower')).toEqual(['median', 'baseline', '46.14', 'minute', '90%', 'lower'])
  })
})

describe('retrieval', () => {
  it.each(questions.filter((x) => !('live' in x)))('the passages the model sees include the right one for: $q', ({ q, expect: ids }) => {
    const seen = selectPassages(GUIDE_INDEX, q).map((c) => c.id)
    expect(seen.some((id) => ids.includes(id))).toBe(true)
  })

  it.each(questions.filter((x) => 'live' in x))('scenario question gets the live prediction: $q', ({ q }) => {
    const msgs = buildRagMessages(q, 'P', 'The network predicts a wait of 100 minutes.')
    expect(msgs.at(-1)!.content).toContain('LIVE PREDICTION')
  })

  it('adds the "Not covered" section only for advice or weak matches, and keeps prompts short', () => {
    expect(selectPassages(GUIDE_INDEX, 'How many staff should my clinic hire?').map((p) => p.id)).toContain(NOT_COVERED_SECTION_ID)
    expect(selectPassages(GUIDE_INDEX, 'How did your model compare with the baseline?').map((p) => p.id)).not.toContain(NOT_COVERED_SECTION_ID)
    for (const { q } of questions) {
      const passages = selectPassages(GUIDE_INDEX, q)
      const msgs = buildRagMessages(q, formatPassages(passages), 'Monday at 9 am, 2 staff on shift, 12 patients in the queue. The network predicts a wait of 100 minutes.')
      const chars = msgs.reduce((s, m) => s + m.content.length, 0)
      expect(chars / 4).toBeLessThan(750) // ≈ tokens
    }
    expect(RAG_SYSTEM.length).toBeGreaterThan(0)
  })

  it('falls back to all quick answers when nothing matches', () => {
    const passages = selectPassages(GUIDE_INDEX, 'zxqv blorp')
    expect(passages.filter((p) => p.quick)).toHaveLength(5)
  })
})
