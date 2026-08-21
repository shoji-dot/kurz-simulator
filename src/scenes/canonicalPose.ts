/**
 * canonicalPose.ts ── D-4 Canonical Pose Generator（Rendering / Collision Candidateの単一Source of Truth）
 *
 * [Architect Decision] docs/D4_Architect_Manipulation_Axis_Pose_Semantics_Decision_v1.0.md（FINALIZED）
 * [Implementation Specification] docs/D4_Implementation_Specification_v1.0.md Section 2-4
 *
 * D-4-Bで確認された「Rendering PoseとCollision Candidate Poseが別々の近似式で計算され、既存offsetの
 * 欠落・二重加算が起きる」という問題を、両者が必ずこの1関数を通る設計そのもので構造的に防止する
 * （SimScene.tsx側のcomposeDragCandidatePose/composeRotationCandidatePoseは本モジュール導入により
 * 呼び出し元を持たなくなる、Decision 7）。
 *
 * Rotation R4のsign（Decision 3、PENDING REAL-DEVICE CONFIRMATION）はtransformControlsConfig.tsの
 * ANGLE_TILT_SIGN/ANGLE_TILT_Z_SIGNへ隔離済み。実機確認後の符号修正はその2定数の反転のみで完結する
 * （Implementation Specification Section 6.1）。
 */
import * as THREE from 'three';
import type { KurzProduct } from '../data/products';
import { UMBO_POS, UMBO_POS_TORP } from './models/OssicleModels';
import { computeCurrentAxisAlignmentOrientation } from './models/ProsthesisModels';
import { ANGLE_TILT_SIGN, ANGLE_TILT_Z_SIGN } from './transformControlsConfig';

export interface CanonicalPoseCommittedInputs {
  product: KurzProduct;
  shaftLength: number;
  basePos: THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  verticalOffset: number;
  dragOffsetX: number;
  dragOffsetY: number;
  dragOffsetZ: number;
  angleTilt: number;
  angleTiltZ: number;
  shaftRollDeg: number;
  /** Section 3（Base Alignment Specification）。Placement段階では必須（null不可、呼び出し側で保証する）。 */
  baseAlignmentQuaternion: THREE.Quaternion;
}

/**
 * candidate: 「まだcommitされていない評価対象の変化分」（排他的discriminated union）。
 * kind:'translate'のlocalDeltaはDELTA（committed.dragOffsetX/Y/Zへ別項として加算）。
 * kind:'rotate'/'shaftRoll'のcandidateAngleはABSOLUTE VALUE（committedの値を丸ごと置換）。
 * Implementation Specification Section 4.1参照。
 */
export type CanonicalPoseCandidateDelta =
  | { kind: 'translate'; localDelta: THREE.Vector3 }
  | { kind: 'rotate'; axis: 'tilt' | 'tiltZ'; candidateAngle: number }
  | { kind: 'shaftRoll'; candidateAngle: number };

export interface CanonicalPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * Placement段階（manipulation.committed===true）でControlPad（SimSceneの兄弟コンポーネント、
 * DraggableProsthesis内部のCollision Constraint参照refに直接アクセスできない）からCanonical Pose
 * Generator + Collision Candidate評価を経由してPlacementStateを更新するための橋渡し。
 * 既存のTransportControls（ManipulationLayer.tsx、Transport段階向けの同種の橋渡し）と同じ
 * 「SimScene内部の関数をコールバックとして親経由でControlPadへ公開する」パターンを踏襲する
 * （Implementation Specification Section 11、Requirement 4: ControlPad Translation/Rotate/
 * Shaft RollのCollision Candidate評価への接続）。
 */
