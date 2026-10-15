import { useEffect } from 'react'

import { useBloxity } from '../../bloxity/BloxityContext'
import { LEADERBOARD } from '../core/config'
import { weekIndex, weeklyStats } from '../core/formulas'
import { getGame, useGame } from '../core/store'
import { leaderboardEnabled, refreshLeaderboard, submitScore } from './leaderboard'

/**
 * Periodically submits this player's WEEKLY stats (what they earned since
 * Monday 00:00 UTC) and refreshes the boards. Renders nothing.
 */
export function LeaderboardSync() {
  const { identity } = useBloxity()
  const hydrated = useGame((s) => s.session.hydrated)
  const id = identity?._id || identity?.id || identity?.username || null
  const name = identity?.displayName || identity?.username || 'Guest'

  useEffect(() => {
    if (!leaderboardEnabled || !hydrated) return undefined

    const submit = () => {
      const { data } = getGame()
      if (!id) return
      const week = weeklyStats(data)
      submitScore({
        id: String(id),
        name: String(name).slice(0, 24),
        week: weekIndex(),
        money: week.money,
        level: week.level,
        rebirths: week.rebirths,
        wins: week.wins,
      })
    }

    refreshLeaderboard()
    const firstSubmit = setTimeout(submit, 5000)
    const submitTimer = setInterval(submit, LEADERBOARD.submitEverySeconds * 1000)
    const refreshTimer = setInterval(refreshLeaderboard, LEADERBOARD.refreshEverySeconds * 1000)
    return () => {
      clearTimeout(firstSubmit)
      clearInterval(submitTimer)
      clearInterval(refreshTimer)
    }
  }, [hydrated, id, name])

  return null
}

export default LeaderboardSync
