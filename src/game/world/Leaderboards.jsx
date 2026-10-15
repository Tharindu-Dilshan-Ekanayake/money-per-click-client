import { memo } from 'react'

import { useBloxity } from '../../bloxity/BloxityContext'
import { useNow } from '../../ui/uiUtils'
import { LEADERBOARD } from '../core/config'
import { formatNumber } from '../core/format'
import { weekEndsAt, weeklyStats } from '../core/formulas'
import { LEADERBOARD_SPOTS } from '../core/layout'
import { useGame } from '../core/store'
import { useLeaderboard } from '../net/leaderboard'
import { StaticBatch } from './batching'
import { COLORS } from './materials'
import { Block, Label } from './parts'

const RANK_COLORS = ['#facc15', '#e2e8f0', '#f59e0b']
const ROW_COLOR = '#ffffff'
const TITLE_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fde047']
const ROWS = 10
const ROW_SIZE = 0.48
/** Line height as a multiple of the font size (rows 0.82 apart). */
const LINE_HEIGHT = 1.7

/** "3D 4H" / "5H 12M" until the weekly boards reset. */
function resetText(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}D ${hours}H`
  return `${hours}H ${minutes % 60}M`
}

/** One multi-line column; `colorRanges` paints each row (top 3 gold/silver/bronze). */
function columnText(lines) {
  const colors = {}
  let offset = 0
  lines.forEach((line, i) => {
    colors[offset] = RANK_COLORS[i] || ROW_COLOR
    offset += line.length + 1
  })
  return { text: lines.join('\n'), colors }
}

const Board = memo(function Board({ stat, index, spot, resetIn }) {
  const { identity } = useBloxity()
  const status = useLeaderboard((s) => s.status)
  // No server messages on screen: offline, the board just shows your own entry.
  const rows = useLeaderboard((s) => s.boards[stat.key]) || []
  const own = useGame((s) => weeklyStats(s.data)[stat.key])
  const myName = identity?.displayName || identity?.username || 'You'

  const entries = (status === 'ok' && rows.length ? rows : [{ name: myName, value: own }]).slice(0, ROWS)
  // Two text objects for the whole table instead of two per row.
  const names = columnText(entries.map((row, i) => `${i + 1}. ${String(row.name).slice(0, 16)}`))
  const values = columnText(entries.map((row) => `${stat.prefix}${formatNumber(row.value)}`))

  return (
    // Rotated to face spawn (-Z); after the rotation the board's front is local +Z.
    <group position={[spot.center[0], 0, spot.center[1]]} rotation={[0, Math.PI, 0]}>
      <Label position={[0, 12.6, 0]} size={1.15} color={TITLE_COLORS[index % TITLE_COLORS.length]}>
        {stat.title}
      </Label>
      <Label position={[0, 11.75, 0.32]} size={0.36} color="#c7d2fe">
        {`THIS WEEK · RESETS IN ${resetIn}`}
      </Label>
      <Label
        position={[-4.7, 11.0, 0.32]}
        anchorX="left"
        anchorY="top"
        textAlign="left"
        size={ROW_SIZE}
        lineHeight={LINE_HEIGHT}
        color={ROW_COLOR}
        colorRanges={names.colors}
        outlineWidth={0.12}
      >
        {names.text}
      </Label>
      <Label
        position={[4.7, 11.0, 0.32]}
        anchorX="right"
        anchorY="top"
        textAlign="right"
        size={ROW_SIZE}
        lineHeight={LINE_HEIGHT}
        color={ROW_COLOR}
        colorRanges={values.colors}
        outlineWidth={0.12}
      >
        {values.text}
      </Label>
    </group>
  )
})

/** Board frames and posts for all four boards: static, merged into two draw calls. */
function BoardFrames() {
  return (
    <StaticBatch>
      {LEADERBOARD_SPOTS.map((spot, i) => (
        <group key={i} position={[spot.center[0], 0, spot.center[1]]} rotation={[0, Math.PI, 0]}>
          <Block size={[0.6, 2.4, 0.6]} position={[-4.2, 1.2, 0]} color={COLORS.navy} studs={false} collider />
          <Block size={[0.6, 2.4, 0.6]} position={[4.2, 1.2, 0]} color={COLORS.navy} studs={false} collider />
          <Block size={[11, 9.6, 0.6]} position={[0, 7, -0.1]} color={COLORS.navy} studs={false} />
          <Block size={[10.2, 8.8, 0.1]} position={[0, 6.9, 0.25]} color="#18225a" studs={false} castShadow={false} />
        </group>
      ))}
    </StaticBatch>
  )
}

/** The four WEEKLY leaderboards along the south wall; they reset every Monday 00:00 UTC. */
export function Leaderboards() {
  const now = useNow(60_000)
  const resetIn = resetText(weekEndsAt(now) - now)
  return (
    <group>
      <BoardFrames />
      {LEADERBOARD.stats.map((stat, i) => (
        <Board key={stat.key} stat={stat} index={i} spot={LEADERBOARD_SPOTS[i]} resetIn={resetIn} />
      ))}
    </group>
  )
}

export default Leaderboards
