import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { portalMultipliers, useBloxityStore } from '../bloxity/store'
import { fx } from './core/events'
import { input } from './core/runtime'

/** How high above the player's origin (capsule centre) the camera aims... */
const LOOK_HEIGHT = 1.4
/** ...and how low it aims when zoomed right in, so head-to-feet stays in view. */
const CLOSE_LOOK_HEIGHT = 0.25
/** Zoom distance where the aim has fully risen back to LOOK_HEIGHT. */
const FAR_LOOK_DISTANCE = 9

const MIN_DISTANCE = 3
const MAX_DISTANCE = 24
const START_DISTANCE = 10

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the track.
const MIN_PITCH = -0.15
const MAX_PITCH = 1.25
const START_PITCH = 0.36

/** Radians per second the camera turns while A/D (or left/right arrows) are held. */
const KEY_TURN_SPEED = 2.4

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.01
/** A touch must travel this far (px) before it counts as a camera drag, not a tap. */
const TOUCH_DRAG_THRESHOLD = 8

// Higher = snappier. Framerate-independent via the pow() smoothing below.
const POSITION_SMOOTHING = 4
const LOOK_SMOOTHING = 8

const BASE_FOV = 60
/** A target jump bigger than this in one frame is a teleport: snap, don't swoop. */
const SNAP_DISTANCE = 6

/** How far in front of a wall/roof the camera stops, and the closest it gets. */
const WALL_MARGIN = 0.35
const MIN_COLLIDE_DISTANCE = 0.9

const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Aim point height for a zoom distance: chest height up close, above the head far away. */
const lookHeightFor = (distance) =>
  CLOSE_LOOK_HEIGHT + (LOOK_HEIGHT - CLOSE_LOOK_HEIGHT) * smoothstep((distance - MIN_DISTANCE) / (FAR_LOOK_DISTANCE - MIN_DISTANCE))

const _desired = new Vector3()
const _target = new Vector3()
const _origin = new Vector3()
const _dir = new Vector3()

