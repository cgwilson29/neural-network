/** Prompt construction for the guide bot. Pure functions — unit-tested in tests/prompt.test.ts. */

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export const NOT_COVERED = "The guide doesn't cover that."

export function buildSystemPrompt(guide: string): string {
  return `You are the guide bot for "Queue Cartography", a web exhibit about a small neural network that predicts clinic wait times from SYNTHETIC (made-up) data.

RULES
1. Answer using only facts written in the GUIDE below. Prefer the GUIDE's "Quick answers" when one matches the question.
2. If the GUIDE does not contain the answer, begin your reply with exactly: "${NOT_COVERED}" Then you may add one sentence about the closest thing the GUIDE does say. Never guess and never use outside knowledge.
3. Copy numbers exactly as they appear in the GUIDE. Never do arithmetic and never combine numbers into new ones.
4. If the visitor's message includes a live prediction for their current settings, use it to answer questions about their own clinic. A live prediction is not a test result.
5. Never give medical, legal, hiring or staffing advice. If asked, begin with "${NOT_COVERED}" and say the exhibit uses synthetic data and is not advice.
6. Reply in at most 3 short, plain sentences.

EXAMPLES
Q: What does the model predict?
A: It predicts how many minutes a visitor will wait at the clinic, using the hour, weekday, staff on shift and patients in the queue.
Q: Which hospital uses this model?
A: ${NOT_COVERED} The guide only says the data is synthetic and does not describe any real clinic.
Q: How many nurses should our clinic hire?
A: ${NOT_COVERED} This exhibit is built on synthetic data and is not staffing advice.

GUIDE
"""
${guide}
"""`
}

/** One-line description of the visitor's current scenario and the network's live prediction. */
export function liveScenarioSummary(described: string, wait: number, plusOne: number | null): string {
  const extra = plusOne === null ? '' : ` With one more staff member, the network predicts ${Math.round(plusOne)} minutes.`
  return `${described}. The network predicts a wait of ${Math.round(wait)} minutes.${extra}`
}

/** Questions about the visitor's own setup get the live prediction attached; others don't. */
const ABOUT_MY_SETUP = /\b(i've set|i have set|i set|set up|current|currently|scenario|settings|right now)\b/i

export function wantsLivePrediction(question: string): boolean {
  return ABOUT_MY_SETUP.test(question)
}

/**
 * System prompt (constant, so its cache can be reused), the last `keepExchanges` question/answer
 * pairs, and the new question — with the live prediction appended only when the question is about
 * the visitor's own settings.
 */
export function buildMessages(system: string, history: ChatTurn[], question: string, liveScenario?: string, keepExchanges = 2) {
  const q = question.trim()
  const recent = history.filter((t) => t.content.trim()).slice(-keepExchanges * 2)
  const content =
    liveScenario && wantsLivePrediction(q) ? `${q}\n\n(Live prediction for my current settings, not a test result: ${liveScenario})` : q
  return [
    { role: 'system' as const, content: system },
    ...recent.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content },
  ]
}

/** Qwen3 may emit an (empty) <think>…</think> block before the answer; never show it. */
export function stripThink(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const open = out.indexOf('<think>')
  if (open !== -1) out = out.slice(0, open) // an unfinished think block mid-stream
  return out.replace(/^\s+/, '')
}

export function isRefusal(answer: string): boolean {
  return answer.trim().startsWith(NOT_COVERED)
}
