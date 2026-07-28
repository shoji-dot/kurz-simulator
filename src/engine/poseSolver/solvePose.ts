/**
 * engine/poseSolver/solvePose.ts ── Pose Solver（Forward/Twist/Normal 3層API、P4B-2）
 *
 * 【2026-07-28改訂（P4B-2、shojiさんレビュー承認）】P4-2 Step1（2026-07-24）で実装した単一の
 * `solvePose(forward,up)→Pose`を、責務ごとに3層へ分離した:
 *
 *   PoseInput ─solvePose()→ PoseBasis ─composeTwist()→ TwistedPose ─composeTilt()→ TwistedPose
 *   ─composeNormal()→ (Final)Pose
 *
 * 【2026-07-28追記（P4B-4）】Feature Flag導入（P4B-3 Step5）着手前の監査でUI操作
 * `angleTilt`/`angleTiltZ`をNEW Poseへ反映する経路が欠落していることが判明したため、
 * `composeTwist()`と`composeNormal()`の間に`composeTilt()`層を追加した（詳細は同関数のJSDoc
 * 参照）。既存の3層の責務・数式は無変更。
 *
 * 分離の理由（P4A完了時点の状況、[[docs/Pose_Design_Constraints_v1.0.md]]参照）:
 * Head Plate Local CoordinateではOrigin/X軸/Y軸はEvidence Aで確定したが、Z軸（Head Plate
 * Normal↔Shaft Axis）は外部データ待ちで保留のまま。P4Bは「Z軸に依存しない部分」を先行して
 * 設計する方針のため、Forward確立(solvePose)とTwist確立(composeTwist)を独立した層として切り
 * 出し、将来Z軸が確定した時点でcomposeNormal()という第4層だけを追加できる構造にした。
 *
 * 【各層の責務】
 * - `solvePose()`: PoseInput → PoseBasis の**Pose Basis生成**を担う。現時点ではforwardの
 *   正規化とpositionの透過のみを行うが、これは「たまたま処理が単純」なだけであり、責務としては
 *   「有効なPose Basisを1つ確立すること」全般を負う（将来、reference axis・quality・縮退フラグ
 *   等をPoseBasisに追加する余地を残すため、"正規化関数" ではなく "Basis生成関数" として位置づける。
 *   2026-07-28shojiさんレビュー指摘）。**twist・quaternion計算には一切関与しない。**
 * - `composeTwist()`: PoseBasis + twistReference → TwistedPose。forward軸まわりのtwistを
 *   一意に確定する。**Twistはforwardを保持したままローカル回転のみ決定する。composeTwist()の
 *   実装がforward自体を書き換えることは設計原則として禁止する**（2026-07-28shojiさんレビュー
 *   指摘。旧方式のangleTilt/angleTiltZがEuler角加算によりforward自体を再照準していたことが
 *   「NEW Poseが約90°回転して見える」問題のRoot Cause Analysis(P4B-0)で判明したため、同じ
 *   誤りの再発を防ぐための明文化）。
 * - `composeNormal()`: TwistedPose + headPlateNormal → TwistedPose。**未実装（今回はP4Bの
 *   スコープ外）**。Head Plate NormalがEvidence AまたはA+として確定した時点で中身を実装する。
 *   引数なしの場合は恒等関数（twistedをそのまま返す）とし、既存呼び出し元に影響を与えない。
 *
 * 【後方互換性】`Pose`型は`TwistedPose`のエイリアスとして維持。`bellAdapter.ts`の
 * `solveBellPose()`（外部公開API）は入出力とも無変更、内部実装のみ
 * `buildBellPoseInput→solvePose→composeTwist`の3段に分解された。
 *
 * 【数式の変更範囲】`composeTwist()`の中身（right=forward×up、correctedUp=right×forward、
 * quaternionFromBasis、縮退フォールバック、w>=0符号正規化）は、2026-07-24時点の
 * `solvePose()`本体からロジックを一切変更せずそのまま移設した（P4B-1のNode検証で移設前後の
 * 出力が完全一致することを確認済み）。
 *
 * 【検証】matrix→quaternion変換（Shepperd's method）はNode実行でTHREE.js
 * （`Quaternion.setFromRotationMatrix`相当）と200件のランダム回転で数値照合済み
 * （最大誤差 6.7e-16、q/-qの符号ambiguityを考慮した内積で比較、2026-07-24）。
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

/** Layer 1: Geometry Adapter（bellAdapter.ts等）が生成する、quaternion計算を含まない入力。 */
export interface PoseInput {
  readonly position: Vec3Tuple;
  /**
   * 姿勢のforward方向（local+Yに対応、既存の「long axis」参照と同じ意味）。正規化は
   * solvePose()内部で行う。前提条件: 有限・非零ベクトルであること。
   */
  readonly forward: Vec3Tuple;
}

