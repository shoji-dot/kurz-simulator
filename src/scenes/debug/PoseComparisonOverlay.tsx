/**
 * scenes/debug/PoseComparisonOverlay.tsx ── Pose比較Ghost Overlay（Debug専用、P4-3 Step3-2）
 *
 * 【目的】2026-07-24、shojiさん承認の構成
 *   Pose Solver → Bell Adapter → Three Adapter（Debug only） → Ghost Overlay
 * のうち最終段（Ghost Overlay）。旧方式（灰）・新方式（緑）・Ground Truth（黄）の3Poseを
 * 同時表示し、Forward Error / Twist Difference / Position Difference を数値表示する。
 *
 * 【責務境界（shojiさん要件、厳守）】
 * - 本コンポーネントはPose（position+quaternion）を受け取って描画するだけで、姿勢を計算しない。
 *   quaternionの計算・合成は一切行わない（poseThreeAdapter.tsのToThree変換、poseCompareStats.ts
 *   の数値計算を除く。どちらも「新しい姿勢を決める」計算ではなく、既存Poseの変換/比較のみ）。
 * - 旧方式Pose（oldPosition/oldQuaternion）は呼び出し元（SimScene.tsx）が既存の
 *   ProsthesisModel本体の変換式（base→dir→quat→euler+angleTilt/angleTiltZ）を1対1で再現した
 *   bellMarkers useMemoの値をそのまま渡す（本ファイル側で再実装しない、既存の実装済み・
 *   shojiさん確認済みの計算を再利用する）。
 * - 新方式Pose（newPose）はengine/poseSolver（solveBellPose）の出力をそのまま受け取り、
 *   poseThreeAdapter.tsで型変換するのみ。
 *
 * 【Ground Truth】現時点でcase-001の実測Ground Truth（3D座標）はまだ存在しない
 * （engine/groundTruth/exportGroundTruth.tsが保存するのはplacementパラメータのみで、
 * quaternion/positionは保存しない設計、2026-07-23shojiさん決定）。そのため本コンポーネントは
 * 「Capture GT」ボタンで“その時点の旧方式Pose”をローカルstateへスナップショットする方式を
 * 採用する（shojiさんが実機でTransformControls/ControlPadを使い解剖学的に正しいと判断した
 * 配置を作った上でキャプチャする運用を想定）。ページリロードで消える一時的なセッション内
 * スナップショットであり、永続化・エクスポートは行わない（Safety DebugパネルのGround Truth
 * Export機能とは別物、混同しないこと）。
 *
 * 【表示条件】呼び出し元（SimScene.tsx）が ?debug=coords かつ footType==='BELL' の時のみ
 * マウントする（既存のBellDebugMarkers/BellDirectionCandidatesと同じゲーティング）。
 *
 * 【ジオメトリ】BELL専用の簡略シルエット（ヘッドプレート=円盤、シャフト=円柱、フット=球）。
 * ProsthesisModel本体（ProsthesisModels.tsx L774-785のBELL分岐）と同じローカルオフセット
 * （headOff=len/2+0.15、footOff=-(len/2)、shaftLen/shaftYのBell補正）を使い、位置関係のみを
 * 1:1で再現する。色分け表示のため本体の詳細ジオメトリ・マテリアルは複製しない
 * （本体マテリアルは色を外から指定できないため。Small Change: 本体には一切手を入れない）。
 */
import { useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { KurzProduct } from '../../data/products';
import { BELL_HEIGHT_MM, BELL_RIM_RADIUS_MM } from '../models/ProsthesisModels';
import type { Pose } from '../../engine/poseSolver/solvePose';
import { poseToThree } from './poseThreeAdapter';
import { comparePoses, type PoseCompareResult } from './poseCompareStats';

interface GhostPoseInput {
  readonly position:   THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

interface PosedProsthesisGhostProps {
  pose:         GhostPoseInput;
  shaftLength:  number;
  color:        string;
  label:        string;
}

/** BELL専用の簡略シルエット。position/quaternionは呼び出し元が渡した値をそのまま適用する。 */
function PosedProsthesisGhost({ pose, shaftLength, color, label }: PosedProsthesisGhostProps) {
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
      <Html position={[0, headOff + 0.5, 0]} center zIndexRange={[0, 10]}>
        <div style={{
          background: 'rgba(0,15,35,.88)', border: `1px solid ${color}`, borderRadius: 4,
          padding: '1px 6px', fontSize: 9, color, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function fmtDeg(v: number): string { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}°`; }
function fmtMm(v: number): string { return `${v.toFixed(3)}mm`; }

function StatRow({ label, stat }: { label: string; stat: PoseCompareResult }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ color: '#fff', fontWeight: 700 }}>{label}</div>
      {`  Forward Error : ${fmtDeg(stat.forwardErrorDeg)}\n  Twist Diff    : ${fmtDeg(stat.twistDeg)}\n  Position Diff : ${fmtMm(stat.positionDiffMm)}`}
    </div>
  );
}

export interface PoseComparisonOverlayProps {
  product:       KurzProduct;
  shaftLength:   number;
  oldPosition:   THREE.Vector3;
  oldQuaternion: THREE.Quaternion;
  newPose:       Pose;
}

export function PoseComparisonOverlay({ product: _product, shaftLength, oldPosition, oldQuaternion, newPose }: PoseComparisonOverlayProps) {
  const [capturedGT, setCapturedGT] = useState<GhostPoseInput | null>(null);

  const oldGhost: GhostPoseInput = { position: oldPosition, quaternion: oldQuaternion };
  const newGhost: GhostPoseInput = useMemo(() => poseToThree(newPose), [newPose]);

  const oldVsNew = useMemo(() => comparePoses(oldGhost, newGhost), [oldGhost, newGhost]);
  const oldVsGT  = useMemo(() => (capturedGT ? comparePoses(capturedGT, oldGhost) : null), [capturedGT, oldGhost]);
  const newVsGT  = useMemo(() => (capturedGT ? comparePoses(capturedGT, newGhost) : null), [capturedGT, newGhost]);

  return (
    <>
      <PosedProsthesisGhost pose={oldGhost} shaftLength={shaftLength} color="#9aa0a6" label="OLD" />
      <PosedProsthesisGhost pose={newGhost} shaftLength={shaftLength} color="#00e676" label="NEW" />
      {capturedGT && (
        <PosedProsthesisGhost pose={capturedGT} shaftLength={shaftLength} color="#ffd600" label="GT" />
      )}

      <Html position={[oldPosition.x, oldPosition.y - 3, oldPosition.z]} center zIndexRange={[0, 10]}>
        <div
          style={{
            background: 'rgba(0,15,35,.9)', border: '1px solid #555', borderRadius: 4,
            padding: '6px 8px', fontSize: 9, color: '#ccc', fontFamily: 'monospace',
            whiteSpace: 'pre', lineHeight: 1.5, minWidth: 190, pointerEvents: 'auto',
          }}
        >
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>Pose Comparison (P4-3 Step3-2)</div>
          <StatRow label="Old vs New" stat={oldVsNew} />
          {oldVsGT && <StatRow label="Old vs GT" stat={oldVsGT} />}
          {newVsGT && <StatRow label="New vs GT" stat={newVsGT} />}
          {!capturedGT && (
            <div style={{ color: '#888', marginBottom: 4 }}>GT未キャプチャ（下のボタンで現在のOld Poseをスナップショット）</div>
          )}
          <button
            type="button"
            onClick={() => setCapturedGT({ position: oldPosition.clone(), quaternion: oldQuaternion.clone() })}
            style={{
              fontFamily: 'monospace', fontSize: 9, padding: '2px 6px', marginRight: 4,
              cursor: 'pointer', background: '#2a2a2a', color: '#ffd600',
              border: '1px solid #555', borderRadius: 3,
            }}
          >
            Capture GT (Old Poseをスナップショット)
          </button>
          {capturedGT && (
            <button
              type="button"
              onClick={() => setCapturedGT(null)}
              style={{
                fontFamily: 'monospace', fontSize: 9, padding: '2px 6px',
                cursor: 'pointer', background: '#2a2a2a', color: '#ff8888',
                border: '1px solid #555', borderRadius: 3,
              }}
            >
              Clear GT
            </button>
          )}
        </div>
      </Html>
    </>
  );
}
