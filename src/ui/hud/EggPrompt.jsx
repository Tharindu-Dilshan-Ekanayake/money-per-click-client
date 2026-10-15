import { useEffect } from 'react'

import { PETS, RARITIES } from '../../game/core/config'
import { formatNumber } from '../../game/core/format'
import { eggById, eggWeights } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton } from '../common'

/**
 * Shown while standing at an egg: the odds, the price, and Open / Open x3
 * buttons (E / R on keyboard). Works on touch screens too.
 */
export function EggPrompt() {
  const eggId = useGame((s) => s.session.nearbyEgg)
  const wins = useGame((s) => s.data.wins)
  const hatching = useGame((s) => Boolean(s.ui.hatch))
  const panelOpen = useGame((s) => Boolean(s.ui.panel))
  const luck = useGame((s) => s.data.winsUpgrades.luck)
  const egg = eggId ? eggById(eggId) : null

  useEffect(() => {
    if (!egg) return undefined
    const onKey = (e) => {
      const { ui } = getGame()
      if (ui.hatch || ui.panel) return
      if (e.code === 'KeyE') getGame().hatchEgg(egg.id, 1)
      if (e.code === 'KeyR') getGame().hatchEgg(egg.id, 3)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [egg])

  if (!egg || hatching || panelOpen) return null
  const weights = eggWeights(egg, { winsUpgrades: { luck } })
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  const canOne = wins >= egg.cost
  const canThree = wins >= egg.cost * 3

  return (
    <div className="panel pointer-events-auto w-[min(94vw,520px)] p-3">
      <div className="game-font stroke-2 mb-2 text-center text-3xl text-white">
        🥚 {egg.name} <span className="text-[#fde047]">· 🏆 {formatNumber(egg.cost)}</span>
      </div>
      <div className="egg-odds mb-3 grid grid-cols-4 gap-2">
        {weights.map(([id, w]) => {
          const pet = PETS[id]
          return (
            <div key={id} className="card flex flex-col items-center p-1 text-center">
              <span className="text-4xl">{pet.emoji}</span>
              <span className="game-font stroke-1 text-sm text-white">{pet.name}</span>
              <span className="game-font stroke-1 text-xs" style={{ color: RARITIES[pet.rarity].color }}>
                {((w / total) * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-center gap-3">
        <GameButton color="green" size="lg" disabled={!canOne} onClick={() => getGame().hatchEgg(egg.id, 1)}>
          Open <span className="text-base opacity-80">(E)</span>
        </GameButton>
        <GameButton color="purple" size="lg" disabled={!canThree} onClick={() => getGame().hatchEgg(egg.id, 3)}>
          Open x3 <span className="text-base opacity-80">(R)</span>
        </GameButton>
      </div>
      {!canOne && (
        <div className="game-font stroke-1 mt-2 text-center text-lg text-[#fca5a5]">
          Need {formatNumber(egg.cost - wins)} more Wins - beat stages to earn them!
        </div>
      )}
    </div>
  )
}

export default EggPrompt

