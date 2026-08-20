/**
 * scenes/debug/PoseComparisonOverlay.tsx ── Pose比較Ghost Overlay（Debug専用、P4-3 Step3-2〜P4B-3 Step4）
 *
 * 【目的】2026-07-24、shojiさん承認の構成
 *   Pose Solver → Bell Adapter → Three Adapter（Debug only） → Ghost Overlay
 * のうち最終段（Ghost Overlay）。Reference（灰）・Candidate（緑）・Anchor（黄）の3Poseを
 * 同時表示する。表示/非表示切替・数値パネル・Anchor Pose捕捉ボタンはHUD側（呼び出し元の
 * SimScene.tsx、Canvas外側のDOM）が担当する（2026-07-24、shojiさんレビュー「ラベルは3D空間
 * ではなくHUD上で管理すべき」対応。理由: 3D空間内Htmlラベルはドラッグ・回転操作後に重なって
 * 判読しにくくなるため、既存のSafety Debugパネルと同じ「Canvas外側の固定DOM」パターンに統一）。
 *
 * 【用語（P4B-3 Step4、2026-07-28確定）】
 *   - Reference Pose: ProsthesisModelが実際に描画へ使うPose（computeProsthesisModelPose()の
 *     戻り値そのもの、旧「OLD」）。P4B-3 Acceptance Criteria #3の比較基準。
 *   - Candidate Pose: 新Pose Solver（solveBellPose）の出力（旧「NEW」）。
 *   - Anchor Pose: ユーザーが任意のタイミングで手動キャプチャする基準姿勢（旧「Reference」、
 *     命名衝突のため改名）。ページリロードで消える一時的なセッション内スナップショット。
 *
 * 【責務境界（shojiさん要件、厳守）】
 * - 本コンポーネントはPose（position+quaternion、THREE型）を受け取って描画するだけで、姿勢の
 *   計算・変換は一切行わない。
 * - Reference Pose（referenceGhost）は呼び出し元が`computeProsthesisModelPose()`
 *   （ProsthesisModel本体が実際に使う関数そのもの、再実装ではない）から渡す値をそのまま使う
 *   （P4B-3 Acceptance Criteria #3）。
 *
 * 【ジオメトリ】BELL専用の簡略シルエット（ヘッドプレート=円盤、シャフト=円柱、フット=球）。
 * ProsthesisModel本体（ProsthesisModels.tsx BELL分岐）と同じローカルオフセット
 * （headOff=len/2+0.15、footOff=-(len/2)、shaftLen/shaftYのBell補正）を使い、位置関係のみを
 * 1:1で再現する。色分け表示のため本体の詳細ジオメトリ・マテリアルは複製しない（本体マテリアルは
 * 色を外から指定できないため。Small Change: 本体には一切手を入れない）。
 */
import * as THREE from 'three';
import { BELL_HEIGHT_MM, BELL_RIM_RADIUS_MM } from '../models/ProsthesisModels';

export interface GhostPoseInput {
  readonly position:   THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

interface PosedProsthesisGhostProps {
  pose:        GhostPoseInput;
  shaftLength: number;
  color:       string;
}

/** BELL専用の簡略シルエット。position/quaternionは呼び出し元が渡した値をそのまま適用する。 */
function PosedProsthesisGhost({ pose, shaftLength, color }: PosedProsthesisGhostProps) {
  // [R4 Geometry Migration Shaft Fix、調査時にArchitect Decisionの記載を再検証: docs/D4_Shaft_
  // Geometry_R4_Migration_Architect_Decision_v1.0.md、Consumer #3] 変更しない。理由:
  // このGhostへ渡される`pose`（referenceGhost/candidateGhost/anchorGhost、いずれもSimScene.tsx側）
  // は現状すべてcomputeProsthesisModelPose()/solveBellPose()由来のR1 shaft-midpoint position
  // であり、resolveCanonicalPose()（R4）は経由していない（本Fixのスコープ外、P4B-3 Pose Solver
  // 比較機能自体の変更が必要になるため）。したがって本関数のfootOff/headOff/shaftYを先だけ
  // R4へ変えると、position（R1 midpoint基準）とlocal offset解釈（R4 anchor基準）が食い違い、
  // 3つのGhostがまとめてshaftLength/2だけ誤表示される新たな不整合を生む。現状のfootOff=
  // -(len/2)/headOff=len/2+0.15/shaftY=BELL_HEIGHT_MM/2は、そのR1 position入力に対しては
  // 内部的に整合しており（式は元々R1向けに正しい）、単体では「Bug」ではない。3 Ghost間の相対比較
  // （poseStats、SimScene.tsx:2088-2100）も全Ghostが同じ式を使う限り相対値は不変のため影響しない。
  // Pose Solver比較機能全体をR4へ揃えるかはArchitect判断が必要な別Scopeとして20節で報告する
  // （Do Not Expand Scope、trainee-facing側には一切影響しない、?debug=coords限定のDebug専用）。
  const shaftLen = Math.max(0.01, shaftLength - BELL_HEIGHT_MM);
  const shaftY   = BELL_HEIGHT_MM / 2;
  const headOff  = shaftLength / 2 + 0.15;
  const footOff  = -(shaftLength / 2);

  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      {/* Head plate（簡略: 円盤、面の法線=local Y=シャフト軸） */}
      <mesh position={[0, headOff, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, shaftY, 0]}>
        <cylinderGeometry args={[0.10, 0.10, shaftLen, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* Foot（簡略: 球） */}
      <mesh position={[0, footOff, 0]}>
        <sphereGeometry args={[BELL_RIM_RADIUS_MM, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

export interface PoseVisibility {
  readonly reference: boolean;
  readonly candidate: boolean;
  readonly anchor:    boolean;
}

export interface PoseComparisonOverlayProps {
  shaftLength:     number;
  referenceGhost:  GhostPoseInput;
  candidateGhost:  GhostPoseInput;
  anchorGhost:     GhostPoseInput | null;
  visibility:      PoseVisibility;
}

/** 色は呼び出し元（SimScene.tsx）のHUD凡例と共有する定数。 */
export const POSE_COLOR_REFERENCE = '#9aa0a6';
export const POSE_COLOR_CANDIDATE = '#00e676';
export const POSE_COLOR_ANCHOR    = '#ffd600';

export function PoseComparisonOverlay({ shaftLength, referenceGhost, candidateGhost, anchorGhost, visibility }: PoseComparisonOverlayProps) {
  return (
    <>
      {visibility.reference && (
        <PosedProsthesisGhost pose={referenceGhost} shaftLength={shaftLength} color={POSE_COLOR_REFERENCE} />
      )}
      {visibility.candidate && (
        <PosedProsthesisGhost pose={candidateGhost} shaftLength={shaftLength} color={POSE_COLOR_CANDIDATE} />
      )}
      {visibility.anchor && anchorGhost && (
        <PosedProsthesisGhost pose={anchorGhost} shaftLength={shaftLength} color={POSE_COLOR_ANCHOR} />
      )}
    </>
  );
}
