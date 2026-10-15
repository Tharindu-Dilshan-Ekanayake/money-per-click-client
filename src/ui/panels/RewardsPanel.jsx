import { DAILY, GIFTS } from '../../game/core/config'
import { formatTime } from '../../game/core/format'
import { clickValue } from '../../game/core/formulas'
import { dailyStatus, getGame, giftReady, useGame } from '../../game/core/store'
import { GameButton, Panel, Tabs } from '../common'
import { describeReward as describe, REWARD_ICONS as ICONS } from '../rewardText'
import { useNow } from '../uiUtils'

function DailyTab({ now }) {
  const data = useGame((s) => s.data)
  const status = dailyStatus(data, now)
  const perClick = clickValue(data, now)
  const scale = 1 + DAILY.weekBonus * status.week

  return (
    <>
      <div className="game-font stroke-2 mb-3 text-center text-2xl text-white">
        Login every day! Streak: <span className="text-[#fde047]">{status.streak} day{status.streak === 1 ? '' : 's'}</span>
        {status.week > 0 && <span className="text-[#86efac]"> (+{Math.round(DAILY.weekBonus * status.week * 100)}% bonus)</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DAILY.rewards.map((reward, i) => {
          const claimed = i < status.dayIndex
          const today = i === status.dayIndex
          return (
            <div
              key={i}
              className={`card flex flex-col items-center p-3 text-center ${today ? (status.canClaim ? 'grad-yellow anim-pulse' : 'grad-blue') : ''} ${claimed ? 'opacity-60' : ''} ${i === 6 ? 'sm:col-span-2' : ''}`}
            >
              <span className="game-font stroke-2 text-xl text-white">Day {i + 1}</span>
              <span className="text-5xl">{claimed ? '✅' : ICONS[reward.kind]}</span>
              <span className="game-font stroke-1 text-base text-white">{describe(reward, perClick, scale)}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex justify-center">
        {status.canClaim ? (
          <GameButton color="green" size="lg" className="anim-pulse" onClick={() => getGame().claimDaily()}>
            Claim Day {status.dayIndex + 1}!
          </GameButton>
        ) : (
          <div className="game-font stroke-2 text-2xl text-white">Next reward in {formatTime((status.nextAt - now) / 1000)}</div>
        )}
      </div>
    </>
  )
}

function GiftsTab({ now }) {
  const session = useGame((s) => s.session)
  const perClick = useGame((s) => clickValue(s.data, now))
  return (
    <>
      <div className="game-font stroke-2 mb-3 text-center text-2xl text-white">
        Free gifts for playing! Played this session: <span className="text-[#fde047]">{formatTime(session.playtime)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GIFTS.map((gift, i) => {
          const claimed = session.giftsClaimed.includes(i)
          const ready = giftReady(session, i)
          const left = gift.minutes * 60 - session.playtime
          return (
            <div key={i} className={`card flex flex-col items-center gap-1 p-3 text-center ${ready ? 'grad-yellow anim-pulse' : ''} ${claimed ? 'opacity-60' : ''}`}>
              <span className="text-5xl">{claimed ? '✅' : ready ? '🎁' : '🔒'}</span>
              <span className="game-font stroke-1 text-base text-white">{describe(gift, perClick)}</span>
              {claimed ? (
                <span className="game-font stroke-1 text-sm text-white/80">Claimed</span>
              ) : ready ? (
                <GameButton color="green" size="sm" onClick={() => getGame().claimGift(i)}>
                  Claim
                </GameButton>
              ) : (
                <span className="game-font stroke-1 text-sm text-white/90">in {formatTime(left)}</span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function RewardsPanel() {
  const tab = useGame((s) => s.ui.tab) || 'daily'
  const setTab = useGame((s) => s.setTab)
  const now = useNow(1000)
  return (
    <Panel title="Rewards" icon="🎁" headerClass="grad-orange" width={820}>
      <Tabs
        tabs={[
          { id: 'daily', label: '📅 Daily' },
          { id: 'gifts', label: '🎁 Playtime Gifts' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'daily' ? <DailyTab now={now} /> : <GiftsTab now={now} />}
    </Panel>
  )
}

export default RewardsPanel
