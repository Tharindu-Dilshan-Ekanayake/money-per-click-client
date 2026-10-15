/**
 * Every gameplay number lives here. Rebalancing the game should never require
 * touching logic files - tweak these tables and reload.
 *
 * Units: distances are world units (the player is 1.8 tall), times are seconds
 * unless a name says otherwise.
 */

export const SAVE_VERSION = 3

/*
 * Balance check: see the pacing notes in README ("Tuning the game"). Change the
 * tables below and re-check pacing before shipping big changes.
 */

export const ECONOMY = {
  /**
   * Like the original game, the Multiplier only comes from rebirths:
   * x1 with no rebirths, x2 after the first, then doubling (x4, x8, ...).
   */
  rebirthMultiplierBase: 2,
  /** A step pays this fraction of a click. */
  stepFraction: 0.5,
  /** Each rebirth also adds +50% Wins from WIN pads. */
  winsPerRebirth: 0.5,

  /** Horizontal distance walked that pays out one "step". */
  stepDistance: 1.6,
  /** Clicks above this rate are ignored (keeps auto-clicker macros honest). */
  maxClicksPerSecond: 20,
  /** Variable reward: now and then a click is a CRIT worth 5 clicks. */
  critChance: 0.04,
  critMultiplier: 5,

  /** Rapid clicks build a combo; each combo point is +1% money, capped. */
  comboWindow: 0.6,
  comboBonusPerHit: 0.01,
  comboMaxBonus: 0.25,

  xpPerClick: 1,
  xpPerStep: 0.5,

  /** Spec: offline earnings pay 50% of AFK income, for at most 8 hours. */
  offlineRate: 0.5,
  offlineMaxSeconds: 8 * 3600,
  /** Ignore very short absences (a page reload should not pop a dialog). */
  offlineMinSeconds: 60,

  /** Spec: 10 minutes at a training table grants 5 minutes of 2x money. */
  /**
   * AFK = logged in but not playing: no movement, clicks or keys. (Closing the
   * game is not AFK - that pays offline earnings instead.) After this long the
   * player shows "AFK" over their head...
   */
  afkTagAfterSeconds: 60,
  /** ...and every 10 minutes of AFK pays 5 minutes of 2x money. */
  afkBoostAfterSeconds: 600,
  afkBoostSeconds: 300,

  /** Lucky money bags that spawn around the hub. Reward = click value x clicks. */
  luckyBagEverySeconds: [40, 75],
  luckyBagClicks: 40,
}

/**
 * Hourly money rain: on the hour (UTC, so everyone online sees it together),
 * cash falls around each player in the lobby for 45 seconds. Each bill is a
 * small amount - a fun bonus, not a jackpot.
 */
export const MONEY_RAIN = {
  everyMinutes: 60,
  durationSeconds: 45,
  /** One bill = this many clicks of your current click value. */
  billClicks: 3,
  spawnPerSecond: 3,
  maxBills: 36,
  /** Bills land within this distance of the player. */
  radius: 12,
  /** Heads-up toast this long before it starts. */
  warnSeconds: 60,
}

/** XP needed to go from `level` to `level + 1`. */
export const LEVEL = {
  base: 8,
  linear: 3,
  quad: 0.12,
}

/**
 * Rebirth happens at MAX level, like the original: 25 at first, then 32, 40,
 * 49, 59 ... (cap = first + step*r + r*(r-1)/2). Rebirthing resets your level
 * and money and doubles the Multiplier.
 */
export const REBIRTH = {
  firstMaxLevel: 25,
  capStep: 7,
}

/**
 * Body, speed and title grow with LIFETIME levels (every level ever gained,
 * across rebirths), so rebirthing resets your level but never your muscles.
 * `buff` (0 = skinny brokie, 1 = bodybuilder) reaches 1 at `maxBuffLevel`,
 * eased so the first levels already show a visible change.
 */
