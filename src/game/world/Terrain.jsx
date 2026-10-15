import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { BackSide, BoxGeometry, Color, MeshStandardMaterial, Object3D, ShaderMaterial } from 'three'

import { CORRIDOR, EGG_SPOTS, GROUND_SIZE, HUB, LEADERBOARD_SPOTS, PET_AREA, PLAZA, TRAINING_AREA, UPGRADE_AREA } from '../core/layout'
import { StaticBatch } from './batching'
import { COLORS, getBoxGeometry, getMaterial } from './materials'
import { Tree } from './models'
import { Block, Floor, InstancedBlocks, Label } from './parts'

const [PLAZA_X, PLAZA_Z] = PLAZA.center
const PLAZA_HALF = PLAZA.size / 2
const UPGRADE_MIN_X = UPGRADE_AREA.center[0] - UPGRADE_AREA.size[0] / 2
const TRAINING_MAX_X = TRAINING_AREA.center[0] + TRAINING_AREA.size[0] / 2
const PETS_MIN_Z = PET_AREA.center[1] - PET_AREA.size[1] / 2

/** Walkways from the plaza to each zone, as [center, size]. */
const PATHS = [
  // North, up to the stage corridor.
  [[0, (HUB.northZ + PLAZA_Z - PLAZA_HALF) / 2], [CORRIDOR.halfWidth * 2, PLAZA_Z - PLAZA_HALF - HUB.northZ]],
  // East to the upgrades, west to training, south to the pets.
  [[(PLAZA_X + PLAZA_HALF + UPGRADE_MIN_X) / 2, PLAZA_Z], [UPGRADE_MIN_X - PLAZA_X - PLAZA_HALF, 4]],
  [[(PLAZA_X - PLAZA_HALF + TRAINING_MAX_X) / 2, PLAZA_Z], [PLAZA_X - PLAZA_HALF - TRAINING_MAX_X, 4]],
  [[PLAZA_X, (PLAZA_Z + PLAZA_HALF + PETS_MIN_Z) / 2], [6, PETS_MIN_Z - PLAZA_Z - PLAZA_HALF]],
]

/** Trees in brick planters either side of the corridor entrance. */
const PLANTER_SPOTS = [
  [-CORRIDOR.halfWidth - 3.6, HUB.northZ + 2.6, 0],
  [CORRIDOR.halfWidth + 3.6, HUB.northZ + 2.6, 1],
]

/** Gradient sky dome that follows the camera. */
function Sky() {
  const ref = useRef()
  const camera = useThree((s) => s.camera)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new Color('#2f8fff') },
          horizon: { value: new Color('#c6ecff') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      {/* Inside the camera's far plane (420); fog has hidden everything past 300. */}
      <sphereGeometry args={[400, 24, 16]} />
    </mesh>
  )
}

const CLOUD_COUNT = 14
/** A cloud is three boxes: [size, offset, color]. */
const CLOUD_PARTS = [
  [[16, 4, 9], [0, 0, 0], '#ffffff'],
  [[9, 4, 7], [-5, 2.5, 0.5], '#ffffff'],
  [[8, 3, 6], [5, 2, -0.5], '#f1f5f9'],
]
const CLOUDS = Array.from({ length: CLOUD_COUNT }, (_, i) => ({
  x: -260 + ((i * 97) % 520),
  y: 48 + ((i * 13) % 22),
  z: -320 + ((i * 151) % 420),
  s: 0.8 + ((i * 7) % 5) * 0.25,
}))
const _cloud = new Object3D()

