/**
 * The site guide: the single source of truth for the chatbot's context and the "Guide" section.
 * Every number is filled from the training notebook's metrics.json, so the two can never disagree.
 */
import guideTemplate from './guide.md?raw'
import { metrics, modelCard } from '../lib/artifacts'
import { DAY_NAMES, formatHour } from '../lib/domain'

const f1 = (x: number) => x.toFixed(1)
const f0 = (x: number) => x.toFixed(0)

export function guideTokens(): Record<string, string> {
  const m = metrics
  const d = m.discovery
  const w = Object.fromEntries(d.waitByStaff.map((r) => [r.staff, r.pred]))
  const miss = m.biggestMiss
  const peaks = d.peakHours.map(formatHour)
  return {
    dataSource: m.dataset.source,
    rows: m.dataset.rows.toLocaleString('en-US'),
    parameters: String(modelCard.training.parameters),
    train: m.dataset.split.train.toLocaleString('en-US'),
    val: String(m.dataset.split.val),
    test: String(m.dataset.split.test),
    nnMae: m.models.nn.test.mae.toFixed(2),
    nnLo: f1(m.models.nn.ci95.mae[0]),
    nnHi: f1(m.models.nn.ci95.mae[1]),
    median: f1(m.target.trainMedian),
    baselineMae: m.models.median_baseline.test.mae.toFixed(2),
    linearMae: m.models.linear.test.mae.toFixed(2),
    ratioMae: m.models.ratio_formula.test.mae.toFixed(2),
    reductionPct: f0(m.headline.maeReductionPct),
    within10: f0(m.headline.nnWithin10Pct),
    over10: f0(100 - m.headline.nnWithin10Pct),
    r2: m.headline.nnR2.toFixed(3),
    w1: f0(w[1]),
    w2: f0(w[2]),
    w3: f0(w[3]),
    w4: f0(w[4]),
    w5: f0(w[5]),
    s12: f0(d.savings[0].minutes),
    s45: f0(d.savings[3].minutes),
    peakHours: peaks.length === 4 ? `${peaks[0]}–${peaks[1]} and ${peaks[2]}–${peaks[3]}` : peaks.join(', '),
    mondayPct: f0(d.mondayLiftPct),
    missDay: DAY_NAMES[miss.inputs.dayIdx],
    missHour: formatHour(miss.inputs.hour),
    missStaff: String(miss.inputs.staff),
    missQueue: String(miss.inputs.queue),
    missActual: f1(miss.actual),
    missNn: f1(miss.nn),
    missN: String(miss.trainNeighbors.n),
    missMin: f1(miss.trainNeighbors.min),
    missMax: f1(miss.trainNeighbors.max),
  }
}

export function renderGuide(template: string = guideTemplate, tokens = guideTokens()): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => tokens[key] ?? whole).trim()
}

export const GUIDE_TEXT = renderGuide()
