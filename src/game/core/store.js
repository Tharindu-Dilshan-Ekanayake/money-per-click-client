import { create } from 'zustand'

import {
  CASH_TIERS,
  CASH_UPGRADES,
  DAILY,
  ECONOMY,
  EGGS,
  GIFTS,
  MONEY_RAIN,
  PET_RULES,
  PETS,
  STAGES,
  TRAILS,
  TRAINING_TABLES,
  TUTORIAL,
  TUTORIAL_REWARD_WINS,
  WINS_UPGRADES,
} from './config'
import { fx } from './events'
import { formatMoney, formatNumber, formatTime } from './format'
import {
  afkIncomePerSecond,
  afkXpPerSecond,
  atMaxLevel,
  cashUpgradeCost,
  clickValue,
  comboBonus,
  eggById,
  maxPetSlots,
  maxLevel,
  moneyRainStatus,
  petPower,
  rebirthMultiplier,
  rollPet,
  stageCost,
  stageWins,
  stepValue,
  tableRequirementText,
  tableUnlocked,
  titleForLevel,
  weekIndex,
  winsUpgradeCost,
  xpForLevel,
  xpMultiplier,
} from './formulas'
import { SPAWN } from './layout'
import { computeOffline, defaultData, deleteSave, writeSave } from './save'

/* ----------------------------------------------------------------- helpers */

let idCounter = 0
const nextId = () => {
  idCounter += 1
  return idCounter
}

function freshSession() {
  return {
    hydrated: false,
    saveKey: null,
    /** Gates passed this run. Paying gate i sets it to i + 1; a WIN pad resets it. */
    runStage: 0,
    activeTable: -1,
    /** Seconds idle (no input) counting toward the AFK 2x boost; any input resets it. */
    afkSeconds: 0,
    /** Idle long enough to show "AFK" over your head. */
    afk: false,
    /** This tab handed the game to another tab of the same browser (see TabLock). */
    paused: false,
    /** Seconds played this session - drives playtime gifts. */
    playtime: 0,
    giftsClaimed: [],
    combo: 0,
    lastClickAt: 0,
    clickTimes: [],
    nearbyEgg: null,
    teleport: null,
    gateDeniedAt: 0,
    lockedNoticeAt: 0,
    affordNotified: -1,
    /** Debug/test: force a money rain until this time (ms). */
    rainForcedUntil: 0,
    /** Money rain slot we already warned about / announced. */
    rainWarned: null,
    rainStarted: null,
    /** The daily gift popup was shown (or not needed) this session. */
    dailyPopupDone: false,
  }
}

function freshUi() {
  return {
    panel: null,
    tab: null,
    toasts: [],
    banner: null,
    hatch: null,
    offline: null,
    tutorialDone: false,
    /** Latest own Boxity chat message shown over the head: { id, text }. */
    chatBubble: null,
  }
}

/** Adds XP, leveling up as needed but never past `cap` (MAX level). */
function applyXp(level, xp, amount, cap) {
  if (level >= cap) return { level: cap, xp: 0 }
  let lvl = level
  let total = xp + amount
  let need = xpForLevel(lvl)
  let guard = 0
  while (total >= need && lvl < cap && guard < 500) {
    total -= need
    lvl += 1
    need = xpForLevel(lvl)
    guard += 1
  }
  return { level: lvl, xp: lvl >= cap ? 0 : total }
}

const findPet = (pets, uid) => pets.find((p) => p.uid === uid)

function bestEquipSet(pets, slots) {
  return [...pets]
    .sort((a, b) => petPower(b) - petPower(a))
    .slice(0, slots)
    .map((p) => p.uid)
}

/** Equip new pets into free slots, or over the weakest equipped pet if stronger. */
function autoEquip(pets, equipped, slots, newPets) {
  const eq = equipped.filter((uid) => findPet(pets, uid))
  for (const pet of newPets) {
    if (eq.length < slots) {
      eq.push(pet.uid)
      continue
    }
    let weakest = -1
    let weakestPower = Infinity
    eq.forEach((uid, i) => {
      const power = petPower(findPet(pets, uid))
      if (power < weakestPower) {
        weakestPower = power
        weakest = i
      }
    })
    if (weakest >= 0 && petPower(pet) > weakestPower) eq[weakest] = pet.uid
  }
  return eq
}

