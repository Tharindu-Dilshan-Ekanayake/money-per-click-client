import { useEffect, useRef, useState } from 'react'

import { ECONOMY, TITLES, TRAINING_TABLES } from '../../game/core/config'
import { formatMoney, formatMult, formatNumber, formatTime } from '../../game/core/format'
import {
  afkIncomePerSecond,
  clickValue,
  comboBonus,
  displayMultiplier,
  maxLevel,
  moneyRainStatus,
  petMultiplier,
  stepValue,
  tableUnlocked,
  titleFor,
  walkSpeed,
  xpForLevel,
} from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { ProgressBar } from '../common'
import { IconCash } from '../icons'
import { useNow, useRolling } from '../uiUtils'

/** Bumps an element's scale whenever `value` increases. */
function useBump(value) {
  const ref = useRef(null)
  const last = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (el && value > last.current) {
      el.classList.remove('anim-bump')
      // Force a reflow so the animation restarts.
      void el.offsetWidth
      el.classList.add('anim-bump')
    }
    last.current = value
  }, [value])
  return ref
}

/**
 * The money counter on its own: it re-renders every frame while the number
 * rolls up, so nothing else on the bar has to.
 */
function MoneyCounter() {
  const money = useGame((s) => s.data.money)
  const ref = useBump(money)
  const shown = useRolling(money, 260)
  return (
    <div ref={ref} className="money-counter game-font stroke-3">
      <IconCash className="money-icon" />
      <span>{formatNumber(Math.floor(shown))}</span>
    </div>
  )
}

/**
 * Bottom-centre bar, laid out like the reference: Multiplier (from rebirths
 * only, like the original) on the left, money in the middle, your title on the
 * right; then money-per-click next to the level bar.
 */
export function BottomBar() {
  const now = useNow(1000)
  const level = useGame((s) => s.data.level)
  const xp = useGame((s) => s.data.xp)
  const mult = useGame((s) => displayMultiplier(s.data))
  const cap = useGame((s) => maxLevel(s.data.rebirths))
  const perClick = useGame((s) => clickValue(s.data, now))
  const perStep = useGame((s) => stepValue(s.data, now))
  const speed = useGame((s) => walkSpeed(s.data))
  const titleIndex = useGame((s) => titleFor(s.data).index)
  const title = TITLES[titleIndex] || TITLES[0]
  const need = xpForLevel(level)
  const atMax = level >= cap

  return (
    <div
      className="pointer-events-none flex flex-col items-stretch"
      style={{ width: 'calc(var(--bar-w) / var(--ui-scale))', transform: 'scale(var(--ui-scale))', transformOrigin: 'bottom center' }}
    >
      <div className="bar-head">
        <div className="bar-mult game-font stroke-3">{formatMult(mult)} Multiplier</div>
        <MoneyCounter />
        <div className="bar-title game-font stroke-3" style={{ color: title.color }}>
          {title.emoji} {title.name}
        </div>
      </div>
      <div className="mt-1 flex items-stretch gap-2">
        <div className="per-click-box game-font stroke-2" title="Money per click">
          +{formatMoney(perClick)}
        </div>
        <ProgressBar
          value={atMax ? 1 : xp}
          max={atMax ? 1 : need}
          className={`level-bar flex-1 ${atMax ? 'anim-pulse' : ''}`}
          fillClass={atMax ? 'is-max' : ''}
          label={
            <div className="level-bar-label flex w-full items-center justify-between">
              <span>Level {level}</span>
              <span>{atMax ? 'MAX' : `${formatNumber(Math.floor(xp))}/${formatNumber(need)}`}</span>
            </div>
          }
        />
      </div>
      <div className="bar-stats game-font stroke-2 mt-1.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-base text-white">
        <span>👟 +{formatMoney(perStep)}/step</span>
        <span className="text-[#7dd3fc]">⚡ {speed.toFixed(1)} speed</span>
      </div>
    </div>
  )
}

/** Active boosts, AFK progress and pet multiplier (under the side menu, or right side on touch). */
export function StatusChips({ align = 'start' }) {
  const now = useNow(1000)
  const boostLeft = useGame((s) => Math.max(0, (s.data.boosts.money2xUntil - now) / 1000))
  const table = useGame((s) => s.session.activeTable)
  const tableOk = useGame((s) => s.session.activeTable >= 0 && tableUnlocked(s.data, s.session.activeTable))
  const afkSeconds = useGame((s) => s.session.afkSeconds)
  const afk = useGame((s) => s.session.afk)
  const afkRate = useGame((s) => (s.session.activeTable >= 0 ? afkIncomePerSecond(s.data, s.session.activeTable, now) : 0))
  const pets = useGame((s) => petMultiplier(s.data))
  const rainForced = useGame((s) => s.session.rainForcedUntil)
  const rain = moneyRainStatus(now, rainForced)

  return (
    <div
      className={`pointer-events-none flex flex-col gap-2 ${align === 'end' ? 'items-end' : 'items-start'}`}
      style={{ transform: 'scale(var(--ui-scale))', transformOrigin: align === 'end' ? 'center right' : 'top left' }}
    >
      {rain.active ? (
        <div className="game-font stroke-2 anim-pulse rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-emerald-400 to-emerald-700 px-3 py-1 text-2xl text-white">
          💸 MONEY RAIN! {formatTime(rain.remaining)}
        </div>
      ) : (
        rain.startsIn <= 600 && (
          <div className="game-font stroke-2 rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-emerald-500 to-emerald-800 px-3 py-1 text-xl text-white">
            💸 Money rain in {formatTime(rain.startsIn)}
          </div>
        )
      )}
      {boostLeft > 0 && (
        <div className="game-font stroke-2 anim-pulse rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-sky-400 to-sky-600 px-3 py-1 text-2xl text-white">
          ⚡ 2x Money {formatTime(boostLeft)}
        </div>
      )}
      {tableOk && (
        <div className="game-font stroke-2 rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-violet-400 to-violet-700 px-3 py-1 text-xl text-white">
          🪑 x{TRAINING_TABLES[table].mult} table: +{formatMoney(afkRate)}/s
          {!afk && <div className="text-base text-yellow-200">Stay AFK 10 min = 2x money</div>}
        </div>
      )}
      {afk && (
        <div className="game-font stroke-2 rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-slate-500 to-slate-700 px-3 py-1 text-xl text-white">
          💤 AFK
          <div className="text-base text-yellow-200">2x money in {formatTime(ECONOMY.afkBoostAfterSeconds - afkSeconds)}</div>
        </div>
      )}
      {pets > 1 && (
        <div className="game-font stroke-2 rounded-xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-amber-500 to-amber-800 px-3 py-1 text-xl text-white">
          🐾 Pets {formatMult(pets)}
        </div>
      )}
    </div>
  )
}

/** "COMBO x12!" while the player is clicking fast. */
export function ComboMeter() {
  const combo = useGame((s) => s.session.combo)
  const [alive, setAlive] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => {
      setAlive(performance.now() - getGame().session.lastClickAt < ECONOMY.comboWindow * 1000)
    }, 120)
    return () => clearInterval(timer)
  }, [])
  if (!alive || combo < 5) return null
  const bonus = Math.round(comboBonus(combo) * 100)
  return (
    <div key={Math.floor(combo / 5)} className="anim-banner pointer-events-none text-center" style={{ transform: 'scale(var(--ui-scale))' }}>
      <div className="game-font stroke-3 text-5xl text-[#f472b6]">COMBO x{combo}!</div>
      <div className="game-font stroke-2 text-2xl text-[#fde047]">+{bonus}% money</div>
    </div>
  )
}
