import { useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { barPath, ChartTip, TableView, useWidth, type TipState } from './chartKit'
import { metrics, type ModelKey } from '../../lib/artifacts'
import { SERIES } from '../../lib/colors'

const ORDER: ModelKey[] = ['median_baseline', 'linear', 'ratio_formula', 'nn']
const NOTE: Record<ModelKey, string> = {
  median_baseline: 'required baseline',
  linear: 'same inputs, straight lines',
  ratio_formula: 'reference: close to how the data was made',
  nn: 'this exhibit’s model',
}
const M = { top: 8, right: 64, bottom: 44, left: 168 }
const ROW = 46

/** Test-set MAE per model with bootstrap 95% intervals. The network is the emphasized bar. */
export function MetricsBars() {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const H = M.top + ORDER.length * ROW + M.bottom
  const narrow = width < 520
  const left = narrow ? 12 : M.left
  const maxV = Math.max(...ORDER.map((k) => metrics.models[k].ci95.mae[1]))
  const x = scaleLinear().domain([0, Math.ceil(maxV / 10) * 10]).range([left, width - M.right])
  const y = scaleBand<ModelKey>().domain(ORDER).range([M.top, M.top + ORDER.length * ROW]).paddingInner(0.3)
  const bh = Math.min(20, y.bandwidth() * (narrow ? 0.45 : 0.75))

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart" width={width} height={H + (narrow ? ORDER.length * 4 : 0)} role="img" aria-label="Bar chart of test-set mean absolute error by model">
        <g className="grid">
          {x.ticks(5).map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom} />
          ))}
        </g>
        {x.ticks(5).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 16} textAnchor="middle" className="num">
            {t}
          </text>
        ))}
        <text x={(x(0) + width - M.right) / 2} y={H - 4} textAnchor="middle" className="axis-label">
          mean absolute error on 300 test visits (min)
        </text>
        {ORDER.map((k) => {
          const m = metrics.models[k]
          const yy = y(k)!
          const by = narrow ? yy + y.bandwidth() - bh : yy + (y.bandwidth() - bh) / 2
          const mae = m.test.mae
          const [lo, hi] = m.ci95.mae
          const emph = k === 'nn'
          return (
            <g
              key={k}
              tabIndex={0}
              aria-label={`${m.label}: ${mae.toFixed(1)} minutes, 95% interval ${lo.toFixed(1)} to ${hi.toFixed(1)}`}
              onPointerEnter={() =>
                setTip({
                  x: x(mae),
                  y: by,
                  content: (
                    <>
                      <strong>{mae.toFixed(2)} min</strong> MAE
                      <span>
                        {m.label} · 95% CI {lo.toFixed(1)}–{hi.toFixed(1)} · within ±10 min:{' '}
                        {(m.test.within10 * 100).toFixed(0)}%
                      </span>
                    </>
                  ),
                })
              }
              onPointerLeave={() => setTip(null)}
            >
              <rect x={0} y={yy} width={width} height={y.bandwidth()} fill="transparent" />
              <text
                x={narrow ? left : left - 12}
                y={narrow ? yy + 4 : by + bh / 2 - 6}
                dy={narrow ? '0.7em' : '0.32em'}
                textAnchor={narrow ? 'start' : 'end'}
                style={{ fill: 'var(--text-primary)', fontWeight: emph ? 650 : 500, fontSize: 13 }}
              >
                {m.label}
              </text>
              {!narrow && (
                <text x={left - 12} y={by + bh / 2 + 10} dy="0.32em" textAnchor="end" style={{ fontSize: 11 }}>
                  {NOTE[k]}
                </text>
              )}
              <path d={barPath(x(0), by, x(mae) - x(0), bh)} fill={emph ? SERIES.current : '#4a5670'} />
              {/* 95% interval whisker */}
              <line x1={x(lo)} x2={x(hi)} y1={by + bh / 2} y2={by + bh / 2} stroke="var(--text-primary)" strokeWidth={1.5} opacity={0.8} />
              <line x1={x(lo)} x2={x(lo)} y1={by + bh / 2 - 5} y2={by + bh / 2 + 5} stroke="var(--text-primary)" strokeWidth={1.5} opacity={0.8} />
              <line x1={x(hi)} x2={x(hi)} y1={by + bh / 2 - 5} y2={by + bh / 2 + 5} stroke="var(--text-primary)" strokeWidth={1.5} opacity={0.8} />
              <text x={x(hi) + 8} y={by + bh / 2} dy="0.32em" className="value-label num">
                {mae.toFixed(1)}
              </text>
            </g>
          )
        })}
        <line className="baseline" x1={x(0)} x2={x(0)} y1={M.top} y2={H - M.bottom} />
      </svg>
      <ChartTip tip={tip} />
      <TableView
        caption="Test-set metrics by model"
        head={['Model', 'MAE (min)', '95% CI', 'RMSE', 'R²', 'Within ±10 min']}
        rows={ORDER.map((k) => {
          const m = metrics.models[k]
          return [
            m.label,
            m.test.mae.toFixed(2),
            `${m.ci95.mae[0].toFixed(1)}–${m.ci95.mae[1].toFixed(1)}`,
            m.test.rmse.toFixed(2),
            m.test.r2.toFixed(3),
            `${(m.test.within10 * 100).toFixed(0)}%`,
          ]
        })}
      />
    </div>
  )
}
