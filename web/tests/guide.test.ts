import { describe, expect, it } from 'vitest'
import { GUIDE_TEXT, guideTokens } from '../src/content/guide'
import { buildSystemPrompt } from '../src/chat/prompt'
import { metrics } from '../src/lib/artifacts'

describe('site guide (chatbot context)', () => {
  it('has every {{token}} filled in', () => {
    expect(GUIDE_TEXT).not.toMatch(/\{\{|\}\}/)
    Object.values(guideTokens()).forEach((v) => expect(v).not.toMatch(/undefined|NaN/))
  })

  it('quotes the same numbers as the metrics file', () => {
    expect(GUIDE_TEXT).toContain(`Neural network: ${metrics.models.nn.test.mae.toFixed(2)} minutes`)
    expect(GUIDE_TEXT).toContain(`${metrics.models.median_baseline.test.mae.toFixed(2)} minutes`)
    expect(GUIDE_TEXT).toContain(`${metrics.dataset.rows.toLocaleString('en-US')} simulated clinic visits`)
    expect(GUIDE_TEXT).toContain(metrics.dataset.source)
  })

  it('states the baseline comparison plainly in the quick answers', () => {
    const quick = GUIDE_TEXT.slice(GUIDE_TEXT.indexOf('## Quick answers'), GUIDE_TEXT.indexOf('## What this site is'))
    expect(quick).toContain(`average error was ${metrics.models.nn.test.mae.toFixed(2)} minutes`)
    expect(quick).toContain(`average error of ${metrics.models.median_baseline.test.mae.toFixed(2)} minutes`)
    expect(quick).toMatch(/no results for any other dataset/)
  })

  it('covers the three required test questions and the limits', () => {
    expect(GUIDE_TEXT).toMatch(/synthetic/i) // data source
    expect(GUIDE_TEXT).toMatch(/Median baseline/) // vs baseline
    expect(GUIDE_TEXT).toMatch(/not tested the model on any other dataset/) // untested dataset
  })

  it('keeps the system prompt within the context budget', () => {
    const prompt = buildSystemPrompt(GUIDE_TEXT)
    // ~4 characters per token for English; budget 1,800 tokens of the 4,096-token window
    expect(prompt.length / 4).toBeLessThan(1800)
  })
})
