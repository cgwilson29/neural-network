import { DAYS } from '../lib/domain'
import { metrics } from '../lib/artifacts'
import type { CorePredictions } from '../lib/useCorePredictions'

/** Neon marquee under the top bar: live scenario + headline results (static in Calm mode). */
export function Ticker({ core }: { core: CorePredictions }) {
  const s = core.scenario
  const h = metrics.headline
  const items = [
    `LIVE ▸ ${DAYS[s.day].toUpperCase()} ${String(s.hour).padStart(2, '0')}:00 · ${s.staff} STAFF · ${s.queue} QUEUED → ${Math.round(core.scenarioWait)} MIN`,
    core.plusOneWait !== null ? `+1 STAFF → ${Math.round(core.plusOneWait)} MIN` : 'MAX STAFF',
    `NET MAE ${h.nnMae.toFixed(2)} MIN`,
    `MEDIAN BASELINE ${h.baselineMae.toFixed(2)} MIN`,
    `ERROR −${h.maeReductionPct.toFixed(0)}%`,
    `R² ${h.nnR2.toFixed(3)}`,
    `TEST SET 300 VISITS · SYNTHETIC DATA`,
    `ONNX RUNTIME WEB · 433 WEIGHTS`,
  ]
  const line = items.join('   ◆   ')
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <span>{line}   ◆   </span>
        <span>{line}   ◆   </span>
      </div>
    </div>
  )
}
