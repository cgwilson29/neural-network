import { describe, expect, it } from 'vitest'
import { buildMessages, buildSystemPrompt, isRefusal, NOT_COVERED, stripThink } from '../src/chat/prompt'

describe('prompt assembly', () => {
  it('embeds the guide, the scenario and the refusal phrase', () => {
    const p = buildSystemPrompt('GUIDE BODY', 'SCENARIO LINE')
    expect(p).toContain('GUIDE BODY')
    expect(p).toContain('SCENARIO LINE')
    expect(p).toContain(NOT_COVERED)
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
