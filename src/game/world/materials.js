import {
  BoxGeometry,
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

/**
 * Shared look for the blocky world: a procedurally drawn Lego-stud texture
 * (white, tinted per material), cached materials per color, and box geometry
 * whose UVs are in world units so studs never stretch, whatever the size.
 */

/** Studs per world unit along each axis (2.5 = tiles a quarter of the old area). */
const STUDS_PER_UNIT = 2.5

let studTexture = null

function drawStuds(size = 128, studs = 2) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, size, size)

  const cell = size / studs
  for (let y = 0; y < studs; y += 1) {
    for (let x = 0; x < studs; x += 1) {
      const cx = x * cell + cell / 2
      const cy = y * cell + cell / 2
      const r = cell * 0.3
      // Soft drop shadow down-right, then the stud with a light rim up-left.
      g.fillStyle = 'rgba(0,0,0,0.16)'
      g.beginPath()
      g.arc(cx + r * 0.18, cy + r * 0.22, r * 1.05, 0, Math.PI * 2)
      g.fill()
      const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, '#e6e6e6')
      g.fillStyle = grad
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.12)'
      g.lineWidth = size / 128
      g.stroke()
    }
  }
  // Faint tile seams.
  g.strokeStyle = 'rgba(0,0,0,0.08)'
  g.lineWidth = size / 64
  g.strokeRect(0, 0, size, size)
  return canvas
}

export function getStudTexture() {
  if (!studTexture) {
    studTexture = new CanvasTexture(drawStuds())
    studTexture.wrapS = RepeatWrapping
    studTexture.wrapT = RepeatWrapping
    studTexture.colorSpace = SRGBColorSpace
    studTexture.minFilter = LinearMipmapLinearFilter
    studTexture.anisotropy = 8
    // Two studs are drawn per tile.
    studTexture.repeat.set(STUDS_PER_UNIT / 2, STUDS_PER_UNIT / 2)
  }
  return studTexture
}

const materialCache = new Map()

/**
 * Cached material. `studs` toggles the stud texture; `emissive` makes signs and
 * neon pop; `opacity` < 1 enables transparency.
 */
export function getMaterial(color, { studs = true, emissive = null, emissiveIntensity = 0.35, opacity = 1, roughness = 0.75, metalness = 0 } = {}) {
  const key = [color, studs, emissive, emissiveIntensity, opacity, roughness, metalness].join('|')
  let mat = materialCache.get(key)
  if (!mat) {
    mat = new MeshStandardMaterial({
      color: new Color(color),
      map: studs ? getStudTexture() : null,
      roughness,
      metalness,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    })
    if (emissive) {
      mat.emissive = new Color(emissive)
      mat.emissiveIntensity = emissiveIntensity
    }
    materialCache.set(key, mat)
  }
  return mat
}

const geometryCache = new Map()

/**
 * Box geometry with UVs scaled to world units per face, so a shared repeating
 * texture tiles at the same density on every block.
 */
export function getBoxGeometry(w, h, d) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`
  let geo = geometryCache.get(key)
  if (geo) return geo
  geo = new BoxGeometry(w, h, d)
  const uv = geo.getAttribute('uv')
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; 4 vertices each.
  const faceDims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let face = 0; face < 6; face += 1) {
    const [fu, fv] = faceDims[face]
    for (let v = 0; v < 4; v += 1) {
      const i = face * 4 + v
      uv.setXY(i, uv.getX(i) * fu, uv.getY(i) * fv)
    }
  }
  uv.needsUpdate = true
  geometryCache.set(key, geo)
  return geo
}

/** Palette pulled from the reference screenshots. */
export const COLORS = {
  grass: '#3ed154',
  grassDark: '#2fb847',
  brick: '#ec7a3c',
  brickDark: '#c45a26',
  tile: '#c4d0ff',
  tileDark: '#a3b4ff',
  navy: '#2b3d99',
  white: '#e6eeff',
  carpet: '#ff3347',
  carpetEdge: '#ffd23f',
  wood: '#b06a2e',
  woodDark: '#7a4720',
  gold: '#facc15',
  cash: '#22c55e',
  cashDark: '#15803d',
  leaf: '#34c759',
  leafDark: '#22a447',
  // One color per zone so the lobby is easy to read at a glance.
  zoneUpgrade: '#93e8b0',
  zoneTraining: '#c6b2ff',
  zonePets: '#ffb3d6',
}

/** Gate frame color per stage: a rainbow down the corridor. */
export const STAGE_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']
