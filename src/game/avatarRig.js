import { Euler, Matrix4, NearestFilter, Quaternion, Vector3 } from 'three'

import { BACK_BONE, HAT_BONE, NECK_OFFSET_BONE, PART_SLOTS } from '../bloxity/avatarAssets'

/**
 * Rig manipulation for the base `player.glb` character.
 *
 * The rig's real structure (confirmed by reading player.glb directly):
 *   character
 *     - default_arm_L / default_arm_R / default_head
 *     - default_leg_L / default_leg_R / default_torso   (6 SkinnedMeshes, 1 skeleton)
 *     - Rig1
 *         - Spine1 > Spine2 > { ArmL_Offset > ArmL1 > ArmL2,
 *                               ArmR_Offset > ArmR1 > ArmR2,
 *                               Neck_Offset > Neck1 }
 *         - LegL_Offset > LegL1 > LegL2, LegR_Offset > LegR1 > LegR2
 *
 * Two consequences drive everything below:
 *  1. Body parts are NOT attached to bones. Each is a separate SkinnedMesh sharing one
 *     skeleton, so equipping a part means swapping that mesh's geometry (remapping
 *     skin indices into the base skeleton's bone order first).
 *  2. Accessories DO attach to bones: hats to `Neck1`, back items to `Spine2`.
 *
 * player.glb ships no animation clips, so the character is posed, not animated.
 */

/**
 * Walks the loaded rig and collects everything later operations need.
 *
 * @param {import('three').Object3D} root
 */
export function collectRig(root) {
  const rig = {
    root,
    skeleton: null,
    /** slot -> SkinnedMesh */
    partMeshes: {},
    /** slot -> the pristine geometry to restore on unequip */
    originalGeometries: {},
    /** bone name -> { bone, origPos, origQuat, origScale } */
    bones: {},
    hatBone: null,
    backBone: null,
    neckOffsetBindY: 0,
    skinnedMeshes: [],
    /** Rest Y of the character root, so the run-cycle bob can return to it. */
    rootRestY: root.position.y,
    /**
     * bone name -> inverse of the bone's rest transform in model space, captured
     * before any proportions/animation. Accessories hang off these. (Not
     * skeleton.boneInverses: the leaf bones' inverse binds are 90deg off rest.)
     */
    restInverse: {},
  }

  const meshBySlot = new Map(
    Object.entries(PART_SLOTS).map(([slot, cfg]) => [cfg.mesh.toLowerCase(), slot]),
  )

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.castShadow = true
      node.receiveShadow = true
      rig.skinnedMeshes.push(node)
      if (!rig.skeleton) rig.skeleton = node.skeleton

      const slot = meshBySlot.get((node.name || '').toLowerCase())
      if (slot) {
        rig.partMeshes[slot] = node
        rig.originalGeometries[slot] = node.geometry.clone()
      }
    } else if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })

  const skeleton = rig.skeleton
  if (skeleton) {
    for (const bone of skeleton.bones) {
      // Proportions are re-applied every frame from these rest values.
      bone.matrixAutoUpdate = true
      rig.bones[bone.name] = {
        bone,
        origPos: bone.position.clone(),
        origQuat: bone.quaternion.clone(),
        origScale: bone.scale.clone(),
      }
    }

    // Bone local axes are NOT world-aligned in this rig: a limb bone's local X
    // points along world -Z and its local Z along world -X, so rotating a leg about
    // its local X swings it sideways instead of forward/back. The offsets differ per
    // bone (Spine1 is identity, ArmL2 is off by ~14 degrees), so rather than hardcode
    // an axis, record for each bone the local-space axis matching each character-space
    // axis and animate about those.
    root.updateMatrixWorld(true)
    const rootInverse = root.matrixWorld.clone().invert()
    for (const bone of skeleton.bones) {
      rig.restInverse[bone.name] = rootInverse.clone().multiply(bone.matrixWorld).invert()
    }

    const rootQuat = new Quaternion()
    root.getWorldQuaternion(rootQuat)
    const rootQuatInv = rootQuat.invert()
    const boneWorld = new Quaternion()

    for (const bone of skeleton.bones) {
      const entry = rig.bones[bone.name]
      if (!entry) continue
      bone.getWorldQuaternion(boneWorld)
      // Bone orientation relative to the character, then inverted: this maps a
      // character-space axis into the bone's own local frame.
      const relInv = rootQuatInv.clone().multiply(boneWorld).invert()
      /** Local axis to rotate about for forward/back swing. */
      entry.axisX = new Vector3(1, 0, 0).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for lateral sway. */
      entry.axisZ = new Vector3(0, 0, 1).applyQuaternion(relInv).normalize()
      /** Character up, in the bone's frame. Used to scale in character space. */
      entry.axisY = new Vector3(0, 1, 0).applyQuaternion(relInv).normalize()
    }

    rig.hatBone = skeleton.bones.find((b) => b.name === HAT_BONE) || null
    rig.backBone = skeleton.bones.find((b) => b.name === BACK_BONE) || null

    const neckIndex = skeleton.bones.findIndex((b) => b.name === NECK_OFFSET_BONE)
    if (neckIndex >= 0) {
      // elements[13] is the Y translation of the inverted bind matrix.
      rig.neckOffsetBindY = skeleton.boneInverses[neckIndex].clone().invert().elements[13]
    }
  }

  return rig
}

