/**
 * scenes/debug/poseCompareStats.ts ── Pose比較用の数値指標（Debug専用）
 *
 * 【目的】Ghost Overlay（PoseComparisonOverlay.tsx）で2つのPose（position+quaternion）を
 * 比較するための3指標を計算する: Forward Error（向きの差）・Twist Difference（forward軸
 * まわりの回転差）・Position Difference（位置差）。2026-07-24、shojiさん要件「Forward error /
 * Twist difference / Position difference くらいは数値表示してもいい」に対応。
 *
 * 【2026-07-24追記】shojiさんレビュー「Forward Errorは0°だがNew Poseが鼓膜に対して約90°
 * 回転して見える。Twist差20°だけでは説明できない」への対応として、forwardベクトルと任意の
 * 参照ベクトル（TM_NORMAL等）とのなす角を計算する`angleToVectorDeg()`を追加した。
 * Old-vs-New比較だけでは「2つのPoseが互いにどれだけ違うか」しか分からず、「どちらが解剖学的な
 * 基準（TM_NORMAL）にどれだけ近いか」は別の指標が必要という指摘に基づく。
 *
 * 【設計】Swing-Twist分解（標準的な手法）を用いる。2つの姿勢の相対回転Rを、基準軸
 * （ここではreference側のforward方向）まわりのtwist成分と、それ以外のswing成分に分解する。
 * Forward Errorはswing成分の大きさ（forwardベクトル同士のなす角）、Twist Differenceは
 * twist成分の角度に相当する。
 *
 * 【責務分離】本ファイルは「表示用の数値を計算するだけ」であり、レンダリングに使う
 * position/quaternionには一切書き戻さない（poseThreeAdapter.tsの責務とは独立）。数値計算に
 * THREE.Quaternion/Vector3の機能を使うが、これはDebug専用の統計ユーティリティであり、
 * engine層のTHREE非依存原則の対象外（scenes/debug配下、Three Adapterとは別レイヤー）。
 *
 * 【検証】Node実行（three.module.js、代表的な4ケース）で確認済み（2026-07-24）:
 *   - 同一姿勢同士            → forwardErrorDeg=0,  twistDeg=0,  positionDiffMm=0
 *   - 純粋twist回転(37°)       → forwardErrorDeg≈0,  twistDeg≈37
 *   - 純粋swing回転(22°)       → forwardErrorDeg≈22, twistDeg≈0
 *   - 位置差(3,4,0)           → positionDiffMm=5
 */
import * as THREE from 'three';

const LOCAL_FORWARD = new THREE.Vector3(0, 1, 0);

export interface PoseLike {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

export interface PoseCompareResult {
  readonly forwardErrorDeg: number;
  readonly twistDeg: number;
  readonly positionDiffMm: number;
}

/** quaternionが表す姿勢のforward方向（local+Y）をワールド空間へ変換した単位ベクトル。 */
export function forwardOf(quaternion: THREE.Quaternion): THREE.Vector3 {
  return LOCAL_FORWARD.clone().applyQuaternion(quaternion).normalize();
}

/**
 * quaternionのforward方向（local+Y）と任意の参照ベクトルとのなす角（度）。
 * 例: TM_NORMALを渡せば「このPoseのヘッドプレート法線が鼓膜法線からどれだけ離れているか」が
 * 分かる（PoseModelBaseline.mdの前提「Head plate normal = Shaft axis(=forward)」に基づく）。
 */
export function angleToVectorDeg(quaternion: THREE.Quaternion, reference: THREE.Vector3): number {
  const forward = forwardOf(quaternion);
  const dot = THREE.MathUtils.clamp(forward.dot(reference.clone().normalize()), -1, 1);
  return THREE.MathUtils.radToDeg(Math.acos(dot));
}

/**
 * 2つのPose（position+quaternion）を比較する。twist軸はreference（基準側、例: Reference Pose）
 * のforward方向を使う。
 * @param reference 基準Pose（例: Reference Poseスナップショット）
 * @param other     比較対象Pose（例: 旧方式/新方式）
 */
export function comparePoses(reference: PoseLike, other: PoseLike): PoseCompareResult {
  const forwardRef   = forwardOf(reference.quaternion);
  const forwardOther = forwardOf(other.quaternion);

  // Forward Error: 2つのforwardベクトルのなす角（swing成分の大きさ）。
  const dotForward = THREE.MathUtils.clamp(forwardRef.dot(forwardOther), -1, 1);
  const forwardErrorDeg = THREE.MathUtils.radToDeg(Math.acos(dotForward));

  // Twist Difference: reference→otherの相対回転を、forwardRef軸まわりのtwist角として抽出する
  // （Swing-Twist分解の標準式: R=(x,y,z,w)、twistAngle=2*atan2(dot((x,y,z),axis), w)）。
  const relative = other.quaternion.clone().multiply(reference.quaternion.clone().invert());
  const relVec = new THREE.Vector3(relative.x, relative.y, relative.z);
  const twistProjection = relVec.dot(forwardRef);
  const twistRad = 2 * Math.atan2(twistProjection, relative.w);
  const twistDeg = THREE.MathUtils.radToDeg(twistRad);

  const positionDiffMm = reference.position.distanceTo(other.position);

  return { forwardErrorDeg, twistDeg, positionDiffMm };
}
