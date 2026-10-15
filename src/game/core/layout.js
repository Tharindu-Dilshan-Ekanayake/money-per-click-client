/**
 * World layout - the single source of truth for where things are. The 3D world
 * renders from these numbers and the zone system tests the player against the
 * same numbers, so a pad can never drift away from its trigger.
 *
 * Axes: +Y up. The player spawns facing -Z ("north"), toward the stage gates.
 *   north (-Z): stage corridor      east (+X): cash upgrades
 *   west  (-X): training tables     south (+Z): pets + leaderboards
 */
import { CASH_TIERS, EGGS, STAGES, TRAINING_TABLES } from './config'

export const SPAWN = [0, 1.4, 4]

export const GROUND_SIZE = 280

/** A compact, walled lobby (64 x 40) with trees growing along the wall tops. */
export const HUB = {
  halfX: 32,
  northZ: -12,
  southZ: 28,
  wallHeight: 8,
  wallThickness: 2,
}

export const PLAZA = { center: [0, 3], size: 16 }

/* ------------------------------------------------------------------ stages */

export const CORRIDOR = {
  halfWidth: 6.5,
  startZ: HUB.northZ,
  firstGateZ: HUB.northZ - 4,
  stageLength: 16,
  wallHeight: 8,
  gateHalfWidth: 2.4,
  gateHeight: 5.6,
  gateThickness: 0.5,
}

export const gateZ = (index) => CORRIDOR.firstGateZ - CORRIDOR.stageLength * index
export const corridorEndZ = gateZ(STAGES.length - 1) - CORRIDOR.stageLength

/** WIN pad of the room just past gate `index`, on the left-hand side. */
export function winPad(index) {
  const z = gateZ(index) - CORRIDOR.stageLength / 2
  return { center: [-4.4, z], half: [1.7, 2.4] }
}

/* -------------------------------------------------------------- upgrades */

export const UPGRADE_AREA = { center: [22.25, 3.5], size: [19.5, 29] }

/**
 * "Unlock Better Cash" pedestals, 3 rows of 5 like the original pyramid. The
 * cheapest row is nearest spawn; later rows float their cash higher.
 */
export const CASH_PADS = CASH_TIERS.map((tier, i) => ({
  index: i,
  row: Math.floor(i / 5),
  center: [15.5 + Math.floor(i / 5) * 5.5, -8 + (i % 5) * 4],
  half: [1.4, 1.4],
}))

/** Money boost pads along the south edge: standing on one keeps buying. */
export const UPGRADE_PADS = [
  { key: 'click', center: [16, 13], half: [1.3, 1.3] },
  { key: 'walk', center: [21.5, 13], half: [1.3, 1.3] },
  { key: 'afk', center: [27, 13], half: [1.3, 1.3] },
]

/* --------------------------------------------------------------- training */

export const TRAINING_AREA = { center: [-22.25, 3.5], size: [19.5, 29] }

/**
 * The training gym: tables in a horseshoe around a golden dumbbell statue,
 * open toward spawn. Table 0 (the free x3) sits at the mouth nearest spawn and
 * the better tables go round the ring.
 */
export const TRAINING_RING = { center: [-22.2, 3.5], radius: 7.2, statueRadius: 1.6 }

export const TRAINING_SPOTS = TRAINING_TABLES.map((table, i) => {
  const angle = ((30 + (i * 300) / Math.max(1, TRAINING_TABLES.length - 1)) * Math.PI) / 180
  const [cx, cz] = TRAINING_RING.center
  return {
    index: i,
    center: [cx + Math.cos(angle) * TRAINING_RING.radius, cz + Math.sin(angle) * TRAINING_RING.radius],
    radius: 2,
    // Long side along the ring, front (+Z) facing the statue.
    rotation: -angle - Math.PI / 2,
  }
})

/** True when (x, z) is on a training rug. */
export const onRug = (x, z, spot) => Math.hypot(x - spot.center[0], z - spot.center[1]) < spot.radius

/* ------------------------------------------------------------------ pets */

export const PET_AREA = { center: [0, 17], size: [24, 10] }

