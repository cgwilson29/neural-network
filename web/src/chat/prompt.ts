/** Prompt construction for the guide bot. Pure functions — unit-tested in tests/prompt.test.ts. */

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const NOT_COVERED = "The guide doesn't cover that."

/**
 * System prompt for retrieval-augmented answers (the default). It holds only the rules; the relevant
 * guide passages travel with each question, which keeps prompts to roughly a third of the full guide.
 */
export const RAG_SYSTEM = `You are the guide bot for "Queue Cartography", a web exhibit about a small neural network that predicts clinic wait times from SYNTHETIC (made-up) data.

RULES
1. Most questions ARE answered by the GUIDE PASSAGES in the visitor's message: answer them directly, copying the matching Quick answer when there is one.
2. Only if the passages truly do not contain the answer, begin with exactly: "${NOT_COVERED}" Then you may add one sentence about the closest thing the passages say. Never guess and never use outside knowledge.
3. Copy numbers exactly as written. Never do arithmetic and never combine numbers into new ones.
4. A LIVE PREDICTION describes the visitor's current settings on the page. Use it for questions about their own clinic or settings. It is not a test result.
5. Never give medical, legal, hiring or staffing advice. If asked for advice, begin with "${NOT_COVERED}" and say the exhibit uses synthetic data and is not advice.
6. Reply in at most 3 short, plain sentences.

EXAMPLES
Q: What does the model predict?
A: It predicts how many minutes a visitor will wait at the clinic, from the hour, weekday, staff on shift and patients in the queue.
Q: How many nurses should our clinic hire?
A: ${NOT_COVERED} This exhibit is built on synthetic data and is not staffing advice.`

/** Full-guide system prompt (used by the evaluation harness for the retrieval-off comparison). */
export function buildSystemPrompt(guide: string): string {
  return `${RAG_SYSTEM.replace("from the GUIDE PASSAGES in the visitor's message", 'from the GUIDE below')}

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
 * Retrieval-augmented messages: rules (system), at most one earlier exchange, then a user turn with
 * the retrieved passages, the live prediction when relevant, and the question.
 */
export function buildRagMessages(question: string, passages: string, liveScenario?: string, history: ChatTurn[] = []): ChatMsg[] {
  const q = question.trim()
  const live =
    liveScenario && wantsLivePrediction(q) ? `\n\nLIVE PREDICTION (visitor's current settings; not a test result)\n${liveScenario}` : ''
  const recent = history.filter((t) => t.content.trim()).slice(-2)
  return [
    { role: 'system', content: RAG_SYSTEM },
    ...recent.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: `GUIDE PASSAGES\n${passages}${live}\n\nQUESTION: ${q}` },
  ]
}

/** Full-guide messages (retrieval off), kept for the harness's comparison runs. */
export function buildMessages(system: string, history: ChatTurn[], question: string, liveScenario?: string, keepExchanges = 2): ChatMsg[] {
  const q = question.trim()
  const recent = history.filter((t) => t.content.trim()).slice(-keepExchanges * 2)
  const content =
    liveScenario && wantsLivePrediction(q) ? `${q}\n\n(Live prediction for my current settings, not a test result: ${liveScenario})` : q
  return [{ role: 'system', content: system }, ...recent.map((t) => ({ role: t.role, content: t.content })), { role: 'user', content }]
}

/** Some models emit an (empty) <think>…</think> block before the answer; never show it. */
export function stripThink(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const open = out.indexOf('<think>')
  if (open !== -1) out = out.slice(0, open) // an unfinished think block mid-stream
  return out.replace(/^\s+/, '')
}

/**
 * Display-ready answer: no think block, no "A:" prefix copied from the prompt's examples, and nothing
 * after a second "Q:"/"A:" marker (small models sometimes keep writing example-style turns).
 */
export function cleanAnswer(text: string): string {
  const s = stripThink(text).replace(/^\s*(?:A|Answer)\s*:\s*/i, '')
  return s.split(/\s(?:A|Q|Answer|Question|Visitor)\s*:\s/)[0].trimEnd()
}

export function isRefusal(answer: string): boolean {
  return answer.trim().startsWith(NOT_COVERED)
}

/** Questions asking for advice get a fixed refusal in the non-AI guide search. */
export function isAdviceQuestion(question: string): boolean {
  return /\b(should (i|we|my|our)|hire|hiring|recommend|advice|advise|how many (staff|nurses|doctors|people) should)\b/i.test(question)
}
