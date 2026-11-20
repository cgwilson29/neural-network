import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD } from '../lib/landscape'
import { Anchor } from './labels'

interface Props {
  staff: number
  queue: number
  wait: number
  /** Linear RGB, may exceed 1 so the bloom pass makes it glow. */
  glow: [number, number, number]
  size?: number
  pulse?: boolean
  beam?: boolean
  /** Id of the screen-space label anchored just above the beacon. */
  anchorId?: string
  reducedMotion: boolean
}

/** A glowing marker sitting on the landscape at (staff, queue, predicted wait). */
export function ScenarioBeacon({
  staff,
  queue,
  wait,
  glow,
  size = 0.1,
  pulse = false,
  beam = false,
  anchorId,
  reducedMotion,
}: Props) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const beamMesh = useRef<THREE.Mesh>(null)
  const floorDot = useRef<THREE.Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const target = new THREE.Vector3(WORLD.x(staff), WORLD.y(wait) + size * 0.6, WORLD.z(queue))
  const color = new THREE.Color(...glow)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    if (reducedMotion) g.position.copy(target)
    else if (g.position.distanceTo(target) > 1e-4) {
      g.position.lerp(target, 1 - Math.exp(-dt * 9))
      invalidate()
    }
    const h = g.position.y
    if (beamMesh.current) {
      beamMesh.current.scale.y = Math.max(h, 0.001)
      beamMesh.current.position.y = -h / 2
    }
    if (floorDot.current) floorDot.current.position.y = -h + 0.004
    if (ring.current && pulse && !reducedMotion) {
      const t = (state.clock.elapsedTime % 1.8) / 1.8
      ring.current.scale.setScalar(1 + t * 2.2)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - t)
    }
  })

  return (
    <group ref={group} position={target}>
      <mesh>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {pulse && (
        <mesh ref={ring} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[size * 1.4, size * 1.65, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {beam && (
        <>
          <mesh ref={beamMesh}>
            <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
          </mesh>
          <mesh ref={floorDot} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[size * 0.5, size * 0.85, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {anchorId && <Anchor id={anchorId} position={[0, size * 3.2, 0]} />}
    </group>
  )
}
