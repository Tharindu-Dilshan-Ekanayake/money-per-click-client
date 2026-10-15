import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { ECONOMY, STAGES } from '../core/config'
import { fx } from '../core/events'
import {
  CASH_PADS,
  CORRIDOR,
  EGG_SPOTS,
  SPAWN,
  TRAINING_SPOTS,
  UPGRADE_PADS,
  gateZ,
  inRect,
  onRug,
  winPad,
} from '../core/layout'
import { playerRuntime } from '../core/runtime'
import { getGame } from '../core/store'

/** Upgrade pads buy faster the longer you stand on them. */
const PAD_FIRST_DELAY = 0.45
const PAD_MIN_DELAY = 0.1

/**
 * Per-frame gameplay against the player's position: walking money, gates,
 * WIN pads, training tables, upgrade pads, egg prompts and out-of-bounds.
 * Lives inside the Canvas so it shares the physics frame. Renders nothing.
 */
export function ZoneSystem() {
  const state = useRef({ hasLast: false, lastX: 0, lastZ: 0, walked: 0, pad: null, padTimer: 0, padHeld: 0, cashPad: -1 })

  useEffect(
    () =>
      fx.on('teleport', () => {
        state.current.hasLast = false
      }),
    [],
  )

  useFrame((_, delta) => {
    const game = getGame()
    if (!game.session.hydrated) return
    const s = state.current
    const p = playerRuntime.position
    const dt = Math.min(delta, 0.1)

    // --- Walking money: every `stepDistance` of horizontal travel pays out.
    if (s.hasLast) {
      const d = Math.hypot(p.x - s.lastX, p.z - s.lastZ)
      // Anything this large in one frame is a teleport, not a walk.
      if (d < 3) {
        s.walked += d
        while (s.walked >= ECONOMY.stepDistance) {
          s.walked -= ECONOMY.stepDistance
          getGame().earnStep()
        }
      }
    }
    s.hasLast = true
    s.lastX = p.x
    s.lastZ = p.z

    // --- Gates: walking into the next door tries to pay for it.
    const run = getGame().session.runStage
    if (run < STAGES.length) {
      const gz = gateZ(run)
      if (Math.abs(p.x) < CORRIDOR.gateHalfWidth + 0.4 && p.z < gz + 1.5 && p.z > gz - 1.2) {
        getGame().tryPayGate(run)
      }
    }

    // --- WIN pads in rooms passed this run.
    for (let i = 0; i < run; i += 1) {
      if (inRect(p.x, p.z, winPad(i)) && p.y < 3) {
        getGame().claimWinPad(i)
        break
      }
    }

    // --- Training tables.
    let table = -1
    for (const spot of TRAINING_SPOTS) {
      if (onRug(p.x, p.z, spot)) {
        table = spot.index
        break
      }
    }
    getGame().setActiveTable(table)

    // --- Upgrade pads: stand on one to keep buying, accelerating.
    let pad = null
    for (const u of UPGRADE_PADS) if (inRect(p.x, p.z, u)) pad = u.key
    if (pad !== s.pad) {
      s.pad = pad
      s.padTimer = 0
      s.padHeld = 0
    }
    if (pad) {
      s.padHeld += dt
      s.padTimer -= dt
      if (s.padTimer <= 0) {
        // Only the first attempt on a pad complains about money.
        const bought = getGame().buyCashUpgrade(pad, { silent: s.padHeld > dt * 1.5 })
        s.padTimer = bought
          ? Math.max(PAD_MIN_DELAY, PAD_FIRST_DELAY - s.padHeld * 0.12)
          : 0.6
      }
    }

    // --- Better Cash pedestals: stepping on one unlocks (Wins) or equips it, once.
    let cashPad = -1
    for (const c of CASH_PADS) if (inRect(p.x, p.z, c)) cashPad = c.index
    if (cashPad !== s.cashPad) {
      s.cashPad = cashPad
      if (cashPad >= 0) getGame().selectCashTier(cashPad)
    }

    // --- Eggs.
    let egg = null
    for (const spot of EGG_SPOTS) {
      if (Math.hypot(p.x - spot.center[0], p.z - spot.center[1]) < spot.radius) egg = spot.id
    }
    getGame().setNearbyEgg(egg)

    // --- Fell out of the world.
    if (p.y < -25) getGame().requestTeleport(SPAWN)
  })

  return null
}

export default ZoneSystem
