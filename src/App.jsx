import AudioDirector from './game/audio/AudioDirector'
import GameScene from './game/GameScene'
import LeaderboardSync from './game/net/LeaderboardSync'
import MultiplayerSync from './game/net/MultiplayerSync'
import BloxityBridge from './game/systems/BloxityBridge'
import GameLoop from './game/systems/GameLoop'
import HUD from './ui/HUD'

function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky-400">
      <GameScene />
      <HUD />
      {/* Non-visual systems: saving + timers, audio, leaderboard, Boxity events. */}
      <GameLoop />
      <BloxityBridge />
      <MultiplayerSync />
      <AudioDirector />
      <LeaderboardSync />
    </div>
  )
}

export default App
