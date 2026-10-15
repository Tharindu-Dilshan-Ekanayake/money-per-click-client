import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { fx } from '../core/events'
import { playerRuntime } from '../core/runtime'
import { useGame } from '../core/store'
import { PetModel } from './PetModel'

/** Capsule centre to feet. Matches Player's capsule. */
const FEET_OFFSET = 0.9
const PER_ROW = 4

function FollowingPet({ runtime, petId, variant, slot, count }) {
  const ref = useRef()
  const snap = useRef(true)
  const last = useRef({ x: 0, z: 0 })

  useEffect(() => fx.on('teleport', () => (snap.current = true)), [])

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    const { position: p, yaw, speed } = runtime
    const row = Math.floor(slot / PER_ROW)
    const inRow = Math.min(PER_ROW, count - row * PER_ROW)
    const lateral = ((slot % PER_ROW) - (inRow - 1) / 2) * 1.5
    const back = 1.9 + row * 1.5

    // Forward (fx, fz) and right (rx, rz) of the owner's facing.
    const fx_ = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const rx = -fz
    const rz = fx_
    const t = state.clock.elapsedTime
    const moving = speed > 0.5
    const hop = moving ? Math.abs(Math.sin(t * 9 + slot)) * 0.35 : Math.sin(t * 2.2 + slot) * 0.12
    const tx = p.x + rx * lateral - fx_ * back
    const tz = p.z + rz * lateral - fz * back
    const ty = p.y - FEET_OFFSET + 0.75 + hop

    // A big jump of the owner (teleport, remote join) snaps instead of flying.
    const jumped = Math.hypot(p.x - last.current.x, p.z - last.current.z) > 6
    last.current.x = p.x
    last.current.z = p.z
    if (snap.current || jumped) {
      g.position.set(tx, ty, tz)
      snap.current = false
    } else {
      const k = 1 - Math.exp(-delta * 7)
      g.position.x += (tx - g.position.x) * k
      g.position.z += (tz - g.position.z) * k
      g.position.y += (ty - g.position.y) * Math.min(1, delta * 12)
    }

    // Face the way the owner is going (shortest-arc lerp).
    let diff = yaw - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    g.rotation.y += diff * Math.min(1, delta * 6)
  })

  return (
    <group ref={ref}>
      <PetModel petId={petId} variant={variant} scale={0.95} />
    </group>
  )
}

/** Pets trailing behind a character. `pets`: [{ key, id, variant }]. */
export function PetFollowers({ runtime = playerRuntime, pets }) {
  return pets.map((pet, i) => (
    <FollowingPet key={pet.key} runtime={runtime} petId={pet.id} variant={pet.variant} slot={i} count={pets.length} />
  ))
}

/** The local player's equipped pets. */
export function LocalPetFollowers() {
  const keys = useGame(
    useShallow((s) => {
      const byUid = new Map(s.data.pets.map((p) => [p.uid, p]))
      return s.data.equippedPets
        .map((uid) => byUid.get(uid))
        .filter(Boolean)
        .map((p) => `${p.uid}:${p.id}:${p.variant || 0}`)
    }),
  )
  const pets = keys.map((key) => {
    const [, id, variant] = key.split(':')
    return { key, id, variant: Number(variant) }
  })
  return <PetFollowers runtime={playerRuntime} pets={pets} />
}

export default LocalPetFollowers