/** Bloxity textures are authored unflipped and pixel-art filtered. */
export function configureAvatarTexture(texture) {
  if (!texture) return texture
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Applies the skin texture to every skinned mesh of the base body.
 * The base body ships with an empty texture, so this always runs - with skin "0"
 * standing in when nothing is equipped.
 */
export function applySkin(rig, texture) {
  if (!texture) return
  for (const mesh of rig.skinnedMeshes) {
    if (!mesh.material) continue
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }
}

/**
 * Swaps a body part's geometry onto its base skinned mesh.
 *
 * A part GLB carries its own skeleton whose bone *order* may differ from the base
 * rig's. Its `skinIndex` attribute therefore has to be remapped by bone name, or the
 * limb deforms against the wrong bones.
 *
 * @param {object} rig from `collectRig`
 * @param {string} slot key of PART_SLOTS
 * @param {import('three').Object3D|null} partScene loaded GLB scene, or null to reset
 */
export function applyPart(rig, slot, partScene) {
  const targetMesh = rig.partMeshes[slot]
  if (!targetMesh) return

  // Unequipped / failed download: restore the part baked into player.glb.
  if (!partScene) {
    const original = rig.originalGeometries[slot]
    if (original && targetMesh.geometry !== original) targetMesh.geometry = original
    return
  }

  let skinnedSource = null
  let plainSource = null
  partScene.traverse((node) => {
    if (node.isSkinnedMesh && !skinnedSource) skinnedSource = node
    else if (node.isMesh && !plainSource) plainSource = node
  })

  if (!skinnedSource) {
    // Some parts ship as plain meshes; use them as-is.
    if (plainSource) targetMesh.geometry = plainSource.geometry
    return
  }

  const baseSkeleton = rig.skeleton
  if (!baseSkeleton || !skinnedSource.skeleton) {
    targetMesh.geometry = skinnedSource.geometry
    return
  }

  const geometry = skinnedSource.geometry.clone()

  const baseIndexByName = new Map()
  baseSkeleton.bones.forEach((bone, i) => baseIndexByName.set(bone.name, i))

  const remap = new Map()
  skinnedSource.skeleton.bones.forEach((bone, i) => {
    const baseIndex = baseIndexByName.get(bone.name)
    if (baseIndex !== undefined) remap.set(i, baseIndex)
  })

  const skinIndex = geometry.getAttribute('skinIndex')
  if (skinIndex) {
    const array = skinIndex.array
    for (let i = 0; i < array.length; i += 1) {
      const mapped = remap.get(array[i])
      if (mapped !== undefined) array[i] = mapped
    }
    skinIndex.needsUpdate = true
  }

  targetMesh.geometry = geometry
}

/**
 * Attaches a hat or back accessory to its bone.
 * Offsets are the SDK's own: hats sit at y=0.8 on `Neck1`, back items at the origin
 * of `Spine2`.
 */
export function attachAccessory(rig, kind, object) {
  const bone = kind === 'hat' ? rig.hatBone : rig.backBone
  if (!object || !bone) return null

  object.scale.setScalar(1)
  object.position.set(0, kind === 'hat' ? 0.8 : 0, 0)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })

  bone.add(object)
  return object
}

