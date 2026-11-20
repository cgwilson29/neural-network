import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { TestVisit } from '../lib/artifacts'
import { WORLD } from '../lib/landscape'
import { Anchor } from './labels'

interface Props {
  visits: TestVisit[]
  focusId: number | null
  /** The visit whose tooltip is showing (hovered, else focused). */
  shown: TestVisit | null
  onHover: (v: TestVisit | null) => void
  onSelect?: (v: TestVisit) => void
}

const tmp = new THREE.Object3D()

/**
 * The 300 held-out test visits, floating at their ACTUAL wait. A thin stem joins each one to what
 * the network predicted for that visit — short stems mean small errors.
 */
export function TestPointCloud({ visits, focusId, shown, onHover, onSelect }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const hovered = useRef<TestVisit | null>(null)
  const invalidate = useThree((s) => s.invalidate)

  const stems = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(visits.length * 6)
    visits.forEach((v, i) => {
      const x = WORLD.x(v.staff)
      const z = WORLD.z(v.queue)
      p.set([x, WORLD.y(v.actual), z, x, WORLD.y(v.nn), z], i * 6)
    })
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [visits])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    visits.forEach((v, i) => {
      tmp.position.set(WORLD.x(v.staff), WORLD.y(v.actual), WORLD.z(v.queue))
      tmp.scale.setScalar(v.id === focusId ? 2.2 : 1)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.count = visits.length
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    invalidate()
  }, [visits, focusId, invalidate])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const v = e.instanceId !== undefined ? visits[e.instanceId] : null
    if (v && v !== hovered.current) {
      hovered.current = v
      onHover(v)
    }
  }

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, 300]}
        onPointerMove={onMove}
        onPointerOut={() => {
          hovered.current = null
          onHover(null)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) onSelect?.(visits[e.instanceId])
        }}
      >
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color={new THREE.Color(1.6, 1.7, 1.9)} toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={stems}>
        <lineBasicMaterial color="#9fb3d1" transparent opacity={0.55} />
      </lineSegments>
      {shown && <Anchor id="visit-tip" position={[WORLD.x(shown.staff), WORLD.y(shown.actual) + 0.2, WORLD.z(shown.queue)]} />}
    </group>
  )
}
