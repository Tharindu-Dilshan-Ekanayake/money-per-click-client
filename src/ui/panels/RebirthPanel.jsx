import { formatNumber } from '../../game/core/format'
import { maxLevel, rebirthMultiplier } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton, Panel, ProgressBar } from '../common'

function StatBox({ title, money, cap, highlight }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="game-font stroke-2 text-center text-3xl text-white">{title}</div>
      <div className={`card grad-yellow flex items-center justify-center gap-2 p-3 ${highlight ? 'anim-pulse' : ''}`}>
        <span className="text-4xl">💵</span>
        <span className="game-font stroke-2 text-4xl text-white">x{formatNumber(money)} Money</span>
      </div>
      <div className="card grad-purple game-font stroke-2 p-3 text-center text-3xl text-white">MAX Level {cap}</div>
    </div>
  )
}

/** Before / After rebirth screen, like the original. */
export function RebirthPanel() {
  const rebirths = useGame((s) => s.data.rebirths)
  const level = useGame((s) => s.data.level)
  const cap = maxLevel(rebirths)
  const ready = level >= cap

  return (
    <Panel title="Rebirth" icon="🔄" headerClass="grad-purple" width={760}>
      <div className="flex items-stretch gap-3">
        <StatBox title="Before" money={rebirthMultiplier(rebirths)} cap={cap} />
        <div className="game-font stroke-3 flex items-center text-6xl text-white">▶</div>
        <StatBox title="After" money={rebirthMultiplier(rebirths + 1)} cap={maxLevel(rebirths + 1)} highlight />
      </div>

      <div className="game-font stroke-2 mt-4 text-center text-2xl text-[#f87171]">Resets your levels and money!</div>
      <div className="game-font stroke-1 text-center text-lg text-[#86efac]">
        You keep: Better Cash, Wins, Wins Shop, Pets, Trails and your muscles 💪. More training tables unlock!
      </div>

      <ProgressBar
        value={level}
        max={cap}
        className="mx-auto mt-4 h-14 w-full max-w-xl"
        label={<span className="text-3xl">Level {level} / Level {cap}</span>}
      />

      <div className="mt-4 flex items-center justify-center gap-4">
        <GameButton color="green" size="lg" disabled={!ready} onClick={() => getGame().rebirth()} className={ready ? 'anim-pulse' : ''}>
          {ready ? 'Rebirth' : `Reach Level ${cap}`}
        </GameButton>
      </div>
      <div className="game-font stroke-1 mt-3 text-center text-base text-white/80">
        Rebirths: {rebirths} · Every rebirth doubles your Multiplier and raises your MAX level.
      </div>
    </Panel>
  )
}

export default RebirthPanel
