/**
 * engine/poseSolver/solvePose.ts ── Pose Solver P4-2 Step1（Forward+Up 2軸拘束、汎用骨格）
 *
 * 【現状】2026-07-24、P4-2 Step1として実装。この時点ではBell/TMCoordinateFrame等の
 * 具体的なランドマークとは未接続の汎用関数（forward/up/positionを引数として受け取るのみ）。
 * Bell Ground Truthとの接続はP4-3で行う（shojiさん指示: 「Step1はsolvePose()だけ作る、
 * まだBellは接続しない」）。
 *
 * 【責務（2026-07-24、shojiさん仕様確定）】
 * Pose SolverはTMCoordinateFrame・Bell Ground Truth・Prosthesis Geometryから最終Poseを
 * 決定する純粋関数とする。UIやThree.js、useSimStoreへの依存を持たない。副作用を持たず、
 * 同一入力に対して常に同一Poseを返す決定論的(deterministic)な関数とする。返り値は
 * `{ position: Vec3Tuple; quaternion: QuaternionTuple }`のみ（THREE.Object3D/Matrix4を
 * 一切知らない）。Three.jsは最後のアダプター層のみに限定する（scenes層で別途実装）。
 *
 * 【設計】既存の`ProsthesisModel`（kurz-simulator/src/scenes/models/ProsthesisModels.tsx）は
 * `dir = normalize(UMBO_POS - base)` を求めた後 `new THREE.Quaternion().setFromUnitVectors(
 * (0,1,0), dir)` でquaternionを構成していた。この方式は「forwardをlocal+Yに一致させる」
 * ことは保証するが、forward軸まわりの回転（twist）は three.js の内部実装が選ぶ「最短回転」に
 * 委ねられており、解剖学的な意味を持たない（Bellのスリット非対称性・ヘッドプレートの鼓膜面
 * 平行性のような、twistが臨床的に重要な場面で不十分）。
 *
 * 本モジュールは、forwardは従来通りlocal+Yに割り当てつつ、twistを`up`参照ベクトル
 * （TM_NORMAL等）で一意に確定する。具体的には:
 *   X (local+X, right)      = normalize(forward × up)
 *   Y (local+Y, forward)    = forward（そのまま）
 *   Z (local+Z, correctedUp)= normalize(X × Y)
 * という右手系正規直交基底を構築し、そのままquaternionへ変換する。Zは「upのforward垂直面への
 * 投影（Gram-Schmidt的直交化）」と数学的に等価になる（X:=forward×upの構成により自動的に導かれる、
 * tympanicMembrane.tsのtangent導出と同じ手法）。
 *
 * upがforwardとほぼ平行（縮退ケース）の場合は、`vectorMath.ts`の`computeReferenceNormal`
 * （既存のWORLD_UP/WORLD_FORWARD_FALLBACKロジック）を再利用してフォールバックする。
 *
 * 【符号規約】返り値のquaternionは w>=0 を正規形とする（qと-qは同一回転だが、Node検証・
 * Ground Truth比較・将来のJSON保存の安定性のためw<0の場合は符号反転して返す。回転としての
 * 同値性は変わらない）。
 *
 * 【検証】matrix→quaternion変換（Shepperd's method）はNode実行でTHREE.js
 * （`Quaternion.setFromRotationMatrix`相当）と200件のランダム回転で数値照合済み
 * （最大誤差 6.7e-16、q/-qの符号ambiguityを考慮した内積で比較）。決定論性・直交性・
 * 右手系も別途Node検証済み（2026-07-24）。
 */
import type { Vec3Tuple, QuaternionTuple } from '../coordinates/types';
import {
  dotVec3,
  normalizeVec3,
  crossVec3,
  computeReferenceNormal,
} from '../coordinates/vectorMath';

/** ほぼ平行とみなす閾値（|dot| がこれを超えたら縮退ケースとして扱う）。 */
const PARALLEL_THRESHOLD = 0.999;

export interface PoseSolverInput {
  /** ワールド空間の位置（呼び出し側で既にオフセット等を適用済みの最終座標）。 */
  readonly position: Vec3Tuple;
  /**
   * 姿勢のforward方向（local+Yに対応、既存の「long axis」参照と同じ意味）。正規化は内部で行う。
   * 前提条件: 有限・非零ベクトルであること。ゼロベクトル（|forward|≈0）や非有限値（NaN/Infinity）を
   * 渡した場合の挙動は未定義（単位クォータニオンにならない可能性がある）。呼び出し側で保証すること。
   */
  readonly forward: Vec3Tuple;
  /** twist（forward軸まわりの回転）を確定するための参照up方向（例: TM_NORMAL）。正規化は内部で行う。 */
  readonly up: Vec3Tuple;
}

export interface Pose {
  readonly position: Vec3Tuple;
  readonly quaternion: QuaternionTuple;
}

/**
 * 3x3回転行列（列ベクトルx/y/z、右手系・正規直交であること）からquaternionへ変換する。
 * Shepperd's method（THREE.js Quaternion.setFromRotationMatrixと同一アルゴリズム、
 * 2026-07-24にNode実行で数値照合済み）。
 */
function quaternionFromBasis(x: Vec3Tuple, y: Vec3Tuple, z: Vec3Tuple): QuaternionTuple {
  const m00 = x[0], m10 = x[1], m20 = x[2];
  const m01 = y[0], m11 = y[1], m21 = y[2];
  const m02 = z[0], m12 = z[1], m22 = z[2];

  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m21 - m12) * s;
    qy = (m02 - m20) * s;
    qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }

  return [qx, qy, qz, qw];
}

/**
 * Forward+Up 2軸拘束でPoseを決定する。position・forward・up以外の入力は持たない
 * （Bell/TMCoordinateFrame固有の値はP4-3で呼び出し側が用意して渡す）。
 * 副作用なし・決定論的（同一入力→同一出力、2026-07-24Node検証済み）。
 */
export function solvePose(input: PoseSolverInput): Pose {
  const forward = normalizeVec3(input.forward);
  let upRef = normalizeVec3(input.up);

  // 縮退ケース: upがforwardとほぼ平行だとforward×upがゼロ近傍になり基底が構築できない。
  // 既存のcomputeReferenceNormal（WORLD_UP/WORLD_FORWARD_FALLBACKロジック）で代替する。
  if (Math.abs(dotVec3(upRef, forward)) > PARALLEL_THRESHOLD) {
    upRef = computeReferenceNormal(forward);
  }

  const right = normalizeVec3(crossVec3(forward, upRef));       // local +X
  const correctedUp = normalizeVec3(crossVec3(right, forward)); // local +Z（upのforward垂直面への投影と等価）

  const rawQuaternion = quaternionFromBasis(right, forward, correctedUp);
  // 符号正規化: qと-qは同一回転だが、テスト・Ground Truth比較・JSON保存の安定性のため
  // w>=0を正規形とする（2026-07-24、shojiさん指定）。
  const quaternion: QuaternionTuple = rawQuaternion[3] < 0
    ? [-rawQuaternion[0], -rawQuaternion[1], -rawQuaternion[2], -rawQuaternion[3]]
    : rawQuaternion;

  return {
    position: input.position,
    quaternion,
  };
}
