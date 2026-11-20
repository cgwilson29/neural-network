import { useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { TableView, useWidth } from './chartKit'
import { metrics, testVisits } from '../../lib/artifacts'
import { SERIES } from '../../lib/colors'
import { DAYS, formatHour, HOURS } from '../../lib/domain'

type By = 'staff' | 'hour' | 'day'
const M = { top: 14, right: 10, bottom: 34, left: 40 }
const H = 240

// deterministic jitter so dots don't jump between renders
const jitter = (id: number) => ((Math.sin(id * 12.9898) * 43758.5453) % 1) - 0.5

/** Errors (actual − predicted) for every test visit, grouped — they look the same everywhere. */
export function ResidualStrip() {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [by, setBy] = useState<By>('staff')
  const groups = useMemo(() => {
    if (by === 'staff') return [1, 2, 3, 4, 5].map((s) => ({ key: s, label: String(s) }))
    if (by === 'hour') return HOURS.map((h) => ({ key: h, label: formatHour(h).replace(' ', '') }))
    return DAYS.map((d, i) => ({ key: i, label: d }))
  }, [by])
  const x = scaleBand<number>().domain(groups.map((g) => g.key)).range([M.left, width - M.right]).padding(0.2)
  const y = scaleLinear().domain([-20, 20]).range([H - M.bottom, M.top])
  const field = (v: (typeof testVisits)[number]) => (by === 'staff' ? v.staff : by === 'hour' ? v.hour : v.day)
  const errs = metrics.residualsBy[by]

  return (
    <div>
      <div className="segmented" role="group" aria-label="Group errors by" style={{ maxWidth: 300, marginBottom: 10 }}>
        {(['staff', 'hour', 'day'] as By[]).map((b) => (
          <button key={b} aria-pressed={by === b} onClick={() => setBy(b)}>
            By {b}
          </button>
        ))}
      </div>
      <div className="chart-wrap" ref={ref}>
        <svg className="chart" width={width} height={H} role="img" aria-label={`Strip plot of prediction errors by ${by}`}>
          <rect x={M.left} width={width - M.left - M.right} y={y(10)} height={y(-10) - y(10)} fill="rgba(95,224,242,0.06)" />
          <g className="grid">
            {[-20, -10, 10, 20].map((t) => (
              <line key={t} x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <line className="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
          {[-20, -10, 0, 10, 20].map((t) => (
            <text key={t} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
              {t > 0 ? `+${t}` : t}
            </text>
          ))}
          {groups.map((g) => (
            <text key={g.key} x={x(g.key)! + x.bandwidth() / 2} y={H - M.bottom + 18} textAnchor="middle">
              {g.label}
            </text>
          ))}
          {testVisits.map((v) => {
            const gx = x(field(v))
            if (gx === undefined) return null
            const r = Math.max(-20, Math.min(20, v.actual - v.nn))
            return (
              <circle
                key={v.id}
                cx={gx + x.bandwidth() / 2 + jitter(v.id) * x.bandwidth() * 0.7}
                cy={y(r)}
                r={2.6}
                fill={SERIES.current}
                fillOpacity={0.7}
              />
            )
          })}
          <text x={width - M.right} y={M.top - 2} textAnchor="end" style={{ fontSize: 11 }}>
            shaded band = within ±10 min
          </text>
        </svg>
      </div>
      <TableView
        caption={`Test error by ${by}`}
        head={[by, 'Visits', 'MAE (min)', 'Mean (actual − predicted)']}
        rows={errs.map((e) => [
          by === 'day' ? String(e.key) : by === 'hour' ? formatHour(Number(e.key)) : String(e.key),
          e.n,
          e.mae.toFixed(1),
          e.meanResidual.toFixed(1),
        ])}
      />
    </div>
  )
}
