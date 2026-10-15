import { useEffect, useRef, useState } from 'react'

import { fx } from '../../game/core/events'
import { formatNumber } from '../../game/core/format'
import { useGame } from '../../game/core/store'
import { IconRebirth, IconTrophy } from '../icons'
import { useRolling } from '../uiUtils'

/** If the flying icons never land (hidden tab...), show the real totals after this. */
const WATCHDOG_MS = 4000

function bump(el) {
  if (!el) return
  el.classList.remove('anim-stat-bump')
  void el.offsetWidth // restart the animation
  el.classList.add('anim-stat-bump')
}

/**
 * Wins and Rebirths, top-left like Roblox leaderstats. New Wins/Rebirths are
 * held back until the trophies flying from your character land here (see
 * FlyingRewards), then the number rolls up with a bump.
 */
export function LeftStats() {
  const wins = useGame((s) => s.data.wins)
  const rebirths = useGame((s) => s.data.rebirths)
  const [pending, setPending] = useState({ wins: 0, rebirths: 0 })
  const winsBox = useRef(null)
  const rebirthBox = useRef(null)

  useEffect(() => {
    let watchdog = null
    const arm = () => {
      clearTimeout(watchdog)
      watchdog = setTimeout(() => setPending({ wins: 0, rebirths: 0 }), WATCHDOG_MS)
    }
    const offs = [
      fx.on('win', ({ wins: gained }) => {
        setPending((p) => ({ ...p, wins: p.wins + gained }))
        arm()
      }),
      fx.on('rebirth', () => {
        setPending((p) => ({ ...p, rebirths: p.rebirths + 1 }))
        arm()
      }),
      fx.on('flyArrive', ({ kind, amount }) => {
        setPending((p) => ({ ...p, [kind]: Math.max(0, p[kind] - amount) }))
        bump(kind === 'wins' ? winsBox.current : rebirthBox.current)
      }),
    ]
    return () => {
      clearTimeout(watchdog)
      offs.forEach((off) => off())
    }
  }, [])

  const shownWins = useRolling(Math.max(0, wins - pending.wins))
  const shownRebirths = Math.max(0, rebirths - pending.rebirths)

  return (
    <div className="left-stats pointer-events-none">
      <div ref={rebirthBox} className="stat-row" title="Rebirths">
        <span id="hud-rebirths-icon" className="stat-icon">
          <IconRebirth className="stat-svg" label="Rebirths" />
        </span>
        <span className="stat-value stat-rebirths game-font stroke-3">{formatNumber(shownRebirths)}</span>
      </div>
      <div ref={winsBox} className="stat-row" title="Wins">
        <span id="hud-wins-icon" className="stat-icon">
          <IconTrophy className="stat-svg" label="Wins" />
        </span>
        <span className="stat-value stat-wins game-font stroke-3">{formatNumber(Math.round(shownWins * 10) / 10)}</span>
      </div>
    </div>
  )
}

export default LeftStats
