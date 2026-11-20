/**
 * Typed access to the artifacts written by training/train_wait_model.ipynb.
 * They are small, so they are bundled with the site (no loading states needed).
 */
import metricsJson from '../data/metrics.json'
import testJson from '../data/test_predictions.json'
import gridJson from '../data/grid_predictions.json'
import cardJson from '../data/model_card.json'
import historyJson from '../data/training_history.json'

export interface RegressionMetrics {
  mae: number
  rmse: number
  r2: number
  within10: number
}

export type ModelKey = 'median_baseline' | 'linear' | 'ratio_formula' | 'nn'

export interface ModelEntry {
  label: string
  val: RegressionMetrics
  test: RegressionMetrics
  ci95: { mae: [number, number] }
  extra?: Record<string, unknown>
}

export interface ResidualBand {
  predMin: number
  predMax: number | null
  q10: number
  q90: number
  n: number
}

export interface GroupError {
  key: string | number
  n: number
  mae: number
  meanResidual: number
}

export interface Metrics {
  generatedAt: string
  dataset: {
    name: string
    source: string
    synthetic: boolean
    rows: number
    sha256: string
    meanWaitByStaff: Record<string, number>
    split: { train: number; val: number; test: number; seed: number; stratifiedBy: string }
  }
  target: { trainMedian: number; trainMean: number; trainStd: number }
  models: Record<ModelKey, ModelEntry>
  headline: {
    nnMae: number
    baselineMae: number
    linearMae: number
    maeReductionPct: number
    maeDiffCI95: [number, number]
    nnWithin10Pct: number
    nnR2: number
  }
  discovery: {
    scenario: { hour: number; day: string; dayIdx: number; queue: number }
    waitByStaff: { staff: number; pred: number }[]
    savings: { from: number; to: number; minutes: number }[]
    peakHours: number[]
    mondayLiftPct: number
    learnedMeanByHour: Record<string, number>
    learnedMeanByDay: Record<string, number>
  }
  residualBands: ResidualBand[]
  biggestMiss: {
    inputs: { hour: number; day: string; dayIdx: number; staff: number; queue: number }
    actual: number
    nn: number
    baseline: number
    ratioFormula: number
    error: number
    trainNeighbors: { n: number; mean: number; min: number; max: number }
    explanation: string
  }
  residualsBy: { hour: GroupError[]; day: GroupError[]; staff: GroupError[] }
}

export interface TestVisit {
  id: number
  hour: number
  day: number
  staff: number
  queue: number
  actual: number
  nn: number
  linear: number
  ratio: number
  baseline: number
}

export interface ModelCard {
  onnx: { file: string; opset: number; bytes: number }
  encoding: {
    hours: number[]
    dayLabels: string[]
    numeric: { staff: { mean: number; std: number }; queue: { mean: number; std: number } }
    target: { mean: number; std: number }
  }
  featureNames: string[]
  layers: { name: string; size: number; activation?: string }[]
  weightsForDiagram: { l1: number[][]; l2: number[][]; out: number[][] }
  training: {
    optimizer: string
    lr: number
    weightDecay: number
    batch: number
    bestEpoch: number
    epochsRun: number
    parameters: number
    sweep: { hidden: number[]; lr: number; weightDecay: number; valMae: number; bestEpoch: number }[]
  }
  versions: Record<string, string>
}

export const metrics = metricsJson as unknown as Metrics
export const modelCard = cardJson as unknown as ModelCard
export const trainingHistory = historyJson as { epoch: number[]; trainLoss: number[]; valMae: number[]; bestEpoch: number }
export const gridWait: readonly number[] = (gridJson as { wait: number[] }).wait

const cols = testJson.columns
const col = (name: string) => cols.indexOf(name)
export const testVisits: TestVisit[] = (testJson.rows as number[][]).map((r) => ({
  id: r[col('id')],
  hour: r[col('hour')],
  day: r[col('day')],
  staff: r[col('staff')],
  queue: r[col('queue')],
  actual: r[col('actual')],
  nn: r[col('nn')],
  linear: r[col('linear')],
  ratio: r[col('ratio')],
  baseline: r[col('baseline')],
}))
export const biggestMissId: number = testJson.biggestMissId

/** "Typical range" for a prediction: 10th–90th percentile of validation residuals in its size band. */
export function typicalRange(pred: number): [number, number] {
  const band =
    metrics.residualBands.find((b) => pred >= b.predMin && (b.predMax === null || pred < b.predMax)) ??
    metrics.residualBands[metrics.residualBands.length - 1]
  return [Math.max(0, pred + band.q10), pred + band.q90]
}

export const SITE_LINKS = {
  repo: 'https://github.com/cgwilson29/neural-network',
  notebook: 'https://github.com/cgwilson29/neural-network/blob/main/training/train_wait_model.ipynb',
  data: metrics.dataset.source,
  exercise: 'https://snsie.github.io/neural-networks/exercise.html',
  webllm: 'https://webllm.mlc.ai/',
}
