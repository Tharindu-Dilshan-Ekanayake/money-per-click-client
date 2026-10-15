import { Vector3 } from 'three'

/**
 * Mutable per-frame state shared between the physics loop and everything that
 * follows the player (camera, pets, zone checks, nameplate). Written once per
 * frame by <Player>; read freely elsewhere. Deliberately not React state.
 */
export const playerRuntime = {
  position: new Vector3(0, 1, 0),
  /** Facing angle in radians (atan2(x, z) of the travel direction). */
  yaw: Math.PI,
  speed: 0,
  grounded: true,
  /** World position of the right hand, for the held cash and click bursts. */
  hand: new Vector3(0, 1, 0),
  /** { elbow, tip } bones of the right arm, published by <PlayerAvatar>. */
  handBones: null,
  /** Set by <Player> so systems can teleport without prop drilling. */
  body: null,
  /** Player's on-screen position (CSS px), for floating numbers. */
  screen: { x: 0, y: 0, visible: false },
  /** Playing Boxity emote: { id, clip, startedAt, weight, stopping } or null. */
  emote: null,
  /** performance.now() when the avatar last started cheering (wins, rebirths). */
  cheerAt: -Infinity,
  /** Wall-clock ms of the last input (move, click, key, tap) - drives AFK. */
  lastActiveAt: Date.now(),
}

/** Call on any player input: it ends AFK. */
export function markActive() {
  playerRuntime.lastActiveAt = Date.now()
}

/** Seconds since the player last did anything. */
export const idleSeconds = (now = Date.now()) => Math.max(0, (now - playerRuntime.lastActiveAt) / 1000)

/**
 * Shared input. Keyboard writes `keys`; the mobile joystick writes `stick`
 * (x right, y forward, each -1..1); the jump button sets `jumpPressed`.
 */
export const input = {
  keys: { forward: false, backward: false, left: false, right: false, jump: false },
  stick: { x: 0, y: 0, active: false },
  jumpPressed: false,
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0)