/** Blocky clouds drifting across the sky: three instanced draw calls for all of them. */
function Clouds() {
  const big = useRef()
  const left = useRef()
  const right = useRef()
  const xs = useRef(CLOUDS.map((c) => c.x))
  useFrame((_, delta) => {
    const meshes = [big.current, left.current, right.current]
    if (meshes.some((m) => !m)) return
    const x = xs.current
    for (let i = 0; i < CLOUD_COUNT; i += 1) {
      x[i] += Math.min(delta, 0.1) * 1.6
      if (x[i] > 280) x[i] = -280
    }
    CLOUD_PARTS.forEach(([, [ox, oy, oz]], k) => {
      const mesh = meshes[k]
      CLOUDS.forEach((c, i) => {
        _cloud.position.set(x[i] + ox * c.s, c.y + oy * c.s, c.z + oz * c.s)
        _cloud.scale.setScalar(c.s)
        _cloud.updateMatrix()
        mesh.setMatrixAt(i, _cloud.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  })
  return (
    <>
      <CloudLayer part={CLOUD_PARTS[0]} meshRef={big} />
      <CloudLayer part={CLOUD_PARTS[1]} meshRef={left} />
      <CloudLayer part={CLOUD_PARTS[2]} meshRef={right} />
    </>
  )
}

/** One box of every cloud, instanced. */
function CloudLayer({ part, meshRef }) {
  const [size, , color] = part
  return (
    <instancedMesh
      ref={meshRef}
      args={[getBoxGeometry(...size), getMaterial(color, { studs: false }), CLOUD_COUNT]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
    />
  )
}

/** The star emblem on the spawn plaza, like the reference spawn. */
function SpawnEmblem() {
  return (
    <group position={[PLAZA_X, 0.05, PLAZA_Z]}>
      {[0, Math.PI / 4].map((r) => (
        <Block key={r} size={[5.2, 0.04, 5.2]} rotation={[0, r, 0]} color={COLORS.navy} studs={false} castShadow={false} />
      ))}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      {/* Square frame around the emblem. */}
      {[
        [0, -4.4, 9.6, 0.6],
        [0, 4.4, 9.6, 0.6],
        [-4.4, 0, 0.6, 9.6],
        [4.4, 0, 0.6, 9.6],
      ].map(([x, z, w, d]) => (
        <Block key={`${x}${z}`} size={[w, 0.05, d]} position={[x, 0, z]} color={COLORS.navy} studs={false} castShadow={false} />
      ))}
    </group>
  )
}

const FLOWER_COLORS = ['#ef4444', '#facc15', '#ec4899', '#ffffff', '#a855f7', '#f97316']
const _flower = new Object3D()

/** Little colorful flower blocks scattered over the lobby grass (one draw call). */
function Flowers() {
  const spots = useMemo(() => {
    const blocked = [
      [PLAZA.center, [PLAZA.size / 2 + 1, PLAZA.size / 2 + 1]],
      [UPGRADE_AREA.center, [UPGRADE_AREA.size[0] / 2 + 1, UPGRADE_AREA.size[1] / 2 + 1]],
      [TRAINING_AREA.center, [TRAINING_AREA.size[0] / 2 + 1, TRAINING_AREA.size[1] / 2 + 1]],
      [PET_AREA.center, [PET_AREA.size[0] / 2 + 1, PET_AREA.size[1] / 2 + 1]],
      [[0, HUB.northZ + 2], [CORRIDOR.halfWidth + 1, 3]],
      ...PATHS.map(([c, size]) => [c, [size[0] / 2 + 0.6, size[1] / 2 + 0.6]]),
      ...PLANTER_SPOTS.map(([x, z]) => [[x, z], [1.8, 1.8]]),
      ...LEADERBOARD_SPOTS.map((b) => [b.center, [6, 1.5]]),
      ...EGG_SPOTS.map((e) => [e.center, [2, 2]]),
    ]
    let seed = 1234
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const out = []
    for (let tries = 0; tries < 3000 && out.length < 110; tries += 1) {
      const x = (rand() * 2 - 1) * (HUB.halfX - 1.5)
      const z = HUB.northZ + 1.5 + rand() * (HUB.southZ - HUB.northZ - 3)
      if (blocked.some(([c, h]) => Math.abs(x - c[0]) < h[0] && Math.abs(z - c[1]) < h[1])) continue
      out.push({ x, z, color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)], s: 0.7 + rand() * 0.6 })
    }
    return out
  }, [])
  const geometry = useMemo(() => new BoxGeometry(0.28, 0.22, 0.28), [])
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.6 }), [])

  return (
    <instancedMesh
      args={[geometry, material, spots.length]}
      castShadow={false}
      ref={(m) => {
        if (!m || m.userData.ready) return
        const color = new Color()
        spots.forEach((f, i) => {
          _flower.position.set(f.x, 0.11 * f.s, f.z)
          _flower.rotation.set(0, f.x * 3.1, 0)
          _flower.scale.setScalar(f.s)
          _flower.updateMatrix()
          m.setMatrixAt(i, _flower.matrix)
          m.setColorAt(i, color.set(f.color))
        })
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
        m.userData.ready = true
      }}
    />
  )
}

/** Grass on top of the walls, where the trees grow. */
const WALL_CAP = 0.5

/** [x, z, seed] for every tree along the wall tops (the corners get one each). */
function wallTreeSpots() {
  const { halfX, northZ, southZ, wallThickness: t } = HUB
  const outerX = halfX + t / 2
  const northZc = northZ - t / 2
  const southZc = southZ + t / 2
  const spots = []
  const line = (x0, z0, x1, z1, count, { skipStart = false, skipEnd = false } = {}) => {
    for (let i = 0; i < count; i += 1) {
      if ((skipStart && i === 0) || (skipEnd && i === count - 1)) continue
      const k = i / (count - 1)
      spots.push([x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, spots.length])
    }
  }
  // Side walls (corners included), the south wall between them, and the two
  // north segments either side of the corridor.
  line(-outerX, northZc, -outerX, southZc, 8)
  line(outerX, northZc, outerX, southZc, 8)
  line(-outerX, southZc, outerX, southZc, 13, { skipStart: true, skipEnd: true })
  const innerX = CORRIDOR.halfWidth + 3
  line(-outerX, northZc, -innerX, northZc, 6, { skipStart: true })
  line(outerX, northZc, innerX, northZc, 6, { skipStart: true })
  return spots
}

const BLOSSOM = '#ff9fd0'
const BLOSSOM_DARK = '#ff7ab8'

/**
 * Trees along the wall tops, like the reference lobby: a mix of green trees
 * and pink blossoms. Every part type is one instanced draw call.
 */
function WallTrees() {
  const parts = useMemo(() => {
    const y0 = HUB.wallHeight + WALL_CAP
    const groups = {
      trunk: { size: [0.9, 1, 0.9], color: COLORS.wood, items: [] },
      leaf: { size: [3.4, 2, 3.4], color: COLORS.leaf, items: [] },
      leafTop: { size: [2.4, 1.4, 2.4], color: COLORS.leafDark, items: [] },
      blossom: { size: [3.4, 2, 3.4], color: BLOSSOM, items: [] },
      blossomTop: { size: [2.4, 1.4, 2.4], color: BLOSSOM_DARK, items: [] },
      crown: { size: [1.4, 1, 1.4], color: COLORS.leaf, items: [] },
    }
    for (const [x, z, seed] of wallTreeSpots()) {
      const trunk = 1.4 + (seed % 3) * 0.5
      const s = 0.85 + (seed % 4) * 0.07
      const rot = seed * 1.3
      const pink = seed % 4 === 3
      const offset = (dx, dz) => [
        x + (dx * Math.cos(rot) + dz * Math.sin(rot)) * s,
        z + (dz * Math.cos(rot) - dx * Math.sin(rot)) * s,
      ]
      groups.trunk.items.push([x, y0 + (trunk * s) / 2, z, rot, s, trunk * s, s])
      groups[pink ? 'blossom' : 'leaf'].items.push([x, y0 + (trunk + 0.8) * s, z, rot, s])
      const [tx, tz] = offset(0.2, -0.1)
      groups[pink ? 'blossomTop' : 'leafTop'].items.push([tx, y0 + (trunk + 2.4) * s, tz, rot, s])
      if (seed % 2 === 0 && !pink) {
        const [cx, cz] = offset(-0.4, 0.3)
        groups.crown.items.push([cx, y0 + (trunk + 3.4) * s, cz, rot, s])
      }
    }
    return Object.entries(groups).filter(([, g]) => g.items.length)
  }, [])
  return parts.map(([key, g]) => <InstancedBlocks key={key} size={g.size} color={g.color} items={g.items} />)
}

function HubWalls() {
  const { halfX, northZ, southZ, wallHeight: h, wallThickness: t } = HUB
  const y = h / 2
  // Side walls run the full depth (closing the corners); the north segments
  // start outside the corridor walls so no two faces ever share a plane
  // (that's what flickered at the entrance).
  const depth = southZ - northZ + t * 2
  const midZ = (northZ + southZ) / 2
  const innerX = CORRIDOR.halfWidth + 1
  const northLen = halfX - innerX
  const capY = h + WALL_CAP / 2
  return (
    <>
      {/* North wall, split around the corridor entrance. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            size={[northLen, h, t]}
            position={[side * (innerX + northLen / 2), y, northZ - t / 2]}
            color={COLORS.brick}
            collider
          />
          <Block
            size={[northLen - 0.15, WALL_CAP, t + 0.3]}
            position={[side * (innerX + (northLen - 0.15) / 2), capY, northZ - t / 2]}
            color={COLORS.grass}
          />
        </group>
      ))}
      <Block size={[halfX * 2, h, t]} position={[0, y, southZ + t / 2]} color={COLORS.brick} collider />
      <Block size={[halfX * 2 - 0.3, WALL_CAP, t + 0.3]} position={[0, capY, southZ + t / 2]} color={COLORS.grass} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block size={[t, h, depth]} position={[side * (halfX + t / 2), y, midZ]} color={COLORS.brick} collider />
          <Block size={[t + 0.3, WALL_CAP, depth + 0.3]} position={[side * (halfX + t / 2), capY, midZ]} color={COLORS.grass} />
          {/* Darker band along the foot so the walls read as blocks, not flat cards. */}
          <Block
            size={[0.3, 0.9, southZ - northZ]}
            position={[side * (halfX - 0.15), 0.45, midZ]}
            color={COLORS.brickDark}
            castShadow={false}
          />
        </group>
      ))}
      <Block
        size={[halfX * 2 - 0.6, 0.9, 0.3]}
        position={[0, 0.45, southZ - 0.15]}
        color={COLORS.brickDark}
        castShadow={false}
      />
      <WallTrees />
    </>
  )
}

