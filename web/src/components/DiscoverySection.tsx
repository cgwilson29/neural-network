import { StaffingCurveChart } from './charts/StaffingCurveChart'
import { MarginalSavingsChart } from './charts/MarginalSavingsChart'
import { WeekHeatmap } from './charts/WeekHeatmap'
import { CompareScenarios } from './CompareScenarios'
import { DAY_NAMES, formatHour } from '../lib/domain'
import { metrics } from '../lib/artifacts'
import type { CorePredictions } from '../lib/useCorePredictions'
import { useExhibit } from '../state/store'

export function DiscoverySection({ core }: { core: CorePredictions }) {
  const { scenario, staffCurve } = core
  const setScenario = useExhibit((s) => s.setScenario)
  const first = staffCurve[0] - staffCurve[1]
  const last = staffCurve[3] - staffCurve[4]
  const d = metrics.discovery
  const peaks = d.peakHours.map(formatHour).join(', ')

  return (
    <section className="section" id="discovery" aria-labelledby="discovery-title">
      <div className="section-head">
        <div className="eyebrow">The discovery</div>
        <h2 id="discovery-title">The second staff member is worth far more than the fifth</h2>
        <p>
          The network was never told that waits depend on <em>queue ÷ staff</em>. It worked that out from the
          examples alone, and the result is a curve with diminishing returns. With{' '}
          <strong>{scenario.queue} patients waiting</strong> on {DAY_NAMES[scenario.day]} at {formatHour(scenario.hour)},
          going from 1 to 2 staff saves about <strong>{first.toFixed(0)} minutes</strong>; going from 4 to 5 saves about{' '}
          <strong>{last.toFixed(0)}</strong>.
        </p>
      </div>

      <div className="grid-2">
        <div className="card" data-tour="discovery-curve">
          <h3>Predicted wait as staff are added</h3>
          <p className="sub">
            Same hour, weekday and queue as your clinic; the line is labeled with minutes saved at each step. Click a
            point to try it on the map.
          </p>
          <StaffingCurveChart curve={staffCurve} currentStaff={scenario.staff} onPick={(staff) => setScenario({ staff })} />
        </div>
        <div className="card">
          <h3>Minutes saved by each added staff member</h3>
          <p className="sub">
            Each bar is one more person on shift. The highlighted bar is the next hire from your current setting.
          </p>
          <MarginalSavingsChart curve={staffCurve} currentStaff={scenario.staff} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Compare two clinics</h3>
          <p className="sub">Pin a scenario, then change the controls. Both appear on the map.</p>
          <CompareScenarios core={core} />
        </div>
        <div className="card">
          <h3>When does the same clinic run longest?</h3>
          <p className="sub">
            {scenario.staff} staff, {scenario.queue} queued, every hour and weekday. The network also learned that{' '}
            <strong>{peaks}</strong> run longer, and Mondays about <strong>{d.mondayLiftPct.toFixed(0)}%</strong> longer
            than other weekdays.
          </p>
          <WeekHeatmap
            staff={scenario.staff}
            queue={scenario.queue}
            currentHour={scenario.hour}
            currentDay={scenario.day}
            onPick={(hour, day) => setScenario({ hour, day })}
          />
        </div>
      </div>
    </section>
  )
}
