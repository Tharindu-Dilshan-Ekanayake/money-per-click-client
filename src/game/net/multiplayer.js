import { Callbacks, Client } from '@colyseus/sdk'
import { create } from 'zustand'

import { getSDK, safeCall } from '../../bloxity/sdk'
import { fx } from '../core/events'
import { titleForLevel } from '../core/formulas'
import { GAME_ID } from './endpoints'

/**
 * Multiplayer connection (Colyseus "lobby" rooms of up to 8 players).
 *
 * Production goes through the Boxity matchmaker: Legion.SDK.net.resolveEndpoint
 * returns a relay endpoint pinned to one pod, and we build a NEW Client for every
 * resolve (never the <gameId>.host.bloxity.io address). For local development,
 * set VITE_COLYSEUS_URL=ws://localhost:2567 to connect straight to your server.
 *
 * Everything here is silent: connection problems are retried in the background
 * and never shown to the player.
 */

const DIRECT_URL = import.meta.env.VITE_COLYSEUS_URL || ''
const ROOM_NAME = 'lobby'
/** The server's "you joined again somewhere else" close code: don't rejoin. */
const CLOSE_DUPLICATE = 4009
const GIVE_UP_MS = 60_000
const RETRY_LATER_MS = 120_000

/** Per-player profile (changes rarely) - drives React. */
export const useRemotePlayers = create(() => ({
  ids: [],
  /** sessionId -> profile */
  profiles: {},
  /** Boxity userId -> { id, text } chat bubble */
  bubbles: {},
  connected: false,
}))

/** sessionId -> live motion (changes ~15x/s) - read in useFrame, never rendered. */
export const remoteMotion = new Map()

let room = null
let wanted = false
let connecting = false
let generation = 0
let retryTimer = null
let joinOptions = () => ({})
const lastProfileSig = new Map()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}

function parsePets(text) {
  if (!text) return []
  return text
    .split(',')
    .map((entry, i) => {
      const [id, variant] = entry.split(':')
      return id ? { key: `${i}:${id}:${variant}`, id, variant: Number(variant) || 0 } : null
    })
    .filter(Boolean)
}

/**
 * Social proof: everyone sees other players level up, earn titles, rebirth and
 * unlock better cash. Derived from their synced profile - not a server message.
 */
function celebrate(sessionId, before, after) {
  let text = null
  let color = '#fde047'
  let cheer = false
  const oldTitle = titleForLevel(before.lifetime)
  const newTitle = titleForLevel(after.lifetime)
  if (after.rebirths > before.rebirths) {
    text = `🔄 REBIRTH ${after.rebirths}!`
    color = '#e879f9'
    cheer = true
  } else if (newTitle.index > oldTitle.index) {
    text = `${newTitle.emoji} ${newTitle.name.toUpperCase()}!`
    color = newTitle.color
    cheer = true
  } else if (after.cashTier > before.cashTier) {
    text = '💵 BETTER CASH!'
    color = '#4ade80'
  } else if (after.level > before.level) {
    text = `LEVEL ${after.level}!`
  }
  if (text) fx.emit('remoteCelebrate', { sessionId, text, color, cheer })
}

function syncPlayer(sessionId, p) {
  const motion = remoteMotion.get(sessionId) || {}
  motion.x = p.x
  motion.y = p.y
  motion.z = p.z
  motion.yaw = p.yaw
  motion.speed = p.speed
  motion.grounded = p.grounded
  motion.emote = p.emote
  motion.emoteSeq = p.emoteSeq
  motion.clicks = p.clicks
  remoteMotion.set(sessionId, motion)

  const sig = [p.userId, p.name, p.level, p.lifetime, p.rebirths, p.cashTier, p.trail, p.pets, p.avatar, p.proportions].join('|')
  if (lastProfileSig.get(sessionId) === sig) return
  lastProfileSig.set(sessionId, sig)
  const profile = {
    userId: p.userId,
    name: p.name || 'Player',
    level: p.level,
    lifetime: p.lifetime,
    rebirths: p.rebirths,
    cashTier: p.cashTier,
    trail: p.trail || 'none',
    pets: parsePets(p.pets),
    avatar: parseJson(p.avatar, null),
    proportions: parseJson(p.proportions, undefined),
  }
  const before = useRemotePlayers.getState().profiles[sessionId]
  useRemotePlayers.setState((s) => ({
    profiles: { ...s.profiles, [sessionId]: profile },
    ids: s.ids.includes(sessionId) ? s.ids : [...s.ids, sessionId],
  }))
  if (before) celebrate(sessionId, before, profile)
}

