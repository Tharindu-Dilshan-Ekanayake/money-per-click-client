import { useEffect, useRef } from 'react'

import { fx } from '../../game/core/events'
import { formatMoney } from '../../game/core/format'
import { playerRuntime } from '../../game/core/runtime'

const MAX_NODES = 45

/**
 * "+$15" numbers that pop and float up. Built with direct DOM nodes rather than
 * React state: at 20 clicks a second, re-rendering a list would be wasteful.
 */
export function FloatingText() {
  const layer = useRef(null)

  useEffect(() => {
    const root = layer.current
    if (!root) return undefined

    const spawn = (text, x, y, { color = '#4ade80', size = 34, duration = 900 } = {}) => {
      if (root.childElementCount >= MAX_NODES) root.firstElementChild?.remove()
      const el = document.createElement('div')
      el.className = 'float-text stroke-2'
      el.textContent = text
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.color = color
      el.style.fontSize = `calc(${size}px * var(--ui-scale))`
      el.style.animationDuration = `${duration}ms`
      el.addEventListener('animationend', () => el.remove(), { once: true })
      root.appendChild(el)
    }

    const nearPlayer = (spread = 60) => {
      const s = playerRuntime.screen
      const x = s?.visible ? s.x : window.innerWidth / 2
      const y = s?.visible ? s.y : window.innerHeight / 2
      return [x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.5]
    }

    const offs = [
      fx.on('click', ({ x, y, amount, combo, crit }) => {
        const jitter = () => (Math.random() - 0.5) * 30
        if (crit) {
          spawn(`CRIT x5! +${formatMoney(amount)}`, x, y - 50, { color: '#fb923c', size: 50, duration: 1200 })
          return
        }
        const big = combo >= 10
        spawn(`+${formatMoney(amount)}`, x + jitter(), y - 20 + jitter(), {
          color: big ? '#fde047' : '#4ade80',
          size: big ? 40 : 34,
        })
      }),
      fx.on('step', ({ amount }) => {
        const [x, y] = nearPlayer(80)
        spawn(`+${formatMoney(amount)}`, x, y + 40, { color: '#86efac', size: 24, duration: 800 })
      }),
      fx.on('afk', ({ amount }) => {
        const [x, y] = nearPlayer(40)
        spawn(`+${formatMoney(amount)}`, x, y - 30, { color: '#fde047', size: 32, duration: 1100 })
      }),
      fx.on('luckyBag', ({ amount }) => {
        spawn(`+${formatMoney(amount)}`, window.innerWidth / 2, window.innerHeight * 0.45, {
          color: '#facc15',
          size: 64,
          duration: 1600,
        })
      }),
      fx.on('rainBill', ({ amount }) => {
        const [x, y] = nearPlayer(50)
        spawn(`+${formatMoney(amount)}`, x, y - 40, { color: '#4ade80', size: 30, duration: 900 })
      }),
      fx.on('buy', ({ kind }) => {
        if (kind !== 'cash') return
        const [x, y] = nearPlayer(30)
        spawn('UPGRADED!', x, y - 60, { color: '#c084fc', size: 30, duration: 800 })
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  return <div ref={layer} className="pointer-events-none fixed inset-0 z-30 overflow-hidden" />
}

export default FloatingText
