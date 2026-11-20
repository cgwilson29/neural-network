import { useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { ChartTip, useWidth, type TipState } from './chartKit'
import { trainingHistory } from '../../lib/artifacts'
import { SERIES } from '../../lib/colors'

const M = { top: 18, right: 16, bottom: 40, left: 40 }
const H = 220
const Y_MAX = 30

/** Validation MAE by epoch; early stopping restored the weights from the best epoch. */
export function TrainingCurveChart() {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const { epoch, valMae, bestEpoch } = trainingHistory
  const x = scaleLinear().domain([1, epoch[epoch.length - 1]]).range([M.left, width - M.right])
  const y = scaleLinear().domain([0, Y_MAX]).range([H - M.bottom, M.top])
  const path = line<number>()
    .x((_, i) => x(epoch[i]))
    .y((d) => y(Math.min(Y_MAX, d)))(valMae)
  const best = valMae[bestEpoch - 1]

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className="chart"
        width={width}
        height={H}
        role="img"
        aria-label={`Validation error fell to ${best.toFixed(2)} minutes at epoch ${bestEpoch}`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const ep = Math.round(x.invert(e.clientX - r.left))
          if (ep < 1 || ep > epoch.length) return setTip(null)
          const v = valMae[ep - 1]
          setTip({ x: x(ep), y: y(Math.min(Y_MAX, v)), content: <><strong>{v.toFixed(2)} min</strong><span>validation MAE · epoch {ep}</span></> })
        }}
        onPointerLeave={() => setTip(null)}
      >
        <g className="grid">
          {y.ticks(3).map((t) => (
            <line key={t} x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {y.ticks(3).map((t) => (
          <text key={t} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
            {t}
          </text>
        ))}
        {x.ticks(5).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 16} textAnchor="middle" className="num">
            {t}
          </text>
        ))}
        <text x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle" className="axis-label">
          training epoch
        </text>
        <text x={M.left} y={10} className="axis-label">
          validation MAE (min)
        </text>
        <line className="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
        <path d={path ?? ''} fill="none" stroke={SERIES.current} strokeWidth={2} strokeLinejoin="round" />
        <line x1={x(bestEpoch)} x2={x(bestEpoch)} y1={M.top} y2={H - M.bottom} stroke="var(--text-muted)" strokeWidth={1} />
        <circle cx={x(bestEpoch)} cy={y(best)} r={5} fill={SERIES.current} stroke="var(--surface-1)" strokeWidth={2} />
        <text
          x={x(bestEpoch) + (x(bestEpoch) > width * 0.6 ? -8 : 8)}
          y={y(best) - 12}
          textAnchor={x(bestEpoch) > width * 0.6 ? 'end' : 'start'}
          className="value-label"
        >
          best: epoch {bestEpoch}, {best.toFixed(2)} min
        </text>
      </svg>
      <ChartTip tip={tip} />
    </div>
  )
}
