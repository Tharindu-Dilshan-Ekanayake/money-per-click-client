import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { AdditiveBlending } from 'three'

import { ECONOMY } from '../core/config'
import { randomHubSpot } from '../core/layout'
import { playerRuntime } from '../core/runtime'
import { getGame, useGame } from '../core/store'
import { MoneyBag } from '../world/models'

const MAX_BAGS = 2
const BAG_LIFETIME_S = 70
const PICKUP_RADIUS = 1.7

let nextId = 0
const nextDelay = () => {
  const [lo, hi] = ECONOMY.luckyBagEverySeconds
  return lo + Math.random() * (hi - lo)
}

function Bag({ bag }) {
  const ref = useRef()
  useFrame((state, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 1.5
    ref.current.position.y = 0.3 + Math.sin(state.clock.elapsedTime * 2.5 + bag.id) * 0.2
  })
  return (
    <group position={[bag.x, 0, bag.z]}>
      <group ref={ref}>
        <MoneyBag scale={1.1} />
      </group>
      <Sparkles count={20} scale={[2.2, 2.5, 2.2]} position={[0, 1.2, 0]} size={5} color="#fde047" speed={0.8} />
      {/* Light beam so bags are visible from across the map. */}
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[0.35, 0.6, 24, 12, 1, true]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.22} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Lucky money bags appear around the hub every minute or so. Walking into one
 * pays a chunk of clicks' worth of money - a reason to keep exploring.
 */
export function LuckyBags() {
  const hydrated = useGame((s) => s.session.hydrated)
  const [bags, setBags] = useState([])
  const timer = useRef(nextDelay())

  useFrame((_, delta) => {
    if (!hydrated) return
    const dt = Math.min(delta, 0.1)
    timer.current -= dt
    if (timer.current <= 0) {
      timer.current = nextDelay()
      setBags((list) => {
        if (list.length >= MAX_BAGS) return list
        const [x, z] = randomHubSpot()
        return [...list, { id: (nextId += 1), x, z, born: performance.now() }]
      })
    }
    if (!bags.length) return
    const p = playerRuntime.position
    const now = performance.now()
    const keep = bags.filter((b) => {
      if (now - b.born > BAG_LIFETIME_S * 1000) return false
      if (Math.hypot(p.x - b.x, p.z - b.z) < PICKUP_RADIUS && p.y < 4) {
        getGame().collectLuckyBag()
        return false
      }
      return true
    })
    if (keep.length !== bags.length) setBags(keep)
  })

  return bags.map((bag) => <Bag key={bag.id} bag={bag} />)
}

export default LuckyBags
