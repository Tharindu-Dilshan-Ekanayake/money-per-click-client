import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider } from '@react-three/rapier'
import { memo, useRef } from 'react'

import { EGGS } from '../core/config'
import { formatNumber } from '../core/format'
import { EGG_SPOTS, PET_AREA } from '../core/layout'
import { useGame } from '../core/store'
import { StaticBatch } from './batching'
import { COLORS } from './materials'
import { Egg } from './models'
import { Floor, Label } from './parts'

const EggStand = memo(function EggStand({ egg, spot, index }) {
  const near = useGame((s) => s.session.nearbyEgg === egg.id)
  const affordable = useGame((s) => s.data.wins >= egg.cost)
  const ref = useRef()

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    g.rotation.y += delta * (near ? 2.2 : 0.6)
    const t = state.clock.elapsedTime
    g.position.y = 2.55 + Math.sin(t * 1.6 + index) * 0.12
    // Excited wobble when you're close enough to open it.
    g.rotation.z = near ? Math.sin(t * 14) * 0.06 : 0
    const s = near ? 1.05 : 0.95
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, delta * 8))
  })

  const [x, z] = spot.center
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.3, 1.5, 1.2, 24]} />
        <meshStandardMaterial color={COLORS.navy} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[1.32, 1.32, 0.05, 24]} />
        <meshStandardMaterial color={egg.color} emissive={egg.color} emissiveIntensity={near ? 0.45 : 0.12} />
      </mesh>
      <CuboidCollider args={[1.15, 0.6, 1.15]} position={[0, 0.6, 0]} />
      <group ref={ref} position={[0, 2.55, 0]}>
        <Egg color={egg.color} spots={egg.spots} glow={index >= 3 ? 0.25 : 0} />
      </group>
      {index >= 2 && <Sparkles count={14 + index * 6} scale={[3, 3.4, 3]} position={[0, 2.6, 0]} size={4 + index} speed={0.5} color={egg.color} />}
      <Billboard position={[0, 5.3, 0]}>
        <Label size={0.62} color={egg.color}>
          {egg.name.toUpperCase()}
        </Label>
        <Label position={[0, -0.68, 0]} size={0.5} color={affordable ? '#fde047' : '#fca5a5'}>
          {`${formatNumber(egg.cost)} WINS`}
        </Label>
        {near && (
          <Label position={[0, -1.3, 0]} size={0.38} color="#ffffff">
            PRESS E TO OPEN
          </Label>
        )}
      </Billboard>
    </group>
  )
})

export function PetArea() {
  return (
    <group>
      <StaticBatch>
        <Floor center={PET_AREA.center} size={PET_AREA.size} color={COLORS.zonePets} />
        {/* Painted on the floor at the front, so it never hides the leaderboards. */}
        <Label
          position={[0, 0.1, PET_AREA.center[1] - PET_AREA.size[1] / 2 + 1.3]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
          size={1.1}
          color="#ffffff"
          outline="#db2777"
        >
          PETS - BOOST YOUR MONEY!
        </Label>
      </StaticBatch>
      {EGGS.map((egg, i) => (
        <EggStand key={egg.id} egg={egg} spot={EGG_SPOTS[i]} index={i} />
      ))}
    </group>
  )
}

export default PetArea
