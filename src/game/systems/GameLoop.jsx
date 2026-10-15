import { useEffect, useRef } from 'react'

import { useBloxity } from '../../bloxity/BloxityContext'
import { idleSeconds, markActive } from '../core/runtime'
import { getGame, useGame } from '../core/store'
import { loadSave, saveKeyFor, writeSave } from '../core/save'
import { startTabLock } from './tabLock'

const AUTOSAVE_MS = 10_000
/** Give the Bloxity SDK this long to report an identity before playing locally. */
const IDENTITY_WAIT_MS = 3500

/**
 * Loads the right save for whoever is playing (Bloxity user, else guest, else
 * "local") and switches saves on login/logout. A guest's progress is carried
 * over the first time they log in to an account that has no save yet.
 */
function useSaveSlot() {
  const { status, user, guest } = useBloxity()
  const identity = user || guest
  /** Set once the first save is loaded; later identity changes apply at once. */
  const ready = useRef(false)
  const currentKey = useRef(null)

  useEffect(() => {
    const settle = () => {
      const key = saveKeyFor(identity)
      if (key === currentKey.current) return
      const game = getGame()

      if (currentKey.current && game.session.hydrated) {
        // Leaving the old identity: persist it first.
        game.save()
        const existing = loadSave(key)
        if (!existing && user) {
          // First login on this account: bring the guest progress along.
          writeSave(key, game.data)
          game.hydrate(key, loadSave(key))
        } else {
          game.hydrate(key, existing)
        }
      } else {
        game.hydrate(key, loadSave(key))
      }
      currentKey.current = key
      ready.current = true
    }

    if (status === 'ready' || status === 'error' || ready.current) {
      settle()
      return undefined
    }
    const timer = setTimeout(settle, IDENTITY_WAIT_MS)
    return () => clearTimeout(timer)
  }, [status, identity, user])
}

/**
 * Wall-clock game loop (1 Hz): playtime, table income, AFK, timed boosts,
 * autosave. Uses real elapsed time so a throttled background tab (still logged
 * in, so it counts as AFK) is paid correctly. Also watches for any input to end
 * AFK. Renders nothing.
 */
export function GameLoop() {
  useSaveSlot()
  const hydrated = useGame((s) => s.session.hydrated)

  // Only one tab of this browser plays the save at a time.
  useEffect(() => startTabLock(), [])

  useEffect(() => {
    if (!hydrated) return undefined
    let last = Date.now()
    let sinceSave = 0
    const tick = () => {
      const now = Date.now()
      const dt = Math.min((now - last) / 1000, 3600)
      last = now
      const game = getGame()
      // Paused: another tab of this browser is playing this save.
      if (game.session.paused) return
      game.tickTime(dt)
      getGame().afkTick(dt, idleSeconds(now))
      sinceSave += dt * 1000
      if (sinceSave >= AUTOSAVE_MS) {
        sinceSave = 0
        getGame().save()
      }
    }
    const timer = setInterval(tick, 1000)

    // Any key, click, tap or scroll counts as playing (ends AFK).
    const activity = ['keydown', 'pointerdown', 'wheel', 'touchstart']
    activity.forEach((type) => window.addEventListener(type, markActive, { passive: true, capture: true }))

    const saveNow = () => getGame().save()
    const onVisibility = () => {
      if (document.hidden) saveNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', saveNow)
    window.addEventListener('beforeunload', saveNow)
    return () => {
      clearInterval(timer)
      activity.forEach((type) => window.removeEventListener(type, markActive, { capture: true }))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', saveNow)
      window.removeEventListener('beforeunload', saveNow)
      saveNow()
    }
  }, [hydrated])

  return null
}

export default GameLoop
