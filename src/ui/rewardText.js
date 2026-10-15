import { formatMoney, formatNumber, formatTime } from '../game/core/format'
import { eggById } from '../game/core/formulas'

export const REWARD_ICONS = { money: '💵', wins: '🏆', boost: '⚡', egg: '🥚' }

/** "1.2K Money", "10 Wins", "2x Money 10m", "Rare Egg pet + 100 Wins". */
export function describeReward(reward, perClick, scale = 1) {
  if (reward.kind === 'money') return formatMoney(perClick * reward.clicks * scale)
  if (reward.kind === 'wins') return `${formatNumber(Math.round(reward.amount * scale))} Wins`
  if (reward.kind === 'boost') return `2x Money ${formatTime(reward.boostMinutes * 60 * scale)}`
  if (reward.kind === 'egg') {
    const egg = eggById(reward.egg)?.name || 'Egg'
    return `${egg} pet${reward.wins ? ` + ${formatNumber(Math.round(reward.wins * scale))} Wins` : ''}`
  }
  return ''
}
