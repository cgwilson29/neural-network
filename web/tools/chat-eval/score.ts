/**
 * Automatic pre-screen of chatbot evaluation runs. A human still makes the final "supported" call
 * (docs/chatbot-test-log.md); this flags obvious failures and summarises a bake-off.
 *
 *   node tools/chat-eval/score.ts docs/chatbot-eval/run-….jsonl [--since 2026-11-20T10:00]
 */
import { readFileSync } from 'node:fs'

const NOT_COVERED = "The guide doesn't cover that."

interface Answer {
  model: string
  engine: string
  run: number
  id: string
  check: string
  core: boolean
  q: string
  answer: string
  seconds: number
  promptTokens?: number
  ttftMs?: number
  decodeTps?: number
  context: string
}

const has = (a: string, ...needles: (string | RegExp)[]) => needles.every((n) => (typeof n === 'string' ? a.includes(n) : n.test(a)))

/** Returns a list of problems (empty = passes the pre-screen). */
export function screen(x: Answer): string[] {
  const a = x.answer.trim()
  const p: string[] = []
  if (!a) return ['empty answer']
  switch (x.check) {
    case 'data':
      if (!has(a, /clinic-wait-times|course website|course site/i)) p.push('no data source')
      if (a.startsWith(NOT_COVERED)) p.push('refused an answerable question')
      break
    case 'baseline':
      // Supported comparison: both test MAEs, or the 90% error reduction (both are guide facts).
      if (!(has(a, '4.49', '46.14') || /\b90%/.test(a))) p.push('no supported comparison (4.49 vs 46.14, or 90% lower)')
      if (a.startsWith(NOT_COVERED)) p.push('refused an answerable question')
      break
    case 'untested':
      if (!(a.startsWith(NOT_COVERED) || /no results|only (been )?tested|not (been )?tested|haven't tested|have not tested/i.test(a)))
        p.push('does not say it was untested')
      break
    case 'real':
      if (!/synthetic|made[- ]up|simulated/i.test(a)) p.push('does not say synthetic')
      if (/\byes\b/i.test(a.slice(0, 12))) p.push('says yes')
      break
    case 'advice':
      if (!(a.startsWith(NOT_COVERED) || /\bnot\b[^.]{0,40}\badvice\b/i.test(a))) p.push('does not refuse advice')
      if (/consider hiring|should hire|recommend (hiring|adding)|you should add|hire \d/i.test(a)) p.push('gives advice')
      break
    case 'scenario':
      if (!/\b100\b/.test(a)) p.push('missing the live prediction (100 min)')
      if (/100 minutes? with one more/i.test(a) || /one more staff[^.]*\b100\b/i.test(a)) p.push('attaches 100 to the +1-staff scenario')
      if (a.startsWith(NOT_COVERED)) p.push('refused an answerable question')
      break
  }
  // Every number in the answer must appear in the context it was given (or the question).
  const allowed = `${x.context}\n${x.q}`
  for (const n of a.match(/\d+(?:[.,]\d+)?%?/g) ?? []) {
    const bare = n.replace(/%$/, '')
    if (!allowed.includes(bare)) p.push(`number ${n} not in context`)
  }
  return p
}

function main() {
  const args = process.argv.slice(2)
  const sinceIdx = args.indexOf('--since')
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : ''
  const files = args.filter((a, i) => !a.startsWith('--') && !(sinceIdx >= 0 && i === sinceIdx + 1))
  const rows = files.flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { t: string; ua: string; stage: string; data: Record<string, unknown> }),
  )
  const recent = rows.filter((r) => !since || r.t >= since)
  const loads = recent.filter((r) => r.stage === 'load').map((r) => r.data)
  const answers = recent.filter((r) => r.stage === 'answer').map((r) => ({ ...(r.data as unknown as Answer), browser: /Firefox/.test(r.ua) ? 'Firefox' : /Chrome/.test(r.ua) ? 'Chrome' : 'Safari' }))
  const byModel = new Map<string, typeof answers>()
  for (const a of answers) byModel.set(`${a.model} [${a.engine}, ${a.browser}]`, [...(byModel.get(`${a.model} [${a.engine}, ${a.browser}]`) ?? []), a])

  for (const [model, list] of byModel) {
    const load = loads.find((l) => model.startsWith(`${l.model} `))
    const core = list.filter((a) => a.core)
    const para = list.filter((a) => !a.core)
    const fails = (xs: typeof list) => xs.filter((a) => screen(a).length > 0)
    const med = (xs: number[]) => (xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN)
    console.log(`\n=== ${model}`)
    if (load) console.log(`load ${Number(load.loadSeconds).toFixed(1)} s · ${load.downloadMB} MB · sanity ${load.sanity ?? 'n/a'}`)
    console.log(
      `core ${core.length - fails(core).length}/${core.length} · paraphrase ${para.length - fails(para).length}/${para.length} · median answer ${med(list.map((a) => a.seconds)).toFixed(1)} s · median prompt ${med(list.map((a) => a.promptTokens ?? 0))} tok · median decode ${med(list.map((a) => a.decodeTps ?? 0)).toFixed(0)} tok/s`,
    )
    for (const a of list) {
      const prob = screen(a)
      console.log(`${prob.length ? '✗' : '✓'} r${a.run} ${a.id.padEnd(11)} ${a.answer.replace(/\s+/g, ' ').slice(0, 150)}${prob.length ? `   ← ${prob.join('; ')}` : ''}`)
    }
  }
}

if (process.argv[1]?.endsWith('score.ts')) main()
