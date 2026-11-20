/**
 * Retrieval over the site guide (no dependencies).
 *
 * The guide is split into chunks — one per "## " section, with the Quick answers split into one chunk
 * per question — and scored against the visitor's question with BM25. Small models answer far more
 * reliably from three relevant passages than from the whole guide, and the shorter prompt is much
 * faster to process (especially on the CPU tier). The same retrieval powers the non-AI guide search.
 */

export interface GuideChunk {
  id: string
  title: string
  text: string
  /** Quick-answer chunks: the canonical answer, without the question. */
  answer?: string
  quick: boolean
}

export interface Retrieved {
  chunk: GuideChunk
  score: number
}

export interface RetrievalResult {
  hits: Retrieved[]
  /** True when nothing matched well; callers then fall back to the Quick answers. */
  lowConfidence: boolean
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function chunkGuide(guide: string): GuideChunk[] {
  const chunks: GuideChunk[] = []
  for (const block of guide.split(/^## /m).filter((b) => b.trim())) {
    const nl = block.indexOf('\n')
    const title = block.slice(0, nl).trim()
    const body = block.slice(nl + 1).trim()
    if (title === 'Quick answers') {
      for (const line of body.split('\n')) {
        const m = line.match(/^- (.+?\?)\s+(.+)$/)
        if (!m) continue
        chunks.push({ id: `qa-${slug(m[1])}`, title: m[1], text: `${m[1]} ${m[2]}`, answer: m[2], quick: true })
      }
    } else {
      chunks.push({ id: slug(title), title, text: body.replace(/\*\*/g, ''), quick: false })
    }
  }
  return chunks
}

const STOP = new Set(
  'a an the and or but of to in on at for from by with about as is are was were be been being it its this that these those i you your we our they their he she do does did can could would should will what which who whom how why when where there here than then so if not no yes any all some me my mine us also just only into over under up down out more most much many very per'.split(
    ' ',
  ),
)

/** Query-side synonyms that map visitor wording onto the guide's wording. */
const SYNONYMS: Record<string, string[]> = {
  baseline: ['median'],
  median: ['baseline'],
  guess: ['median', 'baseline'],
  guessing: ['median', 'baseline'],
  real: ['synthetic', 'made'],
  fake: ['synthetic'],
  patient: ['synthetic', 'data'],
  patients: ['synthetic', 'data'],
  accurate: ['error', 'mae'],
  accuracy: ['error', 'mae'],
  good: ['error', 'results'],
  well: ['error', 'results', 'tested'],
  better: ['error', 'baseline', 'lower'],
  compare: ['baseline', 'error'],
  compared: ['baseline', 'error'],
  hire: ['staffing', 'advice', 'staff'],
  hiring: ['staffing', 'advice'],
  nurses: ['staff', 'staffing', 'advice'],
  advice: ['staffing', 'advice'],
  recommend: ['advice'],
  never: ['tested', 'other', 'dataset'],
  untested: ['tested', 'other', 'dataset'],
  other: ['dataset', 'other'],
  hospital: ['real', 'clinic', 'synthetic'],
  hospitals: ['real', 'clinic'],
  source: ['data', 'came', 'file'],
  dataset: ['data', 'came', 'file', 'csv', 'simulated'],
  tested: ['split', 'validation', 'training'],
  test: ['split', 'validation', 'training'],
  testing: ['split', 'validation', 'training'],
  csv: ['data', 'file'],
  mistake: ['mistake', 'error', 'largest'],
  wrong: ['mistake', 'largest'],
  network: ['model', 'neural'],
  neurons: ['layers', 'relu'],
  layers: ['hidden', 'layers'],
  busy: ['peak', 'hours'],
  busiest: ['peak', 'hours', 'mondays'],
  monday: ['mondays'],
  limitation: ['limitations'],
  limits: ['limitations'],
}

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().match(/[a-z]+|\d+(?:\.\d+)?%?/g) ?? []) {
    if (STOP.has(raw)) continue
    out.push(/^\d/.test(raw) ? raw : stem(raw))
  }
  return out
}

