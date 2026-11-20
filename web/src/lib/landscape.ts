/**
 * Geometry for the 3-D "wait landscape".
 *
 * The network is only ever evaluated at real settings (whole staff, whole queue). The smooth surface
 * between those points is a shape-preserving (monotone cubic, Fritsch–Carlson) interpolation of the
 * network's own predictions — it never invents bumps the network didn't predict.
 */
import { QUEUE_MAX, QUEUE_MIN, STAFF_MAX, STAFF_MIN, WAIT_AXIS_MAX } from './domain'

export const NS = 41 // staff samples (1.0 .. 5.0 in 0.1 steps)
export const NQ = 81 // queue samples (0 .. 20 in 0.25 steps)
export const CONTOUR_STEP = 30 // minutes between equal-wait lines

/** World-space mapping. x = staff (1 left → 5 right), z = queue (0 front → 20 back), y = predicted wait. */
export const WORLD = {
  xHalf: 3,
  zHalf: 4,
  height: 3.2,
  x: (staff: number) => ((staff - (STAFF_MIN + STAFF_MAX) / 2) / ((STAFF_MAX - STAFF_MIN) / 2)) * 3,
  z: (queue: number) => -((queue - (QUEUE_MIN + QUEUE_MAX) / 2) / ((QUEUE_MAX - QUEUE_MIN) / 2)) * 4,
  y: (wait: number) => (Math.max(0, wait) / WAIT_AXIS_MAX) * 3.2,
}

/** Monotone cubic Hermite interpolation of evenly spaced samples ys at fractional index t. */
export function monotoneTangents(ys: ArrayLike<number>): Float64Array {
  const n = ys.length
  const d = new Float64Array(n - 1)
  for (let i = 0; i < n - 1; i++) d[i] = ys[i + 1] - ys[i]
  const m = new Float64Array(n)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * a * d[i]
      m[i + 1] = tau * b * d[i]
    }
  }
  return m
}

export function monotoneAt(ys: ArrayLike<number>, m: ArrayLike<number>, t: number): number {
  const n = ys.length
  if (t <= 0) return ys[0]
  if (t >= n - 1) return ys[n - 1]
  const i = Math.floor(t)
  const u = t - i
  const h00 = (1 + 2 * u) * (1 - u) * (1 - u)
  const h10 = u * (1 - u) * (1 - u)
  const h01 = u * u * (3 - 2 * u)
  const h11 = u * u * (u - 1)
  return h00 * ys[i] + h10 * m[i] + h01 * ys[i + 1] + h11 * m[i + 1]
}

/**
 * Dense NS × NQ grid (index j * NS + i; i = staff sample, j = queue sample) from the network's
 * 5 × 21 predictions given staff-major (staff 1..5 outer, queue 0..20 inner).
 */
export function densify(coarse: ArrayLike<number>): Float32Array {
  const S = STAFF_MAX - STAFF_MIN + 1
  const Q = QUEUE_MAX - QUEUE_MIN + 1
  // 1) along staff, for each whole queue value
  const mid = new Float64Array(Q * NS)
  const col = new Float64Array(S)
  for (let q = 0; q < Q; q++) {
    for (let s = 0; s < S; s++) col[s] = coarse[s * Q + q]
    const m = monotoneTangents(col)
    for (let i = 0; i < NS; i++) mid[q * NS + i] = monotoneAt(col, m, (i / (NS - 1)) * (S - 1))
  }
  // 2) along queue, for each staff sample
  const out = new Float32Array(NS * NQ)
  const row = new Float64Array(Q)
  for (let i = 0; i < NS; i++) {
    for (let q = 0; q < Q; q++) row[q] = mid[q * NS + i]
    const m = monotoneTangents(row)
    for (let j = 0; j < NQ; j++) out[j * NS + i] = Math.max(0, monotoneAt(row, m, (j / (NQ - 1)) * (Q - 1)))
  }
  return out
}

export const staffAtSample = (i: number) => STAFF_MIN + (i / (NS - 1)) * (STAFF_MAX - STAFF_MIN)
export const queueAtSample = (j: number) => QUEUE_MIN + (j / (NQ - 1)) * (QUEUE_MAX - QUEUE_MIN)

/**
 * Marching squares: line segments where the dense grid crosses `level`.
 * Returns a flat array [i0, j0, i1, j1, ...] in fractional sample coordinates.
 */
export function contourSegments(values: ArrayLike<number>, nx: number, ny: number, level: number): number[] {
  const segs: number[] = []
  const v = (i: number, j: number) => values[j * nx + i]
  const lerp = (a: number, b: number) => (level - a) / (b - a)
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j) // (i, j)
      const b = v(i + 1, j) // (i+1, j)
      const c = v(i + 1, j + 1) // (i+1, j+1)
      const d = v(i, j + 1) // (i, j+1)
      const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0)
      if (code === 0 || code === 15) continue
      // edge crossing points
      const top = () => [i + lerp(a, b), j] // a–b
      const right = () => [i + 1, j + lerp(b, c)] // b–c
      const bottom = () => [i + lerp(d, c), j + 1] // d–c
      const left = () => [i, j + lerp(a, d)] // a–d
      const push = (p: number[], q: number[]) => segs.push(p[0], p[1], q[0], q[1])
      switch (code) {
        case 1:
        case 14:
          push(left(), bottom())
          break
        case 2:
        case 13:
          push(bottom(), right())
          break
        case 3:
        case 12:
          push(left(), right())
          break
        case 4:
        case 11:
          push(top(), right())
          break
        case 6:
        case 9:
          push(top(), bottom())
          break
        case 7:
        case 8:
          push(left(), top())
          break
        case 5:
        case 10: {
          const center = (a + b + c + d) / 4
          const centerHigh = center >= level
          if ((code === 5) === centerHigh) {
            push(left(), top())
            push(bottom(), right())
          } else {
            push(left(), bottom())
            push(top(), right())
          }
          break
        }
      }
    }
  }
  return segs
}

export function contourLevels(maxWait: number): number[] {
  const levels: number[] = []
  for (let t = CONTOUR_STEP; t < maxWait; t += CONTOUR_STEP) levels.push(t)
  return levels
}
