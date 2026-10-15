import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MeshBasicMaterial, Object3D, Shape, ShapeGeometry } from 'three'

import { CASH_TIERS, TUTORIAL } from '../core/config'
import { stageCost } from '../core/formulas'
import { guideRoute, guideTarget } from '../core/layout'
import { playerRuntime } from '../core/runtime'
import { getGame, useGame } from '../core/store'
import { Label } from '../world/parts'

const COUNT = 64
const SPACING = 1.25
/** Chevrons flow toward the target at this speed (units per second). */
const FLOW_SPEED = 2.2
const START = 1.4
const _dummy = new Object3D()
const _route = []
const _lengths = []

function chevronGeometry() {
  // A thick ">" pointing +Y, laid flat so it points -Z.
  const s = new Shape()
  s.moveTo(-0.5, -0.28)
  s.lineTo(0, 0.22)
  s.lineTo(0.5, -0.28)
  s.lineTo(0.5, 0.06)
  s.lineTo(0, 0.56)
  s.lineTo(-0.5, 0.06)
  s.closePath()
  const geo = new ShapeGeometry(s)
  geo.rotateX(-Math.PI / 2)
  return geo
}

const MARKER_TEXT = { table: 'TRAIN HERE', gate: 'PAY $100 & ENTER', winpad: 'STEP HERE FOR WINS', cash: 'UNLOCK +3 MONEY' }

/** Where the current guide step points (or null when there is no guide). */
function currentTarget(data, session) {
  if (!session.hydrated || data.tutorial.done) return null
  const step = TUTORIAL[data.tutorial.step]
  if (!step?.guide) return null
  return guideTarget(step.guide, {
    runStage: session.runStage,
    wins: data.wins,
    money: data.money,
    gateCost: stageCost(0),
    cashCost: CASH_TIERS[1].cost,
  })
}

/**
 * The first-time guide in the world: glowing chevrons flowing along the ground
 * from the player to the objective (round the corridor mouth and through the
 * gate openings when needed), plus a bouncing arrow, a spinning ring and a
 * "TRAIN HERE"-style label over the objective.
 */
export function GuideArrows() {
  const mesh = useRef()
  const marker = useRef()
  const ring = useRef()
  const geometry = useMemo(() => chevronGeometry(), [])
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  // The label only changes when the objective changes (one re-render per step).
  const markerKind = useGame((s) => currentTarget(s.data, s.session)?.kind || null)

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const { data, session } = getGame()
    const target = currentTarget(data, session)
    const p = playerRuntime.position
    const t = state.clock.elapsedTime
    let visible = 0

    if (target && p.y < 6) {
      const route = guideRoute([p.x, p.z], target.at)
      _route.length = 0
      _lengths.length = 0
      let total = 0
      for (let i = 0; i < route.length - 1; i += 1) {
        const len = Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1])
        _route.push(route[i])
        _lengths.push(len)
        total += len
      }
      _route.push(route[route.length - 1])
      // Chevrons slide along the route toward the target.
      const offset = (t * FLOW_SPEED) % SPACING
      let seg = 0
      let segStart = 0
      for (let along = START + offset; along < total - 1.2 && visible < COUNT; along += SPACING) {
        while (seg < _lengths.length - 1 && along > segStart + _lengths[seg]) {
          segStart += _lengths[seg]
          seg += 1
        }
        const len = _lengths[seg] || 1
        const k = (along - segStart) / len
        const a = _route[seg]
        const b = _route[seg + 1]
        const ux = (b[0] - a[0]) / len
        const uz = (b[1] - a[1]) / len
        // Grow in near the player, shimmer as a wave travels along.
        const grow = Math.min(1, (along - START) / 1.5 + 0.35)
        const wave = 0.85 + 0.15 * Math.sin(t * 7 - along * 1.3)
        _dummy.position.set(a[0] + (b[0] - a[0]) * k, 0.11, a[1] + (b[1] - a[1]) * k)
        _dummy.rotation.set(0, Math.atan2(-ux, -uz), 0)
        _dummy.scale.setScalar(grow * wave)
        _dummy.updateMatrix()
        m.setMatrixAt(visible, _dummy.matrix)
        visible += 1
      }
      if (marker.current) {
        marker.current.visible = true
        marker.current.position.set(target.at[0], 0, target.at[1])
      }
      const bounce = Math.abs(Math.sin(t * 3))
      if (ring.current) {
        ring.current.rotation.z = t * 1.5
        ring.current.scale.setScalar(1 + bounce * 0.08)
      }
      const arrow = marker.current?.children[0]
      if (arrow) arrow.position.y = 3.4 + bounce * 0.7
    } else if (marker.current) {
      marker.current.visible = false
    }
    m.count = visible
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={2} />
      <group ref={marker} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, 3.4, 0]}>
          <coneGeometry args={[0.6, 1.2, 4]} />
          <meshBasicMaterial color="#facc15" toneMapped={false} />
        </mesh>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]} renderOrder={2}>
          <ringGeometry args={[1.25, 1.6, 32, 1, 0, Math.PI * 1.6]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
        {markerKind && (
          <Billboard position={[0, 5, 0]}>
            <Label size={0.6} color="#fde047">
              {MARKER_TEXT[markerKind] || ''}
            </Label>
          </Billboard>
        )}
      </group>
    </>
  )
}

export default GuideArrows
