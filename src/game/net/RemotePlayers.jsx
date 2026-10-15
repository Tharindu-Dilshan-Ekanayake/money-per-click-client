import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { useShallow } from 'zustand/react/shallow'

import { DEFAULT_PROPORTIONS } from '../../bloxity/store'
import { fx } from '../core/events'
import { titleForLevel } from '../core/formulas'
import { CORRIDOR, HUB } from '../core/layout'
import { getEmoteClip } from '../emotes'
import { HeldCash, Nameplate, PlayerTrail } from '../fx/PlayerExtras'
import { PetFollowers } from '../pets/PetFollowers'
import { CharacterAvatar } from '../PlayerAvatar'
import { Label } from '../world/parts'
import { remoteMotion, useRemotePlayers } from './multiplayer'

/** Capsule centre to feet (same as the local Player). */
const FEET_OFFSET = 0.9
/** Further than this in one update = teleport/spawn: snap instead of gliding. */
const SNAP_DISTANCE = 8
/** How long a celebration label floats above a player. */
const CELEBRATION_MS = 2000

/** sessionId -> mutable per-frame runtime (same shape as playerRuntime). */
const runtimes = new Map()
function runtimeFor(id) {
  let runtime = runtimes.get(id)
  if (!runtime) {
    runtime = {
      position: new Vector3(),
      yaw: Math.PI,
      speed: 0,
      grounded: true,
      hand: new Vector3(),
      handBones: null,
      emote: null,
      cheerAt: -Infinity,
      /** performance.now() of their latest click (drives the click action). */
      clickAt: 0,
    }
    runtimes.set(id, runtime)
  }
  return runtime
}

/** "LEVEL 12!" / "🏆 WIN!" popping up over a player's head, then fading away. */
function Celebration({ text, color }) {
  const ref = useRef()
  const born = useRef(null)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    if (born.current === null) born.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - born.current
    let s = 1
    if (t < 0.25) s = (t / 0.25) * 1.25
    else if (t < 0.4) s = 1.25 - ((t - 0.25) / 0.15) * 0.25
    else if (t > 1.6) s = Math.max(0, 1 - (t - 1.6) / 0.35)
    g.scale.setScalar(Math.max(0.001, s))
    g.position.y = 3.2 + t * 0.45
  })
  return (
    <Billboard ref={ref} position={[0, 3.2, 0]}>
      <Label size={0.55} color={color}>
        {text}
      </Label>
    </Billboard>
  )
}