export const PHYSIQUE = {
  maxBuffLevel: 250,
  easePower: 1.6,
}

/**
 * Walk speed rises a little with every lifetime level (spec: slow at level 0,
 * faster as you level). Trails and the Speed Boost upgrade multiply on top.
 */
export const SPEED = {
  base: 3.4,
  perLevel: 0.045,
  levelCap: 300,
  max: 26,
  jumpImpulse: 5.2,
}

/** Titles above the head, by lifetime levels. */
export const TITLES = [
  { level: 0, name: 'Brokie', emoji: '😭', color: '#a8a29e' },
  { level: 10, name: 'Penny Pincher', emoji: '🪙', color: '#fbbf24' },
  { level: 25, name: 'Hustler', emoji: '💼', color: '#60a5fa' },
  { level: 45, name: 'Rich Kid', emoji: '💵', color: '#4ade80' },
  { level: 75, name: 'Baller', emoji: '😎', color: '#f472b6' },
  { level: 115, name: 'Millionaire', emoji: '💰', color: '#facc15' },
  { level: 165, name: 'Multi-Millionaire', emoji: '💎', color: '#22d3ee' },
  { level: 225, name: 'Billionaire', emoji: '🤑', color: '#a3e635' },
  { level: 300, name: 'Tycoon', emoji: '👑', color: '#fb923c' },
  { level: 400, name: 'Richest In The World', emoji: '🌍', color: '#e879f9' },
]

/**
 * The stage corridor. Each gate costs `cost` money (deducted on entry - you
 * cannot pass without it). Each room has a WIN pad that pays `wins` and sends
 * you back to spawn, closing the gates again.
 */
export const STAGES = [
  { cost: 100, wins: 1 },
  { cost: 250, wins: 2 },
  { cost: 700, wins: 3 },
  { cost: 2_000, wins: 5 },
  { cost: 6_000, wins: 8 },
  { cost: 18_000, wins: 12 },
  { cost: 50_000, wins: 18 },
  { cost: 150_000, wins: 27 },
  { cost: 450_000, wins: 40 },
  { cost: 1.3e6, wins: 60 },
  { cost: 4e6, wins: 90 },
  { cost: 12e6, wins: 135 },
  { cost: 35e6, wins: 200 },
  { cost: 100e6, wins: 300 },
  { cost: 300e6, wins: 450 },
  { cost: 900e6, wins: 675 },
  { cost: 2.7e9, wins: 1_000 },
  { cost: 8e9, wins: 1_500 },
  { cost: 25e9, wins: 2_250 },
  { cost: 75e9, wins: 3_500 },
]

/**
 * "Unlock Better Cash" - the money pedestals from the original game. Each tier
 * sets how much ONE click is worth (before multipliers). Bought with Wins in
 * order and kept forever (rebirth doesn't reset them). The best owned tier is
 * equipped automatically and is what you hold in your hand.
 */
export const CASH_TIERS = [
  { value: 1, cost: 0 },
  // 1 Win: the first WIN pad buys it, which finishes the first-time guide.
  { value: 3, cost: 1 },
  { value: 15, cost: 8 },
  { value: 52.5, cost: 30 },
  { value: 240, cost: 100 },
  { value: 800, cost: 300 },
  { value: 4_500, cost: 800 },
  { value: 15_000, cost: 2_000 },
  { value: 54_000, cost: 5_000 },
  { value: 450_000, cost: 12_000 },
  { value: 2.4e6, cost: 30_000 },
  { value: 8.8e6, cost: 75_000 },
  { value: 36e6, cost: 180_000 },
  { value: 144e6, cost: 450_000 },
  { value: 900e6, cost: 1.1e6 },
]

/**
 * Money boosts - bought with Money, reset on rebirth (spec). Each level adds
 * `perLevel` and costs `growth` (15%) more than the last. Prices are in clicks
 * of your current cash (`costClicks` x click base value), so they stay
 * meaningful whatever cash tier and rebirth you're on.
 */
