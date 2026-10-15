import { useEffect, useRef, useState } from 'react'

import { useBloxity } from '../../bloxity/BloxityContext'
import { useBloxityStore } from '../../bloxity/store'
import { fx } from '../core/events'
import { lifetimeLevel } from '../core/formulas'
import { playerRuntime } from '../core/runtime'
import { getGame, useGame } from '../core/store'
import { authToken as token } from './endpoints'
import { connect, disconnect, isConnected, send } from './multiplayer'

const MOVE_MS = 80
const PROFILE_MS = 500
/** Give the Bloxity SDK this long to report an identity before joining as a guest. */
const IDENTITY_WAIT_MS = 3500
const BROWSER_ID_KEY = 'ppc_browser_id'

function buildProfile(name) {
  const { data } = getGame()
  const { equipped, proportions } = useBloxityStore.getState()
  const equippedPets = new Set(data.equippedPets)
  return {
    name,
    level: data.level,
    lifetime: lifetimeLevel(data),
    rebirths: data.rebirths,
    cashTier: data.cashTiers.equipped,
    trail: data.trail,
    pets: data.pets.filter((p) => equippedPets.has(p.uid)).map((p) => ({ id: p.id, variant: p.variant || 0 })),
    avatar: equipped || {},
    proportions,
  }
}

/** How many times this player has clicked (wraps at 65536); others replay the action. */
let clickCount = 0

function currentMove() {
  const p = playerRuntime.position
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: playerRuntime.yaw,
    speed: playerRuntime.speed,
    grounded: playerRuntime.grounded,
    clicks: clickCount,
  }
}

/** Random id for this browser, kept in localStorage. */
function browserId() {
  try {
    let id = window.localStorage.getItem(BROWSER_ID_KEY)
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(BROWSER_ID_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/** 64-bit FNV-1a style hash as hex: the server never sees the raw save key. */
function hashKey(text) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/**
 * Same save + same browser = same player. The server keeps only the newest
 * session for a key, so a reload or a second tab never shows you twice.
 */
const clientKey = () => hashKey(`${getGame().session.saveKey || 'local'}|${browserId()}`)

/**
 * Keeps this player in a multiplayer lobby: joins once the save is loaded,
 * streams position, and sends profile/emote changes. Leaves at once when the
 * page closes (so nobody sees a frozen copy) and while this tab is paused.
 * Renders nothing and never shows connection messages.
 */
export function MultiplayerSync() {
  const { status, identity, user } = useBloxity()
  const hydrated = useGame((s) => s.session.hydrated)
  const paused = useGame((s) => s.session.paused)
  // Bumped when the page comes back from the back/forward cache.
  const [visit, setVisit] = useState(0)
  const name = identity?.displayName || identity?.username || 'Guest'
  const nameRef = useRef(name)
  useEffect(() => {
    nameRef.current = name
  }, [name])

  // Join once the save is loaded and Boxity has had a chance to report who we are.
  useEffect(() => {
    if (!hydrated || paused) return undefined
    const start = () =>
      connect(() => ({
        name: nameRef.current,
        token: token(),
        clientKey: clientKey(),
        profile: buildProfile(nameRef.current),
        spawn: currentMove(),
      }))
    if (status === 'ready' || status === 'error') {
      start()
      return undefined
    }
    const timer = setTimeout(start, IDENTITY_WAIT_MS)
    return () => clearTimeout(timer)
  }, [hydrated, status, paused, visit])

  // Another tab took over: leave the lobby until "Play here".
  useEffect(() => {
    if (paused) disconnect()
  }, [paused])

  // Closing / leaving the page: a clean leave removes us for everyone at once.
  useEffect(() => {
    const onHide = () => disconnect()
    const onShow = (e) => {
      if (e.persisted) setVisit((v) => v + 1)
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
      disconnect()
    }
  }, [])

  // Signed in mid-game: let the server verify the new identity in place.
  useEffect(() => {
    if (user && isConnected()) send('auth', { token: token() })
  }, [user])

  // Count clicks so other players see our click action.
  useEffect(
    () =>
      fx.on('click', () => {
        clickCount = (clickCount + 1) % 65536
      }),
    [],
  )

  // Stream position, profile and emotes.
  useEffect(() => {
    let lastMove = ''
    let lastMoveAt = 0
    let lastProfile = ''
    let lastProfileAt = 0
    let lastEmote = null
    const timer = setInterval(() => {
      if (!isConnected()) {
        lastMove = ''
        lastProfile = ''
        lastEmote = null
        return
      }
      const now = performance.now()

      const move = currentMove()
      const sig = `${move.x.toFixed(2)}|${move.y.toFixed(2)}|${move.z.toFixed(2)}|${move.yaw.toFixed(2)}|${move.speed.toFixed(1)}|${move.grounded}|${move.clicks}`
      // Send on change, plus a heartbeat so late joiners always get a fresh pose.
      if (sig !== lastMove || now - lastMoveAt > 1000) {
        send('move', move)
        lastMove = sig
        lastMoveAt = now
      }

      if (now - lastProfileAt > PROFILE_MS) {
        const profile = JSON.stringify(buildProfile(nameRef.current))
        if (profile !== lastProfile) {
          send('profile', JSON.parse(profile))
          lastProfile = profile
          lastProfileAt = now
        }
      }

      const emote = playerRuntime.emote
      const playing = emote && !emote.stopping ? emote : null
      if (playing && playing !== lastEmote) send('emote', { id: playing.id })
      else if (!playing && lastEmote) send('emoteStop')
      lastEmote = playing
    }, MOVE_MS)
    return () => clearInterval(timer)
  }, [])

  return null
}

export default MultiplayerSync