/** Layer 2: solvePose()の出力。twist未確定の状態のPose Basis。 */
export interface PoseBasis {
  readonly position: Vec3Tuple;
  /** 正規化済みforward（local+Y）。 */
  readonly forward: Vec3Tuple;
}

/** Layer 3: composeTwist()の出力。forward軸まわりのtwistが確定した状態。 */
export interface TwistedPose {
  readonly position: Vec3Tuple;
  readonly quaternion: QuaternionTuple;
}

/** 後方互換エイリアス（2026-07-24時点の`Pose`型と同一形状）。 */
export type Pose = TwistedPose;

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
 * Layer 2: PoseInputからPoseBasisを生成する（Pose Basis生成、[[Pose_Design_Constraints_v1.0]]
 * P4B-2参照）。現時点ではforwardの正規化とpositionの透過のみを行う。
 * **twist・quaternion計算には一切関与しない**（それはcomposeTwist()の責務）。
 * 前提条件: input.forwardは有限・非零ベクトルであること（ゼロベクトル・非有限値の場合の
 * 挙動は未定義、呼び出し側で保証すること）。
 */
export function solvePose(input: PoseInput): PoseBasis {
  return {
    position: input.position,
    forward: normalizeVec3(input.forward),
  };
}

/**
 * Layer 3: PoseBasis + twistReferenceからTwistedPoseを生成する（forward軸まわりのtwistを
 * 一意に確定する）。**Twistはforwardを保持したままローカル回転のみ決定する。本関数が
 * forward自体を書き換えることは設計原則として禁止する**（P4B-0 Root Cause Analysisで、
 * 旧方式のEuler角加算がforward自体を再照準していたことが「NEW Poseが約90°回転して見える」
 * 問題の原因と判明したため、2026-07-28に明文化）。
 *
 * upがforwardとほぼ平行（縮退ケース）の場合は、`vectorMath.ts`の`computeReferenceNormal`
 * （既存のWORLD_UP/WORLD_FORWARD_FALLBACKロジック）を再利用してフォールバックする。
 * 返り値のquaternionは w>=0 を正規形とする（2026-07-24仕様、q/-qは同一回転）。
 *
 * 【本関数の中身】2026-07-24時点の`solvePose()`本体からロジックを一切変更せずそのまま移設した
 * （P4B-1のNode検証で移設前後の出力が完全一致することを確認済み）。
 */
export function composeTwist(basis: PoseBasis, twistReference: Vec3Tuple): TwistedPose {
  const forward = basis.forward;
  let upRef = normalizeVec3(twistReference);

  if (Math.abs(dotVec3(upRef, forward)) > PARALLEL_THRESHOLD) {
    upRef = computeReferenceNormal(forward);
  }

  const right = normalizeVec3(crossVec3(forward, upRef));       // local +X
  const correctedUp = normalizeVec3(crossVec3(right, forward)); // local +Z

  const rawQuaternion = quaternionFromBasis(right, forward, correctedUp);
  const quaternion: QuaternionTuple = rawQuaternion[3] < 0
    ? [-rawQuaternion[0], -rawQuaternion[1], -rawQuaternion[2], -rawQuaternion[3]]
    : rawQuaternion;

  return {
    position: basis.position,
    quaternion,
  };
}

