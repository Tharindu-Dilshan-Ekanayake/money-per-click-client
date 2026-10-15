/**
 * Pure game math. Everything here is a function of the save `data` (plus `now`
 * for timed boosts) so it can run in the UI, the world, and offline tests alike.
 */
import {
  MONEY_RAIN,
  CASH_TIERS,
  CASH_UPGRADES,
  ECONOMY,
  EGGS,
  LEVEL,
  PET_RULES,
  PETS,
  PHYSIQUE,
  REBIRTH,
  SPEED,
  STAGES,
  TITLES,
  TRAILS,
  TRAINING_TABLES,
  WINS_UPGRADES,
} from './config'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t

/* ----------------------------------------------------------------- levels */

export const xpForLevel = (level) =>
  Math.floor(LEVEL.base + LEVEL.linear * level + LEVEL.quad * level * level)

/** MAX level for a rebirth count: 25, 32, 40, 49, 59, ... (like the original). */
export const maxLevel = (rebirths) =>
  REBIRTH.firstMaxLevel + REBIRTH.capStep * rebirths + (rebirths * (rebirths - 1)) / 2

export const atMaxLevel = (data) => data.level >= maxLevel(data.rebirths)

/** Every level ever gained, across rebirths. Drives body, speed and title. */
export const lifetimeLevel = (data) => Math.max(data.stats?.lifetimeLevels ?? 0, data.level)

export function titleForLevel(level) {
  let index = 0
  for (let i = 0; i < TITLES.length; i += 1) if (level >= TITLES[i].level) index = i
  return { ...TITLES[index], index, next: TITLES[index + 1] || null }
}

export const titleFor = (data) => titleForLevel(lifetimeLevel(data))

/* ---------------------------------------------------------------- rebirth */

/** The Multiplier: x1 with no rebirths, x2 after the first, then doubling. */
export const rebirthMultiplier = (rebirths) => ECONOMY.rebirthMultiplierBase ** rebirths

/** Rebirth is allowed at MAX level. */
export const canRebirth = atMaxLevel

/* ------------------------------------------------------------- cash tiers */

export const cashTierValue = (data) =>
  CASH_TIERS[Math.min(Math.max(0, data.cashTiers.equipped), CASH_TIERS.length - 1)].value

/** Index of the next tier to unlock, or null when all are owned. */
export const nextCashTier = (data) => (data.cashTiers.owned < CASH_TIERS.length ? data.cashTiers.owned : null)

/* ------------------------------------------------------------ money boosts */

export const cashUpgradeBonus = (data, key) => CASH_UPGRADES[key].perLevel * (data.cashUpgrades[key] || 0)

/** One click before boosts and bonuses: cash tier x rebirth Multiplier. */
export const clickBase = (data) => cashTierValue(data) * rebirthMultiplier(data.rebirths)

/** Price of the next level of a money boost, in clicks of your current cash. */
export function cashUpgradeCost(key, level, data) {
  const u = CASH_UPGRADES[key]
  return Math.ceil(u.costClicks * u.growth ** level * clickBase(data))
}

/* ------------------------------------------------------------- wins shop */

export function winsUpgradeCost(key, level) {
  const u = WINS_UPGRADES[key]
  if (level >= u.max) return Infinity
  if (u.costs) return u.costs[level] ?? Infinity
  return Math.ceil(u.baseCost * u.growth ** level)
}

export const winsUpgradeBonus = (data, key) =>
  (WINS_UPGRADES[key].perLevel || 0) * (data.winsUpgrades[key] || 0)

/* ------------------------------------------------------------------- pets */

export const petVariantMult = (variant) => PET_RULES.variants[variant]?.mult ?? 1

export function petPower(pet) {
  const def = PETS[pet?.id]
  if (!def) return 0
  return def.power * petVariantMult(pet.variant || 0)
}

export const maxPetSlots = (data) => PET_RULES.baseSlots + (data.winsUpgrades.petSlot || 0)

export function petMultiplier(data) {
  let bonus = 0
  const equipped = new Set(data.equippedPets)
  for (const pet of data.pets) if (equipped.has(pet.uid)) bonus += petPower(pet)
  return 1 + bonus
}