/**
 * Applies Bloxity body proportions.
 *
 * Must run every frame: each bone is reset to its rest transform before the
 * multipliers are re-applied, which is what makes the result idempotent and lets
 * proportion changes take effect live.
 *
 * `height`, `armLength`, `headScale` and `neckHeight` are applied exactly as the
 * Bloxity portal does, so the in-game body matches the preview. The remaining three
 * (`shoulderWidth`, `torsoScaleX`, `legOffsetX`) are not implemented in the SDK's
 * preview renderer; they are applied here in the spirit of their names and are the
 * ones to sanity-check against the portal.
 */
export function applyProportions(rig, proportions) {
  const skeleton = rig.skeleton
  if (!skeleton || !proportions) return

  const height = proportions.height ?? 1
  const armLength = proportions.armLength ?? 1
  const headScale = proportions.headScale ?? 1
  const neckHeight = proportions.neckHeight ?? 1
  const shoulderWidth = proportions.shoulderWidth ?? 1
  const torsoScaleX = proportions.torsoScaleX ?? 1
  const legOffsetX = proportions.legOffsetX ?? 1

  // Overall height is a scale on the character root, not on a bone.
  rig.root.scale.set(1, height, 1)

  for (const bone of skeleton.bones) {
    const rest = rig.bones[bone.name]
    if (!rest) continue

    const { origScale, origPos, origQuat } = rest
    bone.position.copy(origPos)
    bone.quaternion.copy(origQuat)
    bone.scale.copy(origScale)

    const name = bone.name

    if (name.startsWith('Arm')) {
      bone.scale.y = origScale.y * armLength
      // Not in the SDK preview: widen the shoulders by pushing the arm roots out.
      if (name === 'ArmL_Offset' || name === 'ArmR_Offset') {
        bone.position.x = origPos.x * shoulderWidth
      }
    } else if (name === NECK_OFFSET_BONE) {
      // Keeps the head sitting on the neck as height/headScale change, then applies
      // neckHeight against the bind-pose offset.
      bone.position.y += (height - headScale) * origPos.y
      bone.position.y += rig.neckOffsetBindY * (neckHeight - 1) * 0.8
    } else if (name === HAT_BONE) {
      // Divided by height so the head stays uniform inside the stretched root.
      bone.scale.set(
        origScale.x * headScale,
        origScale.y * (headScale / height),
        origScale.z * headScale,
      )
    } else if (name === BACK_BONE) {
      // Not in the SDK preview: torso width.
      bone.scale.x = origScale.x * torsoScaleX
    } else if (name === 'LegL_Offset' || name === 'LegR_Offset') {
      // Not in the SDK preview: leg splay, mirrored about the rig centre.
      bone.position.x = origPos.x * legOffsetX
    }
  }
}

/* ---------------------------------------------------------------------------
 * Extra cosmetic slots (hair, mask, neck, chest, waist, hands, shoes)
 * Placement follows the Boxity SDK spec: local = restInverse(bone) * translate(origin).
 * ------------------------------------------------------------------------- */

const _slotMatrix = new Matrix4()
const _parentInverse = new Matrix4()
const _followPos = new Vector3()
const _followQuat = new Quaternion()
const _followScale = new Vector3()

/** Hangs an item under its bone; it inherits the bone's scale (hair, neck...). */
export function attachSlotItem(rig, slot, object) {
  const entry = rig.bones[slot.bone]
  const restInverse = rig.restInverse?.[slot.bone]
  if (!entry || !restInverse || !object) return null
  _slotMatrix.copy(restInverse).multiply(new Matrix4().makeTranslation(...slot.origin))
  _slotMatrix.decompose(object.position, object.quaternion, object.scale)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })
  entry.bone.add(object)
  return object
}

/**
 * A pair item half (hands, shoes): follows a bone's position and rotation but
 * not its scale. Add `object` to the avatar's container and call
 * updateFollowers() every frame after animating.
 */
export function createFollower(rig, boneName, object, origin, mirror = false) {
  const entry = rig.bones[boneName]
  const restInverse = rig.restInverse?.[boneName]
  if (!entry || !restInverse || !object) return null
  const local = restInverse.clone()
  if (mirror) local.multiply(new Matrix4().makeScale(-1, 1, 1))
  local.multiply(new Matrix4().makeTranslation(...origin))
  object.matrixAutoUpdate = false
  return { bone: entry.bone, boneName, object, local }
}

