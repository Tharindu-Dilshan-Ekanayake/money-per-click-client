import { useEffect } from 'react'

import { GIFTS } from '../../game/core/config'
import { maxLevel } from '../../game/core/formulas'
import { dailyStatus, getGame, giftReady, useGame } from '../../game/core/store'
import { IconGift, IconRebirth, IconShop } from '../icons'
import { shopReady } from '../shopBadges'
import { uiSound, useNow } from '../uiUtils'

/** Icon button in the reference style: big icon, outlined label, key hint chip. */
function MenuButton({ Icon, label, hotkey, onClick, badge, corner, glow }) {
  return (
    <button
      type="button"
      onClick={() => {
        uiSound('open')
        onClick()
      }}
      className={`hud-icon-btn ${glow ? 'is-glowing' : ''}`}
      aria-label={label}
    >
      {hotkey && <span className="key-chip game-font">{hotkey}</span>}
      <Icon className="hud-icon" />
      {corner && <span className="hud-icon-corner game-font stroke-2">{corner}</span>}
      <span className="hud-icon-label game-font stroke-2">{label}</span>
      {badge ? <span className="badge game-font">{badge}</span> : null}
    </button>
  )
}

const isTyping = (e) => {
  const tag = e.target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable
}

/**
 * Shop (cash, boosts, wins, speed and pets all live inside it), Rebirth and
 * Rewards on the left edge. Keys: B / R / G (R opens 3 eggs instead while
 * you're standing at an egg).
 */
export function MenuButtons() {
  const openPanel = useGame((s) => s.openPanel)
  const now = useNow(1000)

  const shopBadge = useGame(shopReady)
  const rebirthPct = useGame((s) => Math.min(100, Math.floor((s.data.level / maxLevel(s.data.rebirths)) * 100)))
  const rewardCount = useGame((s) => {
    let n = dailyStatus(s.data, now).canClaim ? 1 : 0
    for (let i = 0; i < GIFTS.length; i += 1) if (giftReady(s.session, i)) n += 1
    return n
  })

  useEffect(() => {
    const toggle = (panel, tab) => {
      const { ui, closePanel } = getGame()
      if (ui.panel === panel) {
        uiSound('close')
        closePanel()
      } else {
        uiSound('open')
        openPanel(panel, tab)
      }
    }
    const onKey = (e) => {
      if (isTyping(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const { ui, session } = getGame()
      if (ui.hatch) return
      if (e.code === 'KeyB') toggle('shop', 'cash')
      else if (e.code === 'KeyG') toggle('rewards', 'daily')
      else if (e.code === 'KeyR' && !session.nearbyEgg) toggle('rebirth')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPanel])

  return (
    <div className="menu-stack pointer-events-auto">
      <MenuButton Icon={IconShop} label="Shop" hotkey="B" badge={shopBadge ? '!' : null} onClick={() => openPanel('shop', 'cash')} />
      <MenuButton
        Icon={IconRebirth}
        label="Rebirth"
        hotkey="R"
        corner={`${rebirthPct}%`}
        badge={rebirthPct >= 100 ? '!' : null}
        glow={rebirthPct >= 100}
        onClick={() => openPanel('rebirth')}
      />
      <MenuButton Icon={IconGift} label="Rewards" hotkey="G" badge={rewardCount || null} glow={rewardCount > 0} onClick={() => openPanel('rewards', 'daily')} />
    </div>
  )
}

export default MenuButtons
