import { STAGES, TITLES, TUTORIAL } from '../../game/core/config'
import { formatMoney, formatNumber } from '../../game/core/format'
import { maxLevel, rebirthMultiplier, stageCost, titleFor } from '../../game/core/formulas'
import { useGame } from '../../game/core/store'

/** The orange tutorial / goal bar at the top of the screen, like the reference. */
export function QuestBanner() {
  const done = useGame((s) => s.data.tutorial.done)
  const stepIndex = useGame((s) => s.data.tutorial.step)
  const progress = useGame((s) => {
    const step = TUTORIAL[s.data.tutorial.step]
    return step ? step.progress(s.data, s.session) : 0
  })
  // The gate step changes its hint when you can't afford the gate yet.
  const lowMoney = useGame((s) => s.data.money < stageCost(0))
  const level = useGame((s) => s.data.level)
  const rebirths = useGame((s) => s.data.rebirths)
  const titleIndex = useGame((s) => titleFor(s.data).index)
  const bestStage = useGame((s) => s.data.stats.bestStage)

  let label
  let text
  let hint
  if (!done && TUTORIAL[stepIndex]) {
    const step = TUTORIAL[stepIndex]
    const fmt = step.format === 'money' ? formatMoney : formatNumber
    label = `GUIDE ${stepIndex + 1}/${TUTORIAL.length}`
    text = step.target > 1 ? `${step.text} (${fmt(Math.floor(Math.min(progress, step.target)))}/${fmt(step.target)})` : step.text
    hint = lowMoney && step.lowMoneyHint ? step.lowMoneyHint : step.hint
  } else {
    const cap = maxLevel(rebirths)
    const nextTitle = TITLES[titleIndex + 1]
    label = 'NEXT GOAL'
    text =
      level >= cap
        ? `🔄 Rebirth now for x${formatNumber(rebirthMultiplier(rebirths + 1))} Money!`
        : `Reach MAX Level (${level}/${cap}) → x${formatNumber(rebirthMultiplier(rebirths + 1))} Money`
    if (bestStage < STAGES.length) {
      hint = `Beat Stage ${bestStage + 1} (${formatMoney(stageCost(bestStage))} gate) for more Wins`
    } else if (nextTitle) {
      hint = `Keep leveling to become ${nextTitle.emoji} ${nextTitle.name}`
    } else {
      hint = 'Every stage beaten - keep rebirthing for bigger multipliers!'
    }
  }

  return (
    <>
      {/* Desktop: the big orange banner. */}
      <div className="quest-big pointer-events-none flex flex-col items-center" style={{ transform: 'scale(var(--ui-scale))', transformOrigin: 'top center' }}>
      <div
        className="relative rounded-2xl border-4 border-[#1b1b2f] bg-gradient-to-b from-[#fdba3b] to-[#f59e0b] px-6 pb-2 pt-1 shadow-[0_5px_0_#1b1b2f]"
        style={{ maxWidth: 'calc(var(--quest-w) / var(--ui-scale))' }}
      >
        <div className="game-font stroke-2 absolute -top-5 left-4 whitespace-nowrap text-2xl text-[#bef264]">{label}</div>
        <div className="game-font stroke-3 mt-2 text-balance text-center text-4xl text-white">{text}</div>
      </div>
      {hint && (
        <div className="game-font stroke-2 mt-2 text-balance text-center text-lg text-white/95" style={{ maxWidth: 'calc(var(--quest-w) / var(--ui-scale))' }}>
          {hint}
        </div>
      )}
      </div>
      {/* Phones / small windows: a small pill right at the top (see index.css). */}
      <div className="quest-compact pointer-events-none">
        <span className="quest-compact-tag game-font">{label}</span>
        <span className="quest-compact-text game-font stroke-2">{text}</span>
      </div>
    </>
  )
}

export default QuestBanner