/**
 * Re-places followers in `container` space (the avatar's fit-scale group).
 * `scaleFor(follower)` may return a uniform scale (e.g. bulkier gloves on
 * bodybuilder arms); default 1.
 */
export function updateFollowers(followers, container, scaleFor) {
  if (!followers.length || !container) return
  container.updateWorldMatrix(true, false)
  _parentInverse.copy(container.matrixWorld).invert()
  for (const f of followers) {
    f.bone.updateWorldMatrix(true, false)
    _slotMatrix.multiplyMatrices(_parentInverse, f.bone.matrixWorld).decompose(_followPos, _followQuat, _followScale)
    _followScale.setScalar(scaleFor ? scaleFor(f) : 1)
    f.object.matrix.compose(_followPos, _followQuat, _followScale).multiply(f.local)
    f.object.matrixWorldNeedsUpdate = true
  }
}

/* ---------------------------------------------------------------------------
 * Emotes (Boxity catalogue clips)
 * ------------------------------------------------------------------------- */

const _emoteEuler = new Euler()
const _emoteDelta = new Quaternion()
const _emoteTarget = new Quaternion()
const DEG = Math.PI / 180

/**
 * Blends sampled emote rotations over the current pose. `values` maps bone
 * name -> [xDeg, yDeg, zDeg]: deltas over the bind pose, euler XYZ,
 * right-multiplied onto the bind quaternion. Unknown bones are ignored.
 */
export function applyEmote(rig, values, weight) {
  if (!rig?.skeleton || weight <= 0) return
  for (const [name, [x, y, z]] of Object.entries(values)) {
    const entry = rig.bones[name]
    if (!entry) continue
    _emoteEuler.set(x * DEG, y * DEG, z * DEG, 'XYZ')
    _emoteDelta.setFromEuler(_emoteEuler)
    _emoteTarget.copy(entry.origQuat).multiply(_emoteDelta)
    entry.bone.quaternion.slerp(_emoteTarget, Math.min(1, weight))
  }
}

/* ---------------------------------------------------------------------------
 * Physique: skinny brokie -> bodybuilder
 *
 * Torso bone scales are written in *character* space (x = shoulder-to-shoulder,
 * z = chest-to-back) and converted into each bone's own frame. Limb thickness
 * is done on the meshes instead (applyLimbThickness), so bending never distorts.
 * ------------------------------------------------------------------------- */

const _localScale = new Vector3()

/**
 * Multiplies a character-space scale onto a bone. For a bone whose rotation
 * relative to the character is R, the same linear map in its own frame is
 * R^-1 S R; its diagonal is exact for axis-aligned bones (all of player.glb's,
 * up to the forearm roll, which doesn't matter for equal x/z scales).
 */
function scaleInCharSpace(entry, sx, sy, sz) {
  if (!entry?.axisX || !entry.axisY || !entry.axisZ) return
  const { axisX: ax, axisY: ay, axisZ: az } = entry
  _localScale.set(
    sx * ax.x * ax.x + sy * ay.x * ay.x + sz * az.x * az.x,
    sx * ax.y * ax.y + sy * ay.y * ay.y + sz * az.y * az.y,
    sx * ax.z * ax.z + sy * ay.z * ay.z + sz * az.z * az.z,
  )
  entry.bone.scale.multiply(_localScale)
}

/**
 * player.glb's torso is a single box skinned 100% to Spine1, so it can only
 * scale uniformly. Moving the vertices above Spine2 onto Spine2 lets the chest
 * widen independently of the waist - the V-taper of a bodybuilder.
 *
 * Must run after every assembly (an equipped torso part replaces the geometry).
 * Works on a clone so the cached GLB geometry is never mutated.
 */
