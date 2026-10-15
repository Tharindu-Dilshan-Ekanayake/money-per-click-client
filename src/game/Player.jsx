import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { SPEED } from './core/config'
import { fx } from './core/events'
import { walkSpeed } from './core/formulas'
import { SPAWN } from './core/layout'
import { input, markActive, playerRuntime } from './core/runtime'
import { getGame } from './core/store'
import { LocalNameplate, LocalTrail } from './fx/PlayerExtras'
import PlayerAvatar from './PlayerAvatar'
import useKeyboard from './useKeyboard'

// Capsule roughly matching the humanoid. Rapier's capsule args are the half-height of
// the *cylindrical* section plus the radius, so total height = 2*(halfHeight+radius).
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.55
const PLAYER_HEIGHT = 2 * (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

/** Speed at which the run cycle reaches full amplitude. Slower players shuffle. */
const FULL_STRIDE_SPEED = 8
/** Extra ray length past the capsule bottom; tolerates small ground gaps. */
const GROUND_RAY_SLACK = 0.15
/** Stops one long Space press from re-triggering the moment the ray re-hits. */
const JUMP_COOLDOWN_S = 0.25

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _rayOrigin = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)

/**
 * The player: a dynamic Rapier capsule with the assembled Bloxity avatar as its
 * visual mesh. The avatar is a child of the RigidBody, so R3F/Rapier keeps the mesh
 * on the body transform automatically — no manual per-frame copying.
 *
 * Walk speed comes from the game state (level, trail, Speed Boost), so a fresh
 * brokie really is slow and gets faster with every level.
 *
 * @param {{ position?: [number,number,number], onAvatarReady?: () => void,
 *           bodyRef?: React.MutableRefObject<any> }} props
 */
export function Player({ position = SPAWN, onAvatarReady, bodyRef: externalBodyRef }) {
  // The follow camera needs to read this body's transform, so the scene may own the
  // ref. Fall back to a local one when used standalone.
  const localBodyRef = useRef(null)
  const bodyRef = externalBodyRef || localBodyRef
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const { rapier, world } = useRapier()

  const jumpCooldown = useRef(0)
  const lastTeleport = useRef(null)

  /**
   * Motion state handed to the avatar so it can pose itself. A ref, not state:
   * this is written every frame and must not trigger a re-render.
   */
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: FULL_STRIDE_SPEED })

  useEffect(() => {
    playerRuntime.body = bodyRef.current
    return () => {
      playerRuntime.body = null
    }
  }, [bodyRef])

  /**
   * Grounded check: cast a short ray straight down from the capsule centre and see
   * whether it hits anything before clearing the capsule's own bottom. Without this
   * the player can jump indefinitely in mid-air.
   */
  const isGrounded = () => {
    const body = bodyRef.current
    if (!body) return false

    const pos = body.translation()
    _rayOrigin.set(pos.x, pos.y, pos.z)

    const ray = new rapier.Ray(_rayOrigin, { x: 0, y: -1, z: 0 })
    const maxDistance = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + GROUND_RAY_SLACK

    const hit = world.castRay(
      ray,
      maxDistance,
      true, // solid
      undefined,
      undefined,
      undefined,
      body, // exclude our own body, or we just hit ourselves
    )

    return hit !== null && hit.timeOfImpact <= maxDistance
  }

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return
    const game = getGame()

    // --- Teleports (WIN pads, rebirth, falling out of the world) ---------------
    const tp = game.session.teleport
    if (tp && tp.id !== lastTeleport.current) {
      lastTeleport.current = tp.id
      const [x, y, z] = tp.position
      body.setTranslation({ x, y, z }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (visualRef.current) visualRef.current.quaternion.setFromAxisAngle(_up, Math.PI)
    }

    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta)

    const k = keys
    const stick = input.stick

    // Evaluated once per frame now: both the jump gate and the avatar's pose need it.
    const grounded = isGrounded()
    const moveSpeed = walkSpeed(game.data)

    // --- Horizontal movement, relative to camera yaw -----------------------------
    // W/S walk; A/D turn the camera (FollowCamera). The touch joystick can still
    // walk in any direction.
    _input.set(
      stick.active ? stick.x : 0,
      0,
      (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - (stick.active ? stick.y : 0),
    )

    const linvel = body.linvel()

    if (_input.lengthSq() > 0.0025 || k.left || k.right) markActive()

    if (_input.lengthSq() > 0.0025) {
      // Joystick magnitude scales speed; keyboard is always full speed.
      const magnitude = Math.min(1, _input.length())
      _input.normalize()

      // Flatten the camera's forward onto the ground plane so W always means
      // "away from the camera", the standard 3rd-person runner feel.
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()

      // Screen-right, derived from that flattened forward.
      _camRight.crossVectors(_camForward, _up).normalize()

      // input.z is -1 for W (forward), input.x is +1 for D (right).
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()

      const speed = moveSpeed * magnitude

      // Set velocity directly rather than accumulating impulses: gives crisp,
      // predictable runner control and no drift. Y is left to gravity.
      body.setLinvel({ x: _move.x * speed, y: linvel.y, z: _move.z * speed }, true)

      // Face the direction of travel.
      if (visualRef.current) {
        _targetQuat.setFromAxisAngle(_up, Math.atan2(_move.x, _move.z))
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    } else {
      // Damp horizontal motion to a stop; don't touch the fall speed.
      body.setLinvel({ x: linvel.x * 0.8, y: linvel.y, z: linvel.z * 0.8 }, true)
      // Turning in place with A/D: face where the camera looks.
      if ((k.left || k.right) && visualRef.current) {
        state.camera.getWorldDirection(_camForward)
        _targetQuat.setFromAxisAngle(_up, Math.atan2(_camForward.x, _camForward.z))
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    }

    // --- Jump --------------------------------------------------------------------
    const wantsJump = k.jump || input.jumpPressed
    if (wantsJump && jumpCooldown.current === 0 && grounded) {
      body.applyImpulse({ x: 0, y: SPEED.jumpImpulse, z: 0 }, true)
      jumpCooldown.current = JUMP_COOLDOWN_S
      fx.emit('jump')
    }
    input.jumpPressed = false

    // --- Publish motion state for the avatar's pose and everything that follows ---
    const nowVel = body.linvel()
    const pos = body.translation()
    const motion = motionRef.current
    motion.time += delta
    motion.speed = Math.hypot(nowVel.x, nowVel.z)
    motion.grounded = grounded
    motion.maxSpeed = FULL_STRIDE_SPEED

    playerRuntime.position.set(pos.x, pos.y, pos.z)
    playerRuntime.speed = motion.speed
    playerRuntime.grounded = grounded
    if (visualRef.current) {
      const q = visualRef.current.quaternion
      playerRuntime.yaw = 2 * Math.atan2(q.y, q.w)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={position}
      colliders={false}
      mass={1}
      // Locking rotation keeps the capsule upright; facing is handled on the mesh.
      enabledRotations={[false, false, false]}
      friction={0.2}
      linearDamping={0.1}
      ccd
      name="player"
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      {/* Avatar origin is at the feet; the capsule origin is at its centre.
          Starts facing -Z, toward the stage gates. */}
      <group ref={visualRef} position={[0, -PLAYER_HEIGHT / 2, 0]} rotation={[0, Math.PI, 0]}>
        <PlayerAvatar
          onReady={onAvatarReady}
          targetHeight={PLAYER_HEIGHT}
          motionRef={motionRef}
        />
      </group>
      <LocalTrail />
      <LocalNameplate />
    </RigidBody>
  )
}

export { PLAYER_HEIGHT }
export default Player
