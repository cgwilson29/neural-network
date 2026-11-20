import { useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { ChartTip, columnPath, ordinal, TableView, useWidth, type TipState } from './chartKit'
import { SERIES } from '../../lib/colors'

interface Props {
  curve: number[] // predicted wait for staff 1..5
  currentStaff: number
}

const H = 280
const M = { top: 28, right: 12, bottom: 44, left: 40 }

/** Minutes saved by adding the 2nd, 3rd, 4th, 5th staff member — diminishing returns, directly. */
export function MarginalSavingsChart({ curve, currentStaff }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const steps = curve.slice(1).map((w, i) => ({ nth: i + 2, saved: curve[i] - w }))
  const x = scaleBand<number>()
    .domain(steps.map((s) => s.nth))
    .range([M.left, width - M.right])
    .padding(0.35)
  const bw = Math.min(24, x.bandwidth())
  const yMax = Math.max(10, Math.ceil((Math.max(...steps.map((s) => s.saved)) * 1.15) / 10) * 10)
  const y = scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top])
  const yTicks = y.ticks(4)
  const nextStep = currentStaff + 1

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart" width={width} height={H} role="img" aria-label="Column chart of minutes saved by each added staff member">
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
          minutes saved
        </text>
        <line className="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
        {steps.map((s) => {
          const cx = x(s.nth)! + x.bandwidth() / 2
          const h = y(0) - y(Math.max(0, s.saved))
          const emph = s.nth === nextStep
          return (
            <g
              key={s.nth}
              tabIndex={0}
              aria-label={`Adding the ${ordinal(s.nth)} staff member saves ${s.saved.toFixed(0)} minutes`}
              onPointerEnter={() =>
                setTip({
                  x: cx,
                  y: y(Math.max(0, s.saved)),
                  content: (
                    <>
                      <strong>{s.saved.toFixed(1)} min</strong> saved
                      <span>
                        going from {s.nth - 1} to {s.nth} staff
                      </span>
                    </>
                  ),
                })
              }
              onPointerLeave={() => setTip(null)}
              onFocus={() => setTip({ x: cx, y: y(Math.max(0, s.saved)), content: <strong>{s.saved.toFixed(1)} min saved</strong> })}
              onBlur={() => setTip(null)}
            >
              <rect x={x(s.nth)} y={M.top} width={x.bandwidth()} height={H - M.bottom - M.top} fill="transparent" />
              <path
                d={columnPath(cx - bw / 2, y(Math.max(0, s.saved)), bw, h)}
                fill={SERIES.current}
                opacity={emph || currentStaff >= 5 ? 1 : 0.45}
              />
              <text x={cx} y={y(Math.max(0, s.saved)) - 8} textAnchor="middle" className="value-label num">
                {s.saved.toFixed(0)}
              </text>
              <text x={cx} y={H - M.bottom + 20} textAnchor="middle" className="num">
                {ordinal(s.nth)}
              </text>
            </g>
          )
        })}
        <text x={(M.left + width - M.right) / 2} y={H - 6} textAnchor="middle" className="axis-label">
          staff member added
        </text>
      </svg>
      <ChartTip tip={tip} />
      <TableView
        caption="Minutes saved by each added staff member"
        head={['Staff member added', 'Minutes saved']}
        rows={steps.map((s) => [ordinal(s.nth), s.saved.toFixed(1)])}
      />
    </div>
  )
}
