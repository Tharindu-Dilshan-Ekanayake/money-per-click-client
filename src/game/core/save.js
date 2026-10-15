/**
 * Persistence. Bloxity's SDK has no cloud-save API, so progress lives in
 * localStorage, keyed per account (logged-in user id, else guest id). Saves are
 * merged over fresh defaults on load, so adding a field later never breaks an
 * old save.
 */
import { CASH_TIERS, ECONOMY, SAVE_VERSION, TRAINING_TABLES } from './config'
import { afkIncomePerSecond, maxLevel } from './formulas'

const KEY_PREFIX = 'ppc_save_v1:'

export function defaultData() {
  const now = Date.now()
  return {
    version: SAVE_VERSION,
    money: 0,
    wins: 0,
    level: 0,
    xp: 0,
    rebirths: 0,
    cashUpgrades: { click: 0, walk: 0, afk: 0 },
    /** Better Cash tiers: the first `owned` tiers are unlocked; `equipped` is held. */
    cashTiers: { owned: 1, equipped: 0 },
    winsUpgrades: { money: 0, xp: 0, wins: 0, speed: 0, luck: 0, petSlot: 0 },
    pets: [],
    equippedPets: [],
    nextPetUid: 1,
    trailsOwned: ['none'],
    trail: 'none',
    boosts: { money2xUntil: 0 },
    tutorial: { step: 0, done: false, tableSeconds: 0 },
    daily: { lastClaim: 0, streak: 0 },
    /** Totals at the start of the leaderboard week (weekly = now - these). */
    weekly: { week: -1, earned: 0, wins: 0, levels: 0, rebirths: 0 },
    stats: {
      totalEarned: 0,
      totalClicks: 0,
      totalSteps: 0,
      totalWins: 0,
      bestStage: 0,
      eggsOpened: 0,
      upgradesBought: 0,
      playtime: 0,
      /** Every level ever gained, across rebirths (body, speed, title). */
      lifetimeLevels: 0,
    },
    settings: { music: 0.45, sfx: 0.8, shadows: true, quality: 'high' },
    /** Training table the player was standing on at the last save, or -1. */
    lastTable: -1,
    lastSeen: now,
    createdAt: now,
  }
}

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v)

/** Deep-merge `saved` onto `defaults`, keeping only keys defaults knows about. */
function mergeDefaults(defaults, saved) {
  if (!isPlainObject(saved)) return defaults
  const out = { ...defaults }
  for (const key of Object.keys(defaults)) {
    if (!(key in saved)) continue
    const d = defaults[key]
    const s = saved[key]
    if (isPlainObject(d)) out[key] = mergeDefaults(d, s)
    else if (Array.isArray(d)) out[key] = Array.isArray(s) ? s : d
    else if (typeof d === 'number') out[key] = Number.isFinite(s) ? s : d
    else if (typeof d === typeof s) out[key] = s
  }
  return out
}

function sanitize(data, savedVersion) {
  if (savedVersion < 3 && !data.tutorial.done) {
    // The guide was rewritten (v3). Start it over; steps the player is already
    // past complete themselves on load.
    data.tutorial = { ...data.tutorial, step: 0 }
  }
  if (savedVersion < 2) {
    // v1 never reset levels and had flat-power cash upgrades. Keep the levels as
    // lifetime progress (body/speed/title), clamp the current level to the new
    // MAX, and refund nothing - the boosts simply restart under the new rules.
    data.stats.lifetimeLevels = Math.max(data.stats.lifetimeLevels, data.level)
    data.cashUpgrades = { click: 0, walk: 0, afk: 0 }
  }
  data.money = Math.max(0, data.money)
  data.wins = Math.max(0, data.wins)
  data.rebirths = Math.max(0, Math.floor(data.rebirths))
  data.level = Math.min(maxLevel(data.rebirths), Math.max(0, Math.floor(data.level)))
  data.stats.lifetimeLevels = Math.max(data.stats.lifetimeLevels, data.level)
  const owned = Math.min(CASH_TIERS.length, Math.max(1, Math.floor(data.cashTiers.owned)))
  data.cashTiers = { owned, equipped: Math.min(owned - 1, Math.max(0, Math.floor(data.cashTiers.equipped))) }
  data.pets = data.pets.filter((p) => p && typeof p.id === 'string' && Number.isFinite(p.uid))
  const uids = new Set(data.pets.map((p) => p.uid))
  data.equippedPets = data.equippedPets.filter((uid) => uids.has(uid))
  data.nextPetUid = Math.max(data.nextPetUid, ...data.pets.map((p) => p.uid + 1), 1)
  if (!data.trailsOwned.includes('none')) data.trailsOwned.unshift('none')
  if (!data.trailsOwned.includes(data.trail)) data.trail = 'none'
  return data
}

export function saveKeyFor(identity) {
  const id =
    identity?._id || identity?.id || identity?.legionId || identity?.username || 'local'
  return KEY_PREFIX + String(id)
}

export function loadSave(key) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const data = sanitize(mergeDefaults(defaultData(), parsed), Number(parsed?.version) || 1)
    data.version = SAVE_VERSION
    return data
  } catch (err) {
    console.warn('[save] could not read save, starting fresh', err)
    return null
  }
}

export function writeSave(key, data) {
  if (!key) return false
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...data, lastSeen: Date.now() }))
    return true
  } catch (err) {
    console.warn('[save] could not write save', err)
    return false
  }
}

export function deleteSave(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage blocked - nothing to delete.
  }
}

/**
 * Spec: while away you earn 50% of AFK income for up to 8 hours. Uses the table
 * you were standing on when you left, else the free x3 table.
 */
export function computeOffline(data, now = Date.now()) {
  const away = (now - (data.lastSeen || now)) / 1000
  if (away < ECONOMY.offlineMinSeconds) return null
  const seconds = Math.min(away, ECONOMY.offlineMaxSeconds)
  const table = data.lastTable >= 0 && data.lastTable < TRAINING_TABLES.length ? data.lastTable : 0
  // Offline income ignores timed boosts: they expired while you were gone.
  const perSecond = afkIncomePerSecond({ ...data, boosts: { money2xUntil: 0 } }, table, now)
  const amount = Math.floor(perSecond * seconds * ECONOMY.offlineRate)
  if (amount <= 0) return null
  return { seconds, awaySeconds: away, amount, table }
}
