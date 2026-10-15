import {
  BoxGeometry,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { CASH_LOOKS } from './cashTiers'
import { COLORS, getBoxGeometry, getMaterial } from './materials'
import { Block, Label } from './parts'

/**
 * Small procedural props. Everything is primitives + the shared materials, so
 * there is nothing to download. Props that appear many times (cash stacks,
 * trophies) are pre-merged into one or two meshes so they cost one or two draw
 * calls each.
 */

/* ------------------------------------------------------------- cash stack */

const _color = new Color()

/** Paints every vertex of `geometry` one color (linear, as three.js expects). */
function paint(geometry, hex) {
  _color.set(hex)
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = _color.r
    colors[i * 3 + 1] = _color.g
    colors[i * 3 + 2] = _color.b
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

const stackGeometries = new WeakMap()
const stackMaterials = new WeakMap()

/** One merged, vertex-colored geometry per cash look: bills + paper band. */
function stackGeometry(tier) {
  let geometry = stackGeometries.get(tier)
  if (geometry) return geometry
  const parts = []
  for (let i = 0; i < tier.layers; i += 1) {
    const layer = new BoxGeometry(1, tier.height * 0.9, 0.5)
    layer.translate((i % 2) * 0.03 - 0.015, tier.height * (i + 0.5), ((i * 7) % 3) * 0.015)
    parts.push(paint(layer, i % 2 ? tier.color : COLORS.cashDark))
  }
  const total = tier.height * tier.layers
  const band = new BoxGeometry(0.22, total + 0.02, 0.52)
  band.translate(0, total / 2, 0)
  parts.push(paint(band, tier.band))
  geometry = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  stackGeometries.set(tier, geometry)
  return geometry
}

function stackMaterial(tier) {
  let material = stackMaterials.get(tier)
  if (material) return material
  material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
  if (tier.emissive) {
    material.emissive = new Color(tier.emissive)
    material.emissiveIntensity = 0.25
  }
  stackMaterials.set(tier, material)
  return material
}

/** A stack of banknotes with a paper band, about 1 x layers x 0.5 units. One draw call. */
export function CashStack({ tier = CASH_LOOKS[1], scale = 1, ...rest }) {
  return (
    <group scale={scale} {...rest}>
      <mesh geometry={stackGeometry(tier)} material={stackMaterial(tier)} castShadow receiveShadow />
    </group>
  )
}

/* ----------------------------------------------------------------- trophy */

let trophyGold = null

/**
 * The gold part of the trophy as one geometry: plate, stem, knob, a lathed cup
 * with a rim, and two curved handles whose ends sit inside the cup wall, so
 * they are attached from every angle.
 */
function trophyGoldGeometry() {
  if (trophyGold) return trophyGold
  const plate = new BoxGeometry(0.78, 0.08, 0.78)
  plate.translate(0, 0.26, 0)
  const stem = new CylinderGeometry(0.1, 0.16, 0.34, 16)
  stem.translate(0, 0.47, 0)
  const knob = new SphereGeometry(0.17, 16, 12)
  knob.translate(0, 0.64, 0)
  // Cup: outer wall up to the rim, then the inside back down to a floor.
  const profile = [
    [0.0, 0.7],
    [0.17, 0.7],
    [0.29, 0.77],
    [0.4, 0.92],
    [0.48, 1.1],
    [0.53, 1.3],
    [0.48, 1.3],
    [0.43, 1.12],
    [0.33, 0.95],
    [0.0, 0.9],
  ].map(([x, y]) => new Vector2(x, y))
  const cup = new LatheGeometry(profile, 28)
  const rim = new TorusGeometry(0.505, 0.035, 8, 32)
  rim.rotateX(Math.PI / 2)
  rim.translate(0, 1.3, 0)
  const handles = [-1, 1].map((side) => {
    const curve = new CatmullRomCurve3(
      [
        [0.47, 1.19],
        [0.66, 1.23],
        [0.81, 1.1],
        [0.76, 0.94],
        [0.56, 0.86],
        [0.34, 0.88],
      ].map(([x, y]) => new Vector3(side * x, y, 0)),
    )
    return new TubeGeometry(curve, 24, 0.052, 8, false)
  })
  const parts = [plate, stem, knob, cup, rim, ...handles]
  // Same attribute layout everywhere (lathe/tube add none we need beyond these).
  for (const p of parts) {
    for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(name)) p.deleteAttribute(name)
  }
  trophyGold = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return trophyGold
}

/** Golden trophy cup on a wooden base. Two draw calls. */
export function Trophy({ color = COLORS.gold, scale = 1, ...rest }) {
  const gold = getMaterial(color, { studs: false, metalness: 0.65, roughness: 0.25, emissive: color, emissiveIntensity: 0.15 })
  return (
    <group scale={scale} {...rest}>
      <mesh
        geometry={getBoxGeometry(1, 0.22, 1)}
        material={getMaterial('#7c2d12', { studs: false })}
        position={[0, 0.11, 0]}
        castShadow
        receiveShadow
      />
      <mesh geometry={trophyGoldGeometry()} material={gold} castShadow />
    </group>
  )
}

/** Blocky tree. Deterministic variety from `seed`. */
export function Tree({ seed = 0, scale = 1, ...rest }) {
  const h = 2.2 + (seed % 3) * 0.5
  return (
    <group scale={scale} {...rest}>
      <Block size={[0.9, h, 0.9]} position={[0, h / 2, 0]} color={COLORS.wood} />
      <Block size={[3.4, 2, 3.4]} position={[0, h + 0.8, 0]} color={COLORS.leaf} />
      <Block size={[2.4, 1.4, 2.4]} position={[0.2, h + 2.4, -0.1]} color={COLORS.leafDark} />
      {seed % 2 === 0 && <Block size={[1.4, 1, 1.4]} position={[-0.4, h + 3.4, 0.3]} color={COLORS.leaf} />}
    </group>
  )
}

/** Egg: a stretched sphere with spots. */
let eggShell = null
let eggSpots = null

/** The egg's shell and its six spots (merged): shared by every egg. */
function eggGeometries() {
  if (!eggShell) {
    eggShell = new SphereGeometry(1, 28, 20)
    eggShell.scale(1, 1.3, 1)
    const spots = [
      [0.5, 0.35, 0.62],
      [-0.55, 0.1, 0.55],
      [0.1, 0.75, 0.7],
      [-0.25, -0.35, 0.78],
      [0.62, -0.25, -0.5],
      [-0.4, 0.55, -0.62],
    ].map(([x, y, z]) => {
      const len = Math.hypot(x, y / 1.3, z)
      const spot = new SphereGeometry(0.22, 10, 8)
      spot.translate((x / len) * 0.97, (y / len) * 1.3 * 0.97, (z / len) * 0.97)
      return spot
    })
    eggSpots = mergeGeometries(spots)
    spots.forEach((g) => g.dispose())
  }
  return { shell: eggShell, spots: eggSpots }
}

/** Egg: a stretched sphere with spots (two draw calls). */
export function Egg({ color, spots, scale = 1, glow = 0, ...rest }) {
  const shell = getMaterial(color, { studs: false, roughness: 0.35, emissive: glow ? color : null, emissiveIntensity: glow })
  const spotMat = getMaterial(spots, { studs: false, roughness: 0.4 })
  const geometry = eggGeometries()
  return (
    <group scale={scale} {...rest}>
      <mesh geometry={geometry.shell} material={shell} castShadow />
      <mesh geometry={geometry.spots} material={spotMat} />
    </group>
  )
}

/** Sack of money with a "$" on it. */
export function MoneyBag({ scale = 1, ...rest }) {
  const sack = getMaterial('#d4a24c', { studs: false, roughness: 0.85 })
  const tie = getMaterial('#7c2d12', { studs: false })
  return (
    <group scale={scale} {...rest}>
      <mesh material={sack} position={[0, 0.6, 0]} scale={[1, 0.9, 1]} castShadow>
        <sphereGeometry args={[0.6, 20, 16]} />
      </mesh>
      <mesh material={sack} position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 0.35, 12]} />
      </mesh>
      <mesh material={tie} position={[0, 1.08, 0]}>
        <torusGeometry args={[0.24, 0.06, 8, 16]} />
      </mesh>
      <Label position={[0, 0.62, 0.6]} size={0.6} color="#16a34a" outline="#fef9c3" outlineWidth={0.1}>
        $
      </Label>
      <Label position={[0, 0.62, -0.6]} rotation={[0, Math.PI, 0]} size={0.6} color="#16a34a" outline="#fef9c3" outlineWidth={0.1}>
        $
      </Label>
    </group>
  )
}
