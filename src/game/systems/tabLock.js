import { loadSave } from '../core/save'
import { getGame } from '../core/store'

/**
 * One tab plays a save at a time.
 *
 * Every tab of this browser shares the same guest/account and the same save, so
 * two open tabs would put the same player in the lobby twice and overwrite each
 * other's progress. The newest tab takes over: the older one saves, pauses
 * (no saving, no multiplayer, no rendering) and shows "Play here" to take the
 * game back. Tabs talk over a BroadcastChannel; without one nothing changes.
 */
const CHANNEL = 'ppc-tabs'
const tabId = Math.random().toString(36).slice(2)
let channel = null
let claimedAt = 0

/** Continue from whatever the other tab saved last. */
function reloadSave() {
  const game = getGame()
  if (!game.session.hydrated || !game.session.saveKey) return
  game.hydrate(game.session.saveKey, loadSave(game.session.saveKey))
}

function claim() {
  claimedAt = Date.now()
  channel?.postMessage({ type: 'claim', tabId, at: claimedAt })
}

function onMessage(event) {
  const msg = event.data
  if (!msg || msg.tabId === tabId) return
  const game = getGame()
  if (msg.type === 'claim') {
    if (game.session.paused) return
    // Two tabs claiming at once (e.g. a restored session): the later claim wins.
    if (msg.at < claimedAt || (msg.at === claimedAt && msg.tabId < tabId)) return
    game.save()
    game.setPaused(true)
    channel?.postMessage({ type: 'released', tabId })
  } else if (msg.type === 'released' && !game.session.paused) {
    // The other tab saved just before pausing: pick up its latest progress.
    reloadSave()
  }
}

/** Starts listening and claims the game for this tab. Returns a cleanup. */
export function startTabLock() {
  if (channel || typeof BroadcastChannel === 'undefined') return () => {}
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = onMessage
  claim()
  return () => {
    channel?.close()
    channel = null
  }
}

/** "Play here" on a paused tab. */
export function playHere() {
  reloadSave()
  getGame().setPaused(false)
  claim()
}
