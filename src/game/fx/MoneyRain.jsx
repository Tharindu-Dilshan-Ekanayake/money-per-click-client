import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferAttribute, Color, MeshStandardMaterial, Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { MONEY_RAIN } from '../core/config'
import { moneyRainStatus } from '../core/formulas'
import { HUB } from '../core/layout'
import { playerRuntime } from '../core/runtime'
import { getGame } from '../core/store'

const FALL_SPEED = 3.2
/** Seconds a bill stays on the ground before it fades away. */
const GROUND_SECONDS = 9
const PICKUP_RADIUS = 1.5
const _dummy = new Object3D()
const _color = new Color()

function painted(geometry, hex) {
  _color.set(hex)
  const n = geometry.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) colors.set([_color.r, _color.g, _color.b], i * 3)
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** A banknote with a paper band, as one vertex-colored geometry. */
function billGeometry() {
  const note = painted(new BoxGeometry(0.9, 0.035, 0.45), '#22c55e')
  const band = painted(new BoxGeometry(0.2, 0.04, 0.46), '#fef9c3')
  const merged = mergeGeometries([note, band])
  note.dispose()
  band.dispose()
  return merged
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * The hourly money rain (see MONEY_RAIN): bills flutter down around the player
 * in the lobby, land, and are picked up by walking over them. All bills are
 * one instanced mesh (one draw call) and nothing allocates per frame.
 */
export function MoneyRain() {
  const mesh = useRef()
  const bills = useRef([])
  const spawnBudget = useRef(0)
  const geometry = useMemo(() => billGeometry(), [])
  const material = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: '#14532d', emissiveIntensity: 0.35 }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    const { session } = getGame()
    const now = Date.now()
    const p = playerRuntime.position
    const list = bills.current

    // Spawn around the player while it rains and they're in the (roofless) lobby.
    const inLobby = p.z > HUB.northZ && p.y < 6
    if (session.hydrated && !session.paused && inLobby && moneyRainStatus(now, session.rainForcedUntil).active) {
      spawnBudget.current += dt * MONEY_RAIN.spawnPerSecond
      while (spawnBudget.current >= 1) {
        spawnBudget.current -= 1
        if (list.length >= MONEY_RAIN.maxBills) break
        const angle = Math.random() * Math.PI * 2
        const r = 1.5 + Math.random() * MONEY_RAIN.radius
        list.push({
          x: clamp(p.x + Math.cos(angle) * r, -HUB.halfX + 1.5, HUB.halfX - 1.5),
          z: clamp(p.z + Math.sin(angle) * r, HUB.northZ + 1.5, HUB.southZ - 1.5),
          y: 10 + Math.random() * 6,
          phase: Math.random() * 6.28,
          landedAt: 0,
        })
      }
    } else {
      spawnBudget.current = 0
    }

    let count = 0
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const b = list[i]
      if (!b.landedAt) {
        b.y -= FALL_SPEED * dt
        if (b.y <= 0.08) {
          b.y = 0.08
          b.landedAt = now
        }
      }
      const picked = Math.hypot(p.x - b.x, p.z - b.z) < PICKUP_RADIUS && b.y < p.y + 1.6
      const expired = b.landedAt && now - b.landedAt > GROUND_SECONDS * 1000
      if (picked) getGame().collectRainBill()
      if (picked || expired) {
        list[i] = list[list.length - 1]
        list.pop()
        continue
      }
      if (b.landedAt) {
        // Lying on the ground; blinks during its last two seconds.
        const left = GROUND_SECONDS - (now - b.landedAt) / 1000
        const blink = left < 2 && Math.sin(t * 18) < 0 ? 0.001 : 1
        _dummy.position.set(b.x, b.y, b.z)
        _dummy.rotation.set(0, b.phase + t * 0.6, 0)
        _dummy.scale.setScalar(blink)
      } else {
        // Fluttering down like paper.
        _dummy.position.set(b.x + Math.sin(t * 2 + b.phase) * 0.35, b.y, b.z + Math.cos(t * 1.7 + b.phase) * 0.25)
        _dummy.rotation.set(Math.sin(t * 3 + b.phase) * 0.7, t * 2 + b.phase, Math.cos(t * 2.5 + b.phase) * 0.5)
        _dummy.scale.setScalar(1)
      }
      _dummy.updateMatrix()
      m.setMatrixAt(count, _dummy.matrix)
      count += 1
    }
    m.count = count
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, material, MONEY_RAIN.maxBills]} frustumCulled={false} castShadow />
}

export default MoneyRain
