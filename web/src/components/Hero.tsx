import { lazy, Suspense, useMemo } from 'react'
import { DAYS, formatHour, HOURS, QUEUE_MAX, QUEUE_MIN, STAFF_MAX, STAFF_MIN } from '../lib/domain'
import { metrics, testVisits, typicalRange, type TestVisit } from '../lib/artifacts'
import { heatGradientCss } from '../lib/colors'
import type { CorePredictions } from '../lib/useCorePredictions'
import { useExhibit, type PointFilter } from '../state/store'
import { useMediaQuery } from '../lib/useMediaQuery'

const ObservatoryCanvas = lazy(() =>
  import('../three/ObservatoryCanvas').then((m) => ({ default: m.ObservatoryCanvas })),
)

const FILTERS: { id: PointFilter; label: string }[] = [
  { id: 'hour', label: 'Same hour' },
  { id: 'hourday', label: 'Hour + day' },
  { id: 'all', label: 'All' },
  { id: 'none', label: 'Hide' },
]

export function Hero({ core }: { core: CorePredictions }) {
  const { scenario, scenarioWait, plusOneWait, pinned, pinnedWait, surface, source } = core
  const setScenario = useExhibit((s) => s.setScenario)
  const pin = useExhibit((s) => s.pin)
  const clearPin = useExhibit((s) => s.clearPin)
  const pointFilter = useExhibit((s) => s.pointFilter)
  const setPointFilter = useExhibit((s) => s.setPointFilter)
  const focusId = useExhibit((s) => s.focusVisitId)
  const focusVisit = useExhibit((s) => s.focusVisit)
  const chatGenerating = useExhibit((s) => s.chatGenerating)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const coarsePointer = useMediaQuery('(pointer: coarse)')

  const visits = useMemo(() => {
    const keep = (v: TestVisit) =>
      v.id === focusId ||
      (pointFilter === 'all'
        ? true
        : pointFilter === 'hour'
          ? v.hour === scenario.hour
          : pointFilter === 'hourday'
            ? v.hour === scenario.hour && v.day === scenario.day
            : false)
    return testVisits.filter(keep)
  }, [pointFilter, scenario.hour, scenario.day, focusId])

  const [lo, hi] = typicalRange(scenarioWait)
  const saving = plusOneWait === null ? null : scenarioWait - plusOneWait
  const baseline = metrics.target.trainMedian

  const selectVisit = (v: TestVisit) => {
    focusVisit(v.id)
    setScenario({ hour: v.hour, day: v.day, staff: v.staff, queue: v.queue })
  }

  return (
    <section className="hero" id="explore" aria-labelledby="hero-title">
      <Suspense fallback={<div className="observatory-canvas" data-tour="map" aria-hidden="true" />}>
        <ObservatoryCanvas
          surface={surface}
          scenario={scenario}
          scenarioWait={scenarioWait}
          plusOneWait={plusOneWait}
          pinned={pinned}
          pinnedWait={pinnedWait}
          visits={visits}
          focusId={focusId}
          onSelectVisit={selectVisit}
          reducedMotion={reducedMotion}
          lowPower={chatGenerating || coarsePointer}
        />
      </Suspense>

      <div className="hero-panel">
        <div className="eyebrow">Clinic wait-time simulator · synthetic data</div>
        <h1 id="hero-title">How long is the wait?</h1>
        <p className="lede">
          A small neural network learned how staffing, queue length and time of day shape clinic waits. Set up a
          clinic and it predicts the wait live, in your browser.
        </p>

        <div className="readout" data-tour="readout" aria-live="polite">
          <div className="label">
            Predicted wait · {DAYS[scenario.day]} {formatHour(scenario.hour)}
          </div>
          <div className="figure">
            <span className="value">{Math.round(scenarioWait)}</span>
            <span className="unit">min</span>
          </div>
          <div className="range">
            Typical range {Math.round(lo)}–{Math.round(hi)} min{' '}
            <span title="80% of validation visits fell within this band around the prediction">ⓘ</span>
          </div>
          <div className="facts">
            <div className="fact">
              <span className="k">Median-guess baseline</span>
              <span className="v num">{baseline.toFixed(0)} min</span>
            </div>
            <div className="fact">
              <span className="k">{saving === null ? 'Already at max staff' : 'Add one more staff'}</span>
              <span className="v save num">{saving === null ? '—' : `saves ${saving.toFixed(0)} min`}</span>
            </div>
          </div>
        </div>

        <div className="controls">
          <div className="control">
            <div className="control-label" id="day-label">
              Day <span className="val">{DAYS[scenario.day]}</span>
            </div>
            <div className="segmented" role="group" aria-labelledby="day-label">
              {DAYS.map((d, i) => (
                <button key={d} aria-pressed={scenario.day === i} onClick={() => setScenario({ day: i })}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="control">
            <label htmlFor="hour">
              Hour <span className="val">{formatHour(scenario.hour)}</span>
            </label>
            <input
              id="hour"
              type="range"
              min={HOURS[0]}
              max={HOURS[HOURS.length - 1]}
              step={1}
              value={scenario.hour}
              aria-valuetext={formatHour(scenario.hour)}
              onChange={(e) => setScenario({ hour: Number(e.target.value) })}
            />
            <div className="ticks" aria-hidden="true">
              <span>8 am</span>
              <span>noon</span>
              <span>5 pm</span>
            </div>
          </div>
          <div className="control" data-tour="staff">
            <div className="control-label" id="staff-label">
              Staff on shift <span className="val">{scenario.staff}</span>
            </div>
            <div className="segmented" role="group" aria-labelledby="staff-label">
              {Array.from({ length: STAFF_MAX - STAFF_MIN + 1 }, (_, k) => STAFF_MIN + k).map((s) => (
                <button key={s} aria-pressed={scenario.staff === s} onClick={() => setScenario({ staff: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="control" data-tour="queue">
            <label htmlFor="queue">
              Patients in queue <span className="val">{scenario.queue}</span>
            </label>
            <input
              id="queue"
              type="range"
              min={QUEUE_MIN}
              max={QUEUE_MAX}
              step={1}
              value={scenario.queue}
              onChange={(e) => setScenario({ queue: Number(e.target.value) })}
            />
            <div className="ticks" aria-hidden="true">
              <span>0</span>
              <span>10</span>
              <span>20</span>
            </div>
          </div>
        </div>

        <div className="btn-row">
          {pinned ? (
            <button className="btn amber" data-tour="pin" onClick={clearPin}>
              <span className="glyph pinned" aria-hidden="true" /> Unpin comparison
            </button>
          ) : (
            <button className="btn amber" data-tour="pin" onClick={pin} title="Keep this scenario on the map, then change the controls to compare">
              <span className="glyph pinned" aria-hidden="true" /> Pin to compare
            </button>
          )}
          <a className="btn" href="#discovery">
            What did it learn? ↓
          </a>
        </div>
        <p className="source-note">
          {source === 'onnx'
            ? 'Computed by the trained network in your browser (ONNX Runtime Web).'
            : 'Showing the same network’s precomputed predictions while the in-browser runtime loads.'}
        </p>
      </div>

      <aside className="hero-legend" data-tour="legend" aria-label="Map legend">
        <strong style={{ color: 'var(--text-primary)' }}>Predicted wait (minutes)</strong>
        <div className="heatbar" style={{ background: heatGradientCss() }} aria-hidden="true" />
        <div className="ticks" aria-hidden="true">
          <span>0</span>
          <span>110</span>
          <span>220</span>
          <span>330</span>
        </div>
        <div className="legend-keys">
          <span>
            <i className="glyph contour" style={{ width: 18 }} /> Equal-wait contour, every 30 min
          </span>
          <span>
            <i className="glyph current" /> Your clinic · <i className="glyph ghost" /> with one more staff
          </span>
          {pinned && (
            <span>
              <i className="glyph pinned" /> Pinned scenario
            </span>
          )}
          <span>
            <i className="glyph visit" /> Test visit at its actual wait · stem = error
          </span>
        </div>
        <div className="control-label" id="filter-label" style={{ fontSize: 12 }}>
          Test visits shown
        </div>
        <div className="segmented" role="group" aria-labelledby="filter-label">
          {FILTERS.map((f) => (
            <button key={f.id} aria-pressed={pointFilter === f.id} onClick={() => setPointFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </aside>
      <div className="hint" aria-hidden="true">
        Drag to orbit · scroll to zoom · hover a dot for a real test visit
      </div>
    </section>
  )
}
