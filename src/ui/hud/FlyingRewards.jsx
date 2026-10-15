import { useEffect, useRef } from 'react'

import { fx } from '../../game/core/events'
import { playerRuntime } from '../../game/core/runtime'
import { IconRebirth, IconTrophy } from '../icons'

/** Wait for the teleport back to the lobby (and the camera snap) before flying. */
const WIN_DELAY_MS = 380
const REBIRTH_DELAY_MS = 650
const STAGGER_MS = 70
const STEPS = 18

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Where the player is on screen (falls back to the screen centre). */
function playerScreen() {
  const s = playerRuntime.screen
  if (s?.visible) return { x: s.x, y: s.y }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.55 }
}

function centerOf(id) {
  const el = document.getElementById(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** One icon along a curved path from `from` to `to`; calls `onArrive` when it lands. */
function fly(root, { icon, from, to, size, delay, duration, onArrive }) {
  const el = document.createElement('div')
  el.className = 'fly-icon'
  el.appendChild(icon.cloneNode(true))
  el.style.fontSize = `calc(${size}px * var(--ui-scale))`
  root.appendChild(el)

  // A quadratic curve that arcs up and sideways a little, different every time.
  const start = { x: from.x + (Math.random() - 0.5) * 70, y: from.y + (Math.random() - 0.5) * 40 }
  const ctrl = {
    x: (start.x + to.x) / 2 + (Math.random() - 0.5) * 260,
    y: Math.min(start.y, to.y) - 90 - Math.random() * 140,
  }
  const spin = (Math.random() - 0.5) * 60
  const frames = []
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS
    const e = easeInOut(t)
    const x = (1 - e) * (1 - e) * start.x + 2 * (1 - e) * e * ctrl.x + e * e * to.x
    const y = (1 - e) * (1 - e) * start.y + 2 * (1 - e) * e * ctrl.y + e * e * to.y
    // Pop out big, then shrink into the counter.
    const scale = t < 0.15 ? 0.3 + (t / 0.15) * 1.1 : 1.4 - e * 0.85
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${spin * (1 - e)}deg)`, offset: t })
  }
  const anim = el.animate(frames, { duration, delay, easing: 'linear', fill: 'both' })
  anim.onfinish = () => {
    el.remove()
    onArrive()
  }
}

/**
 * Wins and rebirths fly from your character into their counters on the left
 * (LeftStats), each landing with a "ding". Pure DOM + Web Animations, so it
 * costs React nothing.
 */
export function FlyingRewards() {
  const layer = useRef(null)
  // Hidden copies of the icons; each flying icon is a clone of one.
  const templates = useRef(null)

  useEffect(() => {
    const root = layer.current
    const icons = templates.current
    if (!root || !icons) return undefined
    const [trophyIcon, rebirthIcon] = icons.children
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const launch = ({ kind, icon, targetId, total, count, size }) => {
      const share = total / count
      const arrive = (index) => fx.emit('flyArrive', { kind, amount: share, index })
      const to = centerOf(targetId)
      if (!to || reduced || document.hidden || !root.animate) {
        for (let i = 0; i < count; i += 1) arrive(i)
        return
      }
      const from = playerScreen()
      for (let i = 0; i < count; i += 1) {
        fly(root, {
          icon,
          from,
          to,
          size,
          delay: i * STAGGER_MS,
          duration: 720 + Math.random() * 160,
          onArrive: () => arrive(i),
        })
      }
    }

    const timers = new Set()
    const later = (ms, fn) => {
      const t = setTimeout(() => {
        timers.delete(t)
        fn()
      }, ms)
      timers.add(t)
    }

    const offs = [
      fx.on('win', ({ wins }) => {
        const count = Math.max(1, Math.min(12, wins < 12 ? Math.ceil(wins) : 6 + Math.floor(Math.log10(wins)) * 2))
        later(WIN_DELAY_MS, () => launch({ kind: 'wins', icon: trophyIcon, targetId: 'hud-wins-icon', total: wins, count, size: 50 }))
      }),
      fx.on('rebirth', () => {
        later(REBIRTH_DELAY_MS, () => launch({ kind: 'rebirths', icon: rebirthIcon, targetId: 'hud-rebirths-icon', total: 1, count: 1, size: 80 }))
      }),
    ]
    return () => {
      offs.forEach((off) => off())
      timers.forEach((t) => clearTimeout(t))
    }
  }, [])

  return (
    <>
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[35] overflow-hidden" />
      {/* Off-screen (not display:none, so their gradients still paint in clones). */}
      <div ref={templates} className="fly-templates" aria-hidden>
        <IconTrophy />
        <IconRebirth />
      </div>
    </>
  )
}

export default FlyingRewards
