/**
 * Post-load sanity check. WebGPU reports shader failures asynchronously instead of throwing, so a
 * model can "load" and still compute garbage (seen in Firefox when its limits were faked). One short
 * grounded question with a known answer, long enough to exercise the paged-prefill kernels, catches it.
 */
import { GUIDE_INDEX } from '../../content/guide'
import { formatPassages } from '../retrieval'
import { buildRagMessages, cleanAnswer } from '../prompt'
import { SanityError } from './errors'
import type { ChatEngine } from './types'

export async function sanityCheck(engine: ChatEngine): Promise<void> {
  const passages = formatPassages([...GUIDE_INDEX.quickAnswers, ...GUIDE_INDEX.chunks.filter((c) => c.id === 'where-the-data-came-from')])
  const messages = buildRagMessages('Which file did the data come from? Reply with the file name only.', passages)
  const { text } = await engine.generate({ messages, maxTokens: 24, temperature: 0, topP: 1, seed: 1 })
  const answer = cleanAnswer(text).trim()
  if (!/clinic-wait-times/i.test(answer)) throw new SanityError(answer || text.trim())
}
