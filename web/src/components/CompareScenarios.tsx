import { DAYS, describeScenario, formatHour, type Scenario } from '../lib/domain'
import type { CorePredictions } from '../lib/useCorePredictions'
import { useExhibit } from '../state/store'

function Side({ who, s, wait, kind }: { who: string; s: Scenario; wait: number; kind: 'pinned' | 'current' }) {
  return (
    <div className={`side ${kind}`}>
      <div className="who">
        <i className={`glyph ${kind === 'pinned' ? 'pinned' : 'current'}`} aria-hidden="true" /> {who}
      </div>
      <div className="big num">{Math.round(wait)} min</div>
      <div className="desc">
        {DAYS[s.day]} {formatHour(s.hour)} · {s.staff} staff · {s.queue} queued
      </div>
    </div>
  )
}

export function CompareScenarios({ core }: { core: CorePredictions }) {
  const pin = useExhibit((s) => s.pin)
  const clearPin = useExhibit((s) => s.clearPin)
  const setScenario = useExhibit((s) => s.setScenario)
  const { pinned, pinnedWait, scenario, scenarioWait } = core

  if (!pinned || pinnedWait === null) {
    return (
      <div>
        <p className="callout">
          Right now: <strong>{describeScenario(scenario)}</strong> → <strong>{Math.round(scenarioWait)} min</strong>.
          Pin it, then try adding staff or moving to a quieter hour to see the difference.
        </p>
        <div className="btn-row">
          <button className="btn amber" onClick={pin}>
            <span className="glyph pinned" aria-hidden="true" /> Pin this scenario
          </button>
        </div>
      </div>
    )
  }

  const diff = scenarioWait - pinnedWait
  return (
    <div>
      <div className="compare" aria-live="polite">
        <Side who="Pinned" s={pinned} wait={pinnedWait} kind="pinned" />
        <div className="delta">
          <div>
            <strong className="num">
              {diff <= 0 ? '−' : '+'}
              {Math.abs(diff).toFixed(0)} min
            </strong>
            {diff <= 0 ? 'shorter now' : 'longer now'}
          </div>
        </div>
        <Side who="Current" s={scenario} wait={scenarioWait} kind="current" />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => setScenario(pinned)}>
          Go back to pinned
        </button>
        <button className="btn" onClick={clearPin}>
          Unpin
        </button>
      </div>
    </div>
  )
}
