/**
 * engine/groundTruth/exportGroundTruth.ts ── Ground Truth Export（Phase22.3 準備）
 *
 * 【背景】2026-07-22〜23、PORP/軟骨の理想配置角度の再調査で、現行コードには
 * 「鼓膜面」という解剖学的基準が存在しないことが判明（engine/coordinates/tympanicMembrane.ts
 * 参照）。実物PORPのHead-Shaft固定角度という値も存在しない（多重物理拘束で決まるため）ため、
 * 「理想角度を計算式で導く」方針を撤回し、「shojiさんがアプリ上で作った理想配置（placement）を
 * 正解データとして保存する」Ground Truth Capture方式へ転換した（shojiさん判断、2026-07-22）。
 *
 * 【設計】PlacementState（selectedLength/lateralOffset/anteriorOffset/verticalOffset/
 * angleTilt/angleTiltZ/dragOffsetX/dragOffsetY/dragOffsetZ）の8変数のみを保存する。
 * CartilageSliceは独立状態を持たず同じplacementから導出されるため、この8変数のみで
 * PORP/TORP/Cartilage全ての姿勢を再現できる（shojiさん確認済み）。
 * Quaternion等の計算結果（Pose Solverの出力）は保存しない — Ground Truthは
 * 「どう操作したか」という入力であり、結果ではない（shojiさん、2026-07-23）。
 *
 * poseSolverフィールドについて: 現行のProsthesisModel実装（dir=normalize(UMBO_POS-base)による
 * 単一ベクトル姿勢決定）をshojiさんが`CurrentAxisAlignmentModel`と命名した
 * （docs/PoseModelBaseline.md参照）。将来Pose Solverが刷新された場合（例: TMPoseSolverV1等）、
 * このフィールドにより「どのSolverで取得されたGround Truthか」を後から判別できる
 * （shojiさん要望、2026-07-23）。
 *
 * 本ファイルはengine層の純粋関数のみで構成し、scenes層（React/UI）には依存しない。
 * 呼び出し元はscenes/SimScene.tsx（Safety Debugパネル、?debug=coords限定）を想定。
 *
 * Frozen Layer尊重: 既存のPlacementState/SurgicalCase/KurzProduct型はそのまま参照するのみで
 * 変更しない。Phase1〜22の既存領域には一切触れない。
 */
import type { PlacementState } from '../../store/useSimStore';

/**
 * 現行のPose Model識別子。ProsthesisModel/CartilageSliceが共通で使っている
 * 「dir=normalize(UMBO_POS-base)による単一ベクトル姿勢決定」ロジックの名称
 * （docs/PoseModelBaseline.md、shojiさん命名）。
 * Pose Solverが刷新されたら、このファイルではなく呼び出し元で新しいバージョン識別子に
 * 差し替えること（本定数自体は「現行モデルの名前」であり、可変のバージョン管理機構ではない）。
 */
export const POSE_SOLVER_VERSION = 'CurrentAxisAlignmentModel' as const;

/** Ground Truth 1症例分のレコード。GroundTruth/{PRODUCT}/{caseId}.json 相当の構造。 */
export interface GroundTruthRecord {
  readonly poseSolver: string;
  readonly caseId: string;
  readonly productId: string;
  /** ISO 8601（例: 2026-07-23T10:30:12.000Z）。Landmark更新前後の追跡用。 */
  readonly createdAt: string;
  readonly placement: PlacementState;
}

/**
 * 現在のcaseId/productId/placementからGround Truthレコードを構築する。
 * @param now テスト用の時刻注入点。省略時は呼び出し時点のUTC時刻。
 */
export function buildGroundTruthRecord(
  caseId: string,
  productId: string,
  placement: PlacementState,
  now: () => string = () => new Date().toISOString(),
): GroundTruthRecord {
  return {
    poseSolver: POSE_SOLVER_VERSION,
    caseId,
    productId,
    createdAt: now(),
    placement: { ...placement },
  };
}
