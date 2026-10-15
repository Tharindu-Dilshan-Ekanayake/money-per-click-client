import { Text } from '@react-three/drei'
import { CuboidCollider } from '@react-three/rapier'
import { Object3D } from 'three'

import { FONT_URL } from './font'
import { getBoxGeometry, getMaterial } from './materials'

/**
 * A box in the blocky world. With `collider`, also adds a fixed cuboid collider;
 * it must then be rendered inside the world's fixed <RigidBody>.
 */
export function Block({
  size,
  position = [0, 0, 0],
  rotation,
  color = '#ffffff',
  studs = true,
  emissive = null,
  emissiveIntensity,
  opacity = 1,
  roughness,
  metalness,
  collider = false,
  castShadow = true,
  receiveShadow = true,
  ...rest
}) {
  const [w, h, d] = size
  return (
    <>
      <mesh
        geometry={getBoxGeometry(w, h, d)}
        material={getMaterial(color, { studs, emissive, emissiveIntensity, opacity, roughness, metalness })}
        position={position}
        rotation={rotation}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        {...rest}
      />
      {collider && (
        <CuboidCollider args={[w / 2, h / 2, d / 2]} position={position} rotation={rotation} />
      )}
    </>
  )
}

const _instance = new Object3D()

/**
 * Many identical blocks in one draw call. `items` are [x, y, z, rotY?, scaleX?,
 * scaleY?, scaleZ?]; the list must not change after mount.
 */
export function InstancedBlocks({ size, color, items, studs = true, castShadow = true, receiveShadow = true }) {
  const [w, h, d] = size
  return (
    <instancedMesh
      args={[getBoxGeometry(w, h, d), getMaterial(color, { studs }), items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      ref={(mesh) => {
        if (!mesh || mesh.userData.placed) return
        items.forEach(([x, y, z, rotY = 0, sx = 1, sy = sx, sz = sx], i) => {
          _instance.position.set(x, y, z)
          _instance.rotation.set(0, rotY, 0)
          _instance.scale.set(sx, sy, sz)
          _instance.updateMatrix()
          mesh.setMatrixAt(i, _instance.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
        mesh.userData.placed = true
      }}
    />
  )
}

/** A flat floor overlay (no collider - the ground collider sits underneath). */
export function Floor({ center, size, y = 0.02, color, studs = true, emissive = null, opacity = 1 }) {
  return (
    <Block
      size={[size[0], 0.04, size[1]]}
      position={[center[0], y, center[1]]}
      color={color}
      studs={studs}
      emissive={emissive}
      opacity={opacity}
      castShadow={false}
    />
  )
}

/** Chunky outlined 3D text in the game font. */
export function Label({
  children,
  size = 1,
  color = '#ffffff',
  outline = '#1b1b2f',
  outlineWidth = 0.09,
  anchorX = 'center',
  anchorY = 'middle',
  maxWidth,
  ...rest
}) {
  return (
    <Text
      font={FONT_URL}
      fontSize={size}
      color={color}
      outlineColor={outline}
      outlineWidth={outlineWidth * size}
      anchorX={anchorX}
      anchorY={anchorY}
      maxWidth={maxWidth}
      textAlign="center"
      {...rest}
    >
      {children}
    </Text>
  )
}

/** Two stacked labels, the big-title-plus-subtitle signs from the reference. */
export function Sign({ title, subtitle, position, rotation, titleColor = '#ffffff', subColor = '#4ade80', size = 3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Label size={size} color={titleColor} outlineWidth={0.1}>
        {title}
      </Label>
      {subtitle && (
        <Label position={[0, -size * 0.85, 0]} size={size * 0.48} color={subColor} outlineWidth={0.12}>
          {subtitle}
        </Label>
      )}
    </group>
  )
}
