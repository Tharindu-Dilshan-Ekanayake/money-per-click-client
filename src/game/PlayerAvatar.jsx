import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, DoubleSide, MeshStandardMaterial, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  ACCESSORY_SLOTS,
  assetUrls,
  BASE_BODY_URL,
  isRealId,
  PART_SLOTS,
  skinIdOrDefault,
  skinTextureUrl,
} from '../bloxity/avatarAssets'
import { loadOBJ, loadPartGLB, loadTexture } from '../bloxity/avatarLoader'
import { useBloxity } from '../bloxity/BloxityContext'
import {
  animateRig,
  applyEmote,
  applyPart,
  applyPhysique,
  applyProportions,
  applySkin,
  attachAccessory,
  attachSlotItem,
  cheerWeight,
  collectRig,
  createFollower,
  reweightTorso,
  updateFollowers,
} from './avatarRig'
import { fx } from './core/events'
import { buffForLevel, lifetimeLevel, physiqueFor } from './core/formulas'
import { playerRuntime } from './core/runtime'
import { getGame } from './core/store'
import { DEFAULT_PROPORTIONS } from '../bloxity/store'
import { sampleClip } from './emotes'

/** How long you must stand still before a buff avatar starts flexing. */
const FLEX_IDLE_S = 2.5
const FLEX_EVERY_S = 7
const FLEX_HOLD_S = 1.6
/** Emotes blend in over ~0.1 s and out a little slower when interrupted. */
const EMOTE_BLEND_IN_S = 0.1
const EMOTE_BLEND_OUT_S = 0.15

/**
 * Keeps the avatar breathing when it is rendered outside the game (a menu preview,
 * say) with no physics body feeding it motion.
 */
const _idleMotion = { time: 0, speed: 0, grounded: true, maxSpeed: 6 }
function fallbackMotion(delta) {
  _idleMotion.time += delta
  return _idleMotion
}

/**
 * The player's own Bloxity avatar, assembled at runtime.
 *
 * `player.glb` is the base humanoid rig: six skinned meshes (head, torso, two arms,
 * two legs) sharing one skeleton. Assembly means, per equipped slot:
 *   - body parts  -> swap the matching mesh's geometry
 *   - hat / back  -> attach an OBJ to the Neck1 / Spine2 bone
 *   - skin        -> set one texture as the map on every skinned mesh
 *
 * Any slot that is unequipped or 404s leaves the base body's own part in place. The
 * whole thing re-assembles when `onAvatarChanged` / `onProportionsChanged` fire, so
 * changing cosmetics in the Bloxity portal updates the character live.
 *
 * Used for the local player (PlayerAvatar below) and for every other player in
 * the lobby (RemotePlayers), so everyone gets the same physique, funny walk and
 * emotes.
 *
 * @param {{ equipped?: object|null, proportions?: object, getLifetime: () => number,
 *           runtime: object, local?: boolean, game?: object, onReady?: () => void,
 *           targetHeight?: number, motionRef?: object }} props
 *   `getLifetime` returns lifetime levels (drives the physique) and is read every
 *   frame. `runtime` receives `handBones` and supplies `emote`. `local` enables
 *   the click/level-up reactions and loading-screen steps.
 *   `targetHeight` is the world-space height to fit the avatar into, in the game's
 *   own units. Bloxity authors the rig ~6.4 units tall with the feet at y=0, which is
 *   far bigger than a metric-scale physics capsule, so the model is measured and
 *   rescaled rather than trusted at native size.
 */