export function reweightTorso(rig) {
  const mesh = rig?.partMeshes?.torso
  const skeleton = rig?.skeleton
  if (!mesh || !skeleton || mesh.geometry.userData.ppcReweighted) return

  const spine1 = skeleton.bones.findIndex((b) => b.name === 'Spine1')
  const spine2 = skeleton.bones.findIndex((b) => b.name === 'Spine2')
  if (spine1 < 0 || spine2 < 0) return

  const geometry = mesh.geometry.clone()
  const position = geometry.getAttribute('position')
  const skinIndex = geometry.getAttribute('skinIndex')
  const skinWeight = geometry.getAttribute('skinWeight')
  if (!position || !skinIndex || !skinWeight) return

  // Bind-pose height of Spine2: translation of the inverted inverse-bind matrix.
  const spine2Y = skeleton.boneInverses[spine2].clone().invert().elements[13]

  let moved = 0
  for (let i = 0; i < position.count; i += 1) {
    if (position.getY(i) <= spine2Y) continue
    // Only claim vertices that were fully Spine1's; leave custom weights alone.
    let owned = false
    for (let c = 0; c < 4; c += 1) {
      if (skinIndex.getComponent(i, c) === spine1 && skinWeight.getComponent(i, c) > 0.99) {
        owned = true
      }
    }
    if (!owned) continue
    skinIndex.setXYZW(i, spine2, 0, 0, 0)
    skinWeight.setXYZW(i, 1, 0, 0, 0)
    moved += 1
  }

  geometry.userData.ppcReweighted = true
  if (moved > 0) {
    skinIndex.needsUpdate = true
    skinWeight.needsUpdate = true
  }
  mesh.geometry = geometry
}

/**
 * Applies a physique from `physiqueFor()` (core/formulas.js). Multiplies onto
 * the transforms applyProportions() just wrote, so call it right after that
 * and before animateRig().
 */
export function applyPhysique(rig, p) {
  if (!rig?.skeleton || !p) return
  const b = rig.bones

  // Torso: Spine1 sets the waist; Spine2 (upper torso, see reweightTorso) adds
  // the extra chest width on top.
  scaleInCharSpace(b.Spine1, p.waistW, 1, p.waistD)
  scaleInCharSpace(b.Spine2, p.chestW / p.waistW, 1, p.chestD / p.waistD)

  // The head inherits the chest scale; cancel it so it stays a cube. (Neck_Offset
  // and Neck1 rotate -/+90deg about X and cancel out, so Neck1 is char-aligned.)
  scaleInCharSpace(b.Neck1, 1 / p.chestW, 1, 1 / p.chestD)

  for (const side of ['L', 'R']) {
    // Arms: drop the inherited torso scale (the shoulder *joint* still moves out
    // with the chest). Limb bones themselves stay unscaled - see applyLimbThickness.
    scaleInCharSpace(b[`Arm${side}_Offset`], 1 / p.chestW, 1, 1 / p.chestD)
    const leg = b[`Leg${side}_Offset`]
    if (leg) leg.bone.position.x *= p.hipSpread
  }
  applyLimbThickness(rig, p)
}

/* ---------------------------------------------------------------------------
 * Limb thickness
 *
 * Arms and legs are made thin or thick by moving their mesh vertices toward or
 * away from each segment's bone axis (in bind pose), NOT by scaling the bones:
 * a non-uniformly scaled bone squashes any child that bends inside it, so a
 * skinny arm's forearm used to shrink to half its length when the elbow bent.
 * Each limb mesh is two box segments (upper/lower) skinned to two bones.
 * ------------------------------------------------------------------------- */

const LIMBS = {
  arm_L: { bones: ['ArmL1', 'ArmL2'], arm: true },
  arm_R: { bones: ['ArmR1', 'ArmR2'], arm: true },
  leg_L: { bones: ['LegL1', 'LegL2'], arm: false },
  leg_R: { bones: ['LegR1', 'LegR2'], arm: false },
}
const _bind = new Matrix4()

