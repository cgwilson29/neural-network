import { useEffect, useMemo, useState } from 'react'
import { modelCard } from '../lib/artifacts'
import { DIVERGING, SERIES } from '../lib/colors'
import { DAYS, formatHour, HOURS } from '../lib/domain'
import { runModel } from '../lib/ortModel'
import type { CorePredictions } from '../lib/useCorePredictions'
import { useWidth } from './charts/chartKit'
import { useExhibit } from '../state/store'

type Layer = 'in' | 'h1' | 'h2' | 'out'
interface Hover {
  layer: Layer
  index: number
}

const INPUT_LABELS = [...HOURS.map((h) => formatHour(h)), ...DAYS, 'staff', 'queue']
const ROW = 24
const TOP = 30

/** Live view of the network's neurons for the visitor's scenario. */
export function NetworkXRay({ core }: { core: CorePredictions }) {
  const modelStatus = useExhibit((s) => s.modelStatus)
  const [ref, width] = useWidth<HTMLDivElement>(760)
  const [hover, setHover] = useState<Hover | null>(null)
  const [maxAct, setMaxAct] = useState<{ h1: number[]; h2: number[] } | null>(null)
  const { scenario, hidden, scenarioWait } = core
  const W1 = modelCard.weightsForDiagram.l1
  const W2 = modelCard.weightsForDiagram.l2
  const W3 = modelCard.weightsForDiagram.out
  const nIn = modelCard.featureNames.length
  const n1 = W1.length
  const n2 = W2.length

  // Per-neuron maximum activation over every possible input — a stable brightness scale.
  useEffect(() => {
    if (modelStatus !== 'ready' || maxAct) return
    const rows: [number, number, number, number][] = []
    for (const h of HOURS) for (let d = 0; d < 5; d++) for (let s = 1; s <= 5; s++) for (let q = 0; q <= 20; q++) rows.push([h, d, s, q])
    runModel(rows)
      .then((out) => {
        const m1 = new Array(out.h1Size).fill(0)
        const m2 = new Array(out.h2Size).fill(0)
        for (let r = 0; r < rows.length; r++) {
          for (let j = 0; j < out.h1Size; j++) m1[j] = Math.max(m1[j], out.h1[r * out.h1Size + j])
          for (let j = 0; j < out.h2Size; j++) m2[j] = Math.max(m2[j], out.h2[r * out.h2Size + j])
        }
        setMaxAct({ h1: m1, h2: m2 })
      })
      .catch(() => undefined)
  }, [modelStatus, maxAct])

  const inputs = useMemo(() => {
    const enc = modelCard.encoding
    const v = new Array(nIn).fill(0)
    v[scenario.hour - HOURS[0]] = 1
    v[HOURS.length + scenario.day] = 1
    v[nIn - 2] = (scenario.staff - enc.numeric.staff.mean) / enc.numeric.staff.std
    v[nIn - 1] = (scenario.queue - enc.numeric.queue.mean) / enc.numeric.queue.std
    return v as number[]
  }, [scenario, nIn])

  const H = TOP + nIn * ROW + 10
  const xs = { in: Math.max(84, width * 0.13), h1: width * 0.42, h2: width * 0.7, out: width - 48 }
  const yOf = (n: number, i: number) => TOP + ((nIn - n) * ROW) / 2 + i * ROW + ROW / 2

  const a1 = hidden ? Array.from(hidden.h1) : null
  const a2 = hidden ? Array.from(hidden.h2) : null

  const edges = useMemo(() => {
    if (!a1 || !a2) return []
    const list: { x1: number; y1: number; x2: number; y2: number; c: number; key: string }[] = []
    const push = (layerKey: string, src: number[], W: number[][], x1: number, x2: number, nSrc: number, nDst: number) => {
      const contrib: { i: number; j: number; c: number }[] = []
      for (let j = 0; j < nDst; j++) for (let i = 0; i < nSrc; i++) if (src[i] !== 0) contrib.push({ i, j, c: W[j][i] * src[i] })
      const maxC = Math.max(1e-6, ...contrib.map((e) => Math.abs(e.c)))
      for (const e of contrib)
        list.push({ x1, y1: yOf(nSrc, e.i), x2, y2: yOf(nDst, e.j), c: e.c / maxC, key: `${layerKey}-${e.i}-${e.j}` })
    }
    push('a', inputs, W1, xs.in, xs.h1, nIn, n1)
    push('b', a1, W2, xs.h1, xs.h2, n1, n2)
    push('c', a2, W3, xs.h2, xs.out, n2, 1)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, hidden, width])

  const glow = (layer: 'h1' | 'h2', j: number, a: number) => {
    const max = maxAct?.[layer][j] ?? 3
    return max > 0 ? Math.min(1, a / max) : 0
  }

  // Side panel detail for the hovered neuron
  let detail: React.ReactNode = (
    <p className="sub">Hover or focus a neuron to see what feeds it.</p>
  )
  if (hover && a1 && a2) {
    if (hover.layer === 'in') {
      detail = (
        <dl>
          <dt>Input</dt>
          <dd>{modelCard.featureNames[hover.index]}</dd>
          <dt>Value</dt>
          <dd className="num">{inputs[hover.index].toFixed(2)}</dd>
          <dt>Meaning</dt>
          <dd>
            {hover.index < nIn - 2
              ? inputs[hover.index] === 1
                ? 'switched on for your scenario'
                : 'off (0) for your scenario'
              : 'standardized: 0 = training average'}
          </dd>
        </dl>
      )
    } else if (hover.layer === 'h1' || hover.layer === 'h2') {
      const isH1 = hover.layer === 'h1'
      const act = (isH1 ? a1 : a2)[hover.index]
      const W = isH1 ? W1 : W2
      const src = isH1 ? inputs : a1
      const labels = isH1 ? INPUT_LABELS : a1.map((_, i) => `layer-1 #${i + 1}`)
      const top = src
        .map((v, i) => ({ i, c: W[hover.index][i] * v }))
        .filter((e) => e.c !== 0)
        .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
        .slice(0, 3)
      detail = (
        <dl>
          <dt>Neuron</dt>
          <dd>
            Layer {isH1 ? 1 : 2}, #{hover.index + 1}
          </dd>
          <dt>Activation</dt>
          <dd className="num">{act > 0 ? act.toFixed(2) : '0 (silent)'}</dd>
          <dt>Biggest inputs</dt>
          <dd>
            {top.length
              ? top.map((e) => (
                  <div key={e.i} className="num">
                    {labels[e.i]} {e.c > 0 ? '+' : '−'}
                    {Math.abs(e.c).toFixed(2)}
                  </div>
                ))
              : 'none active'}
          </dd>
        </dl>
      )
    } else {
      detail = (
        <dl>
          <dt>Output</dt>
          <dd>predicted wait</dd>
          <dt>Value</dt>
          <dd className="num">{scenarioWait.toFixed(1)} min</dd>
          <dt>How</dt>
          <dd>
            weighted sum of layer 2, rescaled by ×{modelCard.encoding.target.std.toFixed(1)} + {modelCard.encoding.target.mean.toFixed(1)} minutes
          </dd>
        </dl>
      )
    }
  }

  const ready = Boolean(a1 && a2)
  const node = (layer: Layer, index: number, x: number, y: number, fill: string, r: number, label: string) => (
    <g
      key={`${layer}${index}`}
      tabIndex={0}
      aria-label={label}
      onPointerEnter={() => setHover({ layer, index })}
      onFocus={() => setHover({ layer, index })}
      style={{ cursor: 'default' }}
    >
      <circle cx={x} cy={y} r={11} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill={fill} stroke="var(--surface-1)" strokeWidth={2} />
      {hover?.layer === layer && hover.index === index && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#eaf0f8" strokeWidth={1.5} />}
    </g>
  )

  return (
    <div className="xray-wrap" data-tour="xray">
      <div className="card" ref={ref} style={{ padding: 12 }}>
        {!ready ? (
          <div style={{ height: H, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
            {modelStatus === 'failed'
              ? 'The in-browser runtime could not start, so live neuron activity is unavailable here (predictions still work).'
              : 'Connecting to the in-browser network…'}
          </div>
        ) : (
          <svg className="chart xray-svg" width={width - 24} height={H} role="img" aria-label="Diagram of the neural network's layers with live activations">
            <defs>
              <filter id="nglow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {(['inputs (17)', 'layer 1 (16)', 'layer 2 (8)', 'output'] as const).map((t, i) => (
              <text key={t} x={[xs.in, xs.h1, xs.h2, xs.out][i]} y={14} textAnchor="middle" className="axis-label">
                {t}
              </text>
            ))}
            {edges.map((e) => (
              <line
                key={e.key}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.c >= 0 ? DIVERGING.positive : DIVERGING.negative}
                strokeOpacity={0.08 + 0.75 * Math.abs(e.c)}
                strokeWidth={0.6 + 1.6 * Math.abs(e.c)}
              />
            ))}
            {inputs.map((v, i) => {
              const on = v !== 0
              const y = yOf(nIn, i)
              return (
                <g key={`il${i}`}>
                  <text x={xs.in - 16} y={y} dy="0.32em" textAnchor="end" className="node-label" style={{ fill: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {INPUT_LABELS[i]}
                    {i >= nIn - 2 ? ` ${(i === nIn - 2 ? scenario.staff : scenario.queue).toString()}` : ''}
                  </text>
                  {node('in', i, xs.in, y, on ? SERIES.current : '#1c263a', 6, `${INPUT_LABELS[i]} input ${v.toFixed(2)}`)}
                </g>
              )
            })}
            <g filter="url(#nglow)">
              {a1!.map((a, j) => {
                const g = glow('h1', j, a)
                return node('h1', j, xs.h1, yOf(n1, j), g > 0 ? `rgba(95,224,242,${0.25 + 0.75 * g})` : '#1c263a', 8, `Layer 1 neuron ${j + 1}, activation ${a.toFixed(2)}`)
              })}
              {a2!.map((a, j) => {
                const g = glow('h2', j, a)
                return node('h2', j, xs.h2, yOf(n2, j), g > 0 ? `rgba(95,224,242,${0.25 + 0.75 * g})` : '#1c263a', 9, `Layer 2 neuron ${j + 1}, activation ${a.toFixed(2)}`)
              })}
              {node('out', 0, xs.out, yOf(1, 0), '#fcd36b', 12, `Output: ${scenarioWait.toFixed(0)} minutes`)}
            </g>
            <text x={xs.out} y={yOf(1, 0) + 30} textAnchor="middle" className="value-label num">
              {Math.round(scenarioWait)} min
            </text>
          </svg>
        )}
      </div>
      <aside className="card xray-side">
        <h3>Reading the X-ray</h3>
        <p className="sub">
          Your scenario switches on one hour input and one weekday input; staff and queue enter as numbers. Brighter
          neurons are firing harder; dark ones are silent (ReLU outputs zero). Lines show each active connection’s pull:{' '}
          <span style={{ color: DIVERGING.positive }}>yellow = positive</span>,{' '}
          <span style={{ color: DIVERGING.negative }}>cyan = negative</span>.
        </p>
        <div aria-live="polite">{detail}</div>
        <p className="foot">
          {modelCard.training.parameters} weights in total. Activations come straight from the ONNX model running in your
          browser.
        </p>
      </aside>
    </div>
  )
}
