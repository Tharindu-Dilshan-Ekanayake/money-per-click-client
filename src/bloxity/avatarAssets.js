/**
 * URL construction and slot metadata for Bloxity avatar assets.
 *
 * The shapes here are not guesses: they mirror the assembly logic inside
 * legion-sdk.min.js (the same code that renders the avatar preview in the Bloxity
 * portal), so an avatar built with this file matches what the player sees there.
 *
 * `avatar.getEquipped()` returns:
 *   { hatId, backId, skinId, headId, armLId, armRId, legLId, legRId, torsoId }
 */

export const AVATAR_CDN = 'https://static.bloxity.io/avatars'

/** The base humanoid body + skeleton. All other assets modify this. */
export const BASE_BODY_URL = `${AVATAR_CDN}/player.glb`

/** Bone that hats attach to, from player.glb's skeleton. */
export const HAT_BONE = 'Neck1'
/** Bone that back items attach to. */
export const BACK_BONE = 'Spine2'
/** Bone whose bind-pose Y drives the neckHeight proportion. */
export const NECK_OFFSET_BONE = 'Neck_Offset'

/** Skin id used when nothing is equipped — the base body has no baked-in texture. */
export const DEFAULT_SKIN_ID = '0'

/**
 * Body-part slots.
 *
 * Each maps an equipped id onto a named skinned mesh already present in player.glb.
 * A part is applied by swapping that mesh's *geometry*, not by attaching a new
 * object — that is what keeps it bound to the shared skeleton.
 */
export const PART_SLOTS = {
  head: { idKey: 'headId', mesh: 'default_head', dir: 'head', suffix: '' },
  arm_L: { idKey: 'armLId', mesh: 'default_arm_L', dir: 'arms', suffix: '_L' },
  arm_R: { idKey: 'armRId', mesh: 'default_arm_R', dir: 'arms', suffix: '_R' },
  leg_L: { idKey: 'legLId', mesh: 'default_leg_L', dir: 'legs', suffix: '_L' },
  leg_R: { idKey: 'legRId', mesh: 'default_leg_R', dir: 'legs', suffix: '_R' },
  torso: { idKey: 'torsoId', mesh: 'default_torso', dir: 'torso', suffix: '' },
}

/** Values that all mean "nothing equipped". Superset of the SDK's own check. */
const EMPTY_IDS = new Set(['-1', '', 'undefined', 'null'])

/**
 * @param {unknown} id
 * @returns {boolean} true when the id names a real asset worth fetching
 */
export function isRealId(id) {
  if (id === null || id === undefined) return false
  return !EMPTY_IDS.has(String(id).trim())
}

export const assetUrls = {
  part: (slot, id) => {
    const { dir, suffix } = PART_SLOTS[slot]
    return `${AVATAR_CDN}/parts/${dir}/${id}${suffix}.glb`
  },
  skinTexture: (id) => `${AVATAR_CDN}/skins/${id}.png`,
  hatMesh: (id) => `${AVATAR_CDN}/items/hats/${id}.obj`,
  hatTexture: (id) => `${AVATAR_CDN}/textures/hats/${id}.png`,
  backMesh: (id) => `${AVATAR_CDN}/items/back/${id}.obj`,
  backTexture: (id) => `${AVATAR_CDN}/textures/back/${id}.png`,
  itemMesh: (dir, id) => `${AVATAR_CDN}/items/${dir}/${id}.obj`,
  itemTexture: (dir, id) => `${AVATAR_CDN}/textures/${dir}/${id}.png`,
}

/** Skin ids fall back to "0" rather than being skipped. */
export const skinIdOrDefault = (id) => (isRealId(id) ? String(id) : DEFAULT_SKIN_ID)

/**
 * Extra cosmetic slots, copied from the SDK's own table (legion-sdk.min.js).
 * `origin` is in model space; an item's local matrix under `bone` is
 * restInverse(bone) * translate(origin). `inheritScale: false` items (hands,
 * shoes) are worn as a pair: the mesh on `bone` plus a copy mirrored across x on
 * `mirrorBone`, following position and rotation only.
 */
export const ACCESSORY_SLOTS = [
  { type: 'hair', idKey: 'hairId', bone: 'Neck1', origin: [0, 5.6, 0], inheritScale: true, dir: 'hats' },
  { type: 'mask', idKey: 'maskId', bone: 'Neck1', origin: [0, 5.6, 0], inheritScale: true, dir: 'hats' },
  { type: 'neck', idKey: 'neckId', bone: 'Spine2', origin: [0, 4.8, 0], inheritScale: true, dir: 'neck' },
  { type: 'chest', idKey: 'chestId', bone: 'Spine2', origin: [0, 3.6, 0], inheritScale: true, dir: 'chest' },
  { type: 'waist', idKey: 'waistId', bone: 'Spine1', origin: [0, 2.4, 0], inheritScale: true, dir: 'waist' },
  { type: 'hand', idKey: 'handId', bone: 'ArmL2_leaf', mirrorBone: 'ArmR2_leaf', origin: [0, 0, 0], inheritScale: false, dir: 'hand' },
  { type: 'shoes', idKey: 'shoesId', bone: 'LegL2_leaf', mirrorBone: 'LegR2_leaf', origin: [0, 0, 0], inheritScale: false, dir: 'shoes' },
]

/** Clothing drawn into the skin texture, in the URL's segment order. */
const CLOTHING_SEGMENTS = [
  { idKey: 'pantsId', key: 'pn' },
  { idKey: 'shirtId', key: 'sh' },
  { idKey: 'faceId', key: 'fc' },
]

const API_URL = import.meta.env?.VITE_BLOXITY_API_URL || 'https://api.bloxity.io'

/**
 * Body texture with the worn face, shirt and pants already drawn on - the same
 * URL `Legion.SDK.avatar.getSkinTextureUrl()` builds. The plain /skins/{id}.png
 * has no face or clothes, so never load that when something is worn.
 */
export function skinTextureUrl(equipped) {
  const worn = (id) => isRealId(id) && String(id) !== '0'
  const skin = worn(equipped?.skinId) ? String(equipped.skinId) : DEFAULT_SKIN_ID
  const clothes = CLOTHING_SEGMENTS.filter((c) => worn(equipped?.[c.idKey]))
  if (!clothes.length) return assetUrls.skinTexture(skin)
  const segments = clothes.map((c) => `_${c.key}${equipped[c.idKey]}`).join('')
  return `${API_URL}/v1/avatar/skin-texture/s${skin}${segments}.png`
}
