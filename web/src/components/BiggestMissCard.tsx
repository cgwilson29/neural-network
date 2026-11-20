import { scaleLinear } from 'd3-scale'
import { useWidth } from './charts/chartKit'
import { biggestMissId, metrics, testVisits } from '../lib/artifacts'
import { SERIES } from '../lib/colors'
import { DAY_NAMES, formatHour } from '../lib/domain'
import { useLoadVisit } from '../lib/useLoadVisit'

/** The single largest test-set error, explained (assignment: "pick one mistake"). */
export function BiggestMissCard() {
  const m = metrics.biggestMiss
  const visit = testVisits.find((v) => v.id === biggestMissId)
  const loadVisit = useLoadVisit()
  const [ref, width] = useWidth<HTMLDivElement>(420)
  const H = 150
  const x = scaleLinear().domain([20, 80]).range([16, width - 16])
  const n = m.trainNeighbors
  const day = DAY_NAMES[m.inputs.dayIdx]

  return (
    <div className="card" style={{ marginTop: 20 }} id="mistake">
      <div className="miss">
        <div>
          <div className="eyebrow">One mistake, examined</div>
          <h3 style={{ fontSize: 22, margin: '6px 0 4px' }}>The visit that was quicker than expected</h3>
          <p className="sub" style={{ marginBottom: 0 }}>
            The network’s largest error on the test set: a {day} {formatHour(m.inputs.hour)} visit with {m.inputs.staff}{' '}
            staff and {m.inputs.queue} patients queued.
          </p>
          <dl className="facts-list">
            <dt>Actual wait</dt>
            <dd className="num">{m.actual.toFixed(1)} min</dd>
            <dt>Network predicted</dt>
            <dd className="num">
              {m.nn.toFixed(1)} min (off by {Math.abs(m.error).toFixed(0)})
            </dd>
            <dt>Similar training visits</dt>
            <dd className="num">
              {n.n} visits, {n.min.toFixed(1)}–{n.max.toFixed(1)} min (mean {n.mean.toFixed(1)})
            </dd>
            <dt>Median baseline</dt>
            <dd className="num">{m.baseline.toFixed(1)} min</dd>
          </dl>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Why it missed:</strong> the network did the sensible thing
            and predicted close to every similar visit it had seen. This visit was simply faster than all of them, and
            nothing in hour, day, staff or queue can explain that kind of luck. It is random variation built into the
            simulated data.
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: 14.5, marginTop: 10, fontWeight: 600 }}>What might have helped</p>
          <ol>
            <li>More informative inputs, such as visit type, recent arrivals or no-shows.</li>
            <li>Predicting a range instead of a single number (the “typical range” on the map is a start).</li>
            <li>More training visits for this setting; only {n.n} shared its staff and queue.</li>
          </ol>
          {visit && (
            <div className="btn-row">
              <button className="btn primary" onClick={() => loadVisit(visit)}>
                Show this visit on the map ↑
              </button>
            </div>
          )}
        </div>
        <div ref={ref} style={{ alignSelf: 'center' }}>
          <svg className="chart" width={width} height={H} role="img" aria-label="Number line comparing the actual wait, the prediction, and similar training visits">
            <line className="baseline" x1={16} x2={width - 16} y1={96} y2={96} />
            {[20, 30, 40, 50, 60, 70, 80].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={92} y2={100} stroke="var(--axis)" />
                <text x={x(t)} y={118} textAnchor="middle" className="num">
                  {t}
                </text>
              </g>
            ))}
            <text x={16} y={142} textAnchor="start" className="axis-label">
              wait (minutes)
            </text>
            {/* similar training visits range */}
            <rect x={x(n.min)} y={84} width={x(n.max) - x(n.min)} height={24} rx={4} fill="rgba(160,185,230,0.14)" />
            <text x={(x(n.min) + x(n.max)) / 2} y={142} textAnchor="middle" style={{ fontSize: 11.5 }}>
              ↑ {n.n} similar training visits
            </text>
            {/* network */}
            <circle cx={x(m.nn)} cy={96} r={7} fill={SERIES.current} stroke="var(--surface-1)" strokeWidth={2} />
            <text x={x(m.nn)} y={52} textAnchor="middle" className="value-label num">
              predicted {m.nn.toFixed(0)}
            </text>
            <line x1={x(m.nn)} x2={x(m.nn)} y1={58} y2={88} stroke={SERIES.current} strokeWidth={1} />
            {/* actual */}
            <circle cx={x(m.actual)} cy={96} r={7} fill="#eaf0f8" stroke="var(--surface-1)" strokeWidth={2} />
            <text x={x(m.actual)} y={52} textAnchor="middle" className="value-label num">
              actual {m.actual.toFixed(0)}
            </text>
            <line x1={x(m.actual)} x2={x(m.actual)} y1={58} y2={88} stroke="#eaf0f8" strokeWidth={1} />
            <line x1={x(m.actual) + 10} x2={x(m.nn) - 10} y1={20} y2={20} stroke="var(--text-muted)" />
            <text x={(x(m.actual) + x(m.nn)) / 2} y={14} textAnchor="middle" style={{ fontSize: 11.5 }}>
              {Math.abs(m.error).toFixed(0)}-minute miss
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}
