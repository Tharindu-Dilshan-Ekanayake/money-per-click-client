import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider } from '@react-three/rapier'
import { memo, useRef } from 'react'

import { CASH_TIERS, CASH_UPGRADES } from '../core/config'
import { formatMoney, formatNumber } from '../core/format'
import { cashUpgradeCost } from '../core/formulas'
import { CASH_PADS, HUB, UPGRADE_AREA, UPGRADE_PADS } from '../core/layout'
import { useGame } from '../core/store'
import { StaticBatch } from './batching'
import { cashLook } from './cashTiers'
import { COLORS } from './materials'
import { CashStack } from './models'
import { Block, Floor, Label, Sign } from './parts'

/** Floating height of a pedestal's cash: later rows float higher (a pyramid). */
const pedestalHeight = (pad) => 1.9 + pad.row * 1.3

/** One "Unlock Better Cash" pedestal: walk onto it to unlock (Wins) or equip. */
const CashPedestal = memo(function CashPedestal({ pad }) {
  const tier = CASH_TIERS[pad.index]
  const owned = useGame((s) => s.data.cashTiers.owned > pad.index)
  const equipped = useGame((s) => s.data.cashTiers.equipped === pad.index)
  const isNext = useGame((s) => s.data.cashTiers.owned === pad.index)
  const affordable = useGame((s) => s.data.cashTiers.owned === pad.index && s.data.wins >= tier.cost)
  const cash = useRef()
  const height = pedestalHeight(pad)

  useFrame((state, delta) => {
    if (!cash.current) return
    cash.current.rotation.y += delta * (equipped ? 1.6 : 0.7)
    cash.current.position.y = height + Math.sin(state.clock.elapsedTime * 1.8 + pad.index) * 0.12
  })

  const [x, z] = pad.center
  const padColor = equipped ? '#22c55e' : owned ? '#16a34a' : affordable ? '#facc15' : '#dc2626'
  let status
  let statusColor
  if (equipped) {
    status = 'EQUIPPED'
    statusColor = '#86efac'
  } else if (owned) {
    status = 'UNLOCKED'
    statusColor = '#bbf7d0'
  } else {
    status = `${formatNumber(tier.cost)} WINS`
    statusColor = affordable ? '#fde047' : isNext ? '#fca5a5' : '#cbd5e1'
  }

  return (
    <group position={[x, 0, z]}>
      <Block
        size={[pad.half[0] * 2, 0.16, pad.half[1] * 2]}
        position={[0, 0.08, 0]}
        color={padColor}
        emissive={equipped || affordable ? padColor : null}
        emissiveIntensity={0.3}
        castShadow={false}
      />
      <group ref={cash} position={[0, height, 0]}>
        <CashStack tier={cashLook(pad.index)} scale={1.1 + pad.row * 0.2} position={[0, -0.25, 0]} />
      </group>
      {affordable && <Sparkles count={14} scale={[2.2, 2.2, 2.2]} position={[0, height, 0]} size={4} color="#fde047" speed={0.6} />}
      <Billboard position={[0, height + 1.9, 0]}>
        <Label size={0.62} color="#4ade80">
          {`+${formatNumber(tier.value)} MONEY`}
        </Label>
        <Label position={[0, -0.62, 0]} size={0.45} color={statusColor}>
          {status}
        </Label>
      </Billboard>
    </group>
  )
})

/** Money boost station (Click / Walk / AFK): stand on the pad to keep buying. */
const BoostStation = memo(function BoostStation({ pad }) {
  const def = CASH_UPGRADES[pad.key]
  const level = useGame((s) => s.data.cashUpgrades[pad.key])
  const cost = useGame((s) => cashUpgradeCost(pad.key, s.data.cashUpgrades[pad.key], s.data))
  const affordable = useGame((s) => s.data.money >= cashUpgradeCost(pad.key, s.data.cashUpgrades[pad.key], s.data))

  const [x, z] = pad.center
  return (
    <group>
      <Block
        size={[pad.half[0] * 2, 0.12, pad.half[1] * 2]}
        position={[x, 0.06, z]}
        color={def.color}
        emissive={affordable ? def.color : null}
        emissiveIntensity={0.3}
        castShadow={false}
      />
      <Label position={[x, 0.14, z]} rotation={[-Math.PI / 2, 0, Math.PI]} size={0.3} color="#ffffff">
        STAND HERE
      </Label>
      <group position={[x, 0, z + 2.9]}>
        <CuboidCollider args={[0.9, 0.5, 0.9]} position={[0, 0.5, 0]} />
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 1, 1, 20]} />
          <meshStandardMaterial color={def.color} roughness={0.6} />
        </mesh>
        <Billboard position={[0, 2.6, 0]}>
          <Label size={0.5} color={def.color}>
            {def.name.toUpperCase()}
          </Label>
          <Label position={[0, -0.58, 0]} size={0.36} color="#ffffff">
            {`Lv ${level} · +${Math.round(def.perLevel * 100 * level)}%`}
          </Label>
          <Label position={[0, -1.12, 0]} size={0.46} color={affordable ? '#4ade80' : '#f87171'}>
            {formatMoney(cost)}
          </Label>
        </Billboard>
      </group>
    </group>
  )
})

export function UpgradeArea() {
  const boostsX = UPGRADE_PADS.reduce((sum, p) => sum + p.center[0], 0) / UPGRADE_PADS.length
  return (
    <group>
      <StaticBatch>
        <Floor center={UPGRADE_AREA.center} size={UPGRADE_AREA.size} color={COLORS.zoneUpgrade} />
        {/* Thin pillars so higher rows read as a pyramid of floating cash. */}
        {CASH_PADS.map((pad) => {
          const height = pedestalHeight(pad)
          return (
            <Block
              key={pad.index}
              size={[0.3, height - 0.6, 0.3]}
              position={[pad.center[0], (height - 0.6) / 2, pad.center[1]]}
              color={COLORS.navy}
              studs={false}
              castShadow={false}
            />
          )
        })}
        {/* The big sign hangs on the lobby wall behind the pyramid, like the reference. */}
        <Sign
          title="UPGRADES"
          subtitle="Unlock Better Cash!"
          position={[HUB.halfX - 0.05, 5.4, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          size={1.8}
        />
        <Label position={[boostsX, 0.2, 10.8]} rotation={[-Math.PI / 2, 0, Math.PI]} size={0.5} color="#fde047">
          MONEY BOOSTS (RESET ON REBIRTH)
        </Label>
      </StaticBatch>
      {CASH_PADS.map((pad) => (
        <CashPedestal key={pad.index} pad={pad} />
      ))}
      {UPGRADE_PADS.map((pad) => (
        <BoostStation key={pad.key} pad={pad} />
      ))}
    </group>
  )
}

export default UpgradeArea