/** Gives `slot`'s mesh its own geometry copy plus what thinning needs (once per geometry). */
function prepareLimb(rig, slot) {
  const mesh = rig.partMeshes[slot]
  const skeleton = rig.skeleton
  if (!mesh || !skeleton) return null
  const tagged = mesh.geometry.userData.ppcLimb
  if (tagged && tagged.owner === mesh) return tagged

  // Never edit the shared (GLTF-cached / cloned) geometry: work on our own copy.
  const geometry = mesh.geometry.clone()
  const position = geometry.getAttribute('position')
  const skinIndex = geometry.getAttribute('skinIndex')
  const skinWeight = geometry.getAttribute('skinWeight')
  if (!position || !skinIndex || !skinWeight) return null
  const boneIndex = LIMBS[slot].bones.map((name) => skeleton.bones.findIndex((bone) => bone.name === name))
  // Each segment thins around its bone's bind-pose joint (x, z): limbs hang straight down.
  const cx = [0, 0]
  const cz = [0, 0]
  boneIndex.forEach((index, segment) => {
    if (index < 0) return
    _bind.copy(skeleton.boneInverses[index]).invert()
    cx[segment] = _bind.elements[12]
    cz[segment] = _bind.elements[14]
  })
  const segments = new Uint8Array(position.count)
  for (let i = 0; i < position.count; i += 1) {
    let best = -1
    let bestWeight = 0
    for (let c = 0; c < 4; c += 1) {
      const w = skinWeight.getComponent(i, c)
      if (w > bestWeight) {
        bestWeight = w
        best = skinIndex.getComponent(i, c)
      }
    }
    segments[i] = best === boneIndex[1] ? 1 : 0
  }
  const info = { owner: mesh, base: Float32Array.from(position.array), segments, cx, cz, arm: LIMBS[slot].arm, key: '' }
  geometry.userData = { ...geometry.userData, ppcLimb: info }
  mesh.geometry = geometry
  return info
}

/** Arm/leg thickness from a physique (cheap: only re-runs when the numbers change). */
export function applyLimbThickness(rig, p) {
  for (const slot of Object.keys(LIMBS)) {
    const info = prepareLimb(rig, slot)
    if (!info) continue
    const upper = info.arm ? [p.armW, p.armD] : [p.legThick, p.legThick]
    const lower = info.arm ? [p.armW * p.foreArm, p.armD * p.foreArm] : upper
    const key = `${upper[0].toFixed(4)}|${upper[1].toFixed(4)}|${lower[0].toFixed(4)}|${lower[1].toFixed(4)}`
    if (info.key === key) continue
    info.key = key
    const position = info.owner.geometry.getAttribute('position')
    const out = position.array
    const { base, segments, cx, cz } = info
    for (let i = 0; i < position.count; i += 1) {
      const s = segments[i]
      const [sx, sz] = s ? lower : upper
      out[i * 3] = cx[s] + (base[i * 3] - cx[s]) * sx
      out[i * 3 + 1] = base[i * 3 + 1]
      out[i * 3 + 2] = cz[s] + (base[i * 3 + 2] - cz[s]) * sz
    }
    position.needsUpdate = true
  }
}

/* ---------------------------------------------------------------------------
 * Procedural animation
 *
 * player.glb ships zero animation clips, so a walk/run/jump cycle has to be
 * driven directly on the bones. Rotations are *multiplied onto* whatever
 * applyProportions() just wrote, so this must run immediately after it in the
 * same frame - proportions reset each bone to its rest pose, which is exactly
 * the clean base a pose needs.
 * ------------------------------------------------------------------------- */

const _animQ = new Quaternion()

/**
 * Rotates a bone about one of its precomputed character-space axes.
 * `which` is 'axisX' (forward/back swing) or 'axisZ' (lateral sway).
 */
function rotateBone(rig, name, which, angle) {
  if (!angle) return
  const entry = rig.bones[name]
  const axis = entry?.[which]
  if (!axis) return
  entry.bone.quaternion.multiply(_animQ.setFromAxisAngle(axis, angle))
}

/**
 * Swing a limb forward/back - the plane a walk cycle actually moves in.
 * Swing rotates about the character's X axis: negative swings a hanging limb
 * forward (and bends an elbow), positive tips the spine/head forward.
 */
const swing = (rig, name, angle) => rotateBone(rig, name, 'axisX', angle)
/** Sway a limb out to the side. Left side: positive = outward; right: negative. */
const sway = (rig, name, angle) => rotateBone(rig, name, 'axisZ', angle)
/** Twist about the character's vertical axis (shoulder/hip turn). */
const twist = (rig, name, angle) => rotateBone(rig, name, 'axisY', angle)

/** Beats per second of the background music (sfx.js MUSIC.bpm = 116). */
const MUSIC_BEAT_HZ = 116 / 60

/** How long a cheer lasts, in seconds. */
const CHEER_SECONDS = 1.6

