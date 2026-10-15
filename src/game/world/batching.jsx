import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { BufferAttribute, Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { playerRuntime } from '../core/runtime'

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv']
const _toLocal = new Matrix4()
const _matrix = new Matrix4()

function visibleWithin(object, root) {
  for (let o = object; o && o !== root; o = o.parent) if (!o.visible) return false
  return true
}

/**
 * Merges the static meshes inside it into one mesh per material (and shadow
 * setting), so e.g. a corridor built from 150 blocks costs a handful of draw
 * calls instead of 150 - the main cost on low-end PCs, with zero visual change.
 *
 * Contract: nothing inside may move, animate or change after mounting (put
 * doors, billboards and anything state-driven outside). Text labels are left
 * as they are, and colliders keep working (they aren't meshes).
 */
export function StaticBatch({ children }) {
  const source = useRef()
  const output = useRef()

  useEffect(() => {
    const src = source.current
    const out = output.current
    if (!src || !out) return undefined
    src.updateMatrixWorld(true)
    _toLocal.copy(src.matrixWorld).invert()

    const groups = new Map()
    src.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.text !== undefined || o.userData.noBatch) return
      const material = o.material
      if (!material || Array.isArray(material) || material.transparent) return
      const geometry = o.geometry
      if (!geometry?.attributes?.position || !visibleWithin(o, src)) return
      const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}|${geometry.index ? 1 : 0}`
      let group = groups.get(key)
      if (!group) {
        group = { material, castShadow: o.castShadow, receiveShadow: o.receiveShadow, geometries: [], sources: [] }
        groups.set(key, group)
      }
      const copy = geometry.clone()
      for (const name of Object.keys(copy.attributes)) if (!KEEP_ATTRIBUTES.includes(name)) copy.deleteAttribute(name)
      if (!copy.attributes.normal) copy.computeVertexNormals()
      if (!copy.attributes.uv) copy.setAttribute('uv', new BufferAttribute(new Float32Array(copy.attributes.position.count * 2), 2))
      copy.applyMatrix4(_matrix.multiplyMatrices(_toLocal, o.matrixWorld))
      group.geometries.push(copy)
      group.sources.push(o)
    })

    const merged = []
    const hidden = []
    for (const group of groups.values()) {
      if (group.sources.length < 2) {
        group.geometries.forEach((g) => g.dispose())
        continue
      }
      const geometry = mergeGeometries(group.geometries, false)
      group.geometries.forEach((g) => g.dispose())
      if (!geometry) continue
      const mesh = new Mesh(geometry, group.material)
      mesh.castShadow = group.castShadow
      mesh.receiveShadow = group.receiveShadow
      mesh.matrixAutoUpdate = false
      out.add(mesh)
      merged.push(mesh)
      for (const o of group.sources) {
        o.visible = false
        hidden.push(o)
      }
    }

    // Nothing in here moves: stop recomputing its matrices every frame.
    src.updateMatrixWorld(true)
    const frozen = []
    src.traverse((o) => {
      if (o === src || !o.matrixAutoUpdate) return
      o.matrixAutoUpdate = false
      frozen.push(o)
    })

    return () => {
      for (const mesh of merged) {
        out.remove(mesh)
        mesh.geometry.dispose()
      }
      for (const o of hidden) o.visible = true
      for (const o of frozen) o.matrixAutoUpdate = true
    }
  }, [])

  return (
    <group>
      <group ref={source}>{children}</group>
      <group ref={output} />
    </group>
  )
}

/**
 * Renders its children only while the player is within `radius` of `at`
 * ([x, z]) - e.g. a stage room's labels and trophy, which can't be seen from
 * the other end of the corridor anyway. Colliders inside keep working.
 */
export function DistanceCull({ at, radius, children }) {
  const ref = useRef()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const p = playerRuntime.position
    const near = Math.hypot(p.x - at[0], p.z - at[1]) < radius
    if (g.visible !== near) g.visible = near
  })
  return <group ref={ref}>{children}</group>
}