function expandQuery(question: string): string[] {
  const base = question.toLowerCase().match(/[a-z]+|\d+(?:\.\d+)?%?/g) ?? []
  const extra = base.flatMap((w) => SYNONYMS[w] ?? [])
  return tokenize([...base, ...extra].join(' '))
}

export class GuideIndex {
  readonly chunks: GuideChunk[]
  private docs: string[][]
  private df = new Map<string, number>()
  private avgLen: number

  constructor(guide: string) {
    this.chunks = chunkGuide(guide)
    // Title tokens count twice: headings and quick-answer questions are the best signal.
    this.docs = this.chunks.map((c) => [...tokenize(c.title), ...tokenize(c.title), ...tokenize(c.text)])
    for (const d of this.docs) for (const t of new Set(d)) this.df.set(t, (this.df.get(t) ?? 0) + 1)
    this.avgLen = this.docs.reduce((s, d) => s + d.length, 0) / this.docs.length
  }

  score(question: string): Retrieved[] {
    const q = expandQuery(question)
    const N = this.docs.length
    const k1 = 1.2
    const b = 0.75
    return this.docs
      .map((doc, i) => {
        const tf = new Map<string, number>()
        for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1)
        let s = 0
        for (const t of new Set(q)) {
          const f = tf.get(t)
          if (!f) continue
          const n = this.df.get(t) ?? 0
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
          s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / this.avgLen))
        }
        return { chunk: this.chunks[i], score: s }
      })
      .sort((a, b2) => b2.score - a.score)
  }

  /** Top-k passages (≥ 15% of the best score), returned in guide order. */
  retrieve(question: string, k = 3, minScore = 2): RetrievalResult {
    const ranked = this.score(question)
    const best = ranked[0]?.score ?? 0
    if (best < minScore) return { hits: ranked.slice(0, k), lowConfidence: true }
    const hits = ranked.filter((r) => r.score >= best * 0.15).slice(0, k)
    const order = new Map(this.chunks.map((c, i) => [c.id, i]))
    hits.sort((a, b2) => order.get(a.chunk.id)! - order.get(b2.chunk.id)!)
    return { hits, lowConfidence: false }
  }

  get quickAnswers(): GuideChunk[] {
    return this.chunks.filter((c) => c.quick)
  }

  byId(id: string): GuideChunk | undefined {
    return this.chunks.find((c) => c.id === id)
  }
}

export const NOT_COVERED_SECTION_ID = 'not-covered-by-this-guide'

/**
 * Passages for the prompt: the best hits in rank order while they fit a character budget (always at
 * least one), returned in guide order. When the match is weak or the question asks for advice, the
 * "Not covered" section is added so the model can refuse well; otherwise it is left out, because it
 * pulls small models into refusing questions the passages do answer.
 */
export function selectPassages(index: GuideIndex, question: string, k = 3, maxChars = 1300): GuideChunk[] {
  const r = index.retrieve(question, k)
  let picked: GuideChunk[]
  if (r.lowConfidence) {
    picked = index.quickAnswers
  } else {
    const ranked = index.score(question).filter((h) => r.hits.some((x) => x.chunk.id === h.chunk.id))
    picked = []
    let used = 0
    for (const h of ranked) {
      const len = (h.chunk.answer ?? h.chunk.text).length
      if (picked.length > 0 && used + len > maxChars) continue
      picked.push(h.chunk)
      used += len
    }
    const order = new Map(index.chunks.map((c, i) => [c.id, i]))
    picked.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  }
  const notCovered = index.byId(NOT_COVERED_SECTION_ID)
  if ((r.lowConfidence || ADVICE.test(question)) && notCovered && !picked.some((c) => c.id === notCovered.id)) picked.push(notCovered)
  return picked
}

const ADVICE = /\b(should (i|we|my|our)|hire|hiring|recommend|advice|advise)\b/i

export function formatPassages(chunks: GuideChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.quick ? `Quick answer — ${c.title}` : c.title}\n${c.quick ? c.answer : c.text}`)
    .join('\n\n')
}
