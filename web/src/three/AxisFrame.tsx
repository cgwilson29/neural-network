import { useMemo } from 'react'
import * as THREE from 'three'
import { WORLD } from '../lib/landscape'
import { STAFF_MAX, STAFF_MIN } from '../lib/domain'
import { Anchor } from './labels'

const WAIT_TICKS = [0, 60, 120, 180, 240, 300]
const QUEUE_TICKS = [0, 5, 10, 15, 20]
const STAFF_TICKS = Array.from({ length: STAFF_MAX - STAFF_MIN + 1 }, (_, k) => STAFF_MIN + k)

export interface AxisLabel {
  id: string
  text: string
  className: string
  position: [number, number, number]
}

const zFront = WORLD.zHalf + 0.45
const xSide = WORLD.xHalf + 0.45

/** Tick and title labels (rendered as DOM by the label layer). */
export const AXIS_LABELS: AxisLabel[] = [
  ...STAFF_TICKS.map((s) => ({
    id: `ax-s${s}`,
    text: String(s),
    className: 'axis-tick',
    position: [WORLD.x(s), 0, zFront] as [number, number, number],
  })),
  { id: 'ax-staff', text: 'staff on shift', className: 'axis-title', position: [0, 0, zFront + 0.6] },
  ...QUEUE_TICKS.map((q) => ({
    id: `ax-q${q}`,
    text: String(q),
    className: 'axis-tick',
    position: [xSide, 0, WORLD.z(q)] as [number, number, number],
  })),
  { id: 'ax-queue', text: 'patients in queue', className: 'axis-title', position: [xSide + 0.9, 0, WORLD.z(10)] },
  ...WAIT_TICKS.slice(1).map((w) => ({
    id: `ax-w${w}`,
    text: String(w),
    className: 'axis-tick',
    position: [WORLD.xHalf + 0.32, WORLD.y(w), -WORLD.zHalf] as [number, number, number],
  })),
  { id: 'ax-wait', text: 'wait (min)', className: 'axis-title', position: [WORLD.xHalf + 0.2, WORLD.y(330) + 0.3, -WORLD.zHalf] },
]

/** Floor grid, axes and tick anchors — a recessive frame around the landscape. */
export function AxisFrame() {
  const { floor, axes } = useMemo(() => {
    const x0 = -WORLD.xHalf
    const x1 = WORLD.xHalf
    const z0 = -WORLD.zHalf
    const z1 = WORLD.zHalf
    const f: number[] = []
    for (const s of STAFF_TICKS) f.push(WORLD.x(s), 0, z0, WORLD.x(s), 0, z1)
    for (const q of QUEUE_TICKS) f.push(x0, 0, WORLD.z(q), x1, 0, WORLD.z(q))
    const a: number[] = []
    // vertical wait axis at the back-right corner, with ticks
    a.push(x1, 0, z0, x1, WORLD.y(WAIT_TICKS[WAIT_TICKS.length - 1]), z0)
    for (const w of WAIT_TICKS) a.push(x1, WORLD.y(w), z0, x1 - 0.12, WORLD.y(w), z0)
    // back wall guide lines (faint) at each wait tick
    for (const w of WAIT_TICKS.slice(1)) a.push(x0, WORLD.y(w), z0, x1, WORLD.y(w), z0)
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.Float32BufferAttribute(f, 3))
    const ag = new THREE.BufferGeometry()
    ag.setAttribute('position', new THREE.Float32BufferAttribute(a, 3))
    return { floor: fg, axes: ag }
  }, [])

  return (
    <group>
      <lineSegments geometry={floor}>
        <lineBasicMaterial color="#0e6b7a" transparent opacity={0.8} />
      </lineSegments>
      <lineSegments geometry={axes}>
        <lineBasicMaterial color="#1b8fa0" transparent opacity={0.6} />
      </lineSegments>
      {AXIS_LABELS.map((l) => (
        <Anchor key={l.id} id={l.id} position={l.position} />
      ))}
    </group>
  )
}
