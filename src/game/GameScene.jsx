import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NeutralToneMapping, Object3D, Vector3 } from 'three'

import { useBloxity } from '../bloxity/BloxityContext'
import { portalMultipliers, useBloxityStore } from '../bloxity/store'
import { SPAWN } from './core/layout'
import { playerRuntime } from './core/runtime'
import { getGame, useGame } from './core/store'
import FollowCamera from './FollowCamera'
import Bursts from './fx/Bursts'
import GuideArrows from './fx/GuideArrows'
import LuckyBags from './fx/LuckyBags'
import MoneyBurst from './fx/MoneyBurst'
import MoneyRain from './fx/MoneyRain'
import { LocalHeldCash } from './fx/PlayerExtras'
import { useRemotePlayers } from './net/multiplayer'
import RemotePlayers from './net/RemotePlayers'
import LocalPetFollowers from './pets/PetFollowers'
import Player from './Player'
import ZoneSystem from './systems/ZoneSystem'
import World from './world/World'

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
  })
  return null
}

/** Sun whose shadow frustum follows the player, so shadows stay crisp everywhere. */
function SunLight({ shadows }) {
  const light = useRef()
  const target = useMemo(() => new Object3D(), [])
  useFrame(() => {
    const p = playerRuntime.position
    if (!light.current) return
    light.current.position.set(p.x + 22, p.y + 38, p.z + 16)
    target.position.set(p.x, p.y, p.z)
    target.updateMatrixWorld()
  })
  return (
    <>
      <directionalLight
        ref={light}
        castShadow={shadows}
        intensity={1.8}
        target={target}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <primitive object={target} />
    </>
  )
}

const _screen = new Vector3()

/** Projects the player to screen space each frame for the DOM floating text. */
function ScreenProjector() {
  useFrame(({ camera, size }) => {
    _screen.copy(playerRuntime.position)
    _screen.y += 1.2
    _screen.project(camera)
    const s = playerRuntime.screen
    s.visible = _screen.z < 1
    s.x = ((_screen.x + 1) / 2) * size.width
    s.y = ((1 - _screen.y) / 2) * size.height
  })
  return null
}

/**
 * Click (mouse) or tap (touch) anywhere on the 3D view to earn money.
 * Touch drags rotate the camera instead (see FollowCamera), so a touch only
 * counts as a click if it barely moved and was quick.
 */
function ClickInput() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const touches = new Map()
    const onDown = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) getGame().click(e.clientX, e.clientY)
        return
      }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
    }
    const onUp = (e) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      touches.delete(e.pointerId)
      const moved = Math.hypot(e.clientX - t.x, e.clientY - t.y)
      if (moved < 10 && performance.now() - t.t < 400) getGame().click(e.clientX, e.clientY)
    }
    const onCancel = (e) => touches.delete(e.pointerId)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [gl])
  return null
}

export function GameScene() {
  const { game: bloxityGame } = useBloxity()
  const playerBodyRef = useRef(null)
  // Portal graphics quality (when embedded) caps the game's own settings.
  const portalQuality = useBloxityStore((s) => portalMultipliers(s).quality)
  const shadows = useGame((s) => s.data.settings.shadows) && portalQuality !== 'Low'
  const quality = useGame((s) => s.data.settings.quality)
  const qualityCap = quality === 'low' || portalQuality === 'Low' ? 1 : portalQuality === 'Medium' ? 1.5 : 2
  // Never render more pixels than the screen has.
  const maxDpr = Math.max(1, Math.min(qualityCap, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  // Adaptive resolution: only when a device can't keep its frame rate do we
  // render fewer pixels - never below the screen's normal resolution (1).
  const [dprDrop, setDprDrop] = useState(0)
  const dpr = Math.max(1, maxDpr - dprDrop)
  // Paused tab (the game is open in another tab): stop rendering entirely.
  const paused = useGame((s) => s.session.paused)

  const [avatarReady, setAvatarReady] = useState(false)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => setAvatarReady(true), [])

  // Only end the loading screen once the avatar has finished assembling *and* a
  // frame has rendered with it in place.
  const endLoading = useCallback(() => {
    if (loadingEnded.current) return
    loadingEnded.current = true
    bloxityGame.loadingEnd()
    bloxityGame.gameplayStart()
  }, [bloxityGame])

  const handleFirstFrame = useCallback(() => {
    if (avatarReady) endLoading()
  }, [avatarReady, endLoading])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (avatarReady) endLoading()
  }, [avatarReady, endLoading])

  useEffect(() => {
    bloxityGame.loadingStep('Building the world…')
  }, [bloxityGame])

  return (
    <Canvas
      shadows
      frameloop={paused ? 'never' : 'always'}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 6, 16], fov: 60, near: 0.3, far: 420 }}
      onCreated={({ gl, scene, camera }) => {
        // Dev only (stripped from production builds): lets tooling read draw calls
        // and drive the game state.
        if (import.meta.env.DEV) {
          window.__three = { gl, scene, camera }
          window.__ppc = { getGame, useGame, playerRuntime, useRemotePlayers }
        }
        gl.setClearColor('#9fd8ff')
        // Neutral keeps colors saturated and true to their hex values (ACES
        // washed them out); highlights still roll off softly.
        gl.toneMapping = NeutralToneMapping
      }}
    >
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={4}
        onDecline={() => setDprDrop((d) => Math.min(d + 0.25, 1))}
        onIncline={() => setDprDrop((d) => Math.max(d - 0.25, 0))}
      />
      {/* Fog must attach to the scene itself, so it lives here at the root. */}
      <fog attach="fog" args={['#c6ecff', 90, 300]} />
      <hemisphereLight args={['#e3f3ff', '#5f8f55', 0.8]} />
      <ambientLight intensity={0.2} />
      <SunLight shadows={shadows} />

      <Suspense fallback={null}>
        <Physics gravity={[0, -18, 0]}>
          <World />
          <Player bodyRef={playerBodyRef} position={SPAWN} onAvatarReady={handleAvatarReady} />
          {/* Inside Physics: the camera raycasts against walls and the stage roof. */}
          <FollowCamera bodyRef={playerBodyRef} />
        </Physics>
        <LocalHeldCash />
        <LocalPetFollowers />
        {/* Everyone else in the lobby (visual only - no colliders). */}
        <RemotePlayers />
        <LuckyBags />
        <MoneyRain />
        <GuideArrows />
        <MoneyBurst />
        <Bursts />
      </Suspense>

      <ZoneSystem />
      <ScreenProjector />
      <ClickInput />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
    </Canvas>
  )
}

export default GameScene
