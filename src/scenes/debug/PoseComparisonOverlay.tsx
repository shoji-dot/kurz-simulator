/**
 * scenes/debug/PoseComparisonOverlay.tsx ── Pose比較Ghost Overlay（Debug専用、P4-3 Step3-2）
 *
 * 【目的】2026-07-24、shojiさん承認の構成
 *   Pose Solver → Bell Adapter → Three Adapter（Debug only） → Ghost Overlay
 * のうち最終段（Ghost Overlay）。旧方式（灰）・新方式（緑）・Reference Pose（黄）の3Poseを
 * 同時表示する。表示/非表示切替・数値パネル・Reference Pose捕捉ボタンはHUD側（呼び出し元の
 * SimScene.tsx、Canvas外側のDOM）が担当する（2026-07-24、shojiさんレビュー「ラベルは3D空間
 * ではなくHUD上で管理すべき」対応。理由: 3D空間内Htmlラベルはドラッグ・回転操作後に重なって
 * 判読しにくくなるため、既存のSafety Debugパネルと同じ「Canvas外側の固定DOM」パターンに統一）。
 *
 * 【責務境界（shojiさん要件、厳守）】
 * - 本コンポーネントはPose（position+quaternion、THREE型）を受け取って描画するだけで、姿勢の
 *   計算・変換は一切行わない。Three Adapter（poseThreeAdapter.ts、QuaternionTuple→THREE変換）
 *   の呼び出しは呼び出し元（SimScene.tsx）側で完了させ、本コンポーネントはTHREE型のみを扱う。
 * - 旧方式Pose（oldGhost）は呼び出し元が既存の`bellMarkers`（ProsthesisModel本体の変換式を
 *   1対1で再現、shoji確認済み）から渡す値をそのまま使う。
 *
 * 【ジオメトリ】BELL専用の簡略シルエット（ヘッドプレート=円盤、シャフト=円柱、フット=球）。
 * ProsthesisModel本体（ProsthesisModels.tsx L774-785のBELL分岐）と同じローカルオフセット
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
  readonly old:       boolean;
  readonly new:       boolean;
  readonly reference: boolean;
}

export interface PoseComparisonOverlayProps {
  shaftLength:    number;
  oldGhost:       GhostPoseInput;
  newGhost:       GhostPoseInput;
  referenceGhost: GhostPoseInput | null;
  visibility:     PoseVisibility;
}

/** 色は呼び出し元（SimScene.tsx）のHUD凡例と共有する定数。 */
export const POSE_COLOR_OLD       = '#9aa0a6';
export const POSE_COLOR_NEW       = '#00e676';
export const POSE_COLOR_REFERENCE = '#ffd600';

export function PoseComparisonOverlay({ shaftLength, oldGhost, newGhost, referenceGhost, visibility }: PoseComparisonOverlayProps) {
  return (
    <>
      {visibility.old && (
        <PosedProsthesisGhost pose={oldGhost} shaftLength={shaftLength} color={POSE_COLOR_OLD} />
      )}
      {visibility.new && (
        <PosedProsthesisGhost pose={newGhost} shaftLength={shaftLength} color={POSE_COLOR_NEW} />
      )}
      {visibility.reference && referenceGhost && (
        <PosedProsthesisGhost pose={referenceGhost} shaftLength={shaftLength} color={POSE_COLOR_REFERENCE} />
      )}
    </>
  );
}