export function Terrain() {
  return (
    <>
      <Sky />
      <Clouds />

      {/* Everything that never moves, merged into a few draw calls. */}
      <StaticBatch>
        {/* Ground: one big collider under everything. */}
        <Block
          size={[GROUND_SIZE, 1, GROUND_SIZE + 260]}
          position={[0, -0.5, -110]}
          color={COLORS.grass}
          castShadow={false}
        />
        <CuboidCollider args={[GROUND_SIZE / 2, 0.5, (GROUND_SIZE + 260) / 2]} position={[0, -0.5, -110]} />

        {/* Spawn plaza + walkways out to every zone (touching, never overlapping). */}
        <Floor center={PLAZA.center} size={[PLAZA.size, PLAZA.size]} y={0.04} color={COLORS.tile} />
        {PATHS.map(([center, size], i) => (
          <Floor key={i} center={center} size={size} y={0.04} color={COLORS.tileDark} />
        ))}
        <SpawnEmblem />

        <HubWalls />
        <Flowers />

        {PLANTER_SPOTS.map(([x, z, seed]) => (
          <group key={seed} position={[x, 0, z]}>
            <Block size={[2.6, 0.7, 2.6]} position={[0, 0.35, 0]} color={COLORS.brickDark} collider />
            <Block size={[2.2, 0.08, 2.2]} position={[0, 0.74, 0]} color={COLORS.grassDark} castShadow={false} />
            <Tree seed={seed} position={[0, 0.7, 0]} />
          </group>
        ))}

        {/* Friendly signpost beside the training walkway. */}
        <group position={[PLAZA_X - PLAZA_HALF - 2.2, 0, PLAZA_Z - 5.5]} rotation={[0, 0.45, 0]}>
          <Block size={[0.4, 3, 0.4]} position={[0, 1.5, 0]} color={COLORS.wood} collider />
          <Block size={[4.2, 1.7, 0.3]} position={[0, 3.4, 0]} color="#f97316" studs={false} />
          <Label position={[0, 3.6, 0.17]} size={0.4} color="#ffffff">
            CLICK TO EARN!
          </Label>
          <Label position={[0, 3.05, 0.17]} size={0.28} color="#fef08a">
            walk + click = money
          </Label>
        </group>
      </StaticBatch>
    </>
  )
}

export default Terrain
