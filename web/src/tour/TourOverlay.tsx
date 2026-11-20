import { useEffect, useRef, useState } from 'react'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { TOUR_STEPS } from './steps'
import { useTour } from './useTour'
import { useExhibit } from '../state/store'
import { useMediaQuery } from '../lib/useMediaQuery'
import type { CorePredictions } from '../lib/useCorePredictions'

type Exhibit = ReturnType<typeof useExhibit.getState>
const PAD = 8

/**
 * Spotlight + popover for the current tour step. Non-modal on purpose: the page stays interactive so
 * visitors can do what a step asks (drag the map, click a staff button…).
 */
export function TourOverlay({ core }: { core: CorePredictions }) {
  const step = useTour((s) => s.step)
  const next = useTour((s) => s.next)
  const back = useTour((s) => s.back)
  const end = useTour((s) => s.end)
  const setChatOpen = useExhibit((s) => s.setChatOpen)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const phone = useMediaQuery('(max-width: 640px)')
  const popRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const startSnap = useRef<Exhibit | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [done, setDone] = useState(false)
  const def = step !== null ? TOUR_STEPS[step] : null

  // Enter a step: run its setup, remember the starting state, bring the target into view.
  useEffect(() => {
    if (!def) return
    def.onEnter?.()
    startSnap.current = useExhibit.getState()
    setDone(false)
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
    const el = document.querySelector(def.target)
    if (phone && el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70
      window.scrollTo({ top: Math.max(0, top), behavior })
    } else if (def.scroll === 'top') window.scrollTo({ top: 0, behavior })
    else el?.scrollIntoView({ block: def.scroll === 'start' ? 'start' : 'center', behavior })
    const id = window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), reduced ? 0 : 350)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Learn-by-doing: watch the exhibit state for the step's action.
  useEffect(() => {
    if (!def?.action) return
    const action = def.action
    return useExhibit.subscribe((s) => {
      if (startSnap.current && action.done(s, startSnap.current)) setDone(true)
    })
  }, [def])

  // Track the target's position every frame (it moves with scrolling and layout).
  useEffect(() => {
    if (!def) return
    let raf = 0
    let last = ''
    const loop = () => {
      const el = document.querySelector(def.target)
      if (el) {
        const r = el.getBoundingClientRect()
        const k = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`
        if (k !== last) {
          last = k
          setRect(r)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [def])

  // Position the popover next to the target (unless docked).
  useEffect(() => {
    const pop = popRef.current
    if (!def || !pop || def.dock || phone) return
    const el = document.querySelector(def.target)
    if (!el) return
    return autoUpdate(el, pop, () => {
      computePosition(el, pop, {
        placement: def.placement ?? 'bottom',
        strategy: 'fixed',
        middleware: [offset(PAD + 10), flip({ padding: 12 }), shift({ padding: 12 })],
      }).then(({ x, y }) => {
        pop.style.left = `${x}px`
        pop.style.top = `${y}px`
      })
    })
  }, [def, phone])

  // Keyboard: Esc ends, ←/→ navigate (not while typing in a field).
  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
      if (e.key === 'Escape') end(false)
      else if (!typing && e.key === 'ArrowRight') next()
      else if (!typing && e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, next, back, end])

  if (!def || step === null) return null
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1
  const huge = !!rect && (rect.width * rect.height) / (vw * vh) > 0.6
  const docked = def.dock || phone
  const hole = rect && !huge ? { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + 2 * PAD, h: rect.height + 2 * PAD } : null

  return (
    <>
      {!huge && (
        <svg className="tour-shade" aria-hidden="true">
          <defs>
            <mask id="tour-hole">
              <rect width="100%" height="100%" fill="white" />
              {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={14} fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(2,5,11,0.62)" mask="url(#tour-hole)" />
        </svg>
      )}
      {hole && <div className="tour-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} aria-hidden="true" />}
      <div
        ref={popRef}
        className={`tour-pop${docked ? ' docked' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <div className="tour-progress" aria-label={`Step ${step + 1} of ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? 'on' : i < step ? 'past' : ''} />
          ))}
          <span className="tour-count">
            {step + 1} / {TOUR_STEPS.length}
          </span>
        </div>
        <h3 id="tour-title" ref={titleRef} tabIndex={-1}>
          {def.title}
        </h3>
        <div id="tour-body" className="tour-body">
          {def.body(core)}
        </div>
        {def.action &&
          (done ? (
            <p className="tour-done" aria-live="polite">
              ✓ {def.action.doneText(core, startSnap.current ?? useExhibit.getState())}
            </p>
          ) : (
            <p className="tour-hint">{def.action.hint}</p>
          ))}
        <div className="tour-actions">
          <button className="link-btn" onClick={() => end(false)}>
            End tour
          </button>
          <span className="spacer" />
          {step > 0 && (
            <button className="btn" onClick={back}>
              Back
            </button>
          )}
          {def.final ? (
            <>
              <button className="btn" onClick={() => end(true)}>
                Finish
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  end(true)
                  setChatOpen(true)
                }}
              >
                Open guide bot
              </button>
            </>
          ) : def.action && !done ? (
            <button className="btn" onClick={next}>
              Skip this step
            </button>
          ) : (
            <button className="btn primary" onClick={next}>
              Next
            </button>
          )}
        </div>
      </div>
    </>
  )
}
