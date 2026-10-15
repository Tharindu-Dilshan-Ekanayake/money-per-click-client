import { RigidBody } from '@react-three/rapier'

import Leaderboards from './Leaderboards'
import PetArea from './PetArea'
import StageCorridor from './StageCorridor'
import Terrain from './Terrain'
import TrainingArea from './TrainingArea'
import UpgradeArea from './UpgradeArea'

/**
 * Everything static in one fixed rigid body: each <Block collider> and
 * <CuboidCollider> below attaches to it, which is far cheaper than a body per
 * wall. Gate doors add/remove their colliders here as they open and close.
 */
export function World() {
  return (
    <RigidBody type="fixed" colliders={false} name="world">
      <Terrain />
      <StageCorridor />
      <UpgradeArea />
      <TrainingArea />
      <PetArea />
      <Leaderboards />
    </RigidBody>
  )
}

export default World
