/**
 * scenes/debug/poseThreeAdapter.ts ── Three Adapter（Debug専用、P4-3 Step3-2）
 *
 * 【責務】Pose Solver / Bell Adapterの出力（QuaternionTuple・Vec3Tuple、THREE非依存の値
 * オブジェクト）を THREE.Quaternion / THREE.Vector3 へ変換するだけの層。2026-07-24、
 * shojiさん要件:「Three Adapterは絶対にQuaternionを計算しない。役割はQuaternionTuple→
 * THREE.Quaternionへの変換だけ。setFromUnitVectorsやlookAtなどをThree Adapterで呼び始めると、
 * Engineで決めたPoseが崩れる」。本ファイルはこの制約を厳守し、成分のコピーのみを行う
 * （正規化・符号調整・向き計算は一切行わない。正規化・符号規約はsolvePose()側の責務）。
 *
 * 【現状】?debug=coords限定のGhost Overlay（PoseComparisonOverlay.tsx）専用。本番描画
 * （ProsthesisModel/DraggableProsthesis）には一切接続しない（P4-3 Step3-2時点）。
 */
import * as THREE from 'three';
import type { Vec3Tuple, QuaternionTuple } from '../../engine/coordinates/types';
import type { Pose } from '../../engine/poseSolver/solvePose';

/** QuaternionTuple [x,y,z,w] を THREE.Quaternion へ変換する（成分コピーのみ、計算なし）。 */
export function toThreeQuaternion(q: QuaternionTuple): THREE.Quaternion {
  return new THREE.Quaternion(q[0], q[1], q[2], q[3]);
}

/** Vec3Tuple を THREE.Vector3 へ変換する（成分コピーのみ、計算なし）。 */
export function toThreeVector3(v: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

/** Engineの Pose（position+quaternion）をまとめてTHREEの値へ変換する（成分コピーのみ）。 */
export function poseToThree(pose: Pose): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  return {
    position: toThreeVector3(pose.position),
    quaternion: toThreeQuaternion(pose.quaternion),
  };
}