/** Egg weights after Egg Luck: rarer entries (later in the list) gain weight. */
export function eggWeights(egg, data) {
  const luck = winsUpgradeBonus(data, 'luck')
  return egg.pets.map(([id, weight], i) => [id, weight * (1 + luck * i * 1.5)])
}

export function rollPet(egg, data, random = Math.random) {
  const weights = eggWeights(egg, data)
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = random() * total
  for (const [id, w] of weights) {
    roll -= w
    if (roll <= 0) return id
  }
  return weights[weights.length - 1][0]
}

export const eggById = (id) => EGGS.find((egg) => egg.id === id)

/* -------------------------------------------------------------- multipliers */

export const boostActive = (data, now) => (data.boosts?.money2xUntil || 0) > now
export const boostMultiplier = (data, now) => (boostActive(data, now) ? 2 : 1)

/** The HUD "Multiplier": rebirths only, like the original (x1, x2, x4 ...). */
export const displayMultiplier = (data) => rebirthMultiplier(data.rebirths)

/** Separate bonuses on top: pets, Wins Shop Money Boost, timed 2x. */
export const bonusMultiplier = (data, now = Date.now()) =>
  (1 + winsUpgradeBonus(data, 'money')) * petMultiplier(data) * boostMultiplier(data, now)

/** Everything that scales money. */
export const moneyMultiplier = (data, now = Date.now()) => displayMultiplier(data) * bonusMultiplier(data, now)

export const clickValue = (data, now) =>
  cashTierValue(data) * (1 + cashUpgradeBonus(data, 'click')) * moneyMultiplier(data, now)

export const stepValue = (data, now) =>
  cashTierValue(data) * ECONOMY.stepFraction * (1 + cashUpgradeBonus(data, 'walk')) * moneyMultiplier(data, now)

export const comboBonus = (combo) =>
  Math.min(ECONOMY.comboMaxBonus, Math.max(0, combo - 1) * ECONOMY.comboBonusPerHit)

export const xpMultiplier = (data) =>
  (1 + winsUpgradeBonus(data, 'xp')) * (1 + 0.1 * data.rebirths)

export const winsMultiplier = (data) =>
  (1 + winsUpgradeBonus(data, 'wins')) * (1 + ECONOMY.winsPerRebirth * data.rebirths)

export const stageWins = (data, stageIndex) =>
  Math.max(1, Math.round(STAGES[stageIndex].wins * winsMultiplier(data)))

/* ------------------------------------------------------------- training */

export function tableUnlocked(data, index) {
  const req = TRAINING_TABLES[index]?.req
  if (!req) return false
  return data.level >= (req.level || 0) && data.rebirths >= (req.rebirths || 0)
}

export function tableRequirementText(index) {
  const req = TRAINING_TABLES[index].req
  if (req.rebirths) return `${req.rebirths} Rebirth${req.rebirths > 1 ? 's' : ''}`
  if (req.level) return `Level ${req.level}`
  return 'Free'
}

export function afkIncomePerSecond(data, index, now) {
  const table = TRAINING_TABLES[index]
  if (!table) return 0
  return cashTierValue(data) * table.mult * (1 + cashUpgradeBonus(data, 'afk')) * moneyMultiplier(data, now)
}

export const afkXpPerSecond = (data, index) => (1 + index * 0.5) * xpMultiplier(data)

export function bestUnlockedTable(data) {
  let best = 0
  for (let i = 0; i < TRAINING_TABLES.length; i += 1) if (tableUnlocked(data, i)) best = i
  return best
}

/* --------------------------------------------------------------- movement */

export const trailById = (id) => TRAILS.find((t) => t.id === id) || TRAILS[0]

/** Speed from lifetime levels, so rebirthing never makes you slower. */
export const levelSpeed = (data) => SPEED.base + SPEED.perLevel * Math.min(lifetimeLevel(data), SPEED.levelCap)

export function walkSpeed(data) {
  const trail = 1 + trailById(data.trail).speed
  const boost = 1 + winsUpgradeBonus(data, 'speed')
  return Math.min(SPEED.max, levelSpeed(data) * trail * boost)
}

