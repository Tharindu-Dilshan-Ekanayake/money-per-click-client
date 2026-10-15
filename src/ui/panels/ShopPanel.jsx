import { CASH_TIERS, CASH_UPGRADE_KEYS, CASH_UPGRADES, WINS_UPGRADE_KEYS, WINS_UPGRADES } from '../../game/core/config'
import { fx } from '../../game/core/events'
import { formatMoney, formatNumber } from '../../game/core/format'
import { cashUpgradeBonus, cashUpgradeCost, maxPetSlots, winsUpgradeBonus, winsUpgradeCost } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton, Panel, Tabs } from '../common'
import { cashTierReady, firstPetReady, trailReady, winsUpgradeReady } from '../shopBadges'
import PetsTab from './PetsTab'
import SpeedTab from './SpeedTab'

function CashTierCard({ index }) {
  const tier = CASH_TIERS[index]
  const owned = useGame((s) => s.data.cashTiers.owned)
  const equipped = useGame((s) => s.data.cashTiers.equipped)
  const wins = useGame((s) => s.data.wins)
  const isOwned = index < owned
  const isNext = index === owned
  const isEquipped = index === equipped

  let action
  if (isEquipped) {
    action = (
      <GameButton color="gray" disabled>
        Equipped
      </GameButton>
    )
  } else if (isOwned) {
    action = (
      <GameButton color="blue" onClick={() => getGame().selectCashTier(index)}>
        Equip
      </GameButton>
    )
  } else if (isNext) {
    action = (
      <GameButton color={wins >= tier.cost ? 'yellow' : 'red'} onClick={() => getGame().selectCashTier(index)}>
        🏆 {formatNumber(tier.cost)}
      </GameButton>
    )
  } else {
    action = <span className="game-font stroke-1 text-base text-white/70">🔒 {formatNumber(tier.cost)} Wins</span>
  }

  return (
    <div className={`card flex items-center gap-3 p-2 ${isEquipped ? 'grad-green' : ''} ${!isOwned && !isNext ? 'opacity-60' : ''}`}>
      <span className="text-3xl">💵</span>
      <div className="game-font stroke-2 flex-1 text-2xl text-white">+{formatNumber(tier.value)} Money</div>
      {action}
    </div>
  )
}

function BoostCard({ upgradeKey }) {
  const def = CASH_UPGRADES[upgradeKey]
  const level = useGame((s) => s.data.cashUpgrades[upgradeKey])
  const money = useGame((s) => s.data.money)
  const cost = useGame((s) => cashUpgradeCost(upgradeKey, s.data.cashUpgrades[upgradeKey], s.data))
  const bonus = useGame((s) => cashUpgradeBonus(s.data, upgradeKey))

  const buyMax = () => {
    let n = 0
    while (n < 500 && getGame().buyCashUpgrade(upgradeKey, { silent: true, quiet: true })) n += 1
    if (n > 0) {
      fx.emit('buy', { kind: 'cash', key: upgradeKey })
      getGame().toast(`${def.emoji} Bought ${n} level${n > 1 ? 's' : ''} of ${def.name}!`, 'success', 1800)
    }
  }

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#1b1b2f] text-4xl" style={{ background: def.color }}>
        {def.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="game-font stroke-2 text-2xl text-white">
          {def.name} <span className="text-lg text-[#fde047]">Lv {level}</span>
        </div>
        <div className="game-font stroke-1 text-base text-white/85">{def.desc}</div>
        <div className="game-font stroke-1 text-sm text-sky-200">Now: +{Math.round(bonus * 100)}%</div>
      </div>
      <div className="flex flex-col gap-2">
        <GameButton color={money >= cost ? 'green' : 'gray'} onClick={() => getGame().buyCashUpgrade(upgradeKey)}>
          {formatMoney(cost)}
        </GameButton>
        <GameButton color="blue" size="sm" disabled={money < cost} onClick={buyMax}>
          Buy MAX
        </GameButton>
      </div>
    </div>
  )
}

