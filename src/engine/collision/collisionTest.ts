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
 *
 * @param footContactToleranceMm [Diagnostic / Provisional Contact Tolerance、Architect承認
 *   2026-08-15] 省略時（undefined/0）は従来通り全球・全boxをintersects即NGの二値判定する
 *   （既存呼び出し元は無変更で挙動不変）。正の値を渡すと、role==='foot'の球についてのみ
 *   「貫入深度（radius − Bone表面までの距離）がこの値を超えたらcollided」という深度考慮判定に
 *   切り替える。Shaft/Head（role!=='foot'の球・box全般）は常に従来の二値判定のまま——Foot
 *   Proxy Design Evaluation/Constraint Semantics調査（project_kurz_collision_constraintメモリ
 *   参照）で、既存Placement Scoringが Foot-底板接触を理想状態として設計している一方、本判定は
 *   幾何学的交差を一律forbiddenとしており意味論が矛盾していることが確認されたための対応。
 */
export function testCollision(
  proxy: ProsthesisCollisionProxy,
  index: AnatomyCollisionIndex,
  targets: readonly AnatomyCollisionKey[],
  worldTransform: THREE.Matrix4,
  footContactToleranceMm?: number,
): CollisionResult {
  for (const key of targets) {
    const bvh = index.getBvh(key, worldTransform);
    if (!bvh) continue;

    for (const s of proxy.spheres) {
      if (s.role === 'foot' && footContactToleranceMm && footContactToleranceMm > 0) {
        const hit = bvh.closestPointToPoint(s.center, undefined, 0, s.radius + footContactToleranceMm);
        if (hit && s.radius - hit.distance > footContactToleranceMm) {
          return { collided: true, anatomyId: key };
        }
        continue;
      }
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
