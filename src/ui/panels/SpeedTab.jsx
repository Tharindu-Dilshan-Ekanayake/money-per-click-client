import { TRAILS } from '../../game/core/config'
import { formatNumber } from '../../game/core/format'
import { levelSpeed, lifetimeLevel, trailById, walkSpeed, winsUpgradeBonus } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton } from '../common'

/** Speed tab of the Shop: your speed breakdown and the speed trails. */
export function SpeedTab() {
  const owned = useGame((s) => s.data.trailsOwned)
  const current = useGame((s) => s.data.trail)
  const wins = useGame((s) => s.data.wins)
  const level = useGame((s) => lifetimeLevel(s.data))
  const speed = useGame((s) => walkSpeed(s.data))
  const boost = useGame((s) => winsUpgradeBonus(s.data, 'speed'))
  const fromLevel = useGame((s) => levelSpeed(s.data))

  return (
    <>
      <div className="card mb-3 p-3">
        <div className="game-font stroke-2 text-2xl text-white">
          Your speed: <span className="text-[#7dd3fc]">{speed.toFixed(1)}</span>
        </div>
        <div className="game-font stroke-1 text-base text-white/85">
          Lifetime level {level}: base {fromLevel.toFixed(1)} · Trail +{Math.round(trailById(current).speed * 100)}% · Speed Boost +
          {Math.round(boost * 100)}%
        </div>
        <div className="game-font stroke-1 text-sm text-[#fde047]">Level up to get faster - every level adds speed!</div>
      </div>
      <div className="flex flex-col gap-3">
        {TRAILS.map((trail) => {
          const has = owned.includes(trail.id)
          const isOn = current === trail.id
          return (
            <div key={trail.id} className="card flex items-center gap-3 p-3">
              <div
                className="h-14 w-24 shrink-0 rounded-xl border-[3px] border-[#1b1b2f]"
                style={{ background: `linear-gradient(90deg, ${trail.colors.join(', ')})` }}
              />
              <div className="min-w-0 flex-1">
                <div className="game-font stroke-2 text-2xl text-white">{trail.name}</div>
                <div className="game-font stroke-1 text-lg text-[#7dd3fc]">👟 +{Math.round(trail.speed * 100)}% speed</div>
              </div>
              {isOn ? (
                <GameButton color="gray" disabled>
                  Equipped
                </GameButton>
              ) : has ? (
                <GameButton color="blue" onClick={() => getGame().selectTrail(trail.id)}>
                  Equip
                </GameButton>
              ) : (
                <GameButton color={wins >= trail.cost ? 'yellow' : 'red'} onClick={() => getGame().selectTrail(trail.id)}>
                  🏆 {formatNumber(trail.cost)}
                </GameButton>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default SpeedTab
