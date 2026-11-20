import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  CONTOUR_STEP,
  contourLevels,
  contourSegments,
  NQ,
  NS,
  queueAtSample,
  staffAtSample,
  WORLD,
} from '../lib/landscape'
import { HEAT_LUT, heatLutIndex } from '../lib/colors'
import { WAIT_AXIS_MAX } from '../lib/domain'

interface Props {
  /** Dense NS × NQ predicted waits (target; the mesh eases toward it). */
  values: Float32Array
  reducedMotion: boolean
}

const STAFF_LINE_SAMPLES = [0, 10, 20, 30, 40] // staff = 1..5 exactly

export function WaitSurface({ values, reducedMotion }: Props) {
  const invalidate = useThree((s) => s.invalidate)
  const current = useRef<Float32Array>(values.slice())
  const animating = useRef(false)
  const contourFade = useRef(1)
  const contourLines = useRef(new Map<number, { material: THREE.Material; base: number }>())

  const { geometry, staffLines } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(NS * NQ * 3)
    for (let j = 0; j < NQ; j++)
      for (let i = 0; i < NS; i++) {
        const k = j * NS + i
        pos[k * 3] = WORLD.x(staffAtSample(i))
        pos[k * 3 + 2] = WORLD.z(queueAtSample(j))
      }
    const idx: number[] = []
    for (let j = 0; j < NQ - 1; j++)
      for (let i = 0; i < NS - 1; i++) {
        const a = j * NS + i
        const b = a + 1
        const c = a + NS
        const d = c + 1
        idx.push(a, b, c, b, d, c) // z runs front→back as queue grows, so this winding faces up
      }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NS * NQ * 3), 3))
    g.setIndex(idx)

    const lg = new THREE.BufferGeometry()
    lg.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(STAFF_LINE_SAMPLES.length * (NQ - 1) * 2 * 3), 3),
    )
    return { geometry: g, staffLines: lg }
  }, [])

  const apply = (vals: Float32Array) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const c = col.array as Float32Array
    for (let k = 0; k < NS * NQ; k++) {
      p[k * 3 + 1] = WORLD.y(vals[k])
      const li = heatLutIndex(vals[k])
      c[k * 3] = HEAT_LUT[li]
      c[k * 3 + 1] = HEAT_LUT[li + 1]
      c[k * 3 + 2] = HEAT_LUT[li + 2]
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const lp = staffLines.attributes.position as THREE.BufferAttribute
    const l = lp.array as Float32Array
    let o = 0
    for (const i of STAFF_LINE_SAMPLES) {
      for (let j = 0; j < NQ - 1; j++) {
        for (const jj of [j, j + 1]) {
          const k = jj * NS + i
          l[o++] = p[k * 3]
          l[o++] = p[k * 3 + 1] + 0.012
          l[o++] = p[k * 3 + 2]
        }
      }
    }
    lp.needsUpdate = true
    staffLines.computeBoundingSphere()
  }

  // First paint
  useEffect(() => {
    apply(current.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      current.current = values.slice()
      apply(current.current)
      contourFade.current = 1
    } else {
      animating.current = true
      contourFade.current = 0
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, reducedMotion])

  useFrame((_, dt) => {
    if (animating.current) {
      const a = 1 - Math.exp(-dt * 7)
      const cur = current.current
      let maxDiff = 0
      for (let k = 0; k < cur.length; k++) {
        const d = values[k] - cur[k]
        cur[k] += d * a
        if (Math.abs(d) > maxDiff) maxDiff = Math.abs(d)
      }
      if (maxDiff < 0.2) {
        cur.set(values)
        animating.current = false
      }
      apply(cur)
      invalidate()
    }
    if (!animating.current && contourFade.current < 1) {
      contourFade.current = Math.min(1, contourFade.current + dt * 3)
      invalidate()
    }
    for (const { material, base } of contourLines.current.values()) material.opacity = base * contourFade.current
  })

  const contours = useMemo(() => {
    const maxWait = values.reduce((m, v) => Math.max(m, v), 0)
    return contourLevels(Math.min(maxWait, WAIT_AXIS_MAX)).map((level) => {
      const segs = contourSegments(values, NS, NQ, level)
      const y = WORLD.y(level) + 0.018
      const pts: [number, number, number][] = []
      for (let s = 0; s < segs.length; s += 2) {
        pts.push([WORLD.x(staffAtSample(segs[s])), y, WORLD.z(queueAtSample(segs[s + 1]))])
      }
      return { level, pts, major: level % (CONTOUR_STEP * 2) === 0 }
    })
  }, [values])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          roughness={0.62}
          metalness={0.05}
          side={THREE.DoubleSide}
          transparent
          opacity={0.94}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={staffLines}>
        <lineBasicMaterial color="#e8f6ff" transparent opacity={0.4} />
      </lineSegments>
      <group>
        {contours.map(({ level, pts, major }) =>
          pts.length >= 2 ? (
            <Line
              key={level}
              points={pts}
              segments
              color={major ? new THREE.Color(0.45, 2.1, 2.6) : new THREE.Color(0.3, 1.1, 1.4)}
              lineWidth={major ? 1.8 : 1}
              toneMapped={false}
              transparent
              opacity={(major ? 0.95 : 0.55) * contourFade.current}
              ref={(line) => {
                if (line) contourLines.current.set(level, { material: line.material, base: major ? 0.95 : 0.55 })
                else contourLines.current.delete(level)
              }}
            />
          ) : null,
        )}
      </group>
    </group>
  )
}
