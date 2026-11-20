import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { SITE_LINKS } from '../lib/artifacts'
import { useExhibit } from '../state/store'
import { useTour } from '../tour/useTour'
import { useFx } from '../fx/useFx'

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

export function TopBar({ ticker }: { ticker?: ReactNode }) {
  const modelStatus = useExhibit((s) => s.modelStatus)
  const calm = useFx((s) => s.calm)
  const setCalm = useFx((s) => s.setCalm)
  const music = useFx((s) => s.music)
  const setMusic = useFx((s) => s.setMusic)
  const volume = useFx((s) => s.volume)
  const setVolume = useFx((s) => s.setVolume)
  const startTour = useTour((s) => s.start)
  const bar = useRef<HTMLElement>(null)

  // Publish the bar's real height so the guide-bot button and panel always sit just below it.
  useLayoutEffect(() => {
    const el = bar.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const statusText =
    modelStatus === 'ready' ? 'NET:ONLINE · in browser' : modelStatus === 'loading' ? 'NET:LINKING…' : 'NET:PRECOMPUTED'
  return (
    <header className="topbar" ref={bar}>
      <div className="topbar-row">
        <a className="wordmark" href="#explore">
          <ContourMark />
          <span className="wordmark-text">Queue Cartography</span>
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
          <span aria-hidden="true">✦</span> <span className="tour-label">Tour</span>
        </button>
        <button
          className="chip fx-btn"
          aria-pressed={!calm}
          aria-label={calm ? 'Visual effects: calm. Turn effects on' : 'Visual effects: on. Switch to calm mode'}
          title={calm ? 'Effects calm: no glitches, rain or marquee' : 'Effects on: click for calm mode'}
          onClick={() => setCalm(!calm)}
        >
          <span aria-hidden="true">◈</span> FX {calm ? 'CALM' : 'ON'}
        </button>
        <span className="music-ctl">
          <button
            className="chip music-btn"
            aria-pressed={music}
            aria-label={music ? 'Soundtrack on. Turn it off' : 'Soundtrack off. Turn it on'}
            title="Soundtrack: “Neon Cartography”, an original synthwave loop generated live in your browser"
            onClick={() => setMusic(!music)}
          >
            <span aria-hidden="true">♫</span> {music ? 'ON' : 'OFF'}
          </button>
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Soundtrack volume"
            disabled={!music}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </span>
        <span className="chip synthetic" title="All 2,000 visits in the dataset are simulated">
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
      </div>
      {ticker}
    </header>
  )
}
