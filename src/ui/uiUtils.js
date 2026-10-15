import { useEffect, useRef, useState } from 'react'

import { fx } from '../game/core/events'

/** Re-renders every `ms` and returns Date.now() - for countdowns and boosts. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

/** Plays a UI sound through the audio director. */
export const uiSound = (sound = 'ui') => fx.emit('ui', { sound })

/**
 * A number that rolls smoothly to `value` (ease-out over `ms`) instead of
 * jumping, like a slot-machine counter.
 */
export function useRolling(value, ms = 320) {
  const [shown, setShown] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const from = current.current
    if (from === value) return undefined
    const start = performance.now()
    let raf = 0
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms)
      const next = from + (value - from) * (1 - Math.pow(1 - k, 3))
      current.current = k < 1 ? next : value
      setShown(current.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}
