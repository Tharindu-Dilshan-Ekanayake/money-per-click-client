import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshStandardMaterial } from 'three'

import { PETS, RARITIES } from '../core/config'

const _c = new Color()

function useMat(color, opts = {}) {
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(color),
        roughness: opts.roughness ?? 0.55,
        metalness: opts.metalness ?? 0,
        emissive: new Color(opts.emissive || '#000000'),
        emissiveIntensity: opts.emissiveIntensity ?? 0,
      }),
    [color, opts.roughness, opts.metalness, opts.emissive, opts.emissiveIntensity],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}

function Ears({ type, mat }) {
  if (type === 'none') return null
  const ears = []
  for (const side of [-1, 1]) {
    if (type === 'pointy') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.24, 0.42, 0]} rotation={[0, 0, side * -0.35]}>
          <coneGeometry args={[0.13, 0.32, 4]} />
        </mesh>,
      )
    } else if (type === 'long') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.14, 0.58, 0]} rotation={[0, 0, side * -0.15]} scale={[0.7, 1, 0.5]}>
          <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
        </mesh>,
      )
    } else if (type === 'floppy') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.38, 0.12, 0]} rotation={[0, 0, side * 0.5]} scale={[0.5, 1, 0.35]}>
          <capsuleGeometry args={[0.11, 0.24, 4, 8]} />
        </mesh>,
      )
    } else if (type === 'round') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.3, 0.36, 0]}>
          <sphereGeometry args={[0.12, 12, 10]} />
        </mesh>,
      )
    } else if (type === 'tufts') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.22, 0.42, 0]} rotation={[0, 0, side * -0.6]}>
          <coneGeometry args={[0.07, 0.26, 4]} />
        </mesh>,
      )
    } else if (type === 'horns') {
      ears.push(
        <mesh key={side} material={mat} position={[side * 0.2, 0.44, 0.05]} rotation={[0.3, 0, side * -0.4]}>
          <coneGeometry args={[0.07, 0.34, 8]} />
        </mesh>,
      )
    }
  }
  return ears
}

/**
 * A cute blob pet built from primitives. `variant` 1 = golden, 2 = rainbow.
 * Faces +Z. About 1 unit tall at scale 1.
 */
export function PetModel({ petId, variant = 0, scale = 1, ...rest }) {
  const def = PETS[petId] || PETS.doggy
  const look = def.look
  const rarity = RARITIES[def.rarity]
  const golden = variant === 1
  const rainbow = variant === 2 || look.rainbow

  const bodyColor = golden ? '#facc15' : look.body
  const body = useMat(bodyColor, {
    metalness: golden ? 0.7 : 0,
    roughness: golden ? 0.25 : 0.55,
    emissive: look.glow || (golden ? '#a16207' : null),
    emissiveIntensity: look.glow ? 0.18 + rarity.glow * 0.1 : golden ? 0.2 : 0,
  })
  const belly = useMat(golden ? '#fef08a' : look.belly)
  const earMat = useMat(golden ? '#eab308' : look.earColor || bodyColor, { metalness: golden ? 0.6 : 0 })
  const dark = useMat('#111827', { roughness: 0.3 })
  const white = useMat('#ffffff', { roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.4 })
  const accent = useMat(look.horn || look.halo || look.crown || look.antlers || look.wings || look.tentacles || '#ffffff', {
    metalness: look.crown || look.halo ? 0.6 : 0,
    roughness: 0.35,
    emissive: look.halo || look.horn ? look.halo || look.horn : null,
    emissiveIntensity: look.halo ? 0.6 : 0.2,
  })
  const patches = useMat(look.patches || '#000000')

  const bodyMesh = useRef()
  useFrame((state) => {
    const mat = bodyMesh.current?.material
    if (!rainbow || !mat) return
    _c.setHSL((state.clock.elapsedTime * 0.15) % 1, 0.75, 0.6)
    mat.color.copy(_c)
    mat.emissive.copy(_c)
    mat.emissiveIntensity = 0.25
  })

  return (
    <group scale={scale} {...rest}>
      <group>
        <mesh ref={bodyMesh} material={body} castShadow scale={[1, 0.92, 0.95]}>
          <sphereGeometry args={[0.42, 24, 18]} />
        </mesh>
        <mesh material={belly} position={[0, -0.08, 0.2]} scale={[0.75, 0.7, 0.5]}>
          <sphereGeometry args={[0.36, 18, 14]} />
        </mesh>
        {look.patches && (
          <>
            {[-1, 1].map((side) => (
              <mesh key={side} material={patches} position={[side * 0.15, 0.08, 0.33]} scale={[0.9, 1, 0.5]}>
                <sphereGeometry args={[0.1, 10, 8]} />
              </mesh>
            ))}
          </>
        )}
        {/* Eyes with a shine. */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.15, 0.08, 0.37]}>
            <mesh material={dark}>
              <sphereGeometry args={[0.075, 12, 10]} />
            </mesh>
            <mesh material={white} position={[0.025, 0.03, 0.055]}>
              <sphereGeometry args={[0.025, 8, 6]} />
            </mesh>
          </group>
        ))}
        <mesh material={dark} position={[0, -0.03, 0.41]}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
        <Ears type={look.ears} mat={earMat} />

        {look.horn && (
          <mesh material={accent} position={[0, 0.5, 0.12]} rotation={[0.35, 0, 0]}>
            <coneGeometry args={[0.06, 0.34, 10]} />
          </mesh>
        )}
        {look.antlers &&
          [-1, 1].map((side) => (
            <group key={side} position={[side * 0.18, 0.42, 0]} rotation={[0, 0, side * -0.5]}>
              <mesh material={accent}>
                <cylinderGeometry args={[0.025, 0.035, 0.36, 6]} />
              </mesh>
              <mesh material={accent} position={[side * 0.08, 0.08, 0]} rotation={[0, 0, side * -0.9]}>
                <cylinderGeometry args={[0.02, 0.025, 0.18, 6]} />
              </mesh>
            </group>
          ))}
        {look.wings &&
          [-1, 1].map((side) => (
            <mesh
              key={side}
              material={accent}
              position={[side * 0.42, 0.12, -0.12]}
              rotation={[0, side * 0.5, side * -0.5]}
              scale={[1, 0.6, 0.12]}
              name="wing"
            >
              <sphereGeometry args={[0.28, 12, 10]} />
            </mesh>
          ))}
        {look.halo && (
          <mesh material={accent} position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.035, 8, 24]} />
          </mesh>
        )}
        {look.crown && (
          <group position={[0, 0.42, 0]}>
            <mesh material={accent}>
              <cylinderGeometry args={[0.18, 0.2, 0.14, 12]} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} material={accent} position={[Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.12, Math.cos((i / 5) * Math.PI * 2) * 0.17]}>
                <coneGeometry args={[0.04, 0.12, 6]} />
              </mesh>
            ))}
          </group>
        )}
        {look.tentacles &&
          [0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} material={accent} position={[Math.sin(a) * 0.25, -0.38, Math.cos(a) * 0.25]} rotation={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]}>
                <capsuleGeometry args={[0.05, 0.22, 4, 6]} />
              </mesh>
            )
          })}
      </group>
      {(look.sparkle || rarity.glow >= 1 || variant > 0) && (
        <Sparkles count={10} scale={1.3} size={3} speed={0.6} color={golden ? '#fde047' : look.glow || rarity.color} />
      )}
    </group>
  )
}

export default PetModel
