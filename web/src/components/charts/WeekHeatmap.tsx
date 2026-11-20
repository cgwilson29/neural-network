import { useMemo, useState } from 'react'
import { scaleBand } from 'd3-scale'
import { interpolateInferno } from 'd3-scale-chromatic'
import { ChartTip, TableView, useWidth, type TipState } from './chartKit'
import { DAYS, formatHour, HOURS, weekRows } from '../../lib/domain'
import { usePrediction } from '../../lib/usePrediction'

interface Props {
  staff: number
  queue: number
  currentHour: number
  currentDay: number
  onPick?: (hour: number, day: number) => void
}

const M = { top: 8, right: 8, bottom: 34, left: 44 }

/**
 * Predicted wait for every hour × weekday at the chosen staffing and queue. The color scale is
 * stretched to this grid's own min–max so the hour and weekday pattern is visible.
 */
export function WeekHeatmap({ staff, queue, currentHour, currentDay, onPick }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const rows = useMemo(() => weekRows(staff, queue), [staff, queue])
  const pred = usePrediction(rows, `${staff}|${queue}`)
  const values = Array.from(pred.wait)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const t = (v: number) => 0.22 + 0.72 * (hi > lo ? (v - lo) / (hi - lo) : 0.5)

  const x = scaleBand<number>().domain([...HOURS]).range([M.left, width - M.right]).paddingInner(0.08)
  const cell = x.bandwidth()
  const rowH = Math.min(46, Math.max(28, cell * 0.8))
  const y = scaleBand<number>()
    .domain(DAYS.map((_, i) => i))
    .range([M.top, M.top + rowH * DAYS.length])
    .paddingInner(0.08)
  const H = M.top + rowH * DAYS.length + M.bottom

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart" width={width} height={H} role="img" aria-label="Heatmap of predicted wait by hour and weekday">
        {DAYS.map((d, di) => (
          <text key={d} x={M.left - 8} y={y(di)! + y.bandwidth() / 2} dy="0.32em" textAnchor="end">
            {d}
          </text>
        ))}
        {HOURS.map((h) => (
          <text key={h} x={x(h)! + cell / 2} y={M.top + rowH * DAYS.length + 16} textAnchor="middle" className="num">
            {formatHour(h).replace(' ', '')}
          </text>
        ))}
        {HOURS.map((h, hi_) =>
          DAYS.map((d, di) => {
            const v = values[hi_ * DAYS.length + di]
            const cur = h === currentHour && di === currentDay
            const cx = x(h)!
            const cy = y(di)!
            return (
              <rect
                key={`${h}-${d}`}
                x={cx}
                y={cy}
                width={cell}
                height={y.bandwidth()}
                rx={4}
                fill={interpolateInferno(t(v))}
                stroke={cur ? '#eaf0f8' : 'none'}
                strokeWidth={cur ? 2 : 0}
                tabIndex={0}
                role="button"
                aria-label={`${d} ${formatHour(h)}: ${v.toFixed(0)} minutes`}
                style={{ cursor: onPick ? 'pointer' : 'default' }}
                onClick={() => onPick?.(h, di)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onPick?.(h, di)
                }}
                onPointerEnter={() =>
                  setTip({
                    x: cx + cell / 2,
                    y: cy,
                    content: (
                      <>
                        <strong>{v.toFixed(0)} min</strong>
                        <span>
                          {d} {formatHour(h)} · {staff} staff · {queue} queued
                        </span>
                      </>
                    ),
                  })
                }
                onPointerLeave={() => setTip(null)}
                onFocus={() => setTip({ x: cx + cell / 2, y: cy, content: <strong>{v.toFixed(0)} min</strong> })}
                onBlur={() => setTip(null)}
              />
            )
          }),
        )}
      </svg>
      <div className="legend" style={{ marginTop: 6, alignItems: 'center' }}>
        <span className="num">{lo.toFixed(0)} min</span>
        <span
          style={{
            width: 120,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${interpolateInferno(0.22)}, ${interpolateInferno(0.58)}, ${interpolateInferno(0.94)})`,
          }}
          aria-hidden="true"
        />
        <span className="num">{hi.toFixed(0)} min</span>
        <span style={{ color: 'var(--text-muted)' }}>· color stretched to this grid · outlined = your setting</span>
      </div>
      <ChartTip tip={tip} />
      <TableView
        caption="Predicted wait by hour and weekday"
        head={['Hour', ...DAYS]}
        rows={HOURS.map((h, hi_) => [formatHour(h), ...DAYS.map((_, di) => values[hi_ * DAYS.length + di].toFixed(0))])}
      />
    </div>
  )
}
