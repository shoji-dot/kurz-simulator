/**
 * engine/poseSolver/bellAdapter.ts ── Bell Adapter（P4-3 Step3-1、P4B-2で薄型化）
 *
 * 【責務】BELLフット（PORP）固有のGeometry（STAPES_HEAD等のランドマーク・selectedLength・
 * placementオフセット）を、Pose Solverの3層API（solvePose→composeTwist→将来composeNormal）
 * へ渡すための入力（PoseInput + twistReference）へ変換する。**Quaternion計算は一切行わない**
 * （2026-07-24、shojiさん要件:「Pose Solverを"Bell Solver"にしないこと。Bell Adapterが
 * Bell Geometry→solvePose()へ変換する」。2026-07-28、P4B-2レビューで「bellAdapterは薄く保つ」
 * 方針を再確認・維持）。将来TORP/SoftClip等のAdapterを追加する場合も、本ファイルと同様に
 * solvePose()/composeTwist()自体は変更しない。
 *
 * 【layering注意】STAPES_HEAD/UMBO_POS等の実測ランドマーク定数は現状
 * `scenes/models/OssicleModels.tsx`（scenes層）に定義されている。engine層はscenes層に依存しない
 * 設計方針のため、本ファイルはこれらの値をimportせず、呼び出し側（scenes層）から明示的な引数として
 * 受け取る（依存性注入）。ランドマーク定数をengine層へ移設するかどうかは別途の判断（Small Change
 * 原則により本Stepでは行わない）。
 *
 * 【2026-07-28 P4B-2改訂】`buildBellPoseInput()`の返り値を、quaternion計算まで含んだ
 * `PoseSolverInput`（forward+up混在）から、`{ poseInput, twistReference }`という
 * 「PoseInput（forwardのみ）」と「twist解決用の参照ベクトル」を明確に分離した形へ変更した。
 * 外部公開APIである`solveBellPose()`の入出力（`BellPoseGeometryInput`→`Pose`）は無変更。
 * 内部実装のみ`buildBellPoseInput→solvePose→composeTwist`の3段に分解し、数式は一切変更して
 * いない（P4B-1のNode検証で移設前後の出力が完全一致することを確認済み）。
 *
 * 【現状】case-001含むBELL/PORP 8症例（case-001/003/004/005/007/008/011/012）でNode検証済み
 * （P4B-1、2026-07-28）。他14症例（TORP/SoftClip）への一般化は別Adapterで行う想定。
 */
import type { Vec3Tuple } from '../coordinates/types';
import { solvePose, composeTwist, composeTilt, type Pose, type PoseInput } from './solvePose';

export interface BellPoseGeometryInput {
  /** Bellの取り付け基準点（現行STAPES_HEAD相当、ワールド座標）。 */
  readonly stapesHead: Vec3Tuple;
  /** forward（long axis）の目標点（現行UMBO_POS相当、ワールド座標）。 */
  readonly umboTarget: Vec3Tuple;
  /** twistを確定するための参照up方向（TMCoordinateFrame.normal相当）。 */
  readonly tmNormal: Vec3Tuple;
  /** シャフト長（PlacementState.selectedLengthと同じ意味、mm）。 */
  readonly shaftLength: number;
  /** PlacementStateのlateralOffset + dragOffsetX相当（既にオフセット加算済みの値）。 */
  readonly lateralOffset: number;
  /** PlacementStateのverticalOffset + dragOffsetY相当。 */
  readonly verticalOffset: number;
  /** PlacementStateのanteriorOffset + dragOffsetZ相当。 */
  readonly anteriorOffset: number;
  /**
   * PlacementState.angleTilt相当（degrees、前後傾斜）。P4B-4でcomposeTilt()へ配線。
   * 省略時は0（tilt無し）として扱う。
   */
  readonly angleTilt?: number;
  /** PlacementState.angleTiltZ相当（degrees、左右傾斜）。省略時は0。 */
  readonly angleTiltZ?: number;
}

/** buildBellPoseInput()の返り値。PoseInput（forwardのみ）とtwist解決用の参照ベクトルを分離する。 */
export interface BellPoseInputs {
  /** solvePose()へ渡すPoseInput（position + forwardのみ、quaternion計算を含まない）。 */
  readonly poseInput: PoseInput;
  /** composeTwist()へ渡すtwist解決用の参照ベクトル（Bellの場合はtmNormal）。 */
  readonly twistReference: Vec3Tuple;
}

/**
 * BellPoseGeometryInputを`solvePose()`/`composeTwist()`の入力へ変換する。
 * position（返り値）は既存`ProsthesisModel`の`mid`（シャフト中点）と同じ意味を持たせる
 * （group.positionとして描画側にそのまま使える値、Three Adapter側での変換を最小化するため）。
 * **Quaternion計算は行わない**（poseInput.forwardとtwistReferenceを分離して返すのみ）。
 */
export function buildBellPoseInput(input: BellPoseGeometryInput): BellPoseInputs {
  const base: Vec3Tuple = [
    input.stapesHead[0] + input.lateralOffset,
    input.stapesHead[1] + input.verticalOffset,
    input.stapesHead[2] + input.anteriorOffset,
  ];
  const rawForward: Vec3Tuple = [
    input.umboTarget[0] - base[0],
    input.umboTarget[1] - base[1],
    input.umboTarget[2] - base[2],
  ];
  const halfShaft = input.shaftLength / 2;
  // mid = base + normalize(rawForward) * halfShaft 相当だが、正規化はsolvePose側でも行うため
  // ここでは長さで割ってから半分のシャフト長を掛ける形で明示的に計算する。
  const rawLen = Math.hypot(rawForward[0], rawForward[1], rawForward[2]);
  const unitForward: Vec3Tuple = rawLen > 1e-9
    ? [rawForward[0] / rawLen, rawForward[1] / rawLen, rawForward[2] / rawLen]
    : [0, 1, 0];
  const position: Vec3Tuple = [
    base[0] + unitForward[0] * halfShaft,
    base[1] + unitForward[1] * halfShaft,
    base[2] + unitForward[2] * halfShaft,
  ];

  return {
    poseInput: { position, forward: rawForward },
    twistReference: input.tmNormal,
  };
}

/**
 * BellPoseGeometryInputから直接Poseを得るショートカット。
 * 内部で `buildBellPoseInput → solvePose → composeTwist → composeTilt` を順に呼ぶ薄い
 * オーケストレーターであり、本関数自体はquaternion計算を行わない
 * （2026-07-28 P4B-2、外部公開の入出力は無変更）。
 *
 * 【2026-07-28 P4B-4追記】`angleTilt`/`angleTiltZ`（省略時は共に0）を`composeTwist()`の後段で
 * `composeTilt()`へ渡すよう拡張した。0を渡した場合、`composeTilt`は`Rx_world(0)·q·Rz_local(0)`と
 * なり恒等演算のため、既存呼び出し元（tilt引数を渡さない箇所）の出力には影響しない。
 */
export function solveBellPose(input: BellPoseGeometryInput): Pose {
  const { poseInput, twistReference } = buildBellPoseInput(input);
  const twisted = composeTwist(solvePose(poseInput), twistReference);
  return composeTilt(twisted, input.angleTilt ?? 0, input.angleTiltZ ?? 0);
}
