import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider } from '@react-three/rapier'
import { memo, useRef } from 'react'

import { STAGES } from '../core/config'
import { formatMoney, formatNumber } from '../core/format'
import { stageCost, stageWins } from '../core/formulas'
import { CORRIDOR, corridorEndZ, gateZ, winPad } from '../core/layout'
import { useGame } from '../core/store'
import { DistanceCull, StaticBatch } from './batching'
import { COLORS, STAGE_COLORS } from './materials'
import { Trophy } from './models'
import { Block, Floor, Label } from './parts'

const { halfWidth, startZ, wallHeight, gateHalfWidth, gateHeight, gateThickness } = CORRIDOR
const PILLAR_W = 1
const PARTITION_LEN = halfWidth - gateHalfWidth - PILLAR_W
const PAD_COLORS = ['#facc15', '#22d3ee']

/** Room contents further than this from the player are hidden (they're out of sight anyway). */
const ROOM_VIEW_RADIUS = 56

/** Static shell: floors, walls, gate frames. Never re-renders; merged into a few draw calls. */
const CorridorShell = memo(function CorridorShell() {
  const length = startZ - corridorEndZ
  const midZ = (startZ + corridorEndZ) / 2
  return (
    <StaticBatch>
      {/* Floor + red carpet down the middle, like the reference. */}
      <Floor center={[0, midZ]} size={[halfWidth * 2, length]} y={0.04} color={COLORS.white} />
      <Floor center={[0, midZ]} size={[gateHalfWidth * 2, length]} y={0.07} color={COLORS.carpet} studs />
      {[-1, 1].map((side) => (
        <Floor key={side} center={[side * (gateHalfWidth + 0.15), midZ]} size={[0.3, length]} y={0.075} color={COLORS.carpetEdge} studs={false} />
      ))}

      {/* Side walls with navy trim. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            size={[1, wallHeight, length]}
            position={[side * (halfWidth + 0.5), wallHeight / 2, midZ]}
            color={COLORS.white}
            collider
          />
          {[1.2, wallHeight - 1.2].map((y) => (
            <Block
              key={y}
              size={[0.12, 0.5, length]}
              position={[side * (halfWidth - 0.03), y, midZ]}
              color={COLORS.navy}
              studs={false}
              castShadow={false}
            />
          ))}
        </group>
      ))}
      <Block size={[halfWidth * 2 + 2, wallHeight, 1]} position={[0, wallHeight / 2, corridorEndZ - 0.5]} color={COLORS.white} collider />

      {/* Roof over the whole corridor, like the indoor stages in the original.
          It doesn't cast shadows, so the rooms stay bright. */}
      <Block
        size={[halfWidth * 2 + 2, 0.6, length + 1]}
        position={[0, wallHeight + 0.3, midZ]}
        color={COLORS.white}
        castShadow={false}
        collider
      />
      {Array.from({ length: Math.floor(length / 8) }, (_, i) => (
        <Block
          key={i}
          size={[3.2, 0.12, 1.4]}
          position={[0, wallHeight - 0.06, startZ - 4 - i * 8]}
          color="#fffbe6"
          studs={false}
          emissive="#fff7cc"
          emissiveIntensity={0.7}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
      <Label position={[0, 5, corridorEndZ + 0.1]} size={1.4} color={COLORS.gold}>
        YOU MADE IT TO THE END!
      </Label>
      <Trophy position={[0, 0, corridorEndZ + 3]} scale={3.2} />

      {/* Entrance arch over the corridor mouth. */}
      <Block size={[halfWidth * 2 + 2, 1.4, 1.2]} position={[0, wallHeight - 0.2, startZ]} color={COLORS.navy} studs={false} />
      <Label position={[0, wallHeight - 0.2, startZ + 0.62]} size={0.8} color="#fde047">
        STAGES - WIN TROPHIES!
      </Label>

      {/* Gate frames: partitions + pillars + beam; the door itself is dynamic. */}
      {STAGES.map((_, i) => {
        const z = gateZ(i)
        const frame = STAGE_COLORS[i % STAGE_COLORS.length]
        return (
          <group key={i}>
            {[-1, 1].map((side) => (
              <group key={side}>
                <Block
                  size={[PARTITION_LEN, wallHeight, 1]}
                  position={[side * (halfWidth - PARTITION_LEN / 2), wallHeight / 2, z]}
                  color={COLORS.white}
                  collider
                />
                <Block
                  size={[PILLAR_W, gateHeight + 1.4, 1.2]}
                  position={[side * (gateHalfWidth + PILLAR_W / 2), (gateHeight + 1.4) / 2, z]}
                  color={frame}
                  collider
                />
              </group>
            ))}
            <Block
              size={[(gateHalfWidth + PILLAR_W) * 2, 1.4, 1.2]}
              position={[0, gateHeight + 0.7, z]}
              color={frame}
            />
          </group>
        )
      })}
    </StaticBatch>
  )
})

const DOOR_GREEN = '#22c55e'
const DOOR_RED = '#ef4444'
/** Diagonal glints on the glass, as [x, y, length]. */
const GLINTS = [
  [-1.25, 0.9, 2.2],
  [-0.55, 0.55, 1.2],
]

/**
 * A gate door: see-through green glass when you can afford it, red when you
 * can't, and slides open when paid. Only the next gate shows its price, so
 * text from gates further down never ghosts through the glass.
 */
const Gate = memo(function Gate({ index }) {
  const z = gateZ(index)
  const open = useGame((s) => s.session.runStage > index)
  const isNext = useGame((s) => s.session.runStage === index)
  const affordable = useGame((s) => s.session.runStage === index && s.data.money >= stageCost(index))

  const door = useRef()
  const doorMaterial = useRef()

  // `lift` animates 0 (closed) -> 1 (fully open, hidden).
  const lift = useRef(open ? 1 : 0)
  useFrame((state, delta) => {
    const target = open ? 1 : 0
    lift.current += (target - lift.current) * Math.min(1, delta * (open ? 5 : 12))
    const d = door.current
    if (d) {
      d.visible = lift.current < 0.98
      d.position.y = gateHeight / 2 + lift.current * gateHeight
      d.scale.y = 1 - lift.current * 0.9
    }
    const material = doorMaterial.current
    if (!material) return
    if (affordable) {
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5)
      material.color.set(DOOR_GREEN)
      material.emissive.set(DOOR_GREEN)
      material.emissiveIntensity = 0.3 + pulse * 0.3
      material.opacity = 0.26 + pulse * 0.1
    } else {
      material.color.set(DOOR_RED)
      material.emissive.set(DOOR_RED)
      material.emissiveIntensity = isNext ? 0.3 : 0.2
      material.opacity = isNext ? 0.3 : 0.22
    }
  })

  const price = formatMoney(stageCost(index))
  return (
    <>
      <DistanceCull at={[0, z]} radius={ROOM_VIEW_RADIUS}>
        <Label position={[0, gateHeight + 0.72, z + 0.62]} size={0.72} color="#ffffff">
          {`STAGE ${index + 1}`}
        </Label>
        <group ref={door} position={[0, gateHeight / 2, z]}>
          <mesh castShadow={false} receiveShadow={false}>
            <boxGeometry args={[gateHalfWidth * 2, gateHeight, gateThickness]} />
            <meshStandardMaterial
              ref={doorMaterial}
              color={DOOR_RED}
              emissive={DOOR_RED}
              emissiveIntensity={0.25}
              roughness={0.15}
              transparent
              opacity={0.26}
              depthWrite={false}
            />
          </mesh>
          {GLINTS.map(([x, y, length]) => (
            <mesh key={x} position={[x, y, gateThickness / 2 + 0.01]} rotation={[0, 0, -0.7]}>
              <planeGeometry args={[0.22, length]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} />
            </mesh>
          ))}
          {isNext && (
            <group position={[0, 0.3, gateThickness / 2 + 0.04]}>
              <Label size={1.25} color="#ffffff" outlineWidth={0.1}>
                {price}
              </Label>
              <Label position={[0, -1.3, 0]} size={0.42} color={affordable ? '#bbf7d0' : '#fecaca'}>
                {affordable ? 'WALK IN TO PAY!' : 'NEED MONEY'}
              </Label>
            </group>
          )}
        </group>
      </DistanceCull>
      {!open && (
        <CuboidCollider args={[gateHalfWidth, gateHeight / 2, gateThickness / 2 + 0.05]} position={[0, gateHeight / 2, z]} />
      )}
    </>
  )
})

/** The WIN pad in the room behind gate `index`. */
const WinPad = memo(function WinPad({ index }) {
  const pad = winPad(index)
  const wins = useGame((s) => stageWins(s.data, index))
  const reachable = useGame((s) => s.session.runStage > index)
  const trophy = useRef()
  const color = PAD_COLORS[index % 2]

  useFrame((state, delta) => {
    if (!trophy.current) return
    trophy.current.rotation.y += delta * 1.4
    trophy.current.position.y = 1.4 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.15
  })

  const [x, z] = pad.center
  return (
    <DistanceCull at={pad.center} radius={ROOM_VIEW_RADIUS * 0.8}>
      <group position={[x, 0, z]}>
        <Block
          size={[pad.half[0] * 2, 0.14, pad.half[1] * 2]}
          position={[0, 0.07, 0]}
          color={color}
          emissive={reachable ? color : null}
          emissiveIntensity={0.3}
          castShadow={false}
        />
        <group ref={trophy} position={[0, 1.4, 0]}>
          <Trophy scale={0.9} />
        </group>
        <Billboard position={[0, 4.2, 0]}>
          <Label size={0.5} color="#ffffff">
            RETURN
          </Label>
          <Label position={[0, -0.75, 0]} size={0.95} color={color}>
            {`${formatNumber(wins)} WIN${wins === 1 ? '' : 'S'}`}
          </Label>
        </Billboard>
      </group>
    </DistanceCull>
  )
})

export function StageCorridor() {
  return (
    <>
      <CorridorShell />
      {STAGES.map((_, i) => (
        <Gate key={i} index={i} />
      ))}
      {STAGES.map((_, i) => (
        <WinPad key={i} index={i} />
      ))}
    </>
  )
}

export default StageCorridor