export const CASH_UPGRADES = {
  click: {
    name: 'Click Boost',
    emoji: '👆',
    desc: '+10% money per click',
    perLevel: 0.1,
    costClicks: 25,
    growth: 1.15,
    color: '#22c55e',
  },
  walk: {
    name: 'Walk Boost',
    emoji: '👟',
    desc: '+10% money per step',
    perLevel: 0.1,
    costClicks: 35,
    growth: 1.15,
    color: '#3b82f6',
  },
  afk: {
    name: 'AFK Boost',
    emoji: '🪑',
    desc: '+10% training table income',
    perLevel: 0.1,
    costClicks: 60,
    growth: 1.15,
    color: '#a855f7',
  },
}
export const CASH_UPGRADE_KEYS = ['click', 'walk', 'afk']

/** Wins Shop - bought with Wins, never reset (spec). */
export const WINS_UPGRADES = {
  money: {
    name: 'Money Boost',
    emoji: '💰',
    desc: '+25% money',
    perLevel: 0.25,
    baseCost: 5,
    growth: 1.45,
    max: 250,
  },
  xp: {
    name: 'XP Boost',
    emoji: '⭐',
    desc: '+10% XP',
    perLevel: 0.1,
    baseCost: 5,
    growth: 1.45,
    max: 250,
  },
  wins: {
    name: 'Wins Boost',
    emoji: '🏆',
    desc: '+10% wins',
    perLevel: 0.1,
    baseCost: 10,
    growth: 1.55,
    max: 250,
  },
  speed: {
    name: 'Speed Boost',
    emoji: '⚡',
    desc: '+4% walk speed',
    perLevel: 0.04,
    baseCost: 15,
    growth: 1.7,
    max: 15,
  },
  luck: {
    name: 'Egg Luck',
    emoji: '🍀',
    desc: '+8% rare pet luck',
    perLevel: 0.08,
    baseCost: 25,
    growth: 1.8,
    max: 20,
  },
  petSlot: {
    name: 'Pet Slot',
    emoji: '🐾',
    desc: '+1 pet equipped',
    costs: [40, 400, 4_000, 40_000],
    max: 4,
  },
}
export const WINS_UPGRADE_KEYS = ['money', 'xp', 'wins', 'speed', 'luck', 'petSlot']

/**
 * AFK training tables, unlocked by rebirths like the original. Standing on a
 * table's rug earns `click value x mult x AFK Boost` money every second.
 */
export const TRAINING_TABLES = [
  { mult: 3, req: { rebirths: 0 }, color: '#22c55e' },
  { mult: 6, req: { rebirths: 1 }, color: '#f97316' },
  { mult: 12, req: { rebirths: 3 }, color: '#3b82f6' },
  { mult: 25, req: { rebirths: 5 }, color: '#a855f7' },
  { mult: 60, req: { rebirths: 7 }, color: '#eab308' },
  { mult: 120, req: { rebirths: 9 }, color: '#ef4444' },
  { mult: 250, req: { rebirths: 11 }, color: '#06b6d4' },
  { mult: 500, req: { rebirths: 13 }, color: '#ec4899' },
]

