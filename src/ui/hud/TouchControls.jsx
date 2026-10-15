import { useRef, useState } from 'react'

import { input, isTouchDevice } from '../../game/core/runtime'
import { IconWing } from '../icons'

/** How far the knob travels, as a fraction of the joystick's width. */
const TRAVEL = 0.39

/**
 * On-screen joystick + JUMP button for phones and tablets, styled like the
 * reference: a see-through ring you drag, and a big round blue JUMP button.
 * Both size with the screen (see .touch-stick / .touch-jump), stay inside the
 * safe area and never sit under the menu or the bottom bar.
 */
export function TouchControls() {
  const [enabled] = useState(isTouchDevice)
  const base = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const pointer = useRef(null)

  if (!enabled) return null

  const update = (e) => {
    const rect = base.current.getBoundingClientRect()
    const radius = rect.width * TRAVEL
    let dx = e.clientX - (rect.left + rect.width / 2)
    let dy = e.clientY - (rect.top + rect.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > radius) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    setKnob({ x: dx, y: dy })
    input.stick.x = dx / radius
    input.stick.y = -dy / radius
    input.stick.active = true
  }

  const release = () => {
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    input.stick.x = 0
    input.stick.y = 0
    input.stick.active = false
  }

  return (
    <>
      <div
        ref={base}
        className="joystick-base touch-stick pointer-events-auto z-30 flex items-center justify-center"
        onPointerDown={(e) => {
          pointer.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e)
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) update(e)
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button
        type="button"
        className="jump-btn touch-jump pointer-events-auto z-30"
        aria-label="Jump"
        onPointerDown={(e) => {
          e.preventDefault()
          input.jumpPressed = true
        }}
      >
        <IconWing className="jump-wing" />
        <span className="jump-label game-font">JUMP</span>
      </button>
    </>
  )
}

export default TouchControls
