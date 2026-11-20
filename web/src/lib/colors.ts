import { interpolateInferno } from 'd3-scale-chromatic'
import { color as d3color } from 'd3-color'
import { WAIT_AXIS_MAX } from './domain'

/**
 * "Heat" ramp for wait minutes (semantic heat — the one multi-hue sequential exception; always
 * shown with a scale legend). The darkest end of inferno is clipped so short waits stay visible
 * on the dark surface.
 */
const T0 = 0.18
const T1 = 0.97
export function heatT(wait: number): number {
  return T0 + (T1 - T0) * Math.min(1, Math.max(0, wait / WAIT_AXIS_MAX))
}
export function heatCss(wait: number): string {
  return interpolateInferno(heatT(wait))
}
export function heatRgb(wait: number): [number, number, number] {
  const c = d3color(interpolateInferno(heatT(wait)))!.rgb()
  return [c.r / 255, c.g / 255, c.b / 255]
}
/** 256-entry RGB lookup table (0..1 floats) across 0..WAIT_AXIS_MAX, for per-vertex coloring. */
export const HEAT_LUT: Float32Array = (() => {
  const lut = new Float32Array(256 * 3)
  for (let k = 0; k < 256; k++) {
    const [r, g, b] = heatRgb((k / 255) * WAIT_AXIS_MAX)
    lut.set([r, g, b], k * 3)
  }
  return lut
})()
export function heatLutIndex(wait: number): number {
  return Math.min(255, Math.max(0, Math.round((wait / WAIT_AXIS_MAX) * 255))) * 3
}

export function heatGradientCss(steps = 12): string {
  const stops = Array.from({ length: steps + 1 }, (_, k) => {
    const w = (k / steps) * WAIT_AXIS_MAX
    return `${heatCss(w)} ${((k / steps) * 100).toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Validated series pair on the dark panel surface (dataviz validator: all checks pass). */
export const SERIES = {
  current: '#1fa6c0', // cyan — the visitor's scenario / the neural network
  pinned: '#cf7616', // amber — the pinned comparison scenario / the comparison model
}

/** Diverging pair for signed quantities (weights, residuals): cool ↔ warm with a gray midpoint. */
export const DIVERGING = { negative: '#3987e5', neutral: '#383d4a', positive: '#e0803a' }
