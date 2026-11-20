import { describe, expect, it } from 'vitest'
import { searchGuide } from '../src/chat/engines/guideSearch'
import { NOT_COVERED } from '../src/chat/prompt'
import { metrics } from '../src/lib/artifacts'

describe('guide search (non-AI tier)', () => {
  it('answers the three required questions with guide text', () => {
    expect(searchGuide('Where did your data come from?').text).toMatch(/clinic-wait-times\.csv/)
    const b = searchGuide('How did your model compare with the baseline?').text
    expect(b).toContain(metrics.models.nn.test.mae.toFixed(2))
    expect(b).toContain(metrics.models.median_baseline.test.mae.toFixed(2))
    expect(searchGuide('How well did this model work on a dataset you never tested?').text).toMatch(/no results for any other dataset/)
  })

  it('refuses advice and unknown topics', () => {
    expect(searchGuide('How many staff should my clinic hire?').text.startsWith(NOT_COVERED)).toBe(true)
    expect(searchGuide('zxqv blorp').text.startsWith(NOT_COVERED)).toBe(true)
  })

  it('uses the live prediction for questions about the visitor’s setup', () => {
    const a = searchGuide('What does the model predict for the clinic I have set up?', 'Monday at 9 am… predicts a wait of 100 minutes.')
    expect(a.text).toContain('100 minutes')
  })
})
