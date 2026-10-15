import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, DoubleSide } from 'three'

import { fx } from '../core/events'
import { gateZ, winPad } from '../core/layout'
import { playerRuntime } from '../core/runtime'

let nextId = 0

/** One expanding, fading ring (plus an optional light pillar). */
function Burst({ burst, onDone }) {
  const ring = useRef()
  const pillar = useRef()
  const start = useRef(null)
  const color = useMemo(() => new Color(burst.color), [burst.color])

  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - start.current) / burst.duration
    if (t >= 1) {
      onDone(burst.id)
      return
    }
    const ease = 1 - (1 - t) ** 3
    if (ring.current) {
      ring.current.scale.setScalar(0.3 + ease * burst.size)
      ring.current.material.opacity = (1 - t) * 0.9
    }
    if (pillar.current) {
      pillar.current.scale.set(1 - t * 0.6, 1 + ease * 0.4, 1 - t * 0.6)
      pillar.current.material.opacity = (1 - t) * 0.55
    }
  })

  return (
    <group position={burst.position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {burst.pillar && (
        <mesh ref={pillar} position={[0, 4, 0]}>
          <cylinderGeometry args={[burst.pillar, burst.pillar, 8, 24, 1, true]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** Shockwave rings for level-ups, gates, wins and rebirths. */
export function Bursts() {
  const [bursts, setBursts] = useState([])

  useEffect(() => {
    const add = (b) => setBursts((list) => [...list.slice(-12), { id: (nextId += 1), duration: 0.9, size: 4, ...b }])
    const feet = () => [playerRuntime.position.x, playerRuntime.position.y - 0.9, playerRuntime.position.z]
    const offs = [
      fx.on('levelUp', ({ titleChanged }) => {
        add({ position: feet(), color: '#facc15', size: 5, pillar: titleChanged ? 1.2 : 0 })
        if (titleChanged) add({ position: feet(), color: '#f472b6', size: 8, duration: 1.3 })
      }),
      fx.on('gateOpen', ({ index }) => add({ position: [0, 0, gateZ(index)], color: '#4ade80', size: 6, duration: 0.8 })),
      fx.on('win', ({ index }) => {
        const pad = winPad(index)
        add({ position: [pad.center[0], 0, pad.center[1]], color: '#fde047', size: 6, pillar: 1.6 })
      }),
      fx.on('rebirth', () => {
        add({ position: feet(), color: '#a855f7', size: 12, duration: 1.6, pillar: 2 })
        add({ position: feet(), color: '#22d3ee', size: 18, duration: 2.2 })
      }),
      fx.on('boost', () => add({ position: feet(), color: '#38bdf8', size: 6, pillar: 1 })),
      fx.on('buy', ({ kind }) => {
        if (kind === 'cashTier') add({ position: feet(), color: '#4ade80', size: 7, pillar: 1.3, duration: 1.1 })
      }),
      fx.on('teleport', ({ position }) => add({ position: [position[0], 0, position[2]], color: '#ffffff', size: 4, duration: 0.6 })),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const remove = (id) => setBursts((list) => list.filter((b) => b.id !== id))
  return bursts.map((b) => <Burst key={b.id} burst={b} onDone={remove} />)
}

export default Bursts
