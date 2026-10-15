import { useEffect } from 'react'

import { useBloxity } from '../../bloxity/BloxityContext'
import { getSDK, safeCall, toUnsubscribe } from '../../bloxity/sdk'
import { getEmoteClip, setEmoteCatalogue } from '../emotes'
import { SPAWN } from '../core/layout'
import { markActive, playerRuntime } from '../core/runtime'
import { getGame } from '../core/store'
import { showRemoteBubble } from '../net/multiplayer'

async function loadCatalogue(sdk) {
  try {
    setEmoteCatalogue(await sdk.avatar?.getEmoteCatalog?.())
  } catch {
    // Emotes are cosmetic: a failed fetch just means no emotes this session.
  }
}

/**
 * Game-side Boxity events. Renders nothing.
 * - `play_emote`: play the catalogue clip on our avatar (Boxity draws the picker)
 * - `respawn_request`: back to spawn (the portal's respawn button)
 * - chat: the player's own latest message shows above their name tag
 * - gameplayEnd() when the page goes away
 */
export function BloxityBridge() {
  const { status, game } = useBloxity()

  useEffect(() => {
    if (status !== 'ready') return undefined
    const sdk = getSDK()
    if (!sdk) return undefined

    loadCatalogue(sdk)

    const playEmote = async (id) => {
      let clip = getEmoteClip(id)
      if (!clip) {
        // A new emote may have been added since we fetched; try once more.
        await loadCatalogue(sdk)
        clip = getEmoteClip(id)
      }
      if (!clip) return
      markActive()
      playerRuntime.emote = { id, clip, startedAt: performance.now(), weight: playerRuntime.emote?.weight || 0, stopping: false }
    }

    const offs = [
      toUnsubscribe(
        safeCall(sdk.player?.onEvent?.bind(sdk.player), (event, data) => {
          try {
            if (event === 'play_emote' && typeof data === 'string' && data) playEmote(data)
            else if (event === 'respawn_request') getGame().requestTeleport(SPAWN)
          } catch (err) {
            console.warn('[bloxity] player event failed', err)
          }
        }),
      ),
      toUnsubscribe(
        safeCall(sdk.chat?.onMessage?.bind(sdk.chat), (message) => {
          if (!message) return
          const text = safeCall(sdk.chat.bubbleText?.bind(sdk.chat), message) ?? String(message.text || '')
          const seconds = sdk.chat.bubbleSeconds || 4
          // Our own message over our head; others' over theirs (matched by Boxity id).
          if (message.isLocalPlayer) {
            markActive()
            getGame().showChatBubble(text, seconds)
          }
          else showRemoteBubble(String(message.userId || '').replace(/^legion_/, ''), text, seconds)
        }),
      ),
    ]

    const onPageHide = () => game.gameplayEnd()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      offs.forEach((off) => off())
    }
  }, [status, game])

  return null
}

export default BloxityBridge
