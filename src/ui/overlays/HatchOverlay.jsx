import { useEffect, useState } from 'react'

import { PET_RULES, PETS, RARITIES } from '../../game/core/config'
import { fx } from '../../game/core/events'
import { formatPercent } from '../../game/core/format'
import { eggById, petPower } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton } from '../common'

const SHAKES_MS = [0, 480, 960]
const CRACK_MS = 1450
const REVEAL_MS = 1700

function CssEgg({ egg, shakeKey, size = 150 }) {
  return (
    <div key={shakeKey} className="anim-shake relative" style={{ width: size, height: size * 1.27 }}>
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.85), transparent 32%), ${egg.color}`,
          border: '5px solid #1b1b2f',
          boxShadow: '0 8px 0 #1b1b2f',
        }}
      />
      {[
        [28, 30, 16],
        [62, 48, 13],
        [40, 68, 18],
        [70, 22, 10],
      ].map(([x, y, s], i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, background: egg.spots, opacity: 0.85 }}
        />
      ))}
    </div>
  )
}

function Reveal({ result, equipped }) {
  const def = PETS[result.id]
  const rarity = RARITIES[def.rarity]
  const variant = PET_RULES.variants[result.variant || 0]
  return (
    <div className="anim-reveal relative flex w-44 flex-col items-center">
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 rounded-full opacity-80"
        style={{
          background: `repeating-conic-gradient(${rarity.color}66 0deg 12deg, transparent 12deg 24deg)`,
          animation: 'rays-spin 6s linear infinite',
        }}
      />
      <span className="relative text-[110px] leading-none drop-shadow-[0_6px_0_#1b1b2f]">{def.emoji}</span>
      <span className="game-font stroke-2 relative mt-1 text-3xl text-white">
        {variant.name !== 'Normal' ? `${variant.name} ` : ''}
        {def.name}
      </span>
      <span className="game-font stroke-2 relative text-2xl" style={{ color: rarity.color }}>
        {rarity.name}
      </span>
      <span className="game-font stroke-2 relative text-xl text-[#86efac]">{formatPercent(petPower(result))} money</span>
      {equipped && <span className="game-font stroke-1 relative mt-1 rounded-lg bg-green-600 px-2 text-base text-white">Equipped!</span>}
    </div>
  )
}

function HatchSequence({ hatch }) {
  const [stage, setStage] = useState('shake')
  const [shakeKey, setShakeKey] = useState(0)
  const equippedPets = useGame((s) => s.data.equippedPets)
  const egg = eggById(hatch.eggId)

  useEffect(() => {
    const emit = (s) => fx.emit('hatchStage', { stage: s, results: hatch.results })
    const timers = SHAKES_MS.map((t, i) =>
      setTimeout(() => {
        setShakeKey(i + 1)
        emit('shake')
      }, t),
    )
    timers.push(
      setTimeout(() => {
        setStage('crack')
        emit('crack')
      }, CRACK_MS),
    )
    timers.push(
      setTimeout(() => {
        setStage('reveal')
        emit('reveal')
      }, REVEAL_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [hatch])

  const skipToReveal = () => {
    if (stage === 'reveal') return
    setStage('reveal')
    fx.emit('hatchStage', { stage: 'reveal', results: hatch.results })
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70" onPointerDown={skipToReveal}>
      {stage !== 'reveal' ? (
        <>
          <div className="flex items-end gap-8">
            {hatch.results.map((r) => (
              <CssEgg key={r.uid} egg={egg} shakeKey={shakeKey} size={hatch.results.length > 1 ? 120 : 160} />
            ))}
          </div>
          <div className="game-font stroke-2 mt-6 text-3xl text-white">Hatching...</div>
          {stage === 'crack' && <div className="anim-flash pointer-events-none fixed inset-0 bg-white" />}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-center gap-10">
            {hatch.results.map((r) => (
              <Reveal key={r.uid} result={r} equipped={equippedPets.includes(r.uid)} />
            ))}
          </div>
          <GameButton color="green" size="lg" className="relative mt-10" onClick={() => getGame().closeHatch()}>
            Awesome!
          </GameButton>
        </>
      )}
    </div>
  )
}

/** Full-screen egg hatch: shake x3, crack flash, then the reveal. */
export function HatchOverlay() {
  const hatch = useGame((s) => s.ui.hatch)
  if (!hatch) return null
  return <HatchSequence key={hatch.id} hatch={hatch} />
}

export default HatchOverlay