/**
 * Third-person orbit camera.
 *
 * Trails the player's rigid body, easing both position and look-at target.
 * Right-click drag (or a one-finger drag on touch screens) orbits, the mouse
 * wheel zooms. Adds juice: screen shake on big moments, an FOV kick on level
 * up, and a wider FOV at high speed.
 *
 * Reads the Rapier body directly rather than React state - the body is the
 * authoritative transform and updates every physics step, not every render.
 * Must render inside <Physics>: it raycasts so walls and the stage roof never
 * come between the camera and the player.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function FollowCamera({ bodyRef }) {
  const gl = useThree((s) => s.gl)
  const { rapier, world } = useRapier()

  // Spherical offset from the player. A ref, not state: pointer events write to it
  // every mousemove and the frame loop reads it - re-rendering would be wasteful.
  const orbit = useRef({ yaw: 0, pitch: START_PITCH, distance: START_DISTANCE })
  const lookAt = useRef(new Vector3())
  const initialised = useRef(false)
  const juice = useRef({ shake: 0, fovKick: 0 })
  const lastTarget = useRef(new Vector3())
  // One reusable ray for the camera collision cast (no per-frame allocation).
  const ray = useRef(null)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return

    // pointerId -> { x, y, dragging, mouse }
    const drags = new Map()

    const onPointerDown = (e) => {
      const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen'
      if (!isTouch && e.button !== 2) return // mouse: right button only
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragging: !isTouch })
      el.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e) => {
      const d = drags.get(e.pointerId)
      if (!d) return
      if (!d.dragging) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < TOUCH_DRAG_THRESHOLD) return
        d.dragging = true
      }
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.x = e.clientX
      d.y = e.clientY

      const sensitivity =
        (e.pointerType === 'mouse' ? DRAG_SENSITIVITY : TOUCH_SENSITIVITY) *
        portalMultipliers(useBloxityStore.getState()).cameraSensitivity
      const o = orbit.current
      o.yaw -= dx * sensitivity
      o.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, o.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      if (!drags.has(e.pointerId)) return
      drags.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      const o = orbit.current
      o.distance = Math.min(
        MAX_DISTANCE,
        Math.max(MIN_DISTANCE, o.distance + e.deltaY * ZOOM_SENSITIVITY),
      )
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useEffect(() => {
    const shake = (strength) => {
      juice.current.shake = Math.max(juice.current.shake, strength)
    }
    const offs = [
      // Snap instead of swooping across the map after a teleport.
      fx.on('teleport', () => {
        initialised.current = false
      }),
      fx.on('rebirth', () => shake(0.6)),
      fx.on('win', () => shake(0.25)),
      fx.on('gateDenied', () => shake(0.12)),
      fx.on('gateOpen', () => shake(0.15)),
      fx.on('click', ({ crit }) => {
        if (crit) shake(0.1)
      }),
      fx.on('levelUp', ({ titleChanged }) => {
        juice.current.fovKick = titleChanged ? 10 : 5
        if (titleChanged) shake(0.2)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return
    const camera = state.camera

    // A/D turn the camera around the player (the player turns with it).
    const turn = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0)
    if (turn) orbit.current.yaw -= turn * KEY_TURN_SPEED * Math.min(delta, 0.1)

    const pos = body.translation()
    _target.set(pos.x, pos.y, pos.z)
    if (_target.distanceTo(lastTarget.current) > SNAP_DISTANCE) initialised.current = false
    lastTarget.current.copy(_target)

    // Spherical -> cartesian. yaw 0 puts the camera behind the player on +Z.
    const { yaw, pitch, distance } = orbit.current
    const lookHeight = lookHeightFor(distance)
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      _target.y + Math.sin(pitch) * distance + lookHeight,
      _target.z + Math.cos(yaw) * horizontal,
    )

    // Camera collision: cast from the player's head toward the camera and stop
    // in front of the first wall, roof, tree or floor in the way.
    _origin.set(_target.x, _target.y + lookHeight, _target.z)
    _dir.subVectors(_desired, _origin)
    const wanted = _dir.length()
    let blocked = false
    if (wanted > 0.001) {
      _dir.divideScalar(wanted)
      if (!ray.current) ray.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
      const r = ray.current
      r.origin.x = _origin.x
      r.origin.y = _origin.y
      r.origin.z = _origin.z
      r.dir.x = _dir.x
      r.dir.y = _dir.y
      r.dir.z = _dir.z
      const hit = world.castRay(r, wanted, true, undefined, undefined, undefined, body)
      if (hit && hit.timeOfImpact < wanted) {
        blocked = true
        _desired.copy(_origin).addScaledVector(_dir, Math.max(MIN_COLLIDE_DISTANCE, hit.timeOfImpact - WALL_MARGIN))
      }
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the camera was.
      camera.position.copy(_desired)
      lookAt.current.copy(_target).setY(_target.y + lookHeight)
      initialised.current = true
    }

    // 1 - pow(x, delta) keeps the easing rate consistent across framerates.
    // When a wall is in the way, jump in front of it at once (never see through).
    if (blocked && camera.position.distanceTo(_origin) > _desired.distanceTo(_origin)) {
      camera.position.copy(_desired)
    } else {
      camera.position.lerp(_desired, 1 - Math.pow(0.001, delta * (POSITION_SMOOTHING / 10)))
    }

    _target.y += lookHeight
    lookAt.current.lerp(_target, 1 - Math.pow(0.001, delta * (LOOK_SMOOTHING / 10)))

    // Screen shake: jitter the camera, decaying quickly.
    const j = juice.current
    if (j.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * j.shake
      camera.position.y += (Math.random() - 0.5) * j.shake
      j.shake *= Math.pow(0.02, delta)
    }
    camera.lookAt(lookAt.current)

    // FOV: kick on level up, widen a little at speed.
    const v = body.linvel()
    const speed = Math.hypot(v.x, v.z)
    j.fovKick *= Math.pow(0.05, delta)
    // Tall phone screens see more of the world around the player.
    const portrait = camera.aspect < 1 ? Math.min(20, (1 / camera.aspect - 1) * 14) : 0
    const fov = BASE_FOV + portrait + Math.min(speed, 22) * 0.35 + j.fovKick
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * Math.min(1, delta * 6)
      camera.updateProjectionMatrix()
    }
  })

  return null
}

export default FollowCamera