function WinsCard({ upgradeKey }) {
  const def = WINS_UPGRADES[upgradeKey]
  const level = useGame((s) => s.data.winsUpgrades[upgradeKey] || 0)
  const wins = useGame((s) => s.data.wins)
  const effect = useGame((s) => {
    if (upgradeKey === 'petSlot') return `${maxPetSlots(s.data)} pet slots`
    return `+${Math.round(winsUpgradeBonus(s.data, upgradeKey) * 100)}% total`
  })
  const cost = winsUpgradeCost(upgradeKey, level)
  const maxed = !Number.isFinite(cost)

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#1b1b2f] bg-gradient-to-b from-yellow-300 to-amber-500 text-4xl">
        {def.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="game-font stroke-2 text-2xl text-white">
          {def.name}{' '}
          <span className="text-lg text-[#fde047]">
            Lv {level}/{def.max}
          </span>
        </div>
        <div className="game-font stroke-1 text-base text-white/85">{def.desc} per level</div>
        <div className="game-font stroke-1 text-sm text-sky-200">Now: {effect}</div>
      </div>
      <GameButton color={maxed ? 'gray' : wins >= cost ? 'yellow' : 'gray'} disabled={maxed} onClick={() => getGame().buyWinsUpgrade(upgradeKey)}>
        {maxed ? 'MAX' : `🏆 ${formatNumber(cost)}`}
      </GameButton>
    </div>
  )
}

/**
 * Everything you can buy, in one place: Better Cash, Money Boosts, the Wins
 * Shop, Speed (trails) and Pets. Tabs light up when something new is affordable.
 */
export function ShopPanel() {
  const tab = useGame((s) => s.ui.tab) || 'cash'
  const setTab = useGame((s) => s.setTab)
  const money = useGame((s) => s.data.money)
  const wins = useGame((s) => s.data.wins)
  const cashBadge = useGame(cashTierReady)
  const winsBadge = useGame(winsUpgradeReady)
  const speedBadge = useGame(trailReady)
  const petsBadge = useGame(firstPetReady)

  return (
    <Panel title="Shop" icon="🛒" headerClass="grad-pink" width={tab === 'pets' ? 860 : 760}>
      <Tabs
        tabs={[
          { id: 'cash', label: '💵 Cash', badge: cashBadge },
          { id: 'boosts', label: '⚡ Boosts' },
          { id: 'wins', label: '🏆 Wins', badge: winsBadge },
          { id: 'speed', label: '👟 Speed', badge: speedBadge },
          { id: 'pets', label: '🐾 Pets', badge: petsBadge },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'cash' && (
        <>
          <div className="game-font stroke-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xl text-white">
            <span className="text-[#fde047]">🏆 {formatNumber(wins)} Wins</span>
            <span className="text-base text-white/80">Better cash = more money every click. Kept forever, even after rebirth!</span>
          </div>
          <div className="flex flex-col gap-2">
            {CASH_TIERS.map((_, i) => (
              <CashTierCard key={i} index={i} />
            ))}
          </div>
        </>
      )}
      {tab === 'boosts' && (
        <>
          <div className="game-font stroke-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xl text-white">
            <span className="text-[#4ade80]">💵 {formatMoney(money)}</span>
            <span className="text-base text-white/80">Money boosts reset when you Rebirth. Tip: stand on the pads in the UPGRADES area!</span>
          </div>
          <div className="flex flex-col gap-3">
            {CASH_UPGRADE_KEYS.map((key) => (
              <BoostCard key={key} upgradeKey={key} />
            ))}
          </div>
        </>
      )}
      {tab === 'wins' && (
        <>
          <div className="game-font stroke-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xl text-white">
            <span className="text-[#fde047]">🏆 {formatNumber(wins)} Wins</span>
            <span className="text-base text-white/80">Wins Shop upgrades are permanent - they never reset!</span>
          </div>
          <div className="flex flex-col gap-3">
            {WINS_UPGRADE_KEYS.map((key) => (
              <WinsCard key={key} upgradeKey={key} />
            ))}
          </div>
        </>
      )}
      {tab === 'speed' && <SpeedTab />}
      {tab === 'pets' && <PetsTab />}
    </Panel>
  )
}

export default ShopPanel
