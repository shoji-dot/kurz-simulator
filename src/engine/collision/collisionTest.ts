/**
 * collisionTest.ts ── Candidate PoseがAnatomyと交差するかを判定する（Phase C-1）
 *
 * [Architect設計確定 2026-08-14] CollisionResultはboolean単体ではなく、将来Slide/Safety
 * Margin/Diagnostic拡張時にnormal/penetrationDepth等を追加できる形にしておく（Architect指示#6）。
 * 今回はcollided（と、どのAnatomyに当たったかのanatomyId）のみ使用する。
 *
 * MeshBVH.intersectsSphere() / intersectsBox() を直接呼ぶだけで、three-mesh-bvhの
 * 公開APIをそのまま使う（独自の交差判定ロジックは実装しない）。
 */
import * as THREE from 'three';
import type { AnatomyCollisionIndex, AnatomyCollisionKey } from './anatomyCollisionIndex';
import type { ProsthesisCollisionProxy } from './prosthesisCollisionGeometry';

export interface CollisionResult {
  collided: boolean;
  /** 衝突したAnatomy（collided=falseの場合はundefined）。 */
  anatomyId?: AnatomyCollisionKey;
  // 将来拡張用（Phase 1では未使用、型のみ予約）:
  // normal?: THREE.Vector3;
  // penetrationDepth?: number;
}

/**
 * testCollision(): proxyが、targetsで指定されたAnatomyのいずれかと交差するかを判定する。
 * worldTransformはindex.getBvh()にそのまま渡される（呼び出し側で用意した値を使い回す）。
 * レンダー中ではなく、イベントハンドラ/エフェクト内から呼ぶこと（getBvh()の制約に準拠）。
 */
export function testCollision(
  proxy: ProsthesisCollisionProxy,
  index: AnatomyCollisionIndex,
  targets: readonly AnatomyCollisionKey[],
  worldTransform: THREE.Matrix4,
): CollisionResult {
  for (const key of targets) {
    const bvh = index.getBvh(key, worldTransform);
    if (!bvh) continue;

    for (const s of proxy.spheres) {
      if (bvh.intersectsSphere(new THREE.Sphere(s.center, s.radius))) {
        return { collided: true, anatomyId: key };
      }
    }
    for (const b of proxy.boxes) {
      if (bvh.intersectsBox(b.box, b.matrix)) {
        return { collided: true, anatomyId: key };
      }
    }
  }
  return { collided: false };
}
