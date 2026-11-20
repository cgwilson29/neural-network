import { useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { ChartTip, TableView, useWidth, type TipState } from './chartKit'
import { SERIES } from '../../lib/colors'

interface Props {
  /** predicted wait for staff 1..5 */
  curve: number[]
  currentStaff: number
  onPick?: (staff: number) => void
}

const H = 280
const M = { top: 28, right: 18, bottom: 44, left: 46 }

/** Predicted wait vs staff on shift, with the minutes saved at each step labeled on the line. */
export function StaffingCurveChart({ curve, currentStaff, onPick }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const staff = curve.map((_, i) => i + 1)
  const x = scalePoint<number>().domain(staff).range([M.left, width - M.right]).padding(0.3)
  const yMax = Math.max(60, Math.ceil((Math.max(...curve) * 1.12) / 30) * 30)
  const y = scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top])
  const yTicks = y.ticks(5)
  const path = line<number>()
    .x((_, i) => x(i + 1)!)
    .y((d) => y(d))
    .curve(curveMonotoneX)(curve)

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart" width={width} height={H} role="img" aria-label="Line chart of predicted wait by staff on shift">
        <g className="grid">
          {yTicks.map((t) => (
            <line key={t} x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {yTicks.map((t) => (
          <text key={t} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
            {t}
          </text>
        ))}
        <text x={M.left} y={12} className="axis-label">
          predicted wait (min)
        </text>
        <line className="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
        {staff.map((s) => (
          <text key={s} x={x(s)} y={H - M.bottom + 20} textAnchor="middle" className="num">
            {s}
          </text>
        ))}
        <text x={(M.left + width - M.right) / 2} y={H - 6} textAnchor="middle" className="axis-label">
          staff on shift
        </text>
        <path d={path ?? ''} fill="none" stroke={SERIES.current} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* step labels: minutes saved by each added staff member */}
        {curve.slice(1).map((w, i) => {
          const saved = curve[i] - w
          const mx = (x(i + 1)! + x(i + 2)!) / 2
          const my = (y(curve[i]) + y(w)) / 2
          return (
            <text key={i} x={mx + 6} y={my - 8} className="value-label num" style={{ fontSize: 12 }}>
              −{saved.toFixed(0)}
            </text>
          )
        })}
        {curve.map((w, i) => {
          const s = i + 1
          const isCur = s === currentStaff
          return (
            <g
              key={s}
              tabIndex={0}
              role="button"
              aria-label={`${s} staff: ${w.toFixed(0)} minutes`}
              style={{ cursor: onPick ? 'pointer' : 'default' }}
              onClick={() => onPick?.(s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPick?.(s)
              }}
              onPointerEnter={() =>
                setTip({
                  x: x(s)!,
                  y: y(w),
                  content: (
                    <>
                      <strong>{w.toFixed(0)} min</strong> predicted
                      <span>{s} staff on shift</span>
                    </>
                  ),
                })
              }
              onPointerLeave={() => setTip(null)}
              onFocus={() => setTip({ x: x(s)!, y: y(w), content: <><strong>{w.toFixed(0)} min</strong><span>{s} staff</span></> })}
              onBlur={() => setTip(null)}
            >
              <circle cx={x(s)} cy={y(w)} r={14} fill="transparent" />
              <circle
                cx={x(s)}
                cy={y(w)}
                r={isCur ? 7 : 4.5}
                fill={SERIES.current}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
              {isCur && (
                <text x={x(s)} y={y(w) - 14} textAnchor="middle" className="value-label num">
                  {w.toFixed(0)} min
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ChartTip tip={tip} />
      <TableView
        caption="Predicted wait by staff on shift"
        head={['Staff on shift', 'Predicted wait (min)', 'Saved vs one fewer (min)']}
        rows={curve.map((w, i) => [i + 1, w.toFixed(1), i === 0 ? '—' : (curve[i - 1] - w).toFixed(1)])}
      />
    </div>
  )
}
