/**
 * The ONNX file the browser runs must reproduce the Python model exactly.
 * onnxruntime-node uses the same ONNX Runtime engine as onnxruntime-web.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, beforeAll } from 'vitest'
import * as ort from 'onnxruntime-node'
import testJson from '../src/data/test_predictions.json'
import gridJson from '../src/data/grid_predictions.json'
import fixtures from './fixtures/parity_fixtures.json'

const MODEL = fileURLToPath(new URL('../public/model/wait_mlp.onnx', import.meta.url))
let session: ort.InferenceSession

async function run(rows: number[][]) {
  const data = Float32Array.from(rows.flat())
  const out = await session.run({ x: new ort.Tensor('float32', data, [rows.length, 4]) })
  return {
    wait: Array.from(out.wait_minutes.data as Float32Array),
    h1: out.h1,
    h2: out.h2,
  }
}

beforeAll(async () => {
  session = await ort.InferenceSession.create(readFileSync(MODEL))
})

describe('ONNX model parity', () => {
  it('has the expected inputs and outputs', () => {
    expect(session.inputNames).toEqual(['x'])
    expect(session.outputNames).toEqual(['wait_minutes', 'h1', 'h2'])
  })

  it('matches the notebook’s test-set predictions (rounded to 0.01 min)', async () => {
    const c = testJson.columns
    const rows = testJson.rows.map((r) => [r[c.indexOf('hour')], r[c.indexOf('day')], r[c.indexOf('staff')], r[c.indexOf('queue')]])
    const { wait } = await run(rows)
    testJson.rows.forEach((r, i) => expect(Math.abs(wait[i] - r[c.indexOf('nn')])).toBeLessThan(0.006))
  })

  it('matches the precomputed grid used as the fallback', async () => {
    const rows: number[][] = []
    for (const h of gridJson.hours) for (let d = 0; d < 5; d++) for (const s of gridJson.staff) for (const q of gridJson.queue) rows.push([h, d, s, q])
    const { wait } = await run(rows)
    expect(wait.length).toBe(5250)
    wait.forEach((w, i) => expect(Math.abs(w - gridJson.wait[i])).toBeLessThan(0.006))
  })

  it('reproduces Python’s hidden activations on edge cases', async () => {
    const { wait, h1, h2 } = await run(fixtures.inputs)
    const n1 = Number(h1.dims[1])
    const n2 = Number(h2.dims[1])
    const a1 = h1.data as Float32Array
    const a2 = h2.data as Float32Array
    fixtures.inputs.forEach((_, i) => {
      expect(Math.abs(wait[i] - fixtures.wait[i])).toBeLessThan(1e-4)
      for (let j = 0; j < n1; j++) expect(Math.abs(a1[i * n1 + j] - fixtures.h1[i][j])).toBeLessThan(1e-4)
      for (let j = 0; j < n2; j++) expect(Math.abs(a2[i * n2 + j] - fixtures.h2[i][j])).toBeLessThan(1e-4)
    })
  })

  it('never predicts a negative wait', async () => {
    const { wait } = await run([[8, 4, 5, 0], [17, 0, 1, 20]])
    wait.forEach((w) => expect(w).toBeGreaterThanOrEqual(0))
  })
})