/** 0..1 weight of a cheer that started at `startedAt` (performance.now() ms). */
export function cheerWeight(startedAt, now = performance.now()) {
  const t = (now - startedAt) / 1000
  if (!(t >= 0 && t < CHEER_SECONDS)) return 0
  return Math.min(1, t / 0.15) * Math.min(1, (CHEER_SECONDS - t) / 0.3)
}

/**
 * Poses the rig for the current motion state.
 *
 * @param {object} rig from `collectRig`
 * @param {{ time: number, speed: number, grounded: boolean, maxSpeed: number }} motion
 *   `speed` is horizontal speed in world units/sec; `maxSpeed` is what counts as a
 *   full-amplitude run, so the cycle scales smoothly from a walk to a sprint.
 * @param {{ slouch?: number, headTilt?: number, armSpread?: number, click?: number,
 *           flex?: number, buff?: number, hold?: number, cheer?: number } | null} [pose]
 *   Optional overlays: physique posture, a 0..1 "throw money" click pulse on the
 *   right arm, a 0..1 double-biceps flex, `hold` (default 1): the right hand
 *   raised by the shoulder showing off the cash, and a 0..1 `cheer` (arms up,
 *   hopping).
 */
export function animateRig(rig, motion, pose = null) {
  if (!rig?.skeleton || !motion) return

  const { time = 0, speed = 0, grounded = true, maxSpeed = 6 } = motion
  const ratio = Math.min(speed / Math.max(maxSpeed, 0.001), 1)
  const buff = pose?.buff ?? 0.4
  // The right arm holds the cash: it swings much less than the free left arm.
  const hold = pose ? (pose.hold ?? 1) : 0
  const rightArm = 1 - 0.75 * hold

  rig.root.position.y = rig.rootRestY

  if (!grounded) {
    // --- Airborne: arms up and waving, legs bicycle-kicking -----------------
    const w = Math.sin(time * 18)
    swing(rig, 'LegL1', -0.5 + w * 0.55)
    swing(rig, 'LegR1', -0.5 - w * 0.55)
    swing(rig, 'LegL2', 0.9)
    swing(rig, 'LegR2', 0.9)
    swing(rig, 'ArmL1', -2.2)
    swing(rig, 'ArmR1', -2.2 * rightArm)
    sway(rig, 'ArmL1', 0.35 + w * 0.3)
    sway(rig, 'ArmR1', (-0.35 + w * 0.3) * rightArm)
    swing(rig, 'Spine1', -0.12)
    sway(rig, 'Neck1', w * 0.12)
  } else if (ratio < 0.04) {
    // --- Standing still: a proud, upright stance, grooving to the music -------
    // Feet apart (wider for bodybuilders), a small head bob on every beat and a
    // shoulder shimmy every two beats. Chin up - never staring at the floor.
    const beatPhase = time * Math.PI * MUSIC_BEAT_HZ
    const beat = Math.abs(Math.sin(beatPhase))
    const shimmy = Math.sin(beatPhase / 2)
    sway(rig, 'LegL1', 0.06 + 0.06 * buff)
    sway(rig, 'LegR1', -(0.06 + 0.06 * buff))
    sway(rig, 'ArmL1', 0.05 + beat * 0.04)
    sway(rig, 'ArmR1', -(0.05 + beat * 0.04) * rightArm)
    swing(rig, 'ArmL2', -0.15 - beat * 0.2)
    swing(rig, 'ArmR2', -beat * 0.25 * rightArm)
    swing(rig, 'Neck1', (beat - 0.6) * 0.1)
    sway(rig, 'Spine1', shimmy * 0.05)
    twist(rig, 'Spine1', shimmy * 0.1)
    rig.root.position.y = rig.rootRestY + beat * 0.07
  } else {
    // --- Funny walk ----------------------------------------------------------
    // A bouncy cartoon strut: high knees, flapping arms, waddling hips, a
    // bobbling head and squash-and-stretch on every step. Brokies flail like
    // noodles; bodybuilders stomp wide-legged with heavy swagger.
    const phase = time * (6.5 + ratio * 5)
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    const s2 = Math.sin(phase * 2)
    const floppy = 1 - buff

    const legAmp = (0.75 + 0.2 * buff) * ratio
    swing(rig, 'LegL1', s * legAmp)
    swing(rig, 'LegR1', -s * legAmp)
    swing(rig, 'LegL2', Math.max(0, -s) * 1.5 * ratio)
    swing(rig, 'LegR2', Math.max(0, s) * 1.5 * ratio)
    sway(rig, 'LegL1', 0.12 * buff * ratio)
    sway(rig, 'LegR1', -0.12 * buff * ratio)

    const armAmp = (1.1 - 0.2 * buff) * ratio
    swing(rig, 'ArmL1', -s * armAmp)
    swing(rig, 'ArmR1', s * armAmp * rightArm)
    const flap = (0.25 + 0.35 * floppy * (0.5 + 0.5 * s2)) * ratio
    sway(rig, 'ArmL1', flap)
    sway(rig, 'ArmR1', -flap * rightArm)
    swing(rig, 'ArmL2', -(0.4 + Math.max(0, s) * 0.8) * ratio)
    swing(rig, 'ArmR2', -(0.4 + Math.max(0, -s) * 0.8) * ratio * rightArm)

    swing(rig, 'Spine1', 0.03 * ratio)
    sway(rig, 'Spine1', s * (0.12 + 0.1 * buff) * ratio)
    twist(rig, 'Spine1', -s * 0.22 * ratio)
    sway(rig, 'Neck1', -s * 0.16 * ratio)
    swing(rig, 'Neck1', s2 * 0.1 * ratio)

    // Hop at the passing pose, squash at full stride.
    const hop = Math.abs(c)
    rig.root.position.y = rig.rootRestY + hop * 0.55 * ratio
    const squash = (hop - 0.5) * 0.14 * ratio
    rig.root.scale.y *= 1 + squash
    rig.root.scale.x *= 1 - squash * 0.5
    rig.root.scale.z *= 1 - squash * 0.5
  }

  if (!pose) return

  const flex = grounded ? pose.flex || 0 : 0
  const cheer = grounded ? pose.cheer || 0 : 0

  // --- Holding the cash up: upper arm out to the side, forearm folded up so
  // the hand (and the cash on it) is up by the shoulder, like showing it off.
  if (hold > 0) {
    const h = (grounded ? hold : hold * 0.4) * (1 - flex) * (1 - cheer)
    swing(rig, 'ArmR1', -0.45 * h)
    sway(rig, 'ArmR1', -0.9 * h)
    swing(rig, 'ArmR2', -1.85 * h)
    sway(rig, 'ArmR2', -0.4 * h)
  }

  // --- Posture (from physique) ----------------------------------------------
  swing(rig, 'Spine1', pose.slouch || 0)
  swing(rig, 'Neck1', pose.headTilt || 0)
  const spread = pose.armSpread || 0
  sway(rig, 'ArmL1', spread)
  sway(rig, 'ArmR1', -spread)

  // --- Cheer: both arms thrown up and waving, chest out, happy hops ---------
  if (cheer > 0) {
    const wave = Math.sin(time * 14) * 0.25
    swing(rig, 'ArmL1', (-2.7 + wave) * cheer)
    swing(rig, 'ArmR1', (-2.7 - wave) * cheer)
    sway(rig, 'ArmL1', 0.35 * cheer)
    sway(rig, 'ArmR1', -0.35 * cheer)
    swing(rig, 'ArmL2', -0.3 * cheer)
    swing(rig, 'ArmR2', -0.3 * cheer)
    swing(rig, 'Spine1', -0.1 * cheer)
    swing(rig, 'Neck1', -0.14 * cheer)
    rig.root.position.y += Math.abs(Math.sin(time * 9)) * 0.45 * cheer
  }

  // --- Double-biceps flex (idle bodybuilders show off) ----------------------
  if (flex > 0) {
    sway(rig, 'ArmL1', 1.5 * flex)
    sway(rig, 'ArmR1', -1.5 * flex)
    sway(rig, 'ArmL2', 1.7 * flex)
    sway(rig, 'ArmR2', -1.7 * flex)
    swing(rig, 'Spine1', -0.06 * flex)
  }

  // --- Click: pump the held cash up and forward (or flick a free arm forward)
  const click = pose.click || 0
  if (click > 0) {
    const held = hold * (1 - cheer)
    swing(rig, 'ArmR1', (-1.35 + 0.85 * held) * click)
    sway(rig, 'ArmR1', -0.45 * held * click)
    swing(rig, 'ArmR2', -0.6 * (1 - held) * click)
    sway(rig, 'Spine1', -0.06 * click)
  }
}