/** 単位軸(axis)・角度(angleRad)からquaternionを生成する（axis-angle表現）。 */
function quaternionFromAxisAngle(axis: Vec3Tuple, angleRad: number): QuaternionTuple {
  const half = angleRad / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

/**
 * quaternionのHamilton積 a*b（THREE.Quaternion.multiplyQuaternions(a,b)と同一の演算・符号規約）。
 * 「aを適用した後にbを適用する」の意味ではなく、three.js/一般的な合成規約
 * （aの局所座標系上でbを追加合成する）に合わせる。2026-07-28、composeTilt()検証時にNode上で
 * three.jsと数値照合済み。
 */
function multiplyQuaternions(a: QuaternionTuple, b: QuaternionTuple): QuaternionTuple {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/**
 * Layer 3.5（P4B-4、2026-07-28 shojiさん承認）: TwistedPose + angleTilt/angleTiltZから
 * UI操作（前後傾斜/左右傾斜）を反映したTwistedPoseを生成する。
 *
 * 【追加の経緯】P4B-3のFeature Flag導入（Step5）着手前の監査で、旧`CurrentAxisAlignmentModel`が
 * ユーザー操作の`angleTilt`/`angleTiltZ`（`useSimStore.ts`のPlacementState、Safety Engineの
 * スコア計算にも直結）を反映するのに対し、`solvePose()`→`composeTwist()`の2層にはUI入力を
 * 反映する経路が一切存在しないことが判明した。Flag ONにした場合、研修者がtiltを操作しても
 * 3Dモデルが視覚的に反応しない一方でフィードバック文言はtilt値を語るという、教育アプリとして
 * 危険な不整合が生じるため、P4Bのスコープを拡張しこの層を追加した
 * （[[docs/P4B-3_Acceptance_Criteria_v1.0.md]] 前提条件・Criteria#7参照）。
 *
 * 【数式の根拠】旧`computeCurrentAxisAlignmentOrientation`（`scenes/models/ProsthesisModels.tsx`）
 * のEuler角加算処理を代数的に整理すると、以下の閉形式に一致する（近似ではなく厳密な等価変形）:
 *
 *   quatFinal = Rx_world(angleTilt) · quat0 · Rz_local(angleTiltZ)
 *
 * すなわち angleTilt は「ワールドX軸まわりの前乗算」、angleTiltZ は「ローカルZ軸まわりの
 * 後乗算」であり、直感に反して両者は異なる基準系の回転である。Node実行で4種のbase/target×
 * 12種のtilt角（0°〜180°、負値含む）を検証し、この閉形式とOLD実装の最大差は2.4e-6°
 * （浮動小数点誤差レベル）であることを確認済み（2026-07-28）。
 *
 * 【責務境界】本関数は`twisted.quaternion`（composeTwist()の出力）を土台にtiltを合成するのみで、
 * forward自体やtwist解決ロジックには関与しない。composeNormal()（Head Plate Normal, P4Cスコープ）
 * とは独立した層であり、どちらの引数も参照しない。
 *
 * 【position】OLD実装同様、position（シャフト中点）はtiltの影響を受けない
 * （position計算はtilt適用前のdir/base/shaftLengthのみで決まるため）。
 */
export function composeTilt(twisted: TwistedPose, angleTilt: number, angleTiltZ: number): TwistedPose {
  const tiltXRad = (angleTilt  * Math.PI) / 180;
  const tiltZRad = (angleTiltZ * Math.PI) / 180;

  const qXWorld = quaternionFromAxisAngle([1, 0, 0], tiltXRad);
  const qZLocal = quaternionFromAxisAngle([0, 0, 1], tiltZRad);

  const rawQuaternion = multiplyQuaternions(multiplyQuaternions(qXWorld, twisted.quaternion), qZLocal);
  const quaternion: QuaternionTuple = rawQuaternion[3] < 0
    ? [-rawQuaternion[0], -rawQuaternion[1], -rawQuaternion[2], -rawQuaternion[3]]
    : rawQuaternion;

  return {
    position: twisted.position,
    quaternion,
  };
}

/**
 * Layer 4（将来、P4Bのスコープ外・未実装）: TwistedPose + headPlateNormalからPoseを補正する。
 * Head Plate NormalがEvidence AまたはA+として確定した時点で中身を実装する
 * （[[docs/Head_Plate_Local_Coordinate_v1.0.md]]のZ軸確定・v1.1改訂と対応）。
 * headPlateNormalを渡さない場合は恒等関数（twistedをそのまま返す）。
 * 2026-07-28shojiさんレビュー: 第2引数は補正用の構造体(Correction)ではなく、
 * headPlateNormalベクトルを直接受け取る形とする（責務を曖昧にしないため）。
 */
export function composeNormal(twisted: TwistedPose, headPlateNormal?: Vec3Tuple): TwistedPose {
  if (!headPlateNormal) {
    return twisted;
  }
  // 未実装: Head Plate NormalがEvidence A/A+で確定してから実装する。
  return twisted;
}
