import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, DynamicDrawUsage, MeshStandardMaterial, Object3D, Vector3 } from 'three'

import { fx } from '../core/events'
import { TRAINING_SPOTS, winPad } from '../core/layout'
import { playerRuntime } from '../core/runtime'

const MAX = 220
const GRAVITY = -11
const _dummy = new Object3D()
const _origin = new Vector3()
const BILL_COLORS = ['#22c55e', '#16a34a', '#4ade80', '#86efac']
const GOLD_COLORS = ['#facc15', '#fde047', '#f59e0b']

/**
 * Pooled, instanced banknotes that burst out of the player's hand on every
 * click (and out of tables, bags and WIN pads). One draw call for all of them.
 */
export function MoneyBurst() {
  const mesh = useRef()
  // Particle state lives in a ref: it's mutated every frame, never rendered.
  const poolRef = useRef(null)
  const cursor = useRef(0)
  const getPool = () => {
    if (!poolRef.current) {
      poolRef.current = Array.from({ length: MAX }, () => ({
        life: 0,
        maxLife: 1,
        p: new Vector3(),
        v: new Vector3(),
        r: new Vector3(),
        w: new Vector3(),
        s: 1,
      }))
    }
    return poolRef.current
  }
  const geometry = useMemo(() => new BoxGeometry(0.34, 0.02, 0.17), [])
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, emissive: '#052e16', emissiveIntensity: 0.25 }), [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useEffect(() => {
    const color = new Color()
    const spawn = (origin, count, { speed = 4, up = 4, spread = 1, scale = 1, gold = false, life = 1.1 } = {}) => {
      const m = mesh.current
      if (!m) return
      const pool = getPool()
      for (let i = 0; i < count; i += 1) {
        const idx = cursor.current
        cursor.current = (cursor.current + 1) % MAX
        const part = pool[idx]
        const a = Math.random() * Math.PI * 2
        const h = (0.3 + Math.random() * 0.7) * speed * spread
        part.p.copy(origin)
        part.v.set(Math.cos(a) * h, up * (0.6 + Math.random() * 0.6), Math.sin(a) * h)
        part.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
        part.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
        part.life = life * (0.7 + Math.random() * 0.5)
        part.maxLife = part.life
        part.s = scale * (0.8 + Math.random() * 0.4)
        const palette = gold ? GOLD_COLORS : BILL_COLORS
        m.setColorAt(idx, color.set(palette[(Math.random() * palette.length) | 0]))
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }

    const offs = [
      fx.on('click', ({ combo, crit }) => {
        if (crit) spawn(playerRuntime.hand, 14, { speed: 4, up: 6, scale: 1.1, gold: true, life: 1.2 })
        else spawn(playerRuntime.hand, combo > 15 ? 4 : 2, { speed: 2.2, up: 4.2, scale: 0.8, life: 0.9 })
      }),
      fx.on('remoteClick', ({ x, y, z, count }) => {
        _origin.set(x, y, z)
        spawn(_origin, Math.min(4, 1 + count), { speed: 2.2, up: 4.2, scale: 0.8, life: 0.9 })
      }),
      fx.on('afk', ({ index }) => {
        const spot = TRAINING_SPOTS[index]
        if (!spot) return
        _origin.set(spot.center[0], 1.4, spot.center[1])
        spawn(_origin, 3, { speed: 1.5, up: 4.5, scale: 0.9 })
      }),
      fx.on('luckyBag', () => spawn(playerRuntime.position, 36, { speed: 5, up: 7, scale: 1.2, gold: true, life: 1.6 })),
      fx.on('win', ({ index }) => {
        const pad = winPad(index)
        _origin.set(pad.center[0], 1, pad.center[1])
        spawn(_origin, 40, { speed: 4, up: 8, gold: true, scale: 1.2, life: 1.6 })
      }),
      fx.on('levelUp', () => spawn(playerRuntime.position, 18, { speed: 3, up: 6, gold: true, life: 1.3 })),
      fx.on('rebirth', () => spawn(playerRuntime.position, 80, { speed: 7, up: 10, scale: 1.4, life: 2 })),
      fx.on('buy', ({ kind }) => {
        if (kind === 'cash') spawn(playerRuntime.position, 8, { speed: 2.5, up: 5, life: 1 })
        if (kind === 'cashTier') spawn(playerRuntime.position, 50, { speed: 5, up: 8, scale: 1.3, life: 1.6 })
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const pool = getPool()
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < MAX; i += 1) {
      const part = pool[i]
      if (part.life <= 0) {
        _dummy.scale.setScalar(0)
        _dummy.updateMatrix()
        m.setMatrixAt(i, _dummy.matrix)
        continue
      }
      part.life -= dt
      part.v.y += GRAVITY * dt
      // Paper flutters: heavy drag once it starts falling.
      if (part.v.y < 0) part.v.multiplyScalar(1 - dt * 2.2)
      part.p.addScaledVector(part.v, dt)
      part.r.addScaledVector(part.w, dt)
      const fade = Math.min(1, part.life / (part.maxLife * 0.35))
      _dummy.position.copy(part.p)
      _dummy.rotation.set(part.r.x, part.r.y, part.r.z)
      _dummy.scale.setScalar(part.s * fade)
      _dummy.updateMatrix()
      m.setMatrixAt(i, _dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(m) => {
        mesh.current = m
        if (!m || m.userData.ready) return
        // Colors must exist before the first render so the shader compiles
        // with instance colors; matrices start hidden (scale 0).
        m.instanceMatrix.setUsage(DynamicDrawUsage)
        const white = new Color('#ffffff')
        _dummy.scale.setScalar(0)
        _dummy.updateMatrix()
        for (let i = 0; i < MAX; i += 1) {
          m.setColorAt(i, white)
          m.setMatrixAt(i, _dummy.matrix)
        }
        m.userData.ready = true
      }}
      args={[geometry, material, MAX]}
      frustumCulled={false}
      castShadow={false}
    />
  )
}

export default MoneyBurst
