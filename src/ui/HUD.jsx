import { useEffect, useState } from 'react'

import { useBloxityStore } from '../bloxity/store'
import { isTouchDevice } from '../game/core/runtime'
import { getGame, useGame } from '../game/core/store'
import AuthHUD from './AuthHUD'
import { IconGear, IconMusic } from './icons'
import { uiSound } from './uiUtils'
import { BottomBar, ComboMeter, StatusChips } from './hud/BottomBar'
import EggPrompt from './hud/EggPrompt'
import FloatingText from './hud/FloatingText'
import FlyingRewards from './hud/FlyingRewards'
import FpsCounter from './hud/FpsCounter'
import LeftStats from './hud/LeftStats'
import MenuButtons from './hud/MenuButtons'
import { Banner, Toasts } from './hud/Notifications'
import QuestBanner from './hud/QuestBanner'
import TouchControls from './hud/TouchControls'
import HatchOverlay from './overlays/HatchOverlay'
import { DailyGiftPopup, OfflinePopup, TutorialDonePopup } from './overlays/Popups'
import TabPausedOverlay from './overlays/TabPaused'
import RebirthPanel from './panels/RebirthPanel'
import RewardsPanel from './panels/RewardsPanel'
import SettingsPanel from './panels/SettingsPanel'
import ShopPanel from './panels/ShopPanel'

const PANELS = {
  shop: ShopPanel,
  rebirth: RebirthPanel,
  rewards: RewardsPanel,
  settings: SettingsPanel,
}

/** Name tag top-right, with the Music and Settings icon buttons under it (M toggles music). */
function TopRightBar() {
  const music = useGame((s) => s.data.settings.music)
  const setSetting = useGame((s) => s.setSetting)
  const openPanel = useGame((s) => s.openPanel)

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (e.code !== 'KeyM' || e.repeat || tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      const { data, setSetting: set } = getGame()
      uiSound()
      set('music', data.settings.music > 0 ? 0 : 0.45)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="top-right-block flex w-max flex-col items-end gap-1">
      <AuthHUD />
      <div className="pointer-events-auto flex gap-1">
        <button
          type="button"
          className="hud-icon-btn is-small"
          onClick={() => {
            uiSound()
            setSetting('music', music > 0 ? 0 : 0.45)
          }}
          aria-label="Toggle music"
        >
          <span className="key-chip game-font">M</span>
          <IconMusic className="hud-icon" muted={music <= 0} />
          <span className="hud-icon-label game-font stroke-2">Music</span>
        </button>
        <button
          type="button"
          className="hud-icon-btn is-small"
          onClick={() => {
            uiSound('open')
            openPanel('settings')
          }}
          aria-label="Settings"
        >
          <IconGear className="hud-icon" />
          <span className="hud-icon-label game-font stroke-2">Settings</span>
        </button>
      </div>
    </div>
  )
}

function LoadingCurtain() {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-sky-400 to-sky-700">
      <div className="anim-bounce text-8xl">💵</div>
      <div className="game-font stroke-3 mt-4 text-5xl text-white">Loading...</div>
      <div className="game-font stroke-2 mt-2 text-xl text-white/90">Getting your money ready</div>
    </div>
  )
}

/** All 2D UI layered over the 3D canvas. */
export function HUD() {
  const panel = useGame((s) => s.ui.panel)
  const hydrated = useGame((s) => s.session.hydrated)
  const [touch] = useState(isTouchDevice)
  // On bloxity.io the portal draws its own logo/menu (top-left) and username,
  // Friends, Avatar and Bux (top-right) over the game: keep our HUD clear of them.
  const embedded = useBloxityStore((s) => s.embedded)
  const [onBloxity] = useState(() => typeof window !== 'undefined' && /(^|\.)bloxity\.io$/.test(window.location.hostname))
  const portal = embedded || onBloxity
  const ActivePanel = panel ? PANELS[panel] : null

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && getGame().ui.panel) {
        uiSound('close')
        getGame().closePanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!hydrated) return <LoadingCurtain />

  return (
    <div
      className="hud-root pointer-events-none z-10 select-none"
      data-touch={touch ? 'true' : 'false'}
      data-portal={portal ? 'true' : 'false'}
    >
      <div className="hud-top-right absolute flex w-max flex-col items-end gap-2">
        <TopRightBar />
        <FpsCounter />
      </div>

      <div className="hud-quest absolute inset-x-0 flex flex-col items-center gap-3">
        <QuestBanner />
        <div className="quest-notify flex flex-col items-center gap-3">
          <Banner />
          <Toasts />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[42%] flex justify-center">
        <ComboMeter />
      </div>

      {/* Left column: Rebirths + Wins and the menu (below the portal's logo/menu). */}
      <div className="hud-left absolute flex flex-col items-start">
        <LeftStats />
        <MenuButtons />
      </div>
      {/* Boost / AFK / money-rain / pet chips on the right, clear of the menu and bar. */}
      <div className="hud-chips absolute">
        <StatusChips align="end" />
      </div>

      <div className="hud-bottom absolute inset-x-0 flex flex-col items-center gap-3">
        <EggPrompt />
        <BottomBar />
      </div>
      <FloatingText />
      <FlyingRewards />
      <TouchControls />
      {ActivePanel && <ActivePanel />}
      <HatchOverlay />
      <OfflinePopup />
      <TutorialDonePopup />
      <DailyGiftPopup />
      <TabPausedOverlay />
    </div>
  )
}

export default HUD
