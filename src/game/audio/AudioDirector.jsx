import { useEffect } from 'react'

import { portalMultipliers, useBloxityStore } from '../../bloxity/store'
import { RARITIES, PETS } from '../core/config'
import { fx } from '../core/events'
import { getGame, useGame } from '../core/store'
import audio from './sfx'

const RARITY_RANK = Object.keys(RARITIES)

/**
 * Wires game events to sounds. Renders nothing.
 * - unlocks the AudioContext on the first pointer/key press (browser rule)
 * - mirrors the volume settings
 * - suspends audio while the tab is hidden
 */
export function AudioDirector() {
  const music = useGame((s) => s.data.settings.music)
  const sfx = useGame((s) => s.data.settings.sfx)
  // Portal master/music volume (when embedded on bloxity.io) scale ours.
  const master = useBloxityStore((s) => portalMultipliers(s).master)
  const portalMusic = useBloxityStore((s) => portalMultipliers(s).music)
  const paused = useGame((s) => s.session.paused)

  // Silent while the tab is hidden or paused (another tab is playing).
  useEffect(() => {
    audio.setHidden(document.hidden || paused)
  }, [paused])

  useEffect(() => {
    audio.setVolumes(music * master * portalMusic, sfx * master)
  }, [music, sfx, master, portalMusic])

  useEffect(() => {
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    const onVisibility = () => audio.setHidden(document.hidden || getGame().session.paused)
    document.addEventListener('visibilitychange', onVisibility)

    let lastStep = 0
    const offs = [
      fx.on('click', ({ combo, crit }) => {
        audio.play('click', { combo })
        if (crit) audio.play('crit')
      }),
      fx.on('flyArrive', ({ kind, index }) => audio.play(kind === 'rebirths' ? 'reward' : 'winTick', { index })),
      fx.on('step', () => {
        // Footsteps at a sprint would be machine-gun fast; cap the rate.
        const t = performance.now()
        if (t - lastStep < 110) return
        lastStep = t
        audio.play('step')
      }),
      fx.on('afk', () => audio.play('afk')),
      fx.on('levelUp', ({ titleChanged }) => {
        audio.play('levelUp')
        if (titleChanged) audio.play('title')
      }),
      fx.on('gateOpen', () => audio.play('gateOpen')),
      fx.on('gateDenied', () => audio.play('gateDenied')),
      fx.on('win', () => audio.play('win')),
      fx.on('buy', ({ kind }) => audio.play(kind === 'equip' ? 'equip' : 'buy')),
      fx.on('deny', () => audio.play('deny')),
      fx.on('rebirth', () => audio.play('rebirth')),
      fx.on('reward', ({ kind }) => audio.play(kind === 'step' ? 'stepDone' : 'reward')),
      fx.on('boost', () => audio.play('boost')),
      fx.on('teleport', () => audio.play('teleport')),
      fx.on('luckyBag', () => audio.play('luckyBag')),
      fx.on('moneyRain', () => audio.play('boost')),
      fx.on('rainBill', () => audio.play('coin')),
      fx.on('jump', () => audio.play('jump')),
      fx.on('hatchStage', ({ stage, results }) => {
        if (stage === 'shake') audio.play('hatchShake')
        else if (stage === 'crack') audio.play('hatchCrack')
        else if (stage === 'reveal') {
          const rank = Math.max(
            ...results.map((r) => RARITY_RANK.indexOf(PETS[r.id]?.rarity) + (r.variant || 0)),
          )
          audio.play('hatchReveal', { rank })
        }
      }),
      fx.on('ui', ({ sound = 'ui' } = {}) => audio.play(sound)),
    ]

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('visibilitychange', onVisibility)
      offs.forEach((off) => off())
    }
  }, [])

  return null
}

export default AudioDirector
