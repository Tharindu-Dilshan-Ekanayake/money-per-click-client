import { useGame } from '../../game/core/store'
import { playHere } from '../../game/systems/tabLock'
import { GameButton } from '../common'

/** Shown on an older tab after the game was opened in another tab. */
export function TabPausedOverlay() {
  const paused = useGame((s) => s.session.paused)
  if (!paused) return null
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-md p-6 text-center">
        <div className="text-6xl">🎮</div>
        <div className="game-font stroke-3 mt-2 text-3xl text-white">Playing in another tab</div>
        <div className="game-font stroke-1 mt-2 text-lg text-white/85">
          The game is open in another tab or window, so it's paused here. Your progress is safe.
        </div>
        <GameButton color="green" size="lg" className="mt-5" onClick={playHere}>
          Play here
        </GameButton>
      </div>
    </div>
  )
}

export default TabPausedOverlay
