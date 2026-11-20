/**
 * Screen-space labels for the 3-D scene.
 *
 * Scene components drop invisible <Anchor>s; a single <LabelProjector> projects every anchor to the
 * screen each frame and moves the matching DOM label (rendered outside the <Canvas> in a
 * pointer-transparent overlay). One render loop, ordinary DOM text, no per-label React roots.
 */
import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type AnchorRegistry = Map<string, THREE.Object3D>
export const AnchorContext = createContext<AnchorRegistry | null>(null)

export function Anchor({ id, position = [0, 0, 0] }: { id: string; position?: [number, number, number] }) {
  const registry = useContext(AnchorContext)
  const ref = useRef<THREE.Object3D>(null)
  useLayoutEffect(() => {
    const obj = ref.current
    if (!registry || !obj) return
    registry.set(id, obj)
    return () => {
      if (registry.get(id) === obj) registry.delete(id)
    }
  }, [registry, id])
  return <object3D ref={ref} position={position} />
}

const v = new THREE.Vector3()

export function LabelProjector({ layer }: { layer: RefObject<HTMLDivElement | null> }) {
  const registry = useContext(AnchorContext)
  useFrame(({ camera, size }) => {
    const root = layer.current
    if (!root || !registry) return
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const id = el.dataset.anchor
      const obj = id ? registry.get(id) : undefined
      if (!obj) {
        el.style.visibility = 'hidden'
        continue
      }
      obj.getWorldPosition(v)
      v.project(camera)
      if (v.z > 1 || v.z < -1) {
        el.style.visibility = 'hidden'
        continue
      }
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
      el.style.visibility = 'visible'
    }
  })
  return null
}
