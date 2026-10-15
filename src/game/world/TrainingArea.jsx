import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider } from '@react-three/rapier'
import { memo, useRef } from 'react'

import { TRAINING_TABLES } from '../core/config'
import { formatMoney } from '../core/format'
import { afkIncomePerSecond, tableRequirementText, tableUnlocked } from '../core/formulas'
import { HUB, TRAINING_AREA, TRAINING_RING, TRAINING_SPOTS } from '../core/layout'
import { useGame } from '../core/store'
import { StaticBatch } from './batching'
import { cashLook } from './cashTiers'
import { COLORS } from './materials'
import { CashStack } from './models'
import { Block, Floor, Label, Sign } from './parts'

const LOCKED_COLOR = '#64748b'

function ActiveIncome({ index }) {
  const perSecond = useGame((s) => afkIncomePerSecond(s.data, index, Date.now()))
  return (
    <Label position={[0, -1.2, 0]} size={0.48} color="#fde047">
      {`+${formatMoney(perSecond)}/s`}
    </Label>
  )
}

/** One table on its round rug, long side along the ring, facing the statue. */
const TrainingTable = memo(function TrainingTable({ spot }) {
  const table = TRAINING_TABLES[spot.index]
  const unlocked = useGame((s) => tableUnlocked(s.data, spot.index))
  const active = useGame((s) => s.session.activeTable === spot.index)
  const stacks = useRef()

  useFrame((state) => {
    // Cash on an active table jiggles like it's being counted.
    if (!stacks.current) return
    stacks.current.position.y = active && unlocked ? 1.12 + Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.08 : 1.12
  })

  const [x, z] = spot.center
  const rugColor = unlocked ? table.color : LOCKED_COLOR
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[spot.radius, 40]} />
        <meshStandardMaterial
          color={rugColor}
          emissive={active && unlocked ? rugColor : '#000000'}
          emissiveIntensity={0.35}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[spot.radius - 0.2, spot.radius, 40]} />
        <meshStandardMaterial color={unlocked ? '#ffffff' : '#94a3b8'} roughness={0.6} />
      </mesh>
      <CuboidCollider args={[1.4, 0.56, 0.7]} position={[0, 0.56, 0]} rotation={[0, spot.rotation, 0]} />
      <group rotation={[0, spot.rotation, 0]}>
        <group ref={stacks} position={[0, 1.12, 0]}>
          <CashStack tier={cashLook(2 + spot.index * 1.5)} scale={0.9} rotation={[0, 0.3, 0]} />
        </group>
      </group>

      <Billboard position={[0, 3.9, 0]}>
        <Label size={0.8} color={unlocked ? '#4ade80' : '#cbd5e1'}>
          {`x${table.mult} MONEY`}
        </Label>
        <Label position={[0, -0.66, 0]} size={0.38} color={unlocked ? '#ffffff' : '#fca5a5'}>
          {unlocked ? (active ? 'EARNING...' : 'STAND HERE') : `NEEDS ${tableRequirementText(spot.index).toUpperCase()}`}
        </Label>
        {active && unlocked && <ActiveIncome index={spot.index} />}
      </Billboard>
    </group>
  )
})

/** The wooden tables themselves (static, so they all merge into two draw calls). */
function TableFurniture({ spot }) {
  const [x, z] = spot.center
  return (
    <group position={[x, 0, z]} rotation={[0, spot.rotation, 0]}>
      <Block size={[2.8, 0.22, 1.4]} position={[0, 1.0, 0]} color={COLORS.wood} />
      {[
        [-1.2, -0.55],
        [1.2, -0.55],
        [-1.2, 0.55],
        [1.2, 0.55],
      ].map(([lx, lz]) => (
        <Block key={`${lx}${lz}`} size={[0.22, 0.9, 0.22]} position={[lx, 0.45, lz]} color={COLORS.woodDark} studs={false} />
      ))}
    </group>
  )
}

/** Giant golden dumbbell spinning on a pedestal in the middle of the ring. */
function DumbbellStatue() {
  const bell = useRef()
  useFrame((state, delta) => {
    const b = bell.current
    if (!b) return
    b.rotation.y += delta * 0.6
    b.position.y = 3.1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.15
  })
  const [x, z] = TRAINING_RING.center
  const r = TRAINING_RING.statueRadius
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r + 0.25, 1.1, 8]} />
        <meshStandardMaterial color={COLORS.navy} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <cylinderGeometry args={[r + 0.02, r + 0.02, 0.06, 8]} />
        <meshStandardMaterial color={COLORS.gold} emissive={COLORS.gold} emissiveIntensity={0.3} />
      </mesh>
      <CuboidCollider args={[r * 0.85, 0.55, r * 0.85]} position={[0, 0.55, 0]} />
      <group ref={bell} position={[0, 3.1, 0]} rotation={[0, 0, 0.25]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 3.4, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.85, 0.85, 0.45, 20]} />
              <meshStandardMaterial color={COLORS.gold} metalness={0.55} roughness={0.25} emissive={COLORS.gold} emissiveIntensity={0.15} />
            </mesh>
            <mesh position={[side * 1.6, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.6, 0.6, 0.3, 20]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.55} roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

export function TrainingArea() {
  return (
    <group>
      <StaticBatch>
        <Floor center={TRAINING_AREA.center} size={TRAINING_AREA.size} y={0.02} color={COLORS.zoneTraining} />
        <Sign
          title="TRAINING"
          subtitle="Earn Automatically!"
          position={[-HUB.halfX + 0.05, 5.4, TRAINING_RING.center[1]]}
          rotation={[0, Math.PI / 2, 0]}
          subColor="#fde047"
          size={2}
        />
        {TRAINING_SPOTS.map((spot) => (
          <TableFurniture key={spot.index} spot={spot} />
        ))}
      </StaticBatch>
      <DumbbellStatue />
      {TRAINING_SPOTS.map((spot) => (
        <TrainingTable key={spot.index} spot={spot} />
      ))}
    </group>
  )
}

export default TrainingArea