/** Another player in the lobby, drawn from the room state with smoothing. */
function RemotePlayer({ id }) {
  const profile = useRemotePlayers((s) => s.profiles[id])
  const bubble = useRemotePlayers((s) => (s.profiles[id]?.userId ? s.bubbles[s.profiles[id].userId] || null : null))
  const runtime = runtimeFor(id)
  const group = useRef()
  const visual = useRef()
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 8 })
  const state = useRef({ placed: false, yaw: Math.PI, emoteSeq: -1, clicks: null })
  const getLifetime = useCallback(() => useRemotePlayers.getState().profiles[id]?.lifetime || 0, [id])
  const [celebration, setCelebration] = useState(null)
  // Bumped when they teleport, so their speed trail restarts instead of
  // streaking a line across the map.
  const [trailKey, setTrailKey] = useState(0)
  useEffect(() => () => runtimes.delete(id), [id])

  // Celebrations: shown above their head (and they cheer on the big ones).
  const showCelebration = useCallback(
    (text, color, cheer) => {
      if (cheer) runtimeFor(id).cheerAt = performance.now()
      const key = Math.random()
      setCelebration({ key, text, color })
      setTimeout(() => setCelebration((c) => (c?.key === key ? null : c)), CELEBRATION_MS)
    },
    [id],
  )
  useEffect(
    () =>
      fx.on('remoteCelebrate', (e) => {
        if (e.sessionId === id) showCelebration(e.text, e.color, e.cheer)
      }),
    [id, showCelebration],
  )

  useFrame((_, delta) => {
    const m = remoteMotion.get(id)
    const g = group.current
    if (!m || !g) return
    const s = state.current
    const rt = runtimeFor(id)
    const dt = Math.min(delta, 0.1)

    const far = Math.hypot(m.x - g.position.x, m.z - g.position.z) > SNAP_DISTANCE
    // Jumped from inside the stage corridor back to the lobby = they hit a WIN pad.
    if (s.placed && far && g.position.z < CORRIDOR.startZ - 1 && m.z > HUB.northZ) {
      showCelebration('🏆 WIN!', '#fde047', true)
    }
    if (!s.placed || far) {
      if (s.placed) setTrailKey((k) => k + 1)
      g.position.set(m.x, m.y, m.z)
      s.yaw = m.yaw
      s.placed = true
    } else {
      const k = 1 - Math.exp(-dt * 12)
      g.position.x += (m.x - g.position.x) * k
      g.position.y += (m.y - g.position.y) * k
      g.position.z += (m.z - g.position.z) * k
      let diff = m.yaw - s.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      s.yaw += diff * Math.min(1, dt * 12)
    }
    if (visual.current) visual.current.rotation.y = s.yaw

    rt.position.copy(g.position)
    rt.yaw = s.yaw
    rt.speed = m.speed
    rt.grounded = m.grounded
    const motion = motionRef.current
    motion.time += dt
    motion.speed = m.speed
    motion.grounded = m.grounded

    // Their clicks: play the cash-pump action and throw bills from their hand.
    if (typeof m.clicks === 'number') {
      if (s.clicks === null) s.clicks = m.clicks
      else if (m.clicks !== s.clicks) {
        const count = (m.clicks - s.clicks + 65536) % 65536
        s.clicks = m.clicks
        if (count > 0 && count < 500) {
          rt.clickAt = performance.now()
          fx.emit('remoteClick', { x: rt.hand.x, y: rt.hand.y, z: rt.hand.z, count })
        }
      }
    }

    // Emotes replicate by sequence number, so replaying the same one restarts it.
    if (m.emote && m.emoteSeq !== s.emoteSeq) {
      s.emoteSeq = m.emoteSeq
      const clip = getEmoteClip(m.emote)
      if (clip) rt.emote = { id: m.emote, clip, startedAt: performance.now(), weight: 0, stopping: false }
    } else if (!m.emote && rt.emote) {
      rt.emote.stopping = true
    }
  })

  if (!profile) return null
  return (
    <>
      <group ref={group}>
        <group ref={visual} position={[0, -FEET_OFFSET, 0]} rotation={[0, Math.PI, 0]}>
          <Suspense fallback={null}>
            <CharacterAvatar
              equipped={profile.avatar}
              proportions={profile.proportions || DEFAULT_PROPORTIONS}
              getLifetime={getLifetime}
              runtime={runtime}
              motionRef={motionRef}
              targetHeight={FEET_OFFSET * 2}
            />
          </Suspense>
        </group>
        <Nameplate
          name={profile.name}
          level={profile.level}
          rebirths={profile.rebirths}
          titleIndex={titleForLevel(profile.lifetime).index}
          bubble={bubble}
        />
        <PlayerTrail trailId={profile.trail} resetKey={trailKey} />
        {celebration && <Celebration key={celebration.key} text={celebration.text} color={celebration.color} />}
      </group>
      <HeldCash runtime={runtime} tier={profile.cashTier} />
      <PetFollowers runtime={runtime} pets={profile.pets} />
    </>
  )
}

/** Everyone else in this lobby (up to 7 others). */
export function RemotePlayers() {
  const ids = useRemotePlayers(useShallow((s) => s.ids))
  return ids.map((id) => <RemotePlayer key={id} id={id} />)
}

export default RemotePlayers