function removePlayer(sessionId) {
  remoteMotion.delete(sessionId)
  lastProfileSig.delete(sessionId)
  useRemotePlayers.setState((s) => {
    const profiles = { ...s.profiles }
    delete profiles[sessionId]
    return { profiles, ids: s.ids.filter((id) => id !== sessionId) }
  })
}

function clearRemote() {
  remoteMotion.clear()
  lastProfileSig.clear()
  useRemotePlayers.setState({ ids: [], profiles: {}, connected: false })
}

async function resolveUrl() {
  if (DIRECT_URL) return DIRECT_URL
  const sdk = getSDK()
  if (!sdk?.net?.resolveEndpoint) throw new Error('Boxity matchmaker unavailable')
  const { endpoint } = await sdk.net.resolveEndpoint(GAME_ID)
  if (!endpoint) throw new Error('No endpoint')
  return endpoint
}

function attach(r) {
  room = r
  useRemotePlayers.setState({ connected: true })
  const $ = Callbacks.get(r)
  $.onAdd('players', (player, sessionId) => {
    if (sessionId === r.sessionId) return
    syncPlayer(sessionId, player)
    $.onChange(player, () => syncPlayer(sessionId, player))
  })
  $.onRemove('players', (_player, sessionId) => removePlayer(sessionId))

  // Joinable presence for Boxity (friends / invites).
  const sdk = getSDK()
  safeCall(sdk?.game?.updateRoom?.bind(sdk.game), r.roomId)

  r.onLeave((code) => {
    if (room !== r) return
    room = null
    clearRemote()
    safeCall(sdk?.game?.updateRoom?.bind(sdk.game), '')
    // The same player joined from another tab/device: that one wins, stay out.
    if (code === CLOSE_DUPLICATE) {
      wanted = false
      return
    }
    // Unexpected leave (pod drained, network gone): back to the matchmaker.
    if (wanted) connect(joinOptions)
  })
}

/** Joins a lobby, retrying with backoff; silently tries again later on failure. */
export async function connect(getJoinOptions) {
  joinOptions = getJoinOptions || joinOptions
  wanted = true
  if (connecting || room) return
  connecting = true
  clearTimeout(retryTimer)
  const gen = (generation += 1)
  const started = performance.now()
  let delay = 1000
  while (wanted && gen === generation) {
    try {
      const url = await resolveUrl()
      const client = new Client(url) // a new Client for every resolve
      const r = await client.joinOrCreate(ROOM_NAME, joinOptions())
      if (!wanted || gen !== generation) {
        r.leave(true)
        break
      }
      connecting = false
      attach(r)
      return
    } catch (err) {
      console.debug('[mp] join failed, retrying', err?.message || err)
      if (performance.now() - started > GIVE_UP_MS) break
      await sleep(delay)
      delay = Math.min(delay * 2, 8000)
    }
  }
  connecting = false
  if (wanted && gen === generation) retryTimer = setTimeout(() => connect(joinOptions), RETRY_LATER_MS)
}

export function disconnect() {
  wanted = false
  generation += 1
  clearTimeout(retryTimer)
  const r = room
  room = null
  clearRemote()
  if (r) r.leave(true).catch(() => {})
}

export function send(type, payload) {
  if (!room) return
  try {
    room.send(type, payload)
  } catch {
    // Socket closing - the next connect resends everything.
  }
}

export const isConnected = () => Boolean(room)

/** Shows a Boxity chat message above the matching remote player. */
export function showRemoteBubble(userId, text, seconds = 4) {
  if (!userId) return
  const id = Math.random()
  useRemotePlayers.setState((s) => ({ bubbles: { ...s.bubbles, [userId]: { id, text } } }))
  setTimeout(() => {
    useRemotePlayers.setState((s) => {
      if (s.bubbles[userId]?.id !== id) return {}
      const bubbles = { ...s.bubbles }
      delete bubbles[userId]
      return { bubbles }
    })
  }, seconds * 1000)
}
