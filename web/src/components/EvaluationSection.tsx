import { MetricsBars } from './charts/MetricsBars'
import { PredVsActualScatter } from './charts/PredVsActualScatter'
import { ResidualStrip } from './charts/ResidualStrip'
import { TrainingCurveChart } from './charts/TrainingCurveChart'
import { BiggestMissCard } from './BiggestMissCard'
import { metrics, modelCard } from '../lib/artifacts'
import { useLoadVisit } from '../lib/useLoadVisit'

export function EvaluationSection() {
  const h = metrics.headline
  const split = metrics.dataset.split
  const loadVisit = useLoadVisit()
  const [lo, hi] = metrics.models.nn.ci95.mae

  return (
    <section className="section" id="evaluation" aria-labelledby="evaluation-title">
      <div className="section-head">
        <div className="eyebrow">How good is it?</div>
        <h2 id="evaluation-title">Off by about {h.nnMae.toFixed(1)} minutes, versus {h.baselineMae.toFixed(0)} for a simple guess</h2>
        <p>
          The {metrics.dataset.rows.toLocaleString()} visits were split {split.train.toLocaleString()} / {split.val} /{' '}
          {split.test}. The network learned from the first group, its size and stopping point were chosen with the
          second, and the last <strong>{split.test} visits were locked away</strong> until one final check. Every number
          below comes from that held-out test set.
        </p>
      </div>

      <div className="tiles">
        <div className="tile emph">
          <div className="k">Neural network error</div>
          <div className="v num">
            {h.nnMae.toFixed(1)} <small>min</small>
          </div>
          <div className="d">
            average miss · 95% CI {lo.toFixed(1)}–{hi.toFixed(1)}
          </div>
        </div>
        <div className="tile">
          <div className="k">Median baseline error</div>
          <div className="v num">
            {h.baselineMae.toFixed(1)} <small>min</small>
          </div>
          <div className="d">always guess {metrics.target.trainMedian.toFixed(1)} min</div>
        </div>
        <div className="tile">
          <div className="k">Error reduction</div>
          <div className="v num">{h.maeReductionPct.toFixed(0)}%</div>
          <div className="d">network vs median baseline</div>
        </div>
        <div className="tile">
          <div className="k">Within ±10 minutes</div>
          <div className="v num">{h.nnWithin10Pct.toFixed(0)}%</div>
          <div className="d">of test visits (network)</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Four ways to predict a wait</h3>
        <p className="sub">
          Lower is better. Whiskers are bootstrap 95% intervals. The straight-line model can’t bend into the “÷ staff”
          curve, and the network even beats the queue ÷ staff formula because it also learned the hour and weekday
          effects.
        </p>
        <MetricsBars />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Every test visit: predicted vs actual</h3>
          <p className="sub">Switch models to see the difference a curve makes.</p>
          <PredVsActualScatter onSelect={loadVisit} />
        </div>
        <div className="card">
          <h3>Are the errors patterned?</h3>
          <p className="sub">
            Each dot is one test visit’s error. They scatter evenly around zero for every staffing level, hour and day,
            so what’s left looks like random noise rather than a pattern the network missed.
          </p>
          <ResidualStrip />
          <h3 style={{ marginTop: 22 }}>How training went</h3>
          <p className="sub">
            {modelCard.training.parameters} weights, trained with Adam; stopped early when validation error stopped
            improving, keeping the best epoch.
          </p>
          <TrainingCurveChart />
        </div>
      </div>

      <BiggestMissCard />
    </section>
  )
}
