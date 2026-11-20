/** Prompt construction for the guide bot. Pure functions — unit-tested in tests/prompt.test.ts. */

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export const NOT_COVERED = "The guide doesn't cover that."

export function buildSystemPrompt(guide: string, scenario: string): string {
  return `You are the guide bot for "Queue Cartography", a web exhibit about a small neural network that predicts clinic wait times from SYNTHETIC (made-up) data.

RULES
1. Answer using only facts written in the GUIDE below, plus the CURRENT SCENARIO when the visitor asks about it.
2. If the GUIDE does not contain the answer, begin your reply with exactly: "${NOT_COVERED}" Then you may add one sentence about the closest thing the GUIDE does say. Never guess and never use outside knowledge.
3. Copy numbers exactly as they appear in the GUIDE. Do not calculate new numbers.
4. The data is made up. Never describe it as real patient or clinic data.
5. Do not give medical, legal, or real-world staffing advice.
6. Reply in at most 4 short, plain sentences.

EXAMPLES
Visitor: What does the model predict?
Answer: It predicts how many minutes a visitor will wait at the clinic, using the hour, weekday, staff on shift and patients in the queue.
Visitor: Which hospital uses this model?
Answer: ${NOT_COVERED} The guide only says the data is synthetic and does not describe any real clinic.

GUIDE
"""
${guide}
"""

CURRENT SCENARIO (what the visitor has set on the page)
${scenario}`
}

/** Keep the system prompt, the last `keepExchanges` question/answer pairs, and the new question. */
export function buildMessages(system: string, history: ChatTurn[], question: string, keepExchanges = 2) {
  const recent = history.filter((t) => t.content.trim()).slice(-keepExchanges * 2)
  return [
    { role: 'system' as const, content: system },
    ...recent.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: question.trim() },
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