/* ---------------------------------------------------------------- physique */

/** 0 = skinny brokie, 1 = bodybuilder. Pass lifetime levels. */
export function buffForLevel(level) {
  const t = clamp01(level / PHYSIQUE.maxBuffLevel)
  return 1 - (1 - t) ** PHYSIQUE.easePower
}

/**
 * Body shape for a buff value. Widths are multipliers on the base rig; see
 * applyPhysique() in avatarRig.js for how each one maps onto bones.
 */
export function physiqueFor(buff) {
  const b = clamp01(buff)
  return {
    buff: b,
    // Skinny end: a poor, wasted-away body - stick-thin arms and legs, a narrow
    // little torso and a big head, standing upright with the arms held a
    // little away from the body so the thin limbs read clearly.
    // Buff end: a rich gym bro - broad V-taper, big arms, thick legs.
    waistW: lerp(0.5, 1.15, b),
    waistD: lerp(0.52, 1.1, b),
    chestW: lerp(0.52, 1.7, b),
    chestD: lerp(0.55, 1.4, b),
    armW: lerp(0.36, 1.55, b),
    armD: lerp(0.4, 1.25, b),
    foreArm: lerp(1, 0.85, b),
    legThick: lerp(0.4, 1.25, b),
    hipSpread: lerp(0.82, 1.25, b),
    height: lerp(0.96, 1.12, b),
    headScale: lerp(1.12, 0.92, b),
    // Posture: always upright (no hunch); bodybuilders puff the chest and
    // flare their lats.
    slouch: lerp(0, -0.06, b),
    headTilt: lerp(0, -0.03, b),
    armSpread: lerp(0.12, 0.32, b),
  }
}

/* -------------------------------------------------------------- run/stage */

export const stageCount = STAGES.length
export const stageCost = (index) => STAGES[index]?.cost ?? Infinity

/** Total money needed to reach stage `index` from spawn in one run. */
export function costToReachStage(index) {
  let sum = 0
  for (let i = 0; i <= index && i < STAGES.length; i += 1) sum += STAGES[i].cost
  return sum
}

/* --------------------------------------------------------------- calendar */

const WEEK_MS = 7 * 24 * 3600 * 1000
/** Monday 1 Jan 2024 00:00 UTC: weeks (and the weekly boards) roll over on Mondays. */
const WEEK_EPOCH = Date.UTC(2024, 0, 1)

/** Index of the current leaderboard week (changes every Monday 00:00 UTC). */
export const weekIndex = (now = Date.now()) => Math.floor((now - WEEK_EPOCH) / WEEK_MS)

/** When this week's boards reset (ms timestamp). */
export const weekEndsAt = (now = Date.now()) => WEEK_EPOCH + (weekIndex(now) + 1) * WEEK_MS

/** This week's progress - what the weekly leaderboards rank. */
export function weeklyStats(data, now = Date.now()) {
  const base = data.weekly
  if (!base || base.week !== weekIndex(now)) return { money: 0, level: 0, rebirths: 0, wins: 0 }
  return {
    money: Math.max(0, data.stats.totalEarned - base.earned),
    level: Math.max(0, data.stats.lifetimeLevels - base.levels),
    rebirths: Math.max(0, data.rebirths - base.rebirths),
    wins: Math.max(0, data.stats.totalWins - base.wins),
  }
}

/**
 * Money rain schedule: on the hour (UTC) for everyone at once.
 * Returns { active, remaining, startsIn } in seconds.
 */
export function moneyRainStatus(now = Date.now(), forcedUntil = 0) {
  if (forcedUntil > now) return { active: true, remaining: (forcedUntil - now) / 1000, startsIn: 0 }
  const period = MONEY_RAIN.everyMinutes * 60000
  const phase = ((now % period) + period) % period
  if (phase < MONEY_RAIN.durationSeconds * 1000) {
    return { active: true, remaining: MONEY_RAIN.durationSeconds - phase / 1000, startsIn: 0 }
  }
  return { active: false, remaining: 0, startsIn: (period - phase) / 1000 }
}
