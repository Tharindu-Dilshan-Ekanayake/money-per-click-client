import { CASH_TIERS, EGGS, TRAILS, WINS_UPGRADE_KEYS } from '../game/core/config'
import { nextCashTier, winsUpgradeCost } from '../game/core/formulas'

/*
 * "Something new to buy" checks for the Shop button and its tabs (zustand
 * selectors). Money boosts are left out on purpose: they are almost always
 * affordable, and a badge that never goes away gets ignored.
 */

export const cashTierReady = (s) => {
  const next = nextCashTier(s.data)
  return next !== null && s.data.wins >= CASH_TIERS[next].cost
}

export const winsUpgradeReady = (s) =>
  WINS_UPGRADE_KEYS.some((k) => s.data.wins >= winsUpgradeCost(k, s.data.winsUpgrades[k] || 0))

export const trailReady = (s) => TRAILS.some((t) => !s.data.trailsOwned.includes(t.id) && s.data.wins >= t.cost)

export const firstPetReady = (s) => s.data.pets.length === 0 && s.data.wins >= EGGS[0].cost

export const shopReady = (s) => cashTierReady(s) || winsUpgradeReady(s) || trailReady(s) || firstPetReady(s)
