import { Html, Trail } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Quaternion, Vector3 } from 'three'

import { useBloxity } from '../../bloxity/BloxityContext'
import { TITLES } from '../core/config'
import { titleFor, trailById } from '../core/formulas'
import { playerRuntime } from '../core/runtime'
import { useGame } from '../core/store'
import { cashLook } from '../world/cashTiers'
import { CashStack } from '../world/models'

const _elbow = new Vector3()
const _tip = new Vector3()
const _dir = new Vector3()
const _up = new Vector3(0, 1, 0)
const _alongArm = new Quaternion()
const _facing = new Quaternion()
const _identity = new Quaternion()

/**
 * Cash held up in a character's right hand, sitting on top of the raised fist
 * and following the forearm. Placed in world space from the hand bones every
 * frame (after the avatar animated), so it never inherits the physique's
 * non-uniform bone scales. Works for any character `runtime`.
 */
export function HeldCash({ runtime, tier }) {
  const ref = useRef()
  const look = cashLook(tier)

  useFrame(() => {
    const g = ref.current
    const bones = runtime.handBones
    if (!g) return
    if (!bones) {
      g.visible = false
      return
    }
    bones.elbow.updateWorldMatrix(true, false)
    bones.tip.updateWorldMatrix(true, false)
    bones.elbow.getWorldPosition(_elbow)
    bones.tip.getWorldPosition(_tip)
    runtime.hand.copy(_elbow).lerp(_tip, 0.9)
    g.visible = true
    g.position.copy(runtime.hand)
    // A brick of cash standing on the raised fist, long side facing out like
    // it's being shown off; it leans half as much as the forearm does.
    _dir.subVectors(_tip, _elbow)
    if (_dir.lengthSq() > 1e-6) _alongArm.setFromUnitVectors(_up, _dir.normalize())
    _alongArm.slerp(_identity, 0.5)
    _facing.setFromAxisAngle(_up, runtime.yaw)
    g.quaternion.copy(_alongArm).multiply(_facing)
  })

  return (
    <group ref={ref} visible={false}>
      {/* Big, chunky cash in hand like the original; grows a little with the tier. */}
      <CashStack tier={look} scale={0.44 + tier * 0.01} position={[0, -0.03, 0]} />
    </group>
  )
}

export function LocalHeldCash() {
  const tier = useGame((s) => s.data.cashTiers.equipped)
  return <HeldCash runtime={playerRuntime} tier={tier} />
}

/** Speed trail ribbon at the feet; rainbow trails cycle colour. Render inside the moving body. */
export function PlayerTrail({ trailId, resetKey = 0 }) {
  const trail = trailById(trailId)
  const [colorIndex, setColorIndex] = useState(0)

  useEffect(() => {
    if (trail.colors.length < 2) return undefined
    const timer = setInterval(() => setColorIndex((i) => (i + 1) % trail.colors.length), 180)
    return () => clearInterval(timer)
  }, [trail])

  if (trail.id === 'none') return null
  return (
    <Trail
      key={`${trail.id}-${resetKey}`}
      width={0.9 + trail.speed * 0.6}
      length={5 + trail.speed * 3}
      color={trail.colors[colorIndex % trail.colors.length]}
      attenuation={(t) => t * t}
    >
      <mesh position={[0, -0.75, 0]} visible={false}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
      </mesh>
    </Trail>
  )
}

export function LocalTrail() {
  const trailId = useGame((s) => s.data.trail)
  // Remount on teleport so the ribbon doesn't streak across the map.
  const teleportId = useGame((s) => s.session.teleport?.id ?? 0)
  return <PlayerTrail trailId={trailId} resetKey={teleportId} />
}

/** Title / level / name above the head, like the Roblox overhead GUI. */
export function Nameplate({ name, level, rebirths, titleIndex, bubble }) {
  const title = TITLES[titleIndex] || TITLES[0]
  return (
    <Html position={[0, 1.55, 0]} center distanceFactor={9} zIndexRange={[5, 0]} pointerEvents="none">
      <div className="nameplate">
        {bubble && (
          <div key={bubble.id} className="chat-bubble anim-toast">
            {bubble.text}
          </div>
        )}
        <div className="nameplate-title" style={{ color: title.color }}>
          {title.emoji} {title.name} {title.emoji}
        </div>
        <div className="nameplate-level">
          Level {level}
          {rebirths > 0 && <span className="nameplate-rebirth"> · R{rebirths}</span>}
        </div>
        <div className="nameplate-name">{name}</div>
      </div>
    </Html>
  )
}

export function LocalNameplate() {
  const { identity } = useBloxity()
  const level = useGame((s) => s.data.level)
  const rebirths = useGame((s) => s.data.rebirths)
  const bubble = useGame((s) => s.ui.chatBubble)
  const titleIndex = useGame((s) => titleFor(s.data).index)
  const name = identity?.displayName || identity?.username || 'Player'
  return <Nameplate name={name} level={level} rebirths={rebirths} titleIndex={titleIndex} bubble={bubble} />
}