/** Daily reward state at `now`: which day is next and whether it can be claimed. */
export function dailyStatus(data, now = Date.now()) {
  const last = data.daily.lastClaim || 0
  const hours = last ? (now - last) / 3.6e6 : Infinity
  const broken = hours >= DAILY.streakBreakHours
  const streak = broken ? 0 : data.daily.streak
  return {
    canClaim: hours >= DAILY.claimEveryHours,
    streak,
    dayIndex: streak % DAILY.rewards.length,
    week: Math.floor(streak / DAILY.rewards.length),
    nextAt: last ? last + DAILY.claimEveryHours * 3.6e6 : now,
  }
}

export function giftReady(session, index) {
  return (
    !session.giftsClaimed.includes(index) && session.playtime >= GIFTS[index].minutes * 60
  )
}

/* ------------------------------------------------------------------- store */

export const useGame = create((set, get) => ({
  data: defaultData(),
  session: freshSession(),
  ui: freshUi(),

  /* ------------------------------------------------------------ lifecycle */

  hydrate(saveKey, saved) {
    const data = saved || defaultData()
    const offline = saved ? computeOffline(data) : null
    const next = offline
      ? {
          ...data,
          money: data.money + offline.amount,
          stats: { ...data.stats, totalEarned: data.stats.totalEarned + offline.amount },
        }
      : data
    const switching = get().session.hydrated
    set({
      data: next,
      session: { ...freshSession(), saveKey, hydrated: true },
      ui: { ...freshUi(), offline },
    })
    // Switching saves resets the run (all gates close): never leave the player
    // stranded between two closed gates.
    if (switching) get().requestTeleport(SPAWN)
    // Old saves / returning players skip finished steps without a toast each.
    get().checkTutorial({ silent: true })
  },

  save() {
    const { session, data } = get()
    // A paused tab must never overwrite the progress of the tab now playing.
    if (!session.hydrated || session.paused) return
    writeSave(session.saveKey, { ...data, lastTable: session.activeTable })
  },

  resetProgress() {
    const { session } = get()
    deleteSave(session.saveKey)
    const fresh = defaultData()
    fresh.settings = get().data.settings
    set({ data: fresh, session: { ...freshSession(), saveKey: session.saveKey, hydrated: true }, ui: freshUi() })
    get().requestTeleport(SPAWN)
    writeSave(session.saveKey, fresh)
  },

  /* ----------------------------------------------------------- ui helpers */

  openPanel(panel, tab = null) {
    set((s) => ({ ui: { ...s.ui, panel, tab } }))
  },
  closePanel() {
    set((s) => ({ ui: { ...s.ui, panel: null, tab: null } }))
  },
  setTab(tab) {
    set((s) => ({ ui: { ...s.ui, tab } }))
  },

  toast(text, kind = 'info', ms = 2400) {
    const id = nextId()
    set((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts.slice(-3), { id, text, kind }] } }))
    setTimeout(() => {
      set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } }))
    }, ms)
  },

  showBanner(text, sub = null, kind = 'level', ms = 2600) {
    const id = nextId()
    set((s) => ({ ui: { ...s.ui, banner: { id, text, sub, kind } } }))
    setTimeout(() => {
      set((s) => (s.ui.banner?.id === id ? { ui: { ...s.ui, banner: null } } : {}))
    }, ms)
  },

  showChatBubble(text, seconds = 4) {
    const id = nextId()
    set((s) => ({ ui: { ...s.ui, chatBubble: { id, text } } }))
    setTimeout(() => {
      set((s) => (s.ui.chatBubble?.id === id ? { ui: { ...s.ui, chatBubble: null } } : {}))
    }, seconds * 1000)
  },

  dismissOffline() {
    set((s) => ({ ui: { ...s.ui, offline: null } }))
  },
  dismissTutorialDone() {
    set((s) => ({ ui: { ...s.ui, tutorialDone: false } }))
  },
  closeHatch() {
    set((s) => ({ ui: { ...s.ui, hatch: null } }))
  },

  setSetting(key, value) {
    set((s) => ({ data: { ...s.data, settings: { ...s.data.settings, [key]: value } } }))
  },

  requestTeleport(position) {
    set((s) => ({ session: { ...s.session, teleport: { id: nextId(), position } } }))
    fx.emit('teleport', { position })
  },

  /* -------------------------------------------------------------- earning */

  /** Shared money + XP bookkeeping. Returns nothing; fires level-up effects. */
  grant(money, xp, extraStats = null) {
    const { data } = get()
    const before = data.level
    const lifeBefore = data.stats.lifetimeLevels
    const lv = xp > 0 ? applyXp(data.level, data.xp, xp, maxLevel(data.rebirths)) : { level: data.level, xp: data.xp }
    const stats = { ...data.stats, totalEarned: data.stats.totalEarned + money }
    if (extraStats) for (const [k, v] of Object.entries(extraStats)) stats[k] = (stats[k] || 0) + v
    stats.lifetimeLevels = lifeBefore + (lv.level - before)
    set({ data: { ...data, money: data.money + money, level: lv.level, xp: lv.xp, stats } })
    if (lv.level > before) get().onLevelUp(before, lv.level, lifeBefore, stats.lifetimeLevels)
  },

  click(screenX, screenY) {
    const { session, data } = get()
    if (!session.hydrated) return
    const t = performance.now()
    const recent = session.clickTimes.filter((ts) => t - ts < 1000)
    if (recent.length >= ECONOMY.maxClicksPerSecond) return
    recent.push(t)

    const combo = t - session.lastClickAt < ECONOMY.comboWindow * 1000 ? session.combo + 1 : 1
    const crit = Math.random() < ECONOMY.critChance
    const amount = clickValue(data, Date.now()) * (1 + comboBonus(combo)) * (crit ? ECONOMY.critMultiplier : 1)
    set({ session: { ...session, clickTimes: recent, combo, lastClickAt: t } })
    get().grant(amount, ECONOMY.xpPerClick * xpMultiplier(data), { totalClicks: 1 })
    fx.emit('click', { x: screenX, y: screenY, amount, combo, crit })
    get().checkTutorial()
  },

  earnStep() {
    const { session, data } = get()
    if (!session.hydrated) return
    const amount = stepValue(data, Date.now())
    get().grant(amount, ECONOMY.xpPerStep * xpMultiplier(data), { totalSteps: 1 })
    fx.emit('step', { amount })
  },

  /** Titles follow lifetime levels, so a rebirth never takes your title away. */
  onLevelUp(from, to, lifeFrom = from, lifeTo = to) {
    const oldTitle = titleForLevel(lifeFrom)
    const title = titleForLevel(lifeTo)
    const titleChanged = title.index !== oldTitle.index
    fx.emit('levelUp', { from, to, titleChanged, title })
    const { data } = get()
    if (atMaxLevel(data)) {
      get().showBanner('MAX LEVEL!', `Rebirth now for x${formatNumber(rebirthMultiplier(data.rebirths + 1))} Money 🔄`, 'rebirth', 3200)
      get().toast('🔄 You reached MAX level - open Rebirth!', 'success', 4000)
    } else {
      get().showBanner(
        `Level Up! (${from} > ${to})`,
        titleChanged ? `New title: ${title.emoji} ${title.name}! Your body got stronger 💪` : null,
        'level',
      )
    }
    TRAINING_TABLES.forEach((table, i) => {
      if (table.req.level && from < table.req.level && to >= table.req.level && tableUnlocked(data, i)) {
        get().toast(`🪑 New training table unlocked: x${table.mult} Money!`, 'success', 3500)
      }
    })
    get().checkTutorial()
  },

  /* --------------------------------------------------------------- stages */

  tryPayGate(index) {
    const { session, data } = get()
    if (!session.hydrated || index !== session.runStage || index >= STAGES.length) return
    const cost = stageCost(index)
    if (data.money >= cost) {
      set({
        data: { ...data, money: data.money - cost },
        session: { ...session, runStage: index + 1, affordNotified: -1 },
      })
      fx.emit('gateOpen', { index })
      get().toast(`🚪 Entered Stage ${index + 1}!`, 'success', 1800)
      get().checkTutorial()
    } else {
      const t = Date.now()
      if (t - session.gateDeniedAt < 1500) return
      set({ session: { ...session, gateDeniedAt: t } })
      const missing = cost - data.money
      fx.emit('gateDenied', { index, missing })
      get().toast(`🔒 Need ${formatMoney(missing)} more to enter Stage ${index + 1}!`, 'error')
    }
  },

  claimWinPad(index) {
    const { session, data } = get()
    if (!session.hydrated || index >= session.runStage) return
    const wins = stageWins(data, index)
    set({
      data: {
        ...data,
        wins: data.wins + wins,
        stats: {
          ...data.stats,
          totalWins: data.stats.totalWins + wins,
          bestStage: Math.max(data.stats.bestStage, index + 1),
        },
      },
      session: { ...session, runStage: 0, affordNotified: -1 },
    })
    get().grant(0, (index + 1) * 4 * xpMultiplier(data))
    fx.emit('win', { index, wins })
    get().showBanner(`+${formatNumber(wins)} WINS!`, `Stage ${index + 1} complete 🏆`, 'win', 2200)
    get().requestTeleport(SPAWN)
    get().checkTutorial()
  },

  /**
   * Advances wall-clock timers by `dt` seconds (playtime, gifts, nudges). The
   * game loop measures real elapsed time, so a throttled background tab still
   * gets the right amount.
   */
  tickTime(dt) {
    const { session, data } = get()
    if (!session.hydrated || dt <= 0) return
    const before = session.playtime
    const playtime = before + dt
    set({
      session: { ...session, playtime },
      data: { ...data, stats: { ...data.stats, playtime: data.stats.playtime + dt } },
    })

    // "You can afford Stage N" nudges, once per gate.
    const s = get()
    const next = s.session.runStage
    if (next < STAGES.length && s.data.money >= stageCost(next) && s.session.affordNotified !== next) {
      set({ session: { ...s.session, affordNotified: next } })
      get().toast(`✅ You can afford Stage ${next + 1}!`, 'success')
    }
    const giftJustReady = GIFTS.some(
      (g, i) => before < g.minutes * 60 && playtime >= g.minutes * 60 && !s.session.giftsClaimed.includes(i),
    )
    if (giftJustReady) get().toast('🎁 A playtime gift is ready! Open Rewards.', 'success', 3200)

    // Weekly leaderboards: remember where this week started.
    const now = Date.now()
    const week = weekIndex(now)
    const d = get().data
    if (d.weekly.week !== week) {
      set({
        data: {
          ...d,
          weekly: {
            week,
            earned: d.stats.totalEarned,
            wins: d.stats.totalWins,
            levels: d.stats.lifetimeLevels,
            rebirths: d.rebirths,
          },
        },
      })
    }

    // Hourly money rain: a heads-up a minute before, a banner when it starts.
    const sess = get().session
    const rain = moneyRainStatus(now, sess.rainForcedUntil)
    const period = MONEY_RAIN.everyMinutes * 60000
    const slot = sess.rainForcedUntil > now ? `forced-${sess.rainForcedUntil}` : String(Math.floor(now / period))
    if (rain.active && sess.rainStarted !== slot) {
      set({ session: { ...sess, rainStarted: slot } })
      fx.emit('moneyRain')
      get().showBanner('💸 MONEY RAIN!', 'Grab the falling cash before it disappears!', 'boost', 2600)
    } else if (!rain.active && rain.startsIn <= MONEY_RAIN.warnSeconds) {
      const next = String(Math.floor(now / period) + 1)
      if (sess.rainWarned !== next) {
        set({ session: { ...sess, rainWarned: next } })
        get().toast('💸 Money rain in 1 minute - be in the lobby!', 'success', 3600)
      }
    }
  },

  /** One falling bill picked up during a money rain. */
  collectRainBill() {
    const { data, session } = get()
    if (!session.hydrated) return
    const amount = clickValue(data, Date.now()) * MONEY_RAIN.billClicks
    get().grant(amount, 2 * xpMultiplier(data))
    fx.emit('rainBill', { amount })
  },

  /** Starts a money rain now (testing / events). */
  startMoneyRain(seconds = MONEY_RAIN.durationSeconds) {
    set((s) => ({ session: { ...s.session, rainForcedUntil: Date.now() + seconds * 1000 } }))
  },

  markDailyPopupDone() {
    set((s) => ({ session: { ...s.session, dailyPopupDone: true } }))
  },

  /* ------------------------------------------------------------- training */

  setActiveTable(index) {
    const { session, data } = get()
    if (session.activeTable === index) return
    set({ session: { ...session, activeTable: index } })
    if (index >= 0 && !tableUnlocked(data, index)) {
      const t = Date.now()
      if (t - session.lockedNoticeAt > 2500) {
        set((s) => ({ session: { ...s.session, lockedNoticeAt: t } }))
        get().toast(`🔒 This table needs ${tableRequirementText(index)}`, 'error')
        fx.emit('deny', { reason: 'table' })
      }
    }
  },

  /**
   * Once a second. `idle` = seconds since the player's last input.
   * - Training table: standing on an unlocked rug earns every second.
   * - AFK: logged in with no input for a while shows "AFK"; every 10 minutes of
   *   it pays 5 minutes of 2x money. Any input restarts the count.
   */
  afkTick(dt, idle = 0) {
    const { session, data } = get()
    if (!session.hydrated || session.paused) return
    const now = Date.now()
    const index = session.activeTable
    const atTable = index >= 0 && tableUnlocked(data, index)
    if (atTable) {
      const amount = afkIncomePerSecond(data, index, now) * dt
      get().grant(amount, afkXpPerSecond(data, index) * dt)
      fx.emit('afk', { amount, index })
    }

    const s = get()
    // Input within the last couple of seconds = playing.
    let afkSeconds = idle < 2 ? 0 : s.session.afkSeconds + dt
    let boosts = s.data.boosts
    if (afkSeconds >= ECONOMY.afkBoostAfterSeconds) {
      afkSeconds = 0
      boosts = { money2xUntil: Math.max(now, boosts.money2xUntil) + ECONOMY.afkBoostSeconds * 1000 }
      fx.emit('boost', { seconds: ECONOMY.afkBoostSeconds })
      get().showBanner('2x MONEY!', `AFK reward: ${formatTime(ECONOMY.afkBoostSeconds)} of double money`, 'boost')
    }
    const afk = idle >= ECONOMY.afkTagAfterSeconds
    const tutorial = s.data.tutorial
    const tableStep = atTable && !tutorial.done && TUTORIAL[tutorial.step]?.guide === 'table'
    set({
      session: { ...s.session, afkSeconds, afk },
      data: {
        ...s.data,
        boosts,
        tutorial: tableStep ? { ...tutorial, tableSeconds: tutorial.tableSeconds + dt } : tutorial,
      },
    })
    if (tableStep) get().checkTutorial()
  },

  setPaused(paused) {
    set((s) => ({ session: { ...s.session, paused } }))
  },

  /* ------------------------------------------------------------- upgrades */

  /** `silent` skips the not-enough-money message; `quiet` skips buy effects (bulk buys). */
  buyCashUpgrade(key, { silent = false, quiet = false } = {}) {
    const { data } = get()
    const level = data.cashUpgrades[key]
    const cost = cashUpgradeCost(key, level, data)
    if (data.money < cost) {
      if (!silent) {
        fx.emit('deny', { reason: 'money' })
        get().toast(`Need ${formatMoney(cost - data.money)} more!`, 'error', 1600)
      }
      return false
    }
    set({
      data: {
        ...data,
        money: data.money - cost,
        cashUpgrades: { ...data.cashUpgrades, [key]: level + 1 },
        stats: { ...data.stats, upgradesBought: data.stats.upgradesBought + 1 },
      },
    })
    if (!quiet) fx.emit('buy', { kind: 'cash', key })
    get().checkTutorial()
    return true
  },

  /**
   * Better Cash pedestal: equips an owned tier, or unlocks the next one with
   * Wins (tiers unlock in order) and equips it.
   */
  selectCashTier(index, { silent = false } = {}) {
    const { data } = get()
    const tier = CASH_TIERS[index]
    if (!tier) return false
    const { owned, equipped } = data.cashTiers
    if (index < owned) {
      if (equipped === index) return true
      set({ data: { ...data, cashTiers: { owned, equipped: index } } })
      fx.emit('buy', { kind: 'equip' })
      get().toast(`💵 Equipped +${formatNumber(tier.value)} Money cash`, 'success', 1600)
      return true
    }
    if (index > owned) {
      if (!silent) {
        fx.emit('deny', { reason: 'order' })
        get().toast(`🔒 Unlock +${formatNumber(CASH_TIERS[owned].value)} Money first!`, 'error', 1800)
      }
      return false
    }
    if (data.wins < tier.cost) {
      if (!silent) {
        fx.emit('deny', { reason: 'wins' })
        get().toast(`🏆 Need ${formatNumber(tier.cost - data.wins)} more Wins for +${formatNumber(tier.value)} Money!`, 'error', 2000)
      }
      return false
    }
    set({
      data: {
        ...data,
        wins: data.wins - tier.cost,
        cashTiers: { owned: owned + 1, equipped: index },
      },
    })
    fx.emit('buy', { kind: 'cashTier', key: index })
    get().showBanner(`+${formatNumber(tier.value)} MONEY!`, 'Better cash unlocked - every click is worth more 💵', 'win', 2400)
    get().checkTutorial()
    return true
  },

  buyWinsUpgrade(key) {
    const { data } = get()
    const level = data.winsUpgrades[key] || 0
    const cost = winsUpgradeCost(key, level)
    if (!Number.isFinite(cost)) return false
    if (data.wins < cost) {
      fx.emit('deny', { reason: 'wins' })
      get().toast(`Need ${formatNumber(cost - data.wins)} more Wins!`, 'error', 1600)
      return false
    }
    set({
      data: {
        ...data,
        wins: data.wins - cost,
        winsUpgrades: { ...data.winsUpgrades, [key]: level + 1 },
      },
    })
    fx.emit('buy', { kind: 'wins', key })
    get().toast(`${WINS_UPGRADES[key].emoji} ${WINS_UPGRADES[key].name} upgraded!`, 'success', 1600)
    return true
  },

  /** Rebirth at MAX level: resets level + money + boosts, doubles the Multiplier. */
  rebirth() {
    const { data, session } = get()
    if (!atMaxLevel(data)) {
      fx.emit('deny', { reason: 'rebirth' })
      get().toast(`Reach MAX level (${maxLevel(data.rebirths)}) to rebirth!`, 'error')
      return false
    }
    const rebirths = data.rebirths + 1
    set({
      data: {
        ...data,
        money: 0,
        level: 0,
        xp: 0,
        cashUpgrades: { click: 0, walk: 0, afk: 0 },
        rebirths,
      },
      session: { ...session, runStage: 0, affordNotified: -1 },
      ui: { ...get().ui, panel: null, tab: null },
    })
    fx.emit('rebirth', { rebirths })
    get().showBanner(
      'REBIRTH!',
      `x${formatNumber(rebirthMultiplier(rebirths))} Multiplier · MAX Level ${maxLevel(rebirths)} 🔥`,
      'rebirth',
      3200,
    )
    for (const table of TRAINING_TABLES) {
      if (table.req.rebirths === rebirths) {
        get().toast(`🪑 New training table unlocked: x${table.mult} Money!`, 'success', 4000)
      }
    }
    get().requestTeleport(SPAWN)
    get().checkTutorial()
    get().save()
    return true
  },

  /* ----------------------------------------------------------------- pets */

  setNearbyEgg(id) {
    if (get().session.nearbyEgg === id) return
    set((s) => ({ session: { ...s.session, nearbyEgg: id } }))
  },

  /** Adds pets without charging (rewards); opens the hatch reveal. */
  givePets(eggId, count) {
    const egg = eggById(eggId)
    const { data } = get()
    const space = PET_RULES.maxInventory - data.pets.length
    const n = Math.min(count, Math.max(0, space))
    if (n <= 0) {
      get().toast('🐾 Pet inventory full! Delete some pets first.', 'error', 3000)
      return []
    }
    let uid = data.nextPetUid
    const results = []
    for (let i = 0; i < n; i += 1) {
      results.push({ uid, id: rollPet(egg, data), variant: 0 })
      uid += 1
    }
    const pets = [...data.pets, ...results]
    set({
      data: {
        ...data,
        pets,
        nextPetUid: uid,
        equippedPets: autoEquip(pets, data.equippedPets, maxPetSlots(data), results),
        stats: { ...data.stats, eggsOpened: data.stats.eggsOpened + n },
      },
      ui: { ...get().ui, hatch: { id: nextId(), eggId, results } },
    })
    fx.emit('hatch', { results, eggId })
    get().checkTutorial()
    return results
  },

  hatchEgg(eggId, count = 1) {
    const egg = eggById(eggId)
    const { data, ui } = get()
    if (!egg || ui.hatch) return
    const affordable = Math.floor(data.wins / egg.cost)
    if (affordable < 1) {
      fx.emit('deny', { reason: 'wins' })
      get().toast(`🏆 Need ${formatNumber(egg.cost - data.wins)} more Wins for the ${egg.name}!`, 'error')
      return
    }
    const space = PET_RULES.maxInventory - data.pets.length
    if (space <= 0) {
      fx.emit('deny', { reason: 'inventory' })
      get().toast('🐾 Pet inventory full! Delete some pets first.', 'error', 3000)
      return
    }
    const n = Math.min(count, affordable, space)
    set({ data: { ...data, wins: data.wins - egg.cost * n } })
    get().givePets(eggId, n)
  },

  equipPet(uid) {
    const { data } = get()
    if (data.equippedPets.includes(uid) || !findPet(data.pets, uid)) return
    if (data.equippedPets.length >= maxPetSlots(data)) {
      get().toast('All pet slots are full. Unequip one first (or buy a slot in the Wins Shop).', 'error', 3000)
      fx.emit('deny', { reason: 'slots' })
      return
    }
    set({ data: { ...data, equippedPets: [...data.equippedPets, uid] } })
    fx.emit('buy', { kind: 'equip' })
  },

  unequipPet(uid) {
    const { data } = get()
    set({ data: { ...data, equippedPets: data.equippedPets.filter((u) => u !== uid) } })
  },

  equipBest() {
    const { data } = get()
    set({ data: { ...data, equippedPets: bestEquipSet(data.pets, maxPetSlots(data)) } })
    fx.emit('buy', { kind: 'equip' })
  },

  deletePet(uid) {
    const { data } = get()
    set({
      data: {
        ...data,
        pets: data.pets.filter((p) => p.uid !== uid),
        equippedPets: data.equippedPets.filter((u) => u !== uid),
      },
    })
  },

  /** Combine `evolveCost` identical pets into one of the next variant. */
  evolvePet(petId, variant) {
    const { data } = get()
    if (variant >= PET_RULES.variants.length - 1) return false
    const same = data.pets.filter((p) => p.id === petId && (p.variant || 0) === variant)
    if (same.length < PET_RULES.evolveCost) {
      fx.emit('deny', { reason: 'evolve' })
      return false
    }
    // Spend unequipped copies first.
    same.sort((a, b) => Number(data.equippedPets.includes(a.uid)) - Number(data.equippedPets.includes(b.uid)))
    const used = same.slice(0, PET_RULES.evolveCost)
    const usedIds = new Set(used.map((p) => p.uid))
    const wasEquipped = used.some((p) => data.equippedPets.includes(p.uid))
    const evolved = { uid: data.nextPetUid, id: petId, variant: variant + 1 }
    const pets = [...data.pets.filter((p) => !usedIds.has(p.uid)), evolved]
    let equippedPets = data.equippedPets.filter((u) => !usedIds.has(u))
    if (wasEquipped || equippedPets.length < maxPetSlots(data)) equippedPets = [...equippedPets, evolved.uid]
    set({ data: { ...data, pets, equippedPets, nextPetUid: data.nextPetUid + 1 } })
    fx.emit('reward', { kind: 'evolve' })
    get().toast(`✨ ${PET_RULES.variants[variant + 1].name} ${PETS[petId].name} created!`, 'success', 3000)
    return true
  },

  /* --------------------------------------------------------------- trails */

  selectTrail(id) {
    const { data } = get()
    const trail = TRAILS.find((t) => t.id === id)
    if (!trail) return
    if (data.trailsOwned.includes(id)) {
      set({ data: { ...data, trail: id } })
      fx.emit('buy', { kind: 'equip' })
      return
    }
    if (data.wins < trail.cost) {
      fx.emit('deny', { reason: 'wins' })
      get().toast(`Need ${formatNumber(trail.cost - data.wins)} more Wins!`, 'error')
      return
    }
    set({
      data: { ...data, wins: data.wins - trail.cost, trailsOwned: [...data.trailsOwned, id], trail: id },
    })
    fx.emit('buy', { kind: 'trail', key: id })
    get().toast(`⚡ ${trail.name} equipped! +${Math.round(trail.speed * 100)}% speed`, 'success')
  },

  /* -------------------------------------------------------------- rewards */

  grantReward(reward, scale = 1) {
    const now = Date.now()
    const { data } = get()
    if (reward.kind === 'money') {
      const amount = clickValue(data, now) * reward.clicks * scale
      get().grant(amount, 0)
      get().toast(`💵 +${formatMoney(amount)}!`, 'success')
    } else if (reward.kind === 'wins') {
      const amount = Math.round(reward.amount * scale)
      set({ data: { ...data, wins: data.wins + amount } })
      get().toast(`🏆 +${formatNumber(amount)} Wins!`, 'success')
    } else if (reward.kind === 'boost') {
      const seconds = reward.boostMinutes * 60 * scale
      set({
        data: { ...data, boosts: { money2xUntil: Math.max(now, data.boosts.money2xUntil) + seconds * 1000 } },
      })
      fx.emit('boost', { seconds })
      get().toast(`⚡ 2x Money for ${formatTime(seconds)}!`, 'success')
    } else if (reward.kind === 'egg') {
      if (reward.wins) {
        const amount = Math.round(reward.wins * scale)
        set((s) => ({ data: { ...s.data, wins: s.data.wins + amount } }))
      }
      get().givePets(reward.egg, 1)
    }
    fx.emit('reward', { kind: reward.kind })
  },

  claimDaily() {
    const { data } = get()
    const status = dailyStatus(data)
    if (!status.canClaim) return
    const reward = DAILY.rewards[status.dayIndex]
    set({ data: { ...data, daily: { lastClaim: Date.now(), streak: status.streak + 1 } } })
    get().grantReward(reward, 1 + DAILY.weekBonus * status.week)
    get().save()
  },

  claimGift(index) {
    const { session } = get()
    if (!giftReady(session, index)) return
    set({ session: { ...session, giftsClaimed: [...session.giftsClaimed, index] } })
    get().grantReward(GIFTS[index])
  },

  collectLuckyBag() {
    const { data } = get()
    const amount = clickValue(data, Date.now()) * ECONOMY.luckyBagClicks
    get().grant(amount, 10 * xpMultiplier(data))
    fx.emit('luckyBag', { amount })
    get().toast(`💰 Lucky bag! +${formatMoney(amount)}`, 'success')
  },

  /* ------------------------------------------------------------- tutorial */

  checkTutorial({ silent = false } = {}) {
    for (let guard = 0; guard < TUTORIAL.length; guard += 1) {
      const { data, session } = get()
      const tutorial = data.tutorial
      if (tutorial.done || !session.hydrated) return
      const step = TUTORIAL[tutorial.step]
      if (!step || step.progress(data, session) < step.target) return
      const nextStep = tutorial.step + 1
      if (nextStep >= TUTORIAL.length) {
        set({
          data: { ...data, wins: data.wins + TUTORIAL_REWARD_WINS, tutorial: { ...tutorial, step: nextStep, done: true } },
          ui: { ...get().ui, tutorialDone: true },
        })
        fx.emit('reward', { kind: 'tutorial' })
        return
      }
      set({ data: { ...data, tutorial: { ...tutorial, step: nextStep } } })
      if (silent) continue
      fx.emit('reward', { kind: 'step' })
      get().toast(`✔ ${step.text} - done!`, 'success', 2000)
    }
  },
}))

export const getGame = () => useGame.getState()

/* Re-exported so UI code can price things without importing formulas too. */
export { CASH_UPGRADES, EGGS, WINS_UPGRADES }
