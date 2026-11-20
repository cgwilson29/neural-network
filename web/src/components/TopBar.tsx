import { SITE_LINKS } from '../lib/artifacts'
import { useExhibit } from '../state/store'
import { useTour } from '../tour/useTour'

export function ContourMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="cm" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fcffa4" />
          <stop offset="0.45" stopColor="#f98e09" />
          <stop offset="1" stopColor="#57106e" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="#0b1222" stroke="rgba(160,185,230,.25)" />
      <path d="M5 21c4-1 6-6 11-6s7 5 11 6" fill="none" stroke="#5fe0f2" strokeWidth="1.4" opacity=".55" />
      <path d="M8 18c3-1 4.5-5 8-5s5 4 8 5" fill="none" stroke="#5fe0f2" strokeWidth="1.4" opacity=".8" />
      <circle cx="16" cy="13" r="3.2" fill="url(#cm)" />
    </svg>
  )
}

export function TopBar() {
  const modelStatus = useExhibit((s) => s.modelStatus)
  const startTour = useTour((s) => s.start)
  const statusText =
    modelStatus === 'ready' ? 'Network running in browser' : modelStatus === 'loading' ? 'Loading network…' : 'Precomputed mode'
  return (
    <header className="topbar">
      <a className="wordmark" href="#explore">
        <ContourMark />
        Queue Cartography
      </a>
      <nav className="topnav" aria-label="Sections">
        <a href="#explore">Explore</a>
        <a href="#discovery">Discovery</a>
        <a href="#evaluation">How good is it?</a>
        <a href="#xray">Inside the network</a>
        <a href="#guide">Guide</a>
      </nav>
      <span className="spacer" />
      <button className="chip tour-btn" onClick={startTour} aria-label="Start the guided tour">
        <span aria-hidden="true">✦</span> Tour
      </button>
      <span className="chip" title="All 2,000 visits in the dataset are simulated">
        Synthetic data
      </span>
      <span className="chip model" role="status">
        <span className={`dot ${modelStatus === 'ready' ? 'ok' : modelStatus === 'loading' ? 'wait' : ''}`} />
        {statusText}
      </span>
      <nav className="toplinks" aria-label="Project links">
        <a href={SITE_LINKS.repo} target="_blank" rel="noreferrer">
          Source
        </a>
        <a href={SITE_LINKS.notebook} target="_blank" rel="noreferrer">
          Notebook
        </a>
      </nav>
    </header>
  )
}
