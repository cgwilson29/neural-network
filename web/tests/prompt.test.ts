import { describe, expect, it } from 'vitest'
import { buildMessages, buildSystemPrompt, isRefusal, NOT_COVERED, stripThink } from '../src/chat/prompt'

describe('prompt assembly', () => {
  it('embeds the guide and the refusal phrase, and stays constant across scenarios', () => {
    const p = buildSystemPrompt('GUIDE BODY')
    expect(p).toContain('GUIDE BODY')
    expect(p).toContain(NOT_COVERED)
    expect(buildSystemPrompt('GUIDE BODY')).toBe(p)
  })

  it('attaches the live prediction only to questions about the visitor’s own setup', () => {
    const live = 'Monday at 9 am… The network predicts a wait of 100 minutes.'
    expect(buildMessages('S', [], 'What does it predict for the clinic I have set up?', live).at(-1)!.content).toContain(live)
    expect(buildMessages('S', [], 'How did your model compare with the baseline?', live).at(-1)!.content).not.toContain(live)
    expect(buildMessages('S', [], 'How many staff should my clinic hire?', live).at(-1)!.content).not.toContain(live)
  })

  it('keeps only the last two exchanges', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `m${i}` }))
    const msgs = buildMessages('SYS', history, '  next?  ')
    expect(msgs[0]).toEqual({ role: 'system', content: 'SYS' })
    expect(msgs.slice(1, -1).map((m) => m.content)).toEqual(['m6', 'm7', 'm8', 'm9'])
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'next?' })
  })
})

describe('streamed text cleanup', () => {
  it('drops an "A:" prefix copied from the examples', async () => {
    const { cleanAnswer } = await import('../src/chat/prompt')
    expect(cleanAnswer('A: No. All 2,000 visits are synthetic.')).toBe('No. All 2,000 visits are synthetic.')
    expect(cleanAnswer('<think>\n\n</think>\n\nAnswer: Yes')).toBe('Yes')
    expect(cleanAnswer("Yes, it's better. A: The error is 90% lower. A: The error…")).toBe("Yes, it's better.")
  })

  it('removes Qwen3 think blocks, complete or still streaming', () => {
    expect(stripThink('<think>\n\n</think>\n\nHello')).toBe('Hello')
    expect(stripThink('<think>reasoning')).toBe('')
    expect(stripThink('Answer')).toBe('Answer')
  })

  it('detects the not-covered reply', () => {
    expect(isRefusal(`${NOT_COVERED} It only says…`)).toBe(true)
    expect(isRefusal('The data came from…')).toBe(false)
  })
})
