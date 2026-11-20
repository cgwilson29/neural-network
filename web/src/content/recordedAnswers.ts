/**
 * Answers recorded from the live guide bot during testing (see docs/chatbot-test-log.md, final round).
 * Shown when chat can't run on a visitor's device, so the exhibit still answers the key questions.
 */
export interface RecordedQA {
  q: string
  a: string
  meta: string
}

const META = 'Recorded 2026-11-20 · Qwen3-1.7B (q4f16) via WebLLM in Safari 27.2 · checked against the guide ✓'

export const RECORDED_QA: RecordedQA[] = [
  {
    q: 'Where did your data come from?',
    a: 'From the file clinic-wait-times.csv on the course website.',
    meta: `${META} (the guide adds: 2,000 synthetic visits, not real patient data)`,
  },
  {
    q: 'How did your model compare with the baseline?',
    a: "The model's average error was 4.49 minutes. The median baseline, which always predicts 59.5 minutes, had an average error of 46.14 minutes. The model's error was 90% lower.",
    meta: META,
  },
  {
    q: 'How well did this model work on a dataset you never tested?',
    a: "The guide doesn't cover that. The model was only tested on 300 held-out visits from this one synthetic dataset.",
    meta: META,
  },
  {
    q: 'Is this real patient data?',
    a: 'No. All 2,000 visits are synthetic (made up).',
    meta: META,
  },
  {
    q: 'How many staff should my clinic hire?',
    a: "The guide doesn't cover that. The exhibit uses synthetic data and is not staffing advice.",
    meta: META,
  },
]
