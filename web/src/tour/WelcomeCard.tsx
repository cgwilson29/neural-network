import { useEffect, useRef } from 'react'
import { useTour } from './useTour'
import { ContourMark } from '../components/TopBar'

/** First-visit welcome card: opt in to the tour, or explore alone. */
export function WelcomeCard() {
  const welcome = useTour((s) => s.welcome)
  const start = useTour((s) => s.start)
  const dismiss = useTour((s) => s.dismissWelcome)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!welcome) return
    primary.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [welcome, dismiss])

  if (!welcome) return null
  return (
    <div className="welcome" role="dialog" aria-modal="false" aria-labelledby="welcome-title" aria-describedby="welcome-body">
      <div className="welcome-head">
        <ContourMark size={34} />
        <h2 id="welcome-title">Welcome to Queue Cartography</h2>
      </div>
      <p id="welcome-body">
        A small neural network learned how staffing and queue length shape clinic wait times. Take a one-minute tour? You’ll
        try the controls as you go.
      </p>
      <div className="btn-row">
        <button ref={primary} className="btn primary" onClick={start}>
          Take the 60-second tour
        </button>
        <button className="btn" onClick={dismiss}>
          Explore on my own
        </button>
      </div>
      <p className="meta">You can start the tour any time from “Tour” at the top of the page.</p>
    </div>
  )
}