export const CharacterAvatar = forwardRef(function CharacterAvatar(
  { equipped = null, proportions = DEFAULT_PROPORTIONS, getLifetime, runtime, local = false, game = null, onReady, targetHeight = 1.8, motionRef, ...props },
  ref,
) {
  const { scene: baseScene } = useGLTF(BASE_BODY_URL)
  const [assembled, setAssembled] = useState(false)
  /** The fit-scale group; pair accessories (hands, shoes) live in it. */
  const fitGroup = useRef(null)
  const followersRef = useRef([])

  // The GLTF cache hands back one shared scene. Clone via SkeletonUtils so this
  // instance gets an independent, still-working skeleton.
  const character = useMemo(() => cloneSkeleton(baseScene), [baseScene])

  // Rig lookup tables (bones, part meshes, pristine geometries) built once per clone.
  const rig = useMemo(() => {
    const collected = collectRig(character)

    // The base body ships with an empty texture; give every skinned mesh its own
    // material instance so a skin swap here can't leak into another avatar.
    for (const mesh of collected.skinnedMeshes) {
      mesh.material = new MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
      })
    }

    if (!collected.skeleton) {
      console.warn('[bloxity] player.glb has no skeleton - avatar will not deform')
    }
    return collected
  }, [character])

  // Measured once, from the bind pose, before proportions touch the root scale.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(character)
    const size = box.getSize(new Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0) return { scale: 1, footOffset: 0 }
    const scale = targetHeight / size.y
    // The rig's feet sit at its bbox minimum; drop the group so they land on y=0
    // of the parent (which Player positions at the bottom of the capsule).
    return { scale, footOffset: -box.min.y * scale }
  }, [character, targetHeight])

  // --- Assemble equipped cosmetics --------------------------------------------
  useEffect(() => {
    let cancelled = false
    // Accessories are re-attached on every rebuild; track them so the previous
    // hat/back can be removed rather than stacking up.
    const attached = []

    game?.loadingStep?.('Loading avatar…')

    const jobs = []

    // Skin always loads - "0" is the fallback, since the base body has no baked map.
    // The composed URL has the worn face, shirt and pants drawn on; if that
    // endpoint fails, fall back to the bare skin rather than a blank body.
    const bareSkin = assetUrls.skinTexture(skinIdOrDefault(equipped?.skinId))
    const dressedSkin = skinTextureUrl(equipped)
    jobs.push(
      loadTexture(dressedSkin)
        .then((texture) => texture || (dressedSkin !== bareSkin ? loadTexture(bareSkin) : null))
        .then((texture) => ({ kind: 'skin', texture })),
    )

    // Body parts: fetch only real ids; a missing slot resets to the base geometry.
    for (const [slot, cfg] of Object.entries(PART_SLOTS)) {
      const id = equipped?.[cfg.idKey]
      if (!isRealId(id)) {
        jobs.push(Promise.resolve({ kind: 'part', slot, scene: null }))
        continue
      }
      jobs.push(
        loadPartGLB(assetUrls.part(slot, id)).then((scene) => ({
          kind: 'part',
          slot,
          scene,
        })),
      )
    }

    // Accessories.
    for (const [kind, idKey, meshUrl, texUrl] of [
      ['hat', 'hatId', assetUrls.hatMesh, assetUrls.hatTexture],
      ['back', 'backId', assetUrls.backMesh, assetUrls.backTexture],
    ]) {
      const id = equipped?.[idKey]
      if (!isRealId(id)) continue
      jobs.push(
        Promise.all([loadOBJ(meshUrl(id)), loadTexture(texUrl(id))]).then(
          ([object, texture]) => ({ kind: 'accessory', accessory: kind, object, texture }),
        ),
      )
    }

    // Hair, masks and accessories (neck/chest/waist on bones; hands/shoes as pairs).
    for (const slot of ACCESSORY_SLOTS) {
      const id = equipped?.[slot.idKey]
      if (!isRealId(id)) continue
      jobs.push(
        Promise.all([loadOBJ(assetUrls.itemMesh(slot.dir, id)), loadTexture(assetUrls.itemTexture(slot.dir, id))]).then(
          ([object, texture]) => ({ kind: 'slot', slot, object, texture }),
        ),
      )
    }
    const followers = []

    Promise.all(jobs)
      .then((results) => {
        if (cancelled) return

        for (const result of results) {
          // One bad slot must not take the rest of the character down.
          try {
            if (result.kind === 'skin') {
              applySkin(rig, result.texture)
            } else if (result.kind === 'part') {
              applyPart(rig, result.slot, result.scene)
            } else if (result.kind === 'accessory' && result.object) {
              if (result.texture) {
                result.object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new MeshStandardMaterial({ map: result.texture })
                  }
                })
              }
              const added = attachAccessory(rig, result.accessory, result.object)
              if (added) attached.push(added)
            } else if (result.kind === 'slot' && result.object) {
              const { slot, object, texture } = result
              // Pair items are mirrored, which flips winding: render both sides.
              object.traverse((child) => {
                if (child.isMesh) {
                  child.material = new MeshStandardMaterial({
                    map: texture || null,
                    side: slot.inheritScale ? undefined : DoubleSide,
                  })
                  child.castShadow = true
                }
              })
              if (slot.inheritScale) {
                const added = attachSlotItem(rig, slot, object)
                if (added) attached.push(added)
              } else if (fitGroup.current) {
                const pair = [
                  [slot.bone, object, false],
                  [slot.mirrorBone, object.clone(true), true],
                ]
                for (const [bone, item, mirror] of pair) {
                  const follower = createFollower(rig, bone, item, slot.origin, mirror)
                  if (!follower) continue
                  fitGroup.current.add(item)
                  attached.push(item)
                  followers.push(follower)
                }
              }
            }
          } catch (err) {
            console.warn(`[bloxity] failed to apply ${result.kind}`, err)
          }
        }

        // The torso box needs a second bone for the chest to widen on its own
        // (bodybuilder V-taper). Re-done after every assembly because an equipped
        // torso part swaps the geometry.
        try {
          reweightTorso(rig)
        } catch (err) {
          console.warn('[ppc] torso reweight failed; physique will be uniform', err)
        }
        followersRef.current = followers

        setAssembled(true)
      })
      .catch((err) => {
        console.warn('[bloxity] avatar assembly failed; showing base body', err)
        if (!cancelled) setAssembled(true)
      })

    return () => {
      cancelled = true
      followersRef.current = []
      for (const object of attached) {
        object.parent?.remove(object)
        object.traverse((child) => child.geometry?.dispose())
      }
    }
  }, [rig, equipped, game])

  // --- Proportions -------------------------------------------------------------
  // Applied per frame rather than in an effect: every bone is reset to its rest pose
  // and re-scaled each pass, which keeps it idempotent and survives anything else
  // that touches the skeleton.
  const proportionsRef = useRef(proportions)
  proportionsRef.current = proportions

  // --- Physique + action overlays ------------------------------------------------
  // `buff` eases toward the level's target so leveling up visibly *grows* the body;
  // a level-up adds a temporary "pump" on top that settles back down.
  const anim = useRef({
    buff: null,
    pump: 0,
    click: 0,
    idleTime: 0,
    flexClock: 0,
    flex: 0,
    forceFlex: 0,
    /** Last remote click we animated (see runtime.clickAt). */
    seenClickAt: 0,
  })

  // The held cash and click bursts follow the right hand.
  useEffect(() => {
    const elbow = rig.bones.ArmR2?.bone
    const tip = rig.bones.ArmR2_leaf?.bone
    if (!elbow || !tip) return undefined
    runtime.handBones = { elbow, tip }
    return () => {
      if (runtime.handBones?.elbow === elbow) runtime.handBones = null
    }
  }, [rig, runtime])

  useEffect(() => {
    if (!local) return undefined
    const offClick = fx.on('click', () => {
      anim.current.click = 1
    })
    const offLevel = fx.on('levelUp', ({ titleChanged }) => {
      anim.current.pump = titleChanged ? 0.14 : 0.07
      if (titleChanged) anim.current.forceFlex = FLEX_HOLD_S + 0.4
    })
    // Big moments: throw both arms up and celebrate.
    const cheer = (delayMs = 0) => {
      runtime.cheerAt = performance.now() + delayMs
    }
    const offWin = fx.on('win', () => cheer(250))
    const offRebirth = fx.on('rebirth', () => cheer(400))
    const offGate = fx.on('gateOpen', () => cheer())
    const offBag = fx.on('luckyBag', () => cheer())
    return () => {
      offClick()
      offLevel()
      offWin()
      offRebirth()
      offGate()
      offBag()
    }
  }, [local, runtime])

  useFrame((_state, delta) => {
    try {
      const a = anim.current
      const motion = motionRef?.current ?? fallbackMotion(delta)
      const dt = Math.min(delta, 0.1)

      // Lifetime levels: rebirth resets your level, never your muscles.
      const target = buffForLevel(getLifetime())
      if (a.buff === null) a.buff = target
      a.buff += (target - a.buff) * Math.min(1, dt * 2.5)
      a.pump = Math.max(0, a.pump - dt * 0.12)
      // Another player's click (local clicks set a.click straight from the event).
      if (runtime.clickAt && runtime.clickAt !== a.seenClickAt) {
        a.seenClickAt = runtime.clickAt
        a.click = 1
      }
      a.click = Math.max(0, a.click - dt * 7)

      // Flex: idle bodybuilders show off now and then; a new title always flexes.
      const idle = motion.speed < 0.15 && motion.grounded
      a.idleTime = idle ? a.idleTime + dt : 0
      a.forceFlex = Math.max(0, a.forceFlex - dt)
      let flexTarget = a.forceFlex > 0 ? 1 : 0
      if (idle && a.buff > 0.45 && a.idleTime > FLEX_IDLE_S) {
        a.flexClock += dt
        if (a.flexClock % FLEX_EVERY_S < FLEX_HOLD_S) flexTarget = 1
      } else {
        a.flexClock = 0
      }
      if (!idle && a.forceFlex <= 0) flexTarget = 0
      a.flex += (flexTarget - a.flex) * Math.min(1, dt * 8)

      const phys = physiqueFor(Math.min(1, a.buff + a.pump))
      const base = proportionsRef.current
      // Order matters: proportions reset every bone to its rest pose, physique
      // scales on top, and the animation then rotates on that clean base.
      applyProportions(rig, {
        ...base,
        height: (base.height ?? 1) * phys.height,
        headScale: (base.headScale ?? 1) * phys.headScale,
      })
      applyPhysique(rig, phys)
      animateRig(rig, motion, {
        buff: phys.buff,
        slouch: phys.slouch,
        headTilt: phys.headTilt,
        armSpread: phys.armSpread,
        click: Math.sin(a.click * Math.PI) * (a.click > 0 ? 1 : 0),
        flex: a.flex,
        cheer: cheerWeight(runtime.cheerAt),
      })

      // Boxity emote: blends over the pose; moving or jumping cancels it.
      const emote = runtime.emote
      if (emote) {
        if (motion.speed > 0.5 || !motion.grounded) emote.stopping = true
        const sample = sampleClip(emote.clip, (performance.now() - emote.startedAt) / 1000)
        if (sample.done) emote.stopping = true
        emote.weight = Math.min(
          1,
          Math.max(0, emote.weight + (emote.stopping ? -dt / EMOTE_BLEND_OUT_S : dt / EMOTE_BLEND_IN_S)),
        )
        applyEmote(rig, sample.values, emote.weight)
        if (emote.stopping && emote.weight <= 0) runtime.emote = null
      }

      // Gloves and shoes follow their bones (position + rotation), sized to the
      // physique so a bodybuilder's gloves fit his arms.
      updateFollowers(followersRef.current, fitGroup.current, (f) =>
        f.boneName.startsWith('Arm') ? phys.armW * phys.foreArm : phys.legThick,
      )
    } catch {
      // A malformed payload must not kill the render loop.
    }
  })

  // Signal readiness only once the model is actually standing there.
  useEffect(() => {
    if (assembled) onReady?.()
  }, [assembled, onReady])

  return (
    <group ref={ref} {...props}>
      {/* Fit scale lives on this wrapper, not on `character` - applyProportions
          overwrites the character's own scale every frame. */}
      <group ref={fitGroup} scale={fit.scale} position={[0, fit.footOffset, 0]}>
        <primitive object={character} />
      </group>
    </group>
  )
})

const localLifetime = () => lifetimeLevel(getGame().data)

/** The local player's avatar: Bloxity cosmetics + this save's progress. */
export const PlayerAvatar = forwardRef(function PlayerAvatar(props, ref) {
  const { avatar: equipped, proportions, game } = useBloxity()
  return (
    <CharacterAvatar
      ref={ref}
      equipped={equipped}
      proportions={proportions}
      game={game}
      getLifetime={localLifetime}
      runtime={playerRuntime}
      local
      {...props}
    />
  )
})

useGLTF.preload(BASE_BODY_URL)

export default PlayerAvatar
