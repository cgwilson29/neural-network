/**
 * Page-level cyberpunk layers: CRT scanlines + vignette, data rain, random heading glitches.
 * Every animated part is off in Calm mode and under prefers-reduced-motion.
 */
import { useEffect, useRef } from 'react'
import { useFxActive } from './useFx'
import { useExhibit } from '../state/store'
import { metrics } from '../lib/artifacts'

/** Marks <html> so CSS can gate all animations on one class. */
export function FxRoot() {
  const active = useFxActive()
  useEffect(() => {
    document.documentElement.classList.toggle('fx-active', active)
  }, [active])
  return null
}

export function ScanlineOverlay() {
  return (
    <div className="fx-overlay" aria-hidden="true">
      <div className="fx-scanlines" />
      <div className="fx-vignette" />
    </div>
  )
}

const GLYPHS = [
  ...'0123456789.%Δ∑μ/<>[]{}:=+−'.split(''),
  ...`${metrics.headline.nnMae} ${metrics.headline.baselineMae} 433 ONNX MAE R2 ${metrics.headline.nnR2}`.split(''),
]

/** Falling columns of data glyphs (numbers from the real results) behind the page sections. */
export function DataRain() {
  const active = useFxActive()
  const chatBusy = useExhibit((s) => s.chatGenerating)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c || !active) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const size = 15
    let cols: number[] = []
    let raf = 0
    let last = 0
    const resize = () => {
      c.width = Math.floor(window.innerWidth)
      c.height = Math.floor(window.innerHeight)
      const n = Math.ceil(c.width / size)
      cols = Array.from({ length: n }, () => Math.random() * -60)
    }
    resize()
    window.addEventListener('resize', resize)
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden || useExhibit.getState().chatGenerating) return
      if (t - last < (coarse ? 66 : 33)) return // ~30 fps (15 on touch)
      last = t
      ctx.fillStyle = 'rgba(4, 5, 10, 0.16)'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.font = `${size - 2}px "JetBrains Mono", monospace`
      for (let i = 0; i < cols.length; i++) {
        if (Math.random() < 0.55) continue // sparse
        const y = cols[i] * size
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
        ctx.fillStyle = Math.random() < 0.06 ? 'rgba(232, 255, 58, 0.9)' : 'rgba(0, 240, 255, 0.55)'
        ctx.fillText(ch, i * size, y)
        cols[i] = y > c.height && Math.random() > 0.975 ? 0 : cols[i] + 1
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, c.width, c.height)
    }
  }, [active, chatBusy])

  if (!active) return null
  return <canvas ref={canvas} className="fx-rain" aria-hidden="true" />
}

const GLITCH_TARGETS = '.hero-panel h1, .section-head h2, .wordmark-text'

/** Every 4–9 s, one visible heading glitches for ~0.45 s (well under the 3-flashes-per-second limit). */
export function useRandomGlitch() {
  const active = useFxActive()
  useEffect(() => {
    if (!active) return
    let timer = 0
    const tick = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(GLITCH_TARGETS)).filter((el) => {
        const r = el.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight
      })
      const el = els[(Math.random() * els.length) | 0]
      if (el && !document.hidden) glitchOnce(el)
      timer = window.setTimeout(tick, 4000 + Math.random() * 5000)
    }
    timer = window.setTimeout(tick, 2500)
    return () => window.clearTimeout(timer)
  }, [active])
}

export function glitchOnce(el: HTMLElement, ms = 450) {
  if (!document.documentElement.classList.contains('fx-active')) return
  el.dataset.text = el.textContent ?? ''
  el.classList.add('glitch', 'glitching')
  window.setTimeout(() => el.classList.remove('glitching'), ms)
}
