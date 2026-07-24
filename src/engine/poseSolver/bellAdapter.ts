/**
 * engine/poseSolver/bellAdapter.ts ── Bell Adapter（P4-3 Step3-1）
 *
 * 【責務】BELLフット（PORP）固有のGeometry（STAPES_HEAD等のランドマーク・selectedLength・
 * placementオフセット）を`solvePose()`の汎用入力（position/forward/up）へ変換する。
 * `solvePose()`自身はBell/PORP/TORPのいずれも一切知らない（2026-07-24、shojiさん要件:
 * 「Pose Solverを"Bell Solver"にしないこと。Bell AdapterがBell Geometry→solvePose()へ変換する」）。
 * 将来TORP/SoftClip等のAdapterを追加する場合も、本ファイルと同様にsolvePose()自体は変更しない。
 *
 * 【layering注意】STAPES_HEAD/UMBO_POS等の実測ランドマーク定数は現状
 * `scenes/models/OssicleModels.tsx`（scenes層）に定義されている。engine層はscenes層に依存しない
 * 設計方針のため、本ファイルはこれらの値をimportせず、呼び出し側（scenes層）から明示的な引数として
 * 受け取る（依存性注入）。ランドマーク定数をengine層へ移設するかどうかは別途の判断（Small Change
 * 原則により本Stepでは行わない）。
 *
 * 【現状】case-001のみを対象としたStep3-1。他14症例・他Adapter（TORP等）への一般化はStep3-2/3-3。
 */
import type { Vec3Tuple } from '../coordinates/types';
import { solvePose, type Pose, type PoseSolverInput } from './solvePose';

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
}

/**
 * BellPoseGeometryInputを`solvePose()`の汎用入力へ変換する。
 * position（返り値）は既存`ProsthesisModel`の`mid`（シャフト中点）と同じ意味を持たせる
 * （group.positionとして描画側にそのまま使える値、Three Adapter側での変換を最小化するため）。
 */
export function buildBellPoseInput(input: BellPoseGeometryInput): PoseSolverInput {
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
    position,
    forward: rawForward,
    up: input.tmNormal,
  };
}

/** BellPoseGeometryInputから直接Poseを得るショートカット（buildBellPoseInput + solvePose）。 */
export function solveBellPose(input: BellPoseGeometryInput): Pose {
  return solvePose(buildBellPoseInput(input));
}
