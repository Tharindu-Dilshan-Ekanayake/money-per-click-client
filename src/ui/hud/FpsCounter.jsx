import { useEffect, useState } from 'react'

import { portalMultipliers, useBloxityStore } from '../../bloxity/store'

function Counter() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const loop = (t) => {
      frames += 1
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)))
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="game-font stroke-1 rounded-lg bg-black/40 px-2 py-0.5 text-sm text-white">{fps} FPS</div>
}

/** FPS readout, shown when "Show FPS" is on in the Boxity portal menu. */
export function FpsCounter() {
  const show = useBloxityStore((s) => portalMultipliers(s).showFps)
  return show ? <Counter /> : null
}

export default FpsCounter