export const RARITIES = {
  common: { name: 'Common', color: '#cbd5e1', glow: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', glow: 0 },
  rare: { name: 'Rare', color: '#60a5fa', glow: 0.3 },
  epic: { name: 'Epic', color: '#c084fc', glow: 0.6 },
  legendary: { name: 'Legendary', color: '#facc15', glow: 1 },
  mythic: { name: 'Mythic', color: '#f472b6', glow: 1.4 },
}

/**
 * Pets. `power` is added to the pet multiplier (0.25 = +25% money).
 * `look` drives the procedural 3D model.
 */
export const PETS = {
  doggy: { name: 'Doggy', emoji: '🐶', rarity: 'common', power: 0.1, look: { body: '#d6a76c', belly: '#f5deb3', ears: 'floppy' } },
  kitty: { name: 'Kitty', emoji: '🐱', rarity: 'common', power: 0.15, look: { body: '#f59e0b', belly: '#fde68a', ears: 'pointy' } },
  bunny: { name: 'Bunny', emoji: '🐰', rarity: 'uncommon', power: 0.25, look: { body: '#f5f5f4', belly: '#fbcfe8', ears: 'long' } },
  bear: { name: 'Bear', emoji: '🐻', rarity: 'rare', power: 0.5, look: { body: '#92400e', belly: '#d6a76c', ears: 'round' } },

  fox: { name: 'Fox', emoji: '🦊', rarity: 'uncommon', power: 0.4, look: { body: '#ea580c', belly: '#ffffff', ears: 'pointy' } },
  panda: { name: 'Panda', emoji: '🐼', rarity: 'uncommon', power: 0.6, look: { body: '#ffffff', belly: '#ffffff', ears: 'round', earColor: '#111827', patches: '#111827' } },
  owl: { name: 'Owl', emoji: '🦉', rarity: 'rare', power: 1, look: { body: '#a16207', belly: '#fde68a', ears: 'tufts', wings: '#854d0e' } },
  deer: { name: 'Deer', emoji: '🦌', rarity: 'epic', power: 1.75, look: { body: '#b45309', belly: '#fef3c7', ears: 'pointy', antlers: '#78350f' } },

  wolf: { name: 'Wolf', emoji: '🐺', rarity: 'rare', power: 1.5, look: { body: '#64748b', belly: '#e2e8f0', ears: 'pointy' } },
  tiger: { name: 'Tiger', emoji: '🐯', rarity: 'rare', power: 2.5, look: { body: '#f97316', belly: '#fff7ed', ears: 'round', patches: '#1c1917' } },
  unicorn: { name: 'Unicorn', emoji: '🦄', rarity: 'epic', power: 4.5, look: { body: '#fdf2f8', belly: '#fbcfe8', ears: 'pointy', horn: '#facc15', glow: '#f9a8d4' } },
  phoenix: { name: 'Phoenix', emoji: '🔥', rarity: 'legendary', power: 9, look: { body: '#ef4444', belly: '#fde047', ears: 'tufts', wings: '#f97316', glow: '#fb923c' } },

  dragon: { name: 'Dragon', emoji: '🐲', rarity: 'epic', power: 7, look: { body: '#16a34a', belly: '#bbf7d0', ears: 'horns', wings: '#15803d', glow: '#4ade80' } },
  griffin: { name: 'Griffin', emoji: '🦅', rarity: 'epic', power: 12, look: { body: '#ca8a04', belly: '#fef9c3', ears: 'tufts', wings: '#fefce8', glow: '#fde047' } },
  kraken: { name: 'Kraken', emoji: '🐙', rarity: 'legendary', power: 20, look: { body: '#7c3aed', belly: '#ddd6fe', ears: 'none', tentacles: '#6d28d9', glow: '#a78bfa' } },
  demon: { name: 'Demon', emoji: '👹', rarity: 'mythic', power: 40, look: { body: '#b91c1c', belly: '#fecaca', ears: 'horns', wings: '#450a0a', glow: '#ef4444' } },

  galaxyCat: { name: 'Galaxy Cat', emoji: '🌌', rarity: 'legendary', power: 50, look: { body: '#312e81', belly: '#a5b4fc', ears: 'pointy', glow: '#818cf8', sparkle: true } },
  angel: { name: 'Angel', emoji: '👼', rarity: 'legendary', power: 90, look: { body: '#fefce8', belly: '#ffffff', ears: 'none', wings: '#ffffff', halo: '#fde047', glow: '#fef08a' } },
  moneyKing: { name: 'Money King', emoji: '🤑', rarity: 'mythic', power: 200, look: { body: '#22c55e', belly: '#bbf7d0', ears: 'round', crown: '#facc15', glow: '#4ade80', sparkle: true } },
  rainbowTitan: { name: 'Rainbow Titan', emoji: '🌈', rarity: 'mythic', power: 500, look: { body: '#f472b6', belly: '#ffffff', ears: 'horns', wings: '#a78bfa', rainbow: true, glow: '#ffffff', sparkle: true } },
}

/**
 * Eggs, bought with Wins. `chances` are relative weights. Egg Luck shifts
 * weight toward the rarer (later) entries.
 */
export const EGGS = [
  { id: 'common', name: 'Common Egg', cost: 3, color: '#f8fafc', spots: '#cbd5e1', pets: [['doggy', 50], ['kitty', 32], ['bunny', 14], ['bear', 4]] },
  { id: 'uncommon', name: 'Uncommon Egg', cost: 120, color: '#4ade80', spots: '#166534', pets: [['fox', 45], ['panda', 32], ['owl', 18], ['deer', 5]] },
  { id: 'rare', name: 'Rare Egg', cost: 2_000, color: '#60a5fa', spots: '#1e3a8a', pets: [['wolf', 45], ['tiger', 32], ['unicorn', 18], ['phoenix', 5]] },
  { id: 'epic', name: 'Epic Egg', cost: 35_000, color: '#c084fc', spots: '#581c87', pets: [['dragon', 48], ['griffin', 34], ['kraken', 15], ['demon', 3]] },
  { id: 'legendary', name: 'Legendary Egg', cost: 600_000, color: '#facc15', spots: '#a16207', pets: [['galaxyCat', 50], ['angel', 33], ['moneyKing', 14], ['rainbowTitan', 3]] },
]

export const PET_RULES = {
  baseSlots: 3,
  maxInventory: 60,
  /** Evolving 3 identical pets makes one of the next variant. */
  evolveCost: 3,
  variants: [
    { name: 'Normal', mult: 1 },
    { name: 'Golden', mult: 3 },
    { name: 'Rainbow', mult: 9 },
  ],
}

/** Speed trails, bought with Wins. `speed` is a fractional bonus (0.1 = +10%). */
export const TRAILS = [
  { id: 'none', name: 'No Trail', speed: 0, cost: 0, colors: ['#94a3b8'] },
  { id: 'cloud', name: 'Cloud Trail', speed: 0.06, cost: 15, colors: ['#ffffff', '#e2e8f0'] },
  { id: 'red', name: 'Red Trail', speed: 0.12, cost: 75, colors: ['#ef4444', '#f87171'] },
  { id: 'orange', name: 'Flame Trail', speed: 0.18, cost: 300, colors: ['#f97316', '#facc15'] },
  { id: 'green', name: 'Toxic Trail', speed: 0.25, cost: 1_200, colors: ['#22c55e', '#a3e635'] },
  { id: 'blue', name: 'Ocean Trail', speed: 0.34, cost: 5_000, colors: ['#3b82f6', '#22d3ee'] },
  { id: 'purple', name: 'Galaxy Trail', speed: 0.45, cost: 20_000, colors: ['#8b5cf6', '#ec4899'] },
  { id: 'gold', name: 'Golden Trail', speed: 0.6, cost: 90_000, colors: ['#facc15', '#fde68a'] },
  { id: 'diamond', name: 'Diamond Trail', speed: 0.78, cost: 400_000, colors: ['#67e8f9', '#e0f2fe'] },
  { id: 'rainbow', name: 'Rainbow Trail', speed: 1, cost: 2e6, colors: ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'] },
]

/**
 * Daily login rewards, a 7-day cycle. Money rewards are expressed in clicks
 * so they stay meaningful at any stage of the game. Every completed week adds
 * `weekBonus` to all rewards.
 */
export const DAILY = {
  claimEveryHours: 20,
  streakBreakHours: 48,
  weekBonus: 0.25,
  rewards: [
    { kind: 'money', clicks: 150, label: 'Money' },
    { kind: 'wins', amount: 10, label: 'Wins' },
    { kind: 'boost', boostMinutes: 10, label: '2x Money' },
    { kind: 'wins', amount: 30, label: 'Wins' },
    { kind: 'money', clicks: 1_500, label: 'Money' },
    { kind: 'wins', amount: 75, label: 'Wins' },
    { kind: 'egg', egg: 'rare', wins: 100, label: 'Rare Pet!' },
  ],
}

/** Playtime gifts, unlocked by minutes played in the current session. */
export const GIFTS = [
  { minutes: 1, kind: 'money', clicks: 60 },
  { minutes: 3, kind: 'wins', amount: 3 },
  { minutes: 6, kind: 'boost', boostMinutes: 5 },
  { minutes: 10, kind: 'money', clicks: 400 },
  { minutes: 15, kind: 'wins', amount: 15 },
  { minutes: 20, kind: 'egg', egg: 'common' },
  { minutes: 30, kind: 'money', clicks: 2_500 },
  { minutes: 45, kind: 'wins', amount: 60 },
]

/**
 * Tutorial. `progress(data, session)` returns a number compared against
 * `target`. `guide` names the world target the arrows point at.
 */
const pastGate = (d, s) =>
  (s?.runStage || 0) >= 1 || d.stats.bestStage >= 1 || d.stats.totalWins > 0 || d.cashTiers.owned > 1
const hasWon = (d) => d.stats.totalWins > 0 || d.cashTiers.owned > 1

export const TUTORIAL = [
  {
    id: 'table',
    text: 'Go to the Training Table',
    hint: 'Follow the arrows and stand on the glowing rug!',
    marker: 'TRAIN HERE',
    target: 1,
    guide: 'table',
    progress: (d, s) => (d.tutorial.tableSeconds >= 1 || pastGate(d, s) ? 1 : 0),
  },
  {
    id: 'train',
    text: 'Train to $100',
    hint: 'Stay on the rug - it earns money every second. Clicking helps too!',
    marker: 'TRAIN HERE',
    target: 100,
    format: 'money',
    guide: 'table',
    progress: (d, s) => (pastGate(d, s) ? 100 : d.money),
  },
  {
    id: 'gate',
    text: 'Go through the $100 gate',
    hint: 'Walk into the green door: it takes $100 and lets you in!',
    lowMoneyHint: 'You need $100 for the gate - go back and train!',
    marker: 'PAY $100 & ENTER',
    target: 1,
    guide: 'gate',
    progress: (d, s) => (pastGate(d, s) ? 1 : 0),
  },
  {
    id: 'win',
    text: 'Step on the WIN pad',
    hint: 'Wins buy better cash, pets and speed!',
    marker: 'STEP HERE FOR WINS',
    target: 1,
    guide: 'winpad',
    progress: (d) => (hasWon(d) ? 1 : 0),
  },
  {
    id: 'cash',
    text: 'Unlock +3 Money',
    hint: 'Walk onto the +3 Money pedestal: every click earns 3x!',
    marker: 'UNLOCK +3 MONEY',
    target: 1,
    guide: 'cash',
    progress: (d) => d.cashTiers.owned - 1,
  },
]
/** Finishing the guide gives a head start on the next Better Cash (+15 costs 8). */
export const TUTORIAL_REWARD_WINS = 10

/**
 * Weekly leaderboards (money-per-click-server): what each player earned THIS
 * week. They reset every Monday 00:00 UTC (see weekIndex in formulas).
 */
export const LEADERBOARD = {
  submitEverySeconds: 45,
  refreshEverySeconds: 60,
  stats: [
    { key: 'money', title: 'TOP MONEY', prefix: '$' },
    { key: 'level', title: 'TOP LEVELS', prefix: '+' },
    { key: 'rebirths', title: 'TOP REBIRTHS', prefix: '' },
    { key: 'wins', title: 'TOP WINS', prefix: '' },
  ],
}