export interface PlacementControls {
  translate: (axis: 'x' | 'y' | 'z', deltaMm: number) => void;
  rotate: (axis: 'tilt' | 'tiltZ', deltaDeg: number) => void;
  rotateShaftRoll: (deltaDeg: number) => void;
  /**
   * [M-2、M1 Investigation §6/§3③] タッチ操作でのDepth（camera-relative奥/手前移動）用。
   * PageUp/PageDown（SimScene.tsx keydownハンドラ）が使うのと同一のperformDepthStep()を
   * 呼ぶだけの薄いラッパー——camera.getWorldDirection()→evaluateDragCandidate()という既存の
   * Collision Candidate経路をそのまま再利用し、新規Depth/Collision実装は一切追加しない。
   * sign: 1=奥（PageDownと同じ）、-1=手前（PageUpと同じ）。fine: true時はKEYBOARD_STEP_CTRL_MM。
   */
  depthStep: (sign: 1 | -1, fine: boolean) => void;
  /**
   * Depth Sessionの終了（keyupのendDepthSession(true)と同じ、通常Poseへのslerp Releaseを開始する）。
   * タッチ操作ではpointerup/pointerleave/pointercancelで呼ぶ。
   */
  endDepth: () => void;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * Base Alignment Quaternion（Section 3.1）: Placement Commit時点のbaseから、UMBO_POS
 * （またはFLAT/PISTONはUMBO_POS_TORP）方向を向く、tilt無し(0,0)の基準姿勢。
 * computeProsthesisModelPose()（ProsthesisModels.tsx:1742-1762）と同じfootType判定式を
 * ここでも複製する（store/scenes層が独立してclamp3等を複製している既存の前例と同じ方針）。
 */
export function computeBaseAlignmentQuaternion(product: KurzProduct, base: THREE.Vector3): THREE.Quaternion {
  const target = ['FLAT', 'PISTON'].includes(product.footType) ? UMBO_POS_TORP : UMBO_POS;
  return computeCurrentAxisAlignmentOrientation({ base, target, angleTilt: 0, angleTiltZ: 0 }).quaternion;
}

const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);

/**
 * resolveCanonicalPose(): Rendering/Collision Candidate共通のPose生成関数（Section 4.3）。
 * candidate省略時 = 現在Renderingされているべき値（INVARIANT 1）。
 * candidate指定時 = 評価対象の候補Pose（INVARIANT 2）。
 */
export function resolveCanonicalPose(
  committed: CanonicalPoseCommittedInputs,
  candidate?: CanonicalPoseCandidateDelta,
): CanonicalPose {
  const translateDelta = candidate?.kind === 'translate' ? candidate.localDelta : ZERO_VECTOR;

  const position = committed.basePos.clone()
    .add(new THREE.Vector3(
      committed.lateralOffset + committed.dragOffsetX,
      committed.verticalOffset + committed.dragOffsetY,
      committed.anteriorOffset + committed.dragOffsetZ,
    ))
    .add(translateDelta);

  const tiltX = (candidate?.kind === 'rotate' && candidate.axis === 'tilt')
    ? candidate.candidateAngle : committed.angleTilt;
  const tiltZ = (candidate?.kind === 'rotate' && candidate.axis === 'tiltZ')
    ? candidate.candidateAngle : committed.angleTiltZ;
  const roll = candidate?.kind === 'shaftRoll' ? candidate.candidateAngle : committed.shaftRollDeg;

  // Q = Rx(angleTilt) * Rz(angleTiltZ) * BaseAlignment * Roll(shaftRoll)
  // MUST: 乗算順序を入れ替えない（Architect Decision Section 6.3 / Implementation Specification 4.3）。
  const quaternion = new THREE.Quaternion()
    .setFromAxisAngle(AXIS_X, THREE.MathUtils.degToRad(tiltX * ANGLE_TILT_SIGN))
    .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, THREE.MathUtils.degToRad(tiltZ * ANGLE_TILT_Z_SIGN)))
    .multiply(committed.baseAlignmentQuaternion)
    .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, THREE.MathUtils.degToRad(roll)));

  return { position, quaternion };
}
