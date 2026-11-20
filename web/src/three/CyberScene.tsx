/**
 * Cyberpunk set dressing around the data landscape (never on top of it):
 * - Skyline: a ring of neon-windowed towers beyond the axes, fogged so the data stays the focus.
 * - HoloFloor: a glowing cyan perspective grid with a pulse rippling outward.
 * - ScanSweep: an acid-yellow scan plane sweeping across the map every few seconds.
 * Motion stops when effects are calm / reduced (the scene still renders, just still).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD } from '../lib/landscape'

function windowTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#05070d'
  g.fillRect(0, 0, 64, 128)
  let r = seed
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  for (let y = 4; y < 124; y += 6) {
    for (let x = 4; x < 60; x += 6) {
      const v = rand()
      if (v < 0.42) continue
      g.fillStyle = v > 0.94 ? '#e8ff3a' : v > 0.7 ? '#00f0ff' : '#0c4a5a'
      g.fillRect(x, y, 3, 3)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

export function Skyline({ animate }: { animate: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const signs = useRef<THREE.InstancedMesh>(null)
  const { towers, texture, signData } = useMemo(() => {
    const towers: { x: number; z: number; w: number; d: number; h: number }[] = []
    let r = 7
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + rand() * 0.08
      const dist = 11 + rand() * 7
      towers.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, w: 0.7 + rand() * 1.1, d: 0.7 + rand() * 1.1, h: 1.5 + rand() * 6.5 })
    }
    const signData = towers.filter((_, i) => i % 5 === 0).map((t, i) => ({ ...t, color: i % 3 === 0 ? '#e8ff3a' : '#00f0ff' }))
    return { towers, texture: windowTexture(11), signData }
  }, [])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    towers.forEach((t, i) => {
      o.position.set(t.x, t.h / 2, t.z)
      o.scale.set(t.w, t.h, t.d)
      o.lookAt(0, t.h / 2, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    const s = signs.current
    if (!s) return
    signData.forEach((t, i) => {
      o.position.set(t.x, t.h + 0.12, t.z)
      o.scale.set(t.w * 0.9, 0.08, 0.08)
      o.lookAt(0, t.h, 0)
      o.updateMatrix()
      s.setMatrixAt(i, o.matrix)
      s.setColorAt(i, new THREE.Color(t.color).multiplyScalar(2.2))
    })
    s.instanceMatrix.needsUpdate = true
    if (s.instanceColor) s.instanceColor.needsUpdate = true
  }, [towers, signData])

  // A couple of signs flicker (slow, well under 3 Hz).
  useFrame(({ clock }) => {
    const s = signs.current
    if (!s || !animate) return
    const mat = s.material as THREE.MeshBasicMaterial
    mat.opacity = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.1) * Math.sin(clock.elapsedTime * 0.7)
  })

  return (
    <group position={[0, -0.02, 0]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={1.6} color="#0a0f1a" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={signs} args={[undefined, undefined, signData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  )
}

const floorVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const floorFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vPos;
  float line(float v, float w) { float d = abs(fract(v - 0.5) - 0.5); return 1.0 - smoothstep(0.0, w, d); }
  void main() {
    float dist = length(vPos);
    float grid = max(line(vPos.x / 1.5, 0.03), line(vPos.y / 1.5, 0.03));
    float fade = 1.0 - smoothstep(6.0, 26.0, dist);
    float pulse = 1.0 - smoothstep(0.0, 0.6, abs(dist - mod(uTime * 4.0, 30.0)));
    vec3 cyan = vec3(0.0, 0.94, 1.0);
    vec3 col = cyan * grid * (0.35 + 0.9 * pulse) * fade;
    float alpha = grid * fade * (0.45 + 0.5 * pulse);
    gl_FragColor = vec4(col * 1.6, alpha);
  }
`

export function HoloFloor({ animate }: { animate: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, dt) => {
    if (animate && mat.current) mat.current.uniforms.uTime.value += dt
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
      <planeGeometry args={[60, 60, 1, 1]} />
      <shaderMaterial
        ref={mat}
        vertexShader={floorVertex}
        fragmentShader={floorFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function ScanSweep({ animate }: { animate: boolean }) {
  const plane = useRef<THREE.Mesh>(null)
  const edge = useRef<THREE.Mesh>(null)
  const period = 6.5
  useFrame(({ clock }) => {
    if (!plane.current || !edge.current) return
    const visible = animate
    plane.current.visible = visible
    edge.current.visible = visible
    if (!visible) return
    const t = (clock.elapsedTime % period) / period // 0..1
    const z = WORLD.zHalf + 0.3 - t * (2 * WORLD.zHalf + 0.6)
    plane.current.position.z = z
    edge.current.position.z = z
    const fade = Math.sin(Math.PI * t)
    ;(plane.current.material as THREE.MeshBasicMaterial).opacity = 0.035 * fade
    ;(edge.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade
  })
  const h = WORLD.height + 0.4
  return (
    <group>
      <mesh ref={plane} position={[0, h / 2, 0]}>
        <planeGeometry args={[2 * WORLD.xHalf + 0.6, h]} />
        <meshBasicMaterial color={new THREE.Color(2.2, 2.6, 0.5)} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={edge} position={[0, 0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2 * WORLD.xHalf + 0.6, 0.05]} />
        <meshBasicMaterial color={new THREE.Color(2.6, 3.0, 0.6)} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