export const EGG_SPOTS = EGGS.map((egg, i) => ({
  id: egg.id,
  center: [-9.6 + i * 4.8, 17.5],
  radius: 2.3,
}))

/** Leaderboards stand along the south wall, facing spawn. */
export const LEADERBOARD_SPOTS = [-18, -6, 6, 18].map((x) => ({ center: [x, HUB.southZ - 1.7] }))

/* --------------------------------------------------------------- helpers */

export function inRect(x, z, rect) {
  return (
    Math.abs(x - rect.center[0]) <= rect.half[0] && Math.abs(z - rect.center[1]) <= rect.half[1]
  )
}

/** Random walkable spot in the hub for lucky money bags. */
export function randomHubSpot(random = Math.random) {
  for (let tries = 0; tries < 30; tries += 1) {
    const x = (random() * 2 - 1) * (HUB.halfX - 6)
    const z = HUB.northZ + 4 + random() * (HUB.southZ - HUB.northZ - 10)
    const nearTable =
      TRAINING_SPOTS.some((s) => Math.hypot(x - s.center[0], z - s.center[1]) < s.radius + 1.2) ||
      Math.hypot(x - TRAINING_RING.center[0], z - TRAINING_RING.center[1]) < TRAINING_RING.statueRadius + 2
    const nearEgg = EGG_SPOTS.some((s) => Math.hypot(x - s.center[0], z - s.center[1]) < 3)
    const nearBoard = z > LEADERBOARD_SPOTS[0].center[1] - 2
    const upgradeMinX = UPGRADE_AREA.center[0] - UPGRADE_AREA.size[0] / 2
    const nearUpgrades = x > upgradeMinX - 1 && z < UPGRADE_AREA.center[1] + UPGRADE_AREA.size[1] / 2 + 1
    if (!nearTable && !nearEgg && !nearBoard && !nearUpgrades) return [x, z]
  }
  return [6, 8]
}

/**
 * Where the first-time guide points for a step, as { at: [x, z], kind }. If
 * the player isn't ready for a step yet it points at what they need first
 * (no money for the gate -> the training table, no Win yet -> the stage).
 */
export function guideTarget(kind, { runStage, wins, money, gateCost, cashCost }) {
  const ctx = { runStage, wins, money, gateCost, cashCost }
  if (kind === 'table') return { at: TRAINING_SPOTS[0].center, kind: 'table' }
  if (kind === 'gate') return money >= gateCost ? { at: [0, gateZ(0) + 2], kind: 'gate' } : guideTarget('table', ctx)
  if (kind === 'winpad') return runStage >= 1 ? { at: winPad(0).center, kind: 'winpad' } : guideTarget('gate', ctx)
  if (kind === 'cash') return wins >= cashCost ? { at: CASH_PADS[1].center, kind: 'cash' } : guideTarget('winpad', ctx)
  if (kind === 'upgrade') return { at: UPGRADE_PADS[0].center, kind }
  if (kind === 'egg') return { at: EGG_SPOTS[0].center, kind }
  return null
}

const inCorridor = (z) => z < CORRIDOR.startZ + 0.5

/**
 * A walkable route on the ground from `from` to `to` ([x, z] each): through
 * the corridor mouth when going in or out of the stages, and along the
 * corridor's centre line (where the gate openings are) inside it.
 */
export function guideRoute(from, to) {
  const route = [from]
  const outside = [0, CORRIDOR.startZ + 3]
  const inside = [0, CORRIDOR.startZ - 1.5]
  const fromIn = inCorridor(from[1])
  const toIn = inCorridor(to[1])
  if (!fromIn && toIn) {
    route.push(outside, inside)
    if (Math.abs(to[0]) > 1) route.push([0, to[1]])
  } else if (fromIn && !toIn) {
    if (Math.abs(from[0]) > 1) route.push([0, from[1]])
    route.push(inside, outside)
  } else if (fromIn && toIn && Math.abs(from[1] - to[1]) > 3) {
    if (Math.abs(from[0]) > 1) route.push([0, from[1]])
    if (Math.abs(to[0]) > 1) route.push([0, to[1]])
  }
  route.push(to)
  return route
}
