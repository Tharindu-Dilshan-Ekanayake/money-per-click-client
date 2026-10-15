import { DAILY, ECONOMY, TRAINING_TABLES, TUTORIAL_REWARD_WINS } from '../../game/core/config'
import { formatMoney, formatTime } from '../../game/core/format'
import { clickValue } from '../../game/core/formulas'
import { dailyStatus, getGame, useGame } from '../../game/core/store'
import { GameButton } from '../common'
import { describeReward, REWARD_ICONS } from '../rewardText'
import { useNow } from '../uiUtils'

function Modal({ children }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="panel w-full max-w-lg p-6 text-center">{children}</div>
    </div>
  )
}

/** "Welcome back" - offline earnings (spec: 50% of AFK income, max 8h). */
export function OfflinePopup() {
  const offline = useGame((s) => s.ui.offline)
  if (!offline) return null
  return (
    <Modal>
      <div className="text-7xl">💤</div>
      <div className="game-font stroke-3 mt-2 text-4xl text-white">Welcome back!</div>
      <div className="game-font stroke-2 mt-2 text-xl text-white/90">
        You were away for {formatTime(offline.awaySeconds)}
        {offline.awaySeconds > ECONOMY.offlineMaxSeconds && ` (max ${formatTime(ECONOMY.offlineMaxSeconds)} counted)`}.
      </div>
      <div className="game-font stroke-2 mt-1 text-lg text-white/80">
        Your x{TRAINING_TABLES[offline.table].mult} training table kept earning at {Math.round(ECONOMY.offlineRate * 100)}% speed:
      </div>
      <div className="game-font stroke-3 my-4 text-6xl text-[#4ade80]">+{formatMoney(offline.amount)}</div>
      <GameButton color="green" size="lg" onClick={() => getGame().dismissOffline()}>
        Collect!
      </GameButton>
      <div className="game-font stroke-1 mt-3 text-sm text-white/70">Tip: stand on your best training table before you leave!</div>
    </Modal>
  )
}

export function TutorialDonePopup() {
  const show = useGame((s) => s.ui.tutorialDone)
  if (!show) return null
  return (
    <Modal>
      <div className="text-7xl">🎉</div>
      <div className="game-font stroke-3 mt-2 text-4xl text-[#fde047]">Tutorial Complete!</div>
      <div className="game-font stroke-2 mt-3 text-2xl text-white">+{TUTORIAL_REWARD_WINS} Wins 🏆</div>
      <div className="game-font stroke-2 mt-2 text-lg text-white/90">
        Spend them on the next Better Cash (+15 Money). Keep leveling to grow from Brokie to Bodybuilder, beat every stage
        and become the Richest In The World!
      </div>
      <GameButton color="green" size="lg" className="mt-5" onClick={() => getGame().dismissTutorialDone()}>
        Let&apos;s go!
      </GameButton>
    </Modal>
  )
}

/**
 * Daily gift, shown by itself when you join and today's gift is waiting (after
 * the first-time guide, and never on top of another popup). Seven days in a
 * row lead to a Rare pet; missing two days resets the streak.
 */
export function DailyGiftPopup() {
  const show = useGame(
    (s) =>
      s.session.hydrated &&
      !s.session.paused &&
      !s.session.dailyPopupDone &&
      s.data.tutorial.done &&
      !s.ui.offline &&
      !s.ui.tutorialDone &&
      !s.ui.hatch &&
      !s.ui.panel &&
      dailyStatus(s.data).canClaim,
  )
  const data = useGame((s) => (show ? s.data : null))
  const now = useNow(1000)
  if (!show || !data) return null
  const status = dailyStatus(data, now)
  const reward = DAILY.rewards[status.dayIndex]
  const scale = 1 + DAILY.weekBonus * status.week
  const perClick = clickValue(data, now)
  const close = () => getGame().markDailyPopupDone()

  return (
    <Modal>
      <div className="anim-bounce text-7xl">🎁</div>
      <div className="game-font stroke-3 mt-1 text-4xl text-[#fde047]">Daily Gift!</div>
      <div className="game-font stroke-2 mt-1 text-lg text-white/90">
        Day {status.dayIndex + 1} of {DAILY.rewards.length}
        {status.streak > 0 && ` · ${status.streak} day streak 🔥`}
      </div>
      <div className="my-4 flex flex-wrap justify-center gap-2">
        {DAILY.rewards.map((r, i) => (
          <div key={i} className={`daily-dot game-font ${i < status.dayIndex ? 'is-done' : ''} ${i === status.dayIndex ? 'is-today' : ''}`}>
            {i < status.dayIndex ? '✔' : i === DAILY.rewards.length - 1 ? '🥚' : i + 1}
          </div>
        ))}
      </div>
      <div className="card grad-yellow mx-auto flex max-w-xs items-center justify-center gap-3 p-3">
        <span className="text-5xl">{REWARD_ICONS[reward.kind]}</span>
        <span className="game-font stroke-2 text-2xl text-white">{describeReward(reward, perClick, scale)}</span>
      </div>
      <GameButton
        color="green"
        size="lg"
        className="anim-pulse mt-5"
        onClick={() => {
          getGame().claimDaily()
          close()
        }}
      >
        Claim!
      </GameButton>
      <div>
        <button type="button" className="game-font stroke-1 mt-3 text-sm text-white/70 underline" onClick={close}>
          Later
        </button>
      </div>
      <div className="game-font stroke-1 mt-1 text-sm text-white/80">Come back every day - day 7 gives a Rare pet!</div>
    </Modal>
  )
}
