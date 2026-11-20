import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { WaitSurface } from './WaitSurface'
import { ScenarioBeacon } from './ScenarioBeacon'
import { TestPointCloud } from './TestPointCloud'
import { AXIS_LABELS, AxisFrame } from './AxisFrame'
import { AnchorContext, LabelProjector, type AnchorRegistry } from './labels'
import { densify } from '../lib/landscape'
import { DAYS, formatHour, type Scenario } from '../lib/domain'
import type { TestVisit } from '../lib/artifacts'

export interface LandscapeProps {
  /** Network predictions for the current hour/day: staff 1..5 × queue 0..20 (staff-major). */
  surface: Float32Array
  scenario: Scenario
  scenarioWait: number
  /** Prediction with one more staff member (null at 5 staff). */
  plusOneWait: number | null
  pinned: Scenario | null
  pinnedWait: number | null
  visits: TestVisit[]
  focusId: number | null
  onSelectVisit: (v: TestVisit) => void
  reducedMotion: boolean
  lowPower: boolean
}

const CYAN_GLOW: [number, number, number] = [0.5, 2.6, 3.2]
const GHOST_GLOW: [number, number, number] = [0.6, 1.3, 1.6]
const AMBER_GLOW: [number, number, number] = [3.0, 1.4, 0.35]

/**
 * Keeps the landscape framed on any screen:
 * - wide screens: the control panel covers the left of the canvas, so shift the projection (not the
 *   camera) to centre the landscape in the free space; orbiting still pivots around it.
 * - narrow / portrait screens: widen the vertical field of view so the whole map fits horizontally.
 */
function ResponsiveCamera({ panelRight }: { panelRight: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const aspect = size.width / size.height
    camera.fov = THREE.MathUtils.clamp(34 * Math.max(1, 1.12 / aspect), 34, 56)
    const wide = size.width > 860
    const frac = wide ? Math.min(0.2, panelRight / 2 / size.width) : 0
    camera.filmOffset = -frac * camera.getFilmWidth() * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect
    camera.updateProjectionMatrix()
  }, [camera, size, panelRight])
  return null
}

export function ObservatoryCanvas(p: LandscapeProps) {
  const host = useRef<HTMLDivElement>(null)
  const labelLayer = useRef<HTMLDivElement>(null)
  const registry = useMemo<AnchorRegistry>(() => new Map(), [])
  const [visible, setVisible] = useState(true)
  const [idle, setIdle] = useState(true)
  const [hovered, setHovered] = useState<TestVisit | null>(null)
  const idleTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const dense = useMemo(() => densify(p.surface), [p.surface])
  const saving = p.plusOneWait === null ? null : p.scenarioWait - p.plusOneWait
  const shownVisit = hovered ?? p.visits.find((v) => v.id === p.focusId) ?? null

  const animate = visible && !p.reducedMotion
  return (
    <div
      ref={host}
      className="observatory-canvas"
      data-tour="map"
      role="img"
      aria-label="Three-dimensional map of predicted wait time by staff on shift and patients in queue"
    >
      <Canvas
        camera={{ position: [7.0, 9.8, 15.8], fov: 34, near: 0.1, far: 120 }}
        dpr={p.lowPower ? 1 : [1, 2]}
        frameloop={!visible ? 'never' : animate ? 'always' : 'demand'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <AnchorContext.Provider value={registry}>
          <ResponsiveCamera panelRight={430} />
          <LabelProjector layer={labelLayer} />
          <color attach="background" args={['#060a13']} />
          <fog attach="fog" args={['#060a13', 18, 38]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 9, 5]} intensity={1.15} />
          <directionalLight position={[-6, 4, -6]} intensity={0.35} color="#7aa7ff" />
          <Stars radius={70} depth={30} count={1800} factor={3} saturation={0} fade speed={animate ? 0.4 : 0} />
          <group position={[0, -1.3, 0]}>
            <AxisFrame />
            <WaitSurface values={dense} reducedMotion={p.reducedMotion} />
            <TestPointCloud
              visits={p.visits}
              focusId={p.focusId}
              shown={shownVisit}
              onHover={setHovered}
              onSelect={p.onSelectVisit}
            />
            {p.pinned && p.pinnedWait !== null && (
              <ScenarioBeacon
                staff={p.pinned.staff}
                queue={p.pinned.queue}
                wait={p.pinnedWait}
                glow={AMBER_GLOW}
                size={0.09}
                beam
                anchorId="beacon-pinned"
                reducedMotion={p.reducedMotion}
              />
            )}
            {p.plusOneWait !== null && (
              <ScenarioBeacon
                staff={p.scenario.staff + 1}
                queue={p.scenario.queue}
                wait={p.plusOneWait}
                glow={GHOST_GLOW}
                size={0.07}
                anchorId="beacon-ghost"
                reducedMotion={p.reducedMotion}
              />
            )}
            <ScenarioBeacon
              staff={p.scenario.staff}
              queue={p.scenario.queue}
              wait={p.scenarioWait}
              glow={CYAN_GLOW}
              size={0.11}
              pulse
              beam
              anchorId="beacon-current"
              reducedMotion={p.reducedMotion}
            />
          </group>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            minDistance={9}
            maxDistance={28}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI * 0.46}
            target={[0, -0.75, -0.6]}
            autoRotate={animate && idle}
            autoRotateSpeed={0.35}
            onStart={() => {
              setIdle(false)
              window.clearTimeout(idleTimer.current)
            }}
            onEnd={() => {
              window.clearTimeout(idleTimer.current)
              idleTimer.current = window.setTimeout(() => setIdle(true), 9000)
            }}
          />
          <EffectComposer multisampling={p.lowPower ? 0 : 4}>
            <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
          </EffectComposer>
        </AnchorContext.Provider>
      </Canvas>

      {/* Screen-space labels, positioned every frame by <LabelProjector>. */}
      <div ref={labelLayer} className="label-layer" aria-hidden="true">
        {AXIS_LABELS.map((l) => (
          <div key={l.id} data-anchor={l.id} className={l.className}>
            {l.text}
          </div>
        ))}
        {p.pinned && p.pinnedWait !== null && (
          <div data-anchor="beacon-pinned">
            <span className="beacon-tag pinned">Pinned · {Math.round(p.pinnedWait)} min</span>
          </div>
        )}
        {saving !== null && (
          <div data-anchor="beacon-ghost">
            <span className="beacon-tag ghost">
              +1 staff · {saving >= 0 ? '−' : '+'}
              {Math.abs(saving).toFixed(0)} min
            </span>
          </div>
        )}
        <div data-anchor="beacon-current">
          <span className="beacon-tag current">{Math.round(p.scenarioWait)} min</span>
        </div>
        {shownVisit && (
          <div data-anchor="visit-tip">
            <div className="tip" style={{ transform: 'translateY(-26px)' }}>
              <strong>{shownVisit.actual.toFixed(0)} min</strong> actual ·{' '}
              <strong>{shownVisit.nn.toFixed(0)} min</strong> predicted
              <span>
                Test visit · {DAYS[shownVisit.day]} {formatHour(shownVisit.hour)} · {shownVisit.staff} staff ·{' '}
                {shownVisit.queue} queued
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
