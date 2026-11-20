/**
 * Answers recorded from the live guide bot during testing (docs/chatbot-test-log.md).
 * Shown when chat can't run on a visitor's device, so the exhibit still answers the key questions.
 */
export interface RecordedQA {
  q: string
  a: string
  meta: string
}

export const RECORDED_QA: RecordedQA[] = [
  {
    q: 'Where did your data come from?',
    a: 'Recorded answer pending chatbot testing.',
    meta: 'pending',
  },
  {
    q: 'How did your model compare with the baseline?',
    a: 'Recorded answer pending chatbot testing.',
    meta: 'pending',
  },
  {
    q: 'How well did this model work on a dataset you never tested?',
    a: 'Recorded answer pending chatbot testing.',
    meta: 'pending',
  },
]
