import { useEffect } from 'react'

import { input } from './core/runtime'

/**
 * Keyboard state in the shared `input` object, deliberately *not* React state.
 *
 * Movement is read every frame inside `useFrame`; routing keydown/keyup through
 * React state would re-render the whole scene 60x a second for no benefit.
 * (No sprint key on purpose: walk speed is earned through levels and trails.)
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
}

export function useKeyboard() {
  useEffect(() => {
    const keys = input.keys
    const isTyping = (e) => {
      const tag = e.target?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable
    }
    const onKeyDown = (e) => {
      if (isTyping(e)) return
      const action = KEY_MAP[e.code]
      if (!action) return
      e.preventDefault() // stop Space/arrows scrolling the page
      keys[action] = true
    }
    const onKeyUp = (e) => {
      const action = KEY_MAP[e.code]
      if (action) keys[action] = false
    }
    // Alt-tabbing away mid-run otherwise leaves a key stuck down.
    const onBlur = () => {
      for (const action of Object.keys(keys)) keys[action] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return input.keys
}

export default useKeyboard
