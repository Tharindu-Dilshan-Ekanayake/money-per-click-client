import { useState } from 'react'

import { formatMoney, formatNumber, formatTime } from '../../game/core/format'
import { getGame, useGame } from '../../game/core/store'
import { GameButton, Panel } from '../common'

function Row({ label, children }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className="game-font stroke-2 w-40 shrink-0 text-xl text-white">{label}</span>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </div>
  )
}

export function SettingsPanel() {
  const settings = useGame((s) => s.data.settings)
  const stats = useGame((s) => s.data.stats)
  const setSetting = useGame((s) => s.setSetting)
  const [confirmReset, setConfirmReset] = useState(0)

  return (
    <Panel title="Settings" icon="⚙️" headerClass="grad-gray" width={680}>
      <div className="flex flex-col gap-3">
        <Row label="🎵 Music">
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.music}
            onChange={(e) => setSetting('music', Number(e.target.value))}
          />
        </Row>
        <Row label="🔊 Sounds">
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfx}
            onChange={(e) => setSetting('sfx', Number(e.target.value))}
          />
        </Row>
        <Row label="🌗 Shadows">
          <GameButton color={settings.shadows ? 'green' : 'gray'} onClick={() => setSetting('shadows', !settings.shadows)}>
            {settings.shadows ? 'ON' : 'OFF'}
          </GameButton>
        </Row>
        <Row label="🖥️ Quality">
          {['high', 'low'].map((q) => (
            <GameButton key={q} color={settings.quality === q ? 'green' : 'gray'} onClick={() => setSetting('quality', q)}>
              {q.toUpperCase()}
            </GameButton>
          ))}
        </Row>

        <div className="card p-3">
          <div className="game-font stroke-2 mb-2 text-2xl text-white">📊 Stats</div>
          <div className="game-font stroke-1 grid grid-cols-2 gap-x-4 gap-y-1 text-lg text-white">
            <span>Total earned</span>
            <span className="text-right text-[#4ade80]">{formatMoney(stats.totalEarned)}</span>
            <span>Clicks</span>
            <span className="text-right">{formatNumber(stats.totalClicks)}</span>
            <span>Steps</span>
            <span className="text-right">{formatNumber(stats.totalSteps)}</span>
            <span>Wins earned</span>
            <span className="text-right text-[#fde047]">{formatNumber(stats.totalWins)}</span>
            <span>Lifetime levels</span>
            <span className="text-right">{formatNumber(stats.lifetimeLevels)}</span>
            <span>Best stage</span>
            <span className="text-right">{stats.bestStage}</span>
            <span>Eggs opened</span>
            <span className="text-right">{formatNumber(stats.eggsOpened)}</span>
            <span>Time played</span>
            <span className="text-right">{formatTime(stats.playtime)}</span>
          </div>
        </div>

        <div className="card p-3">
          <div className="game-font stroke-2 mb-1 text-xl text-white">🎮 Controls</div>
          <div className="game-font stroke-1 text-base text-white/90">
            W/S walk · A/D turn camera · Space jump · Left click earn money · Right-drag rotate camera · Scroll zoom · B Shop · R Rebirth · G
            Rewards · M music · E / R open eggs (at an egg) · Esc close windows. On phones: joystick + JUMP, tap to earn, drag to look.
          </div>
        </div>

        <Row label="⚠️ Reset">
          {confirmReset === 0 && (
            <GameButton color="red" onClick={() => setConfirmReset(1)}>
              Reset progress
            </GameButton>
          )}
          {confirmReset === 1 && (
            <>
              <span className="game-font stroke-1 text-base text-[#fca5a5]">This deletes everything!</span>
              <GameButton
                color="red"
                onClick={() => {
                  getGame().resetProgress()
                  setConfirmReset(0)
                }}
              >
                Yes, reset
              </GameButton>
              <GameButton color="gray" onClick={() => setConfirmReset(0)}>
                Cancel
              </GameButton>
            </>
          )}
        </Row>
      </div>
    </Panel>
  )
}

export default SettingsPanel
