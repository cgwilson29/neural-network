import { useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { ChartTip, useWidth, type TipState } from './chartKit'
import { biggestMissId, metrics, testVisits, type TestVisit } from '../../lib/artifacts'
import { SERIES } from '../../lib/colors'
import { DAYS, formatHour } from '../../lib/domain'

type Which = 'nn' | 'linear'
const M = { top: 16, right: 16, bottom: 44, left: 48 }

/** Predicted vs actual wait for the 300 test visits. Points on the diagonal are perfect predictions. */
export function PredVsActualScatter({ onSelect }: { onSelect: (v: TestVisit) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [which, setWhich] = useState<Which>('nn')
  const [hover, setHover] = useState<TestVisit | null>(null)
  const H = Math.min(420, Math.max(300, width * 0.8))
  const max = 330
  const x = scaleLinear().domain([0, max]).range([M.left, width - M.right])
  const y = scaleLinear().domain([0, max]).range([H - M.bottom, M.top])
  const ticks = [0, 100, 200, 300]
  const color = which === 'nn' ? SERIES.current : SERIES.pinned
  const label = which === 'nn' ? 'Neural network' : 'Linear regression'
  const mae = metrics.models[which].test.mae

  const nearest = (px: number, py: number) => {
    let best: TestVisit | null = null
    let bd = 22 * 22
    for (const v of testVisits) {
      const dx = x(v.actual) - px
      const dy = y(v[which]) - py
      const d = dx * dx + dy * dy
      if (d < bd) {
        bd = d
        best = v
      }
    }
    return best
  }

  const tip: TipState | null = hover
    ? {
        x: x(hover.actual),
        y: y(hover[which]),
        content: (
          <>
            <strong>{hover[which].toFixed(0)} min</strong> predicted · <strong>{hover.actual.toFixed(0)}</strong> actual
            <span>
              {DAYS[hover.day]} {formatHour(hover.hour)} · {hover.staff} staff · {hover.queue} queued · click to load
            </span>
          </>
        ),
      }
    : null

  const miss = testVisits.find((v) => v.id === biggestMissId)

  return (
    <div>
      <div className="segmented" role="group" aria-label="Model shown" style={{ maxWidth: 320, marginBottom: 10 }}>
        <button aria-pressed={which === 'nn'} onClick={() => setWhich('nn')}>
          Neural network
        </button>
        <button aria-pressed={which === 'linear'} onClick={() => setWhich('linear')}>
          Linear regression
        </button>
      </div>
      <div className="chart-wrap" ref={ref}>
        <svg
          className="chart"
          width={width}
          height={H}
          role="img"
          aria-label={`Scatter plot of ${label} predictions against actual waits; MAE ${mae.toFixed(1)} minutes`}
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            setHover(nearest(e.clientX - r.left, e.clientY - r.top))
          }}
          onPointerLeave={() => setHover(null)}
          onClick={() => hover && onSelect(hover)}
          style={{ cursor: hover ? 'pointer' : 'default' }}
        >
          <g className="grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
                <line x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom} />
              </g>
            ))}
          </g>
          {ticks.map((t) => (
            <g key={t}>
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
                {t}
              </text>
              <text x={x(t)} y={H - M.bottom + 18} textAnchor="middle" className="num">
                {t}
              </text>
            </g>
          ))}
          <text x={(M.left + width - M.right) / 2} y={H - 6} textAnchor="middle" className="axis-label">
            actual wait (min)
          </text>
          <text x={M.left} y={M.top - 4} className="axis-label">
            predicted (min)
          </text>
          <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="var(--text-muted)" strokeWidth={1} />
          <text x={x(300)} y={y(300) - 8} textAnchor="end" style={{ fontSize: 11 }}>
            perfect prediction
          </text>
          {testVisits.map((v) => (
            <circle
              key={v.id}
              cx={x(v.actual)}
              cy={y(v[which])}
              r={4}
              fill={color}
              fillOpacity={0.75}
              stroke="var(--surface-1)"
              strokeWidth={1}
            />
          ))}
          {miss && (
            <g>
              <circle cx={x(miss.actual)} cy={y(miss[which])} r={9} fill="none" stroke="#eaf0f8" strokeWidth={1.5} />
              <text x={x(miss.actual) + 13} y={y(miss[which])} dy="0.32em" className="value-label" style={{ fontSize: 12 }}>
                network’s biggest miss
              </text>
            </g>
          )}
          {hover && <circle cx={x(hover.actual)} cy={y(hover[which])} r={7} fill="none" stroke="#eaf0f8" strokeWidth={2} />}
        </svg>
        <ChartTip tip={tip} />
      </div>
      <p className="foot">
        {label}: mean absolute error <strong className="num">{mae.toFixed(1)} min</strong> on the held-out test set. Click
        any visit to load it into the simulator.
      </p>
    </div>
  )
}
