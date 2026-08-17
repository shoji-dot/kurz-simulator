/**
 * SimScene.tsx  ── シミュレーションモード 3D シーン（GLBリアルモデル版）
 *
 * ▼ モデル変換
 *   <group rotation={[Math.PI, -Math.PI/2, 0]}>
 *   内包する全ての子（GLBモデル・プロステーシス）に適用。
 *   【2026-07-21訂正】このコメントは以前「GLB[x, y, z] → world[z, -y, x]」という回転の変換式を
 *   記載していたが、これは検証されていない誤った式だった（正しい式はengine/coordinates/
 *   transforms.tsのPhase3.1コメント・glbLocalToWorld()参照、Three.js実行検証済み）。本ファイルの
 *   座標計算（basePos・DANGER_ZONES比較等）はこの回転式に依存しないため実害はないが、誤解を
 *   避けるため式そのものは削除した。回転の向き自体（X+=Lateral/Y+=Superior/Z+=Anterior、下部の
 *   GizmoHelperラベル参照）は引き続き有効。
 *
 * ▼ GLBオフセット
 *   GLB座標系の原点 = アブミ骨底板 = ローカル[0.84, -2.65, 2.12]
 *   → GLBグループを STAPES_FOOTPLATE (ローカル値) 位置にオフセット。
 *   この値（GLB_OFFSET）は data/dangerZones.ts（DANGER_ZONES、原点=アブミ骨底板(0,0,0)）が使う
 *   座標系との平行移動オフセットと厳密に一致する（回転は共有の親グループが適用するため両者の
 *   相対距離には影響しない、Phase20.4で数値検証済み）。DANGER_ZONESとの変換が必要な場合は
 *   engine/coordinates/placementFrame.ts の placementPointToDangerZoneFrame() /
 *   dangerZonePointToPlacementFrame() を使うこと（このファイル内で新たに変換式を書き起こさない）。
 *
 * ▼ TransformControls によるドラッグ配置
 *   プロステーシスを world 空間でドラッグ → mouseup 時に dragOffset を更新
 *   OrbitControls はドラッグ中に無効化
 */

import { Suspense, useRef, useEffect, useMemo, useState, useCallback, type RefObject } from 'react';
import { Canvas, useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  STAPES_HEAD,
  STAPES_FOOTPLATE,
  UMBO_POS,
} from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis, BELL_HEIGHT_MM, BELL_RIM_RADIUS_MM, computeCurrentAxisAlignmentOrientation, computeProsthesisModelPose, SoftClipPocketPreview, SoftClipBandLoopPreview, SoftClipBandLoopAttachedPreview, getSoftClipBandLoopDefaultAttachTransform, type SoftClipBandLoopAttachTransform } from './models/ProsthesisModels';
import { ANATOMICAL_VIEWS, SURGICAL_VIEWS } from './ViewPresets';
import { Z_INDEX } from '../components/ui';
import { isCoordDebugMode, isSceneDumpDebugMode, isCollisionVerifyDebugMode } from '../utils/debugMode';
import { CoordinateDebugPanel, CoordinateDebugTracker, CoordinateDebugScene3D } from './debug/CoordinateDebugOverlay';
import { SceneDumpPanel, SceneDumpTracker, type SceneDumpResult } from './debug/SceneDumpOverlay';
import { CollisionVerifyPanel, CollisionVerifyTracker, CollisionBoundaryWarpTracker, RotationBoundaryWarpTracker, type CollisionVerifyCaseResult } from './debug/CollisionVerifyOverlay';
import { DANGER_ZONES } from '../data/dangerZones';
import { placementPointToDangerZoneFrame, dangerZonePointToPlacementFrame } from '../engine/coordinates/placementFrame';
import { findNearestDangerZone } from '../engine/safety';
import { buildGroundTruthRecord } from '../engine/groundTruth/exportGroundTruth';
import { solveBellPose } from '../engine/poseSolver/bellAdapter';
import { solvePose, composeTwist, composeTilt } from '../engine/poseSolver/solvePose';
import { TM_NORMAL } from '../engine/coordinates/tympanicMembrane';
import {
  PoseComparisonOverlay,
  POSE_COLOR_REFERENCE,
  POSE_COLOR_CANDIDATE,
  POSE_COLOR_ANCHOR,
  type GhostPoseInput,
  type PoseVisibility,
} from './debug/PoseComparisonOverlay';
import { poseToThree } from './debug/poseThreeAdapter';
import { comparePoses, angleToVectorDeg } from './debug/poseCompareStats';
import type { Vec3Tuple } from '../engine/coordinates/types';
import { TRANSLATION_SNAP_MM, KEYBOARD_STEP_MM, KEYBOARD_STEP_CTRL_MM, ROTATION_STEP_DEG, ROTATION_STEP_FINE_DEG, DIRECT_MANIPULATION_UX, COLLISION_CONSTRAINT_ENABLED } from './transformControlsConfig';
import { useAnatomyCollisionIndex, type AnatomyCollisionKey } from '../engine/collision/anatomyCollisionIndex';
import { buildProsthesisCollisionProxy, FOOT_CONTACT_TOLERANCE_MM } from '../engine/collision/prosthesisCollisionGeometry';
import { testCollision } from '../engine/collision/collisionTest';
import {
  TransportProsthesis,
  DirectTransportProsthesis,
  createInitialTransportPose,
  useScreenSpaceDrag,
  nudgeTransportPosition,
  nudgeTransportTilt,
  INITIAL_MANIPULATION_STATE,
  INITIAL_TRANSPORT_TILT,
  type TransportPose,
  type TransportTilt,
  type TransportControls,
  type ManipulationState,
} from './transport/ManipulationLayer';

// ── カメラ視点 保存/復元 ────────────────────────────────────────
const _SIM_KEY     = 'kurz_cam_sim';
const _SIM_VERSION = 4;
const _SIM_DEFAULT: { pos: [number,number,number]; target: [number,number,number] } = {
  // overview 方向（外側＋前方＋上方）+ SIM_OFF[2.12,2.65,0.84]
  pos: [-37.88, -22.35, 45.84], target: [2.12, 14.65, -2.16],
};
// P4-3 Step3-2: Pose比較Overlay用。TM_NORMALはengine層のVec3Tuple定数のためTHREE型へ変換して
// 保持する（Three Adapterの責務と同じ「成分コピーのみ」、モジュールスコープで1回だけ変換）。
const TM_NORMAL_VEC3 = new THREE.Vector3(TM_NORMAL[0], TM_NORMAL[1], TM_NORMAL[2]);

function _loadSimCam() {
  try {
    const raw = localStorage.getItem(_SIM_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === _SIM_VERSION && Array.isArray(d.pos) && d.pos.length === 3 && Array.isArray(d.target) && d.target.length === 3)
        return d as typeof _SIM_DEFAULT;
    }
  } catch { /* */ }
  return _SIM_DEFAULT;
}
let _simCam = { ..._SIM_DEFAULT };
let _simOrbit: any = null;
export function saveSimCam(): void {
  localStorage.setItem(_SIM_KEY, JSON.stringify({ ..._simCam, version: _SIM_VERSION }));
}
/** 現在のカメラ視点を返す（ViewPresetPanel カスタム保存用） */
export function getSimCam(): { pos: [number,number,number]; target: [number,number,number] } {
  return { pos: [..._simCam.pos] as [number,number,number], target: [..._simCam.target] as [number,number,number] };
}
export function resetSimCam(): void {
  localStorage.removeItem(_SIM_KEY);
  _simCam = { ..._SIM_DEFAULT };
  if (_simOrbit) {
    const [px, py, pz] = _SIM_DEFAULT.pos;
    const [tx, ty, tz] = _SIM_DEFAULT.target;
    _simOrbit.object.position.set(px, py, pz);
    _simOrbit.target.set(tx, ty, tz);
    _simOrbit.update();
  }
}
/** カメラをプリセットビューにジャンプ */
export function setSimCameraView(view: import('./ViewPresets').CameraView): void {
  if (!_simOrbit) return;
  const [px, py, pz] = view.pos;
  const [tx, ty, tz] = view.target;
  _simOrbit.object.up.set(...(view.up ?? [0, 1, 0]) as [number,number,number]);
  _simOrbit.object.position.set(px, py, pz);
  _simOrbit.target.set(tx, ty, tz);
  _simOrbit.update();
  _simCam = { pos: [px, py, pz], target: [tx, ty, tz] };
}
import {
  RealAnatomy,
  RealMalleus,
  RealIncus,
  RealStapes,
  StapesFootplateHighlight,
  GHOST_OPACITY,
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from './models/RealAnatomyModels';
import { useSimStore } from '../store/useSimStore';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';
import type { PlacementState } from '../store/useSimStore';

// GLBモデル群をアブミ骨底板（STAPES_FOOTPLATE）位置にオフセットするためのベクトル
const GLB_OFFSET: [number, number, number] = [
  STAPES_FOOTPLATE.x,
  STAPES_FOOTPLATE.y,
  STAPES_FOOTPLATE.z,
];

// SimScene デフォルト表示設定
export const SIM_DEFAULT_VIS: VisibilityMap = {
  bone:          'solid',
  auricle:       'hidden',
  ossicles:      'hidden',   // GLB 耳小骨は症例別に直接レンダリング（旧キー）
  malleus:       'solid',    // 個別制御：サイドバー既定は実体
  incus:         'solid',
  stapes:        'solid',
  tympanic:      'solid',
  innerEar:      'solid',
  facialNerve:   'solid',
  chordaTympani: 'solid',    // 鼓索神経：手術視野に近いため solid
  eac:           'solid',
  roundWindow:   'solid',
};

// Phase1-C（Direct Manipulation Rotate Mode、Architect実装指示2026-08-15）: 'rotate'を追加。
// 既存の'move'/'view'の意味・既存コード上の分岐は無変更（isMove = dragMode==='move'は
// dragMode==='rotate'時に自動的にfalseとなるため、Keyboard Rotationリスナー等の既存ガードは
// 変更なしで正しくRotate Mode中も無効のままになる）。
export type DragMode = 'move' | 'rotate' | 'view';
export type SimViewMode = 'normal' | 'microscope' | 'endoscope';

// ── 顕微鏡モード: FOV切替コントローラー ─────────────────────────────
const SIM_VIEW_FOV: Record<SimViewMode, number> = { normal: 38, microscope: 11, endoscope: 112 };
function SimViewModeController({ mode, fovOverride }: { mode: SimViewMode; fovOverride?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = (mode === 'microscope' && fovOverride !== undefined) ? fovOverride : SIM_VIEW_FOV[mode];
    cam.updateProjectionMatrix();
  }, [mode, fovOverride, camera]);
  return null;
}

// ── 顕微鏡同軸照明（カメラ位置に追従する点光源）──────────────────────────
function MicroscopeLightController({ on, intensity }: { on: boolean; intensity: number }) {
  const { camera } = useThree();
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  if (!on) return null;
  return <pointLight ref={ref} intensity={intensity * 7} distance={40} decay={2} color="#fffaf0" />;
}

// ── 観察フィルター（tone mapping exposure 調整）─────────────────────────
type ScopeFilter = 'normal' | 'high_contrast' | 'bone' | 'soft_tissue';
const FILTER_EXPOSURE: Record<ScopeFilter, number> = {
  normal:        1.15,
  high_contrast: 1.65,
  bone:          1.90,
  soft_tissue:   0.82,
};
function FilterController({ filter }: { filter: ScopeFilter }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = FILTER_EXPOSURE[filter] ?? 1.15;
    return () => { gl.toneMappingExposure = 1.15; }; // cleanup
  }, [filter, gl]);
  return null;
}

// ── 軟骨スライス（ヘッドプレートと鼓膜の間に挟む 2mm 厚カーリッジ）──────────
interface CartilageSliceProps {
  product:        KurzProduct;
  shaftLength:    number;
  basePos:        THREE.Vector3;
  lateralOffset:  number;
  anteriorOffset: number;
  verticalOffset: number;
  angleTilt:      number;
  angleTiltZ:     number;
  dragOffsetX:    number;
  dragOffsetY:    number;
  dragOffsetZ:    number;
  /**
   * P4B-3 Step5（Feature Flag）: 指定時、内部のOLD計算（computeCurrentAxisAlignmentOrientation）
   * を使わずこの位置・回転をそのまま採用する。ProsthesisModelと同時に切り替えるための経路
   * （[[docs/P4B-3_Acceptance_Criteria_v1.0.md]] Criteria#2「同時切替」対応）。未指定時は従来通り。
   */
  poseOverride?:  { position: THREE.Vector3; quaternion: THREE.Quaternion };
}

function CartilageSlice({
  product, shaftLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,
  angleTilt, angleTiltZ,
  dragOffsetX, dragOffsetY, dragOffsetZ,
  poseOverride,
}: CartilageSliceProps) {
  const base = basePos.clone();
  base.x += lateralOffset   + dragOffsetX;
  base.y += verticalOffset  + dragOffsetY;
  base.z += anteriorOffset  + dragOffsetZ;

  // P4B-3: 回転計算はProsthesisModelと共通のcomputeCurrentAxisAlignmentOrientation()へ委譲
  // （数式は無変更、抽出のみ）。位置(center)の組み立て方はCartilage固有のためここに残す。
  // 注: targetは従来通りUMBO_POS固定（ProsthesisModelはFLAT/PISTON時UMBO_POS_TORPを使うため
  // 本来ここも分岐が必要な可能性があるが、これは既存の食い違いでありP4B-3の変更範囲外。
  // 発見事項として別Issueで扱う）。
  const { dir, quaternion: oldQuaternion } = computeCurrentAxisAlignmentOrientation({
    base, target: UMBO_POS, angleTilt, angleTiltZ,
  });

  // ヘッドプレート中心 ≒ base + (len + 0.15) * dir
  // 軟骨スライス中心 = ヘッドプレートから 1.5mm 上（鼓膜側）
  const oldCenter = base.clone().addScaledVector(dir, shaftLength + 1.65);
  const center     = poseOverride ? poseOverride.position   : oldCenter;
  const quaternion = poseOverride ? poseOverride.quaternion : oldQuaternion;
  // BELL_TOP: 楕円 rx=1.30mm（短辺2.6mm）× rz=1.80mm（長辺3.6mm） ← BellTopヘッドプレート実寸に一致
  // その他: headPlateDiameter/4 の真円
  const isBellTop = product.headType === 'BELL_TOP';
  const RX = isBellTop ? 1.30 : (product.headPlateDiameter ?? 3.0) / 4;
  const RZ = isBellTop ? 1.80 : RX;
  const THICK = 0.25; // 軟骨スライス厚さ 0.25mm

  return (
    <group
      position={[center.x, center.y, center.z]}
      quaternion={quaternion}
    >
      {/* 軟骨本体 — scale で楕円化（unit cylinder × RX/RZ） */}
      <mesh scale={[RX, 1, RZ]}>
        <cylinderGeometry args={[1, 1, THICK, 32]} />
        <meshStandardMaterial color="#e8d5a0" transparent opacity={0.82} roughness={0.65} metalness={0} />
      </mesh>
      {/* 上面・下面の輪郭を強調 */}
      <mesh scale={[RX, 1, RZ]} position={[0,  THICK / 2, 0]}>
        <cylinderGeometry args={[0.99, 0.99, 0.06, 32]} />
        <meshStandardMaterial color="#c4a86a" transparent opacity={0.9} roughness={0.4} />
      </mesh>
      <mesh scale={[RX, 1, RZ]} position={[0, -THICK / 2, 0]}>
        <cylinderGeometry args={[0.99, 0.99, 0.06, 32]} />
        <meshStandardMaterial color="#c4a86a" transparent opacity={0.9} roughness={0.4} />
      </mesh>
    </group>
  );
}

interface SimSceneProps {
  surgicalCase:   SurgicalCase;
  product:        KurzProduct;
  placement:      PlacementState;
  showIdeal?:     boolean;
  showCartilage?: boolean;
  /** 表示切替（学習モードと同一形式） */
  vis?:           VisibilityMap;
  /** 操作モード: 'move'=プロステーシス移動, 'view'=ビュー操作 */
  dragMode?:      DragMode;
  /** ダブルクリックで構造の表示モードを切替するコールバック */
  onStructureClick?: (key: StructureKey) => void;
  /** 顕微鏡モード: FOV切替 + 回転ロック */
  viewMode?: SimViewMode;
  /** デバッグ: ランドマーク球マーカーを表示（黄=底板, シアン=頭部, マゼンタ=臍部） */
  showDebugMarkers?: boolean;
  /** カメラ位置変化コールバック（デバッグオーバーレイ用） */
  onCameraChange?: (pos: [number,number,number], target: [number,number,number]) => void;
  /** 顕微鏡モード: FOV 手動指定（ズームスライダー用） */
  microscopeFov?: number;
  /** 顕微鏡モード: 同軸照明 */
  microscopeLight?: { on: boolean; intensity: number };
  /** 顕微鏡モード: 観察フィルター */
  microscopeFilter?: ScopeFilter;
  /** 顕微鏡モード: Position モード（回転を許可） */
  scopePositionMode?: boolean;
  /** 顕微鏡移動中: 回転↔平行移動切替 */
  panMode?: boolean;
  /**
   * Phase1 Interaction/Transport Layer（Instrument Select→Grasp→Transport→Release）の現在状態。
   * 未指定時は committed:true 相当（＝常に既存DraggableProsthesis経路のみ描画）として扱うため、
   * これを渡さない既存の呼び出し元（StepFlowMode.tsx等）は完全に無変更のまま動作する。
   */
  manipulation?: ManipulationState;
  /** manipulation.committed が false→true になった直後、Release/Commit実行完了を親へ通知する
   *  （SimulationMode側でUI表示を切り替えるためのコールバック、任意）。 */
  onManipulationCommitted?: () => void;
  /**
   * Phase1-B Step6: DIRECT_MANIPULATION_UX flag ON時、Transport段階でProsthesisを
   * クリック→ドラッグ→pointerUp（解放）した瞬間に呼ばれる。呼び出し元（SimulationMode.tsx）
   * はここでmanipulation.committedをtrueにする。実際のPlacementStateへのCommit処理自体は
   * DirectTransportProsthesisのonRelease（下記JSX）が自分で同期的にupdatePlacement()する
   * （2026-08-15修正: 以前は別途useEffectがtransportPoseから再計算・再書き込みしていたが、
   * TEST強制確定等transportPoseと同期していないcommit経路でPlacementStateを壊すバグの
   * 原因だったため削除済み。offsets書き込みの責務はcommitを発生させる側のみが持つ）。
   */
  onDirectRelease?: () => void;
  /**
   * Phase1-B ControlPad Transport対応: SimSceneがTransport段階のPosition/Tilt操作用
   * コールバック（transportPose/transportTiltを更新するだけの薄いラッパー）を生成した際に
   * 親（SimulationMode.tsx）へ公開する。マウント時に1回呼ばれ、アンマウント時にnullで
   * 呼ばれる（cleanup）。transportPose/transportTilt自体の所有権はSimSceneに残したまま、
   * ControlPad（sibling）から更新できるようにするための最小限の経路。
   */
  onTransportControlsReady?: (controls: TransportControls | null) => void;
  /**
   * [TEST-ONLY, 一時] Phase C-2実機検証（Architect依頼2026-08-14、Collision Boundary Warp）。
   * ボタン押下のたびにインクリメントされる値を渡すと、「側頭骨の外側・Collision発生直前
   * （まだ非衝突）」のlateralOffsetを二分探索で求めてPlacementStateへ書き込み、
   * onDirectReleaseと同じ意味でmanipulation.committedをtrueにする（呼び出し元に委譲）。
   * 未指定時は何もしない（既存呼び出し元に影響なし）。Phase C検証完了後に削除する。
   */
  collisionBoundaryWarpRequestId?: number;
  /** Collision Boundary Warpの結果メッセージ（成功/失敗）を親へ通知する（表示はSimulationMode側）。 */
  onCollisionBoundaryWarpResult?: (message: string, success: boolean) => void;
  /**
   * [TEST-ONLY, 一時] Phase C-3実機検証（Architect依頼2026-08-14、Rotation Boundary Warp）。
   * ボタン押下のたびにインクリメントされる値を渡すと、rotationBoundaryWarpAxis/Directionで
   * 指定した軸・方向へ「Collision発生直前（まだ非衝突）」の角度を二分探索で求めて
   * PlacementStateへ書き込む。Translation版と異なりPlacement段階で完結する操作のため、
   * manipulation.committedには一切触れない。未指定時は何もしない。Phase C-3検証完了後に
   * 削除するかどうかはArchitect判断（C-2のCollision Boundary Warp前例に倣い温存する想定）。
   */
  rotationBoundaryWarpRequestId?: number;
  rotationBoundaryWarpAxis?: 'tilt' | 'tiltZ';
  rotationBoundaryWarpDirection?: 1 | -1;
  onRotationBoundaryWarpResult?: (message: string, success: boolean) => void;
}

// ── 配置ターゲットマーカー（理想位置 = 症例別 idealLateralOffset 適用済み）───────────
function PlacementMarker({ pos }: { pos: THREE.Vector3 }) {
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {/* 中心ドット */}
      <mesh>
        <cylinderGeometry args={[0.10, 0.10, 0.05, 12]} />
        <meshStandardMaterial color="#00b4d8" emissive="#00b4d8" emissiveIntensity={1.2} />
      </mesh>
      {/* クロスライン（ターゲット十字） */}
      <mesh>
        <boxGeometry args={[3.0, 0.05, 0.05]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.55} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.05, 0.05, 3.0]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ── Danger Zone Overlay（Phase20.4b、coordDebug時のみ表示） ─────────────────────
// DANGER_ZONES（Danger Zone Frame）を dangerZonePointToPlacementFrame() で Placement Frame へ
// 変換し、basePos等と同じ回転済み親グループの子として配置する（このグループは既存のRealAnatomy/
// プロステーシスと共通のため、追加の回転計算は不要。engine/coordinates/placementFrame.ts参照）。
// 既存ユーザー体験には影響しない（coordDebug=trueのときのみ描画、既定は非表示）。
function DangerZoneOverlay() {
  return (
    <>
      {DANGER_ZONES.map((zone) => {
        const pos = dangerZonePointToPlacementFrame(zone.position);
        return (
          <group key={zone.id} position={pos}>
            {/* warningRadius: 半透明の外殻 */}
            <mesh renderOrder={2}>
              <sphereGeometry args={[zone.warningRadius, 20, 14]} />
              <meshStandardMaterial
                color={zone.color}
                emissive={zone.glowColor}
                emissiveIntensity={0.4}
                transparent
                opacity={0.10}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* dangerRadius: 発光する核 */}
            <mesh renderOrder={3}>
              <sphereGeometry args={[zone.dangerRadius, 16, 12]} />
              <meshStandardMaterial
                color={zone.color}
                emissive={zone.glowColor}
                emissiveIntensity={0.9}
                transparent
                opacity={0.75}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ── Bell構造デバッグマーカー（2026-07-23、shojiさん指摘のBELLフット×シャフト構造矛盾調査用）──
// ?debug=coords かつ footType==='BELL'（PORP）のときのみ表示。Ground Truth取得時にBell頂点/
// Bell底面(=現行シャフト開始点)/Bell高さの寸法線を可視化し、shojiさんがselectedLengthの定義
// （STAPES_HEAD→HeadPlateか、Bell頂点→HeadPlateか）を確定するための一時的な調査用オーバーレイ。
// 本実装（ProsthesisModel/BellFoot）には一切手を入れていない（Strangler Pattern、Small Change）。
function BellDebugMarkers({ base, apex }: { base: THREE.Vector3; apex: THREE.Vector3 }) {
  return (
    <group>
      {/* Bell Rim = 現行シャフト開始点（オレンジ） */}
      <mesh position={[base.x, base.y, base.z]}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={2} depthTest={false} />
      </mesh>
      <Html position={[base.x, base.y, base.z]} center zIndexRange={[0, 10]}>
        <div style={{
          background: 'rgba(0,15,35,.88)', border: '1px solid #ff8800', borderRadius: 4,
          padding: '2px 8px', fontSize: 10, color: '#ff8800', whiteSpace: 'nowrap',
        }}>
          Bell Rim / 現行Shaft開始点
        </div>
      </Html>

      {/* Bell Apex（緑） */}
      <mesh position={[apex.x, apex.y, apex.z]}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} depthTest={false} />
      </mesh>
      <Html position={[apex.x, apex.y, apex.z]} center zIndexRange={[0, 10]}>
        <div style={{
          background: 'rgba(0,15,35,.88)', border: '1px solid #00ff88', borderRadius: 4,
          padding: '2px 8px', fontSize: 10, color: '#00ff88', whiteSpace: 'nowrap',
        }}>
          Bell Apex（頂点）
        </div>
      </Html>

      <BellDimensionLine from={base} to={apex} />
    </group>
  );
}

function BellDimensionLine({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const mid   = from.clone().add(to).multiplyScalar(0.5);
  const dir   = to.clone().sub(from).normalize();
  const len   = from.distanceTo(to);
  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group position={[mid.x, mid.y, mid.z]} rotation={[euler.x, euler.y, euler.z]}>
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, len, 8]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <Html position={[0, 0, 0]} center zIndexRange={[0, 10]}>
        <div style={{
          background: 'rgba(0,15,35,.88)', border: '1px solid #fff', borderRadius: 4,
          padding: '2px 8px', fontSize: 10, color: '#fff', whiteSpace: 'nowrap',
        }}>
          Bell Height = {BELL_HEIGHT_MM.toFixed(3)}mm（実測1.48mm×0.7395）
        </div>
      </Html>
    </group>
  );
}

// ── Bellローカル座標系 方向候補デバッグ表示（2026-07-23、Step14 P1-2用） ──
// ?debug=coords かつ footType==='BELL' 時のみ。座標を測るためではなく方位を確認するための表示
// （shojiさん方針: 先入観を避けるためAnterior等の解剖名はまだ付けず、A/B/C/D+角度のみ表示）。
// Three.js LatheGeometry の実装（vertex.x=r*sin(phi), vertex.z=r*cos(phi)）に合わせ、
// ローカル角度0°を+Z、90°を+Xとして候補点を計算する（BellFoot()のプロファイル回転と同一の
// 角度定義、node_modules/three/src/geometries/LatheGeometry.js L141-150で確認済み）。
// ProsthesisModel/BellFoot本体には一切手を入れていない（Strangler Pattern、Small Change）。
interface BellCandidate {
  label:    string;
  angleDeg: number;
  pos:      THREE.Vector3;
  outerPos: THREE.Vector3;
}

function DebugLine({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const mid   = from.clone().add(to).multiplyScalar(0.5);
  const dir   = to.clone().sub(from).normalize();
  const len   = from.distanceTo(to);
  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group position={[mid.x, mid.y, mid.z]} rotation={[euler.x, euler.y, euler.z]}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, len, 6]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
    </group>
  );
}

function BellDirectionCandidates({
  base, candidates, axisX, axisY, axisZ,
}: {
  base:       THREE.Vector3;
  candidates: BellCandidate[];
  axisX:      THREE.Vector3;
  axisY:      THREE.Vector3;
  axisZ:      THREE.Vector3;
}) {
  return (
    <group>
      {candidates.map((cnd) => (
        <group key={cnd.label}>
          <mesh position={[cnd.pos.x, cnd.pos.y, cnd.pos.z]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2} depthTest={false} />
          </mesh>
          <DebugLine from={cnd.pos} to={cnd.outerPos} color="#00e5ff" />
          <Html position={[cnd.outerPos.x, cnd.outerPos.y, cnd.outerPos.z]} center zIndexRange={[0, 10]}>
            <div style={{
              background: 'rgba(0,15,35,.88)', border: '1px solid #00e5ff', borderRadius: 4,
              padding: '2px 6px', fontSize: 9, color: '#00e5ff', whiteSpace: 'nowrap',
            }}>
              Candidate {cnd.label} ({cnd.angleDeg}°)
            </div>
          </Html>
        </group>
      ))}
      {/* Bellローカル座標軸（開発用のみ、赤=local X / 緑=local Y / 青=local Z） */}
      <DebugLine from={base} to={axisX} color="#ff4d4d" />
      <DebugLine from={base} to={axisY} color="#4dff4d" />
      <DebugLine from={base} to={axisZ} color="#4d88ff" />
    </group>
  );
}

// ── ドラッグ可能プロステーシス（TransformControls） ──────────────────────
interface DraggableProsthesisProps {
  product:        KurzProduct;
  selectedLength: number;
  basePos:        THREE.Vector3;
  lateralOffset:  number;
  anteriorOffset: number;
  verticalOffset: number;
  angleTilt:      number;
  angleTiltZ:     number;
  dragOffsetX:    number;
  dragOffsetY:    number;
  dragOffsetZ:    number;
  /** 'move' のときのみ TransformControls を表示・有効化 */
  dragMode:       DragMode;
  /** P4B-3 Step5（Feature Flag）: 指定時、ProsthesisModelへそのまま転送する。CartilageSliceの
   *  poseOverrideと同時に渡すことで、両者を同時にOLD/NEWへ切り替える（中間状態を作らない）。 */
  poseOverride?:  { position: THREE.Vector3; quaternion: THREE.Quaternion };
  /**
   * Phase1-B Step3: true時、TransformControlsギズモの代わりにProsthesis直接クリック→
   * スクリーン空間ドラッグ（ManipulationLayer.tsxのuseScreenSpaceDrag）を有効にする。
   * 既存のTransformControls/キーボード矢印キー経路は削除せず、ギズモの表示・有効化のみ
   * 抑制する（DIRECT_MANIPULATION_UX flag OFF時は常にfalse、旧経路に完全復帰）。
   */
  directManipulation?: boolean;
  /** Phase1-B Step5 state（PlacementStateの外側）。描画にのみ反映する。 */
  shaftRollDeg?:       number;
  /** ドラッグ中(true)/非ドラッグ中(false)。呼び出し元でOrbitControlsとの競合防止に使う。 */
  onDragActiveChange?: (active: boolean) => void;
  /**
   * Phase C-2（Prosthesis-Anatomy Collision Constraint）: Anatomy側worldTransform取得用の
   * 読み取り専用ref。SceneDump診断（Phase Occlusion調査）で追加済みのanatomyGroupRefをそのまま
   * 再利用する。未指定時はCollision Constraintを評価しない（安全側フォールバック、既存呼び出し
   * 元がこのpropを渡さなくてもクラッシュしない）。
   */
  anatomyRootRef?: RefObject<THREE.Group | null>;
  /**
   * [Phase C-3 STEP3/Phase B、Architect承認2026-08-15] Prosthesis Collision World Transform
   * Ground Truth Investigation確定分: position/quaternion（computeProsthesisModelPose系の値）は
   * coordGroupRef配下のローカル座標系であり、Anatomy側（anatomyRootRef.matrixWorld、GLB_OFFSET
   * 込みで既に真のWorld Space）とは異なる空間にある。buildProsthesisCollisionProxy()への
   * ancestorMatrix引数にcoordGroupRef.matrixWorldをそのまま渡すための読み取り専用ref。
   * 未指定時はCollision Constraintを評価しない（anatomyRootRefと同じ安全側フォールバック）。
   */
  coordGroupRef?: RefObject<THREE.Group | null>;
}

function DraggableProsthesis({
  product, selectedLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,
  angleTilt, angleTiltZ,
  dragOffsetX, dragOffsetY, dragOffsetZ,
  dragMode,
  poseOverride,
  directManipulation = false,
  shaftRollDeg = 0,
  onDragActiveChange,
  anatomyRootRef,
  coordGroupRef,
}: DraggableProsthesisProps) {
  const tcRef = useRef<any>(null);
  const dragGroupRef = useRef<THREE.Group>(null);
  // Phase1-C（Rotate Mode）: useScreenSpaceDrag（ManipulationLayer.tsx）と違い、Rotate Modeの
  // ドラッグはRaycastを使わず素の画面ピクセルdeltaのみを使うため、pointer captureにgl.domElement
  // が必要（Move側はuseScreenSpaceDrag内部で同様にuseThree()のglを使っており、同じ前例）。
  const { gl } = useThree();

  // Phase C-2（Collision Constraint）: 直前フレームまでCollisionしていなかった、dragGroupRef
  // ローカル座標系でのdelta。ドラッグ開始のたびに(0,0,0)へリセットする（Architect指示「前回の
  // DragのlastValidを次のDragへ持ち越さない」というInvariant）。Collision Test自体はuseFrame側
  // （下部）で行う。useScreenSpaceDrag本体・handleMove・handleUpは無変更。
  const lastValidLocalDeltaRef = useRef(new THREE.Vector3(0, 0, 0));
  const anatomyIndex = useAnatomyCollisionIndex();
  // [C3-P0-1-VERIFY, 一時] Phase B実装後の実機再診断（Architect依頼2026-08-15）。
  // 祖先matrixWorldは変化しないため、初回1回だけログする（毎フレームのログ量を抑える）。
  const p01VerifyLoggedAncestorsRef = useRef(false);

  // [Rotate Smoothness Fix、Architect承認2026-08-16] Rotate-dragのReact/Store commit頻度を
  // rAFへ間引くためのpending値。evaluateRotationCandidate自体の呼び出し頻度・粒度（毎pointermoveで
  // 評価、PASSした候補のみ採用）は変更しない——Investigation（Node harness実測）でCollision評価
  // 自体は無視できるコスト（mean 0.085ms）と確認済みのため、変えるのは「PASSした値をReact state
  // （store）へ書き込む頻度」のみ。null＝直前のflush以降、新しいPASS済み候補がないことを表す。
  const pendingAngleTiltRef = useRef<number | null>(null);
  const pendingAngleTiltZRef = useRef<number | null>(null);
  // pendingAngleTilt(Z)Refをstoreへ同期flushする。呼び出し元は2箇所（下部useFrame内＝1フレーム
  // 1回、handleUp内＝pointerup時の即時flush）。flush後にrefをnullへ戻すため、直後に同じ
  // flushPendingRotation()をもう一度呼んでも二重commitにはならない（Architect指示の
  // 「pending===committed→no-op」を、新規state機構を足さずrefのnull sentinelだけで満たす設計）。
  const flushPendingRotation = () => {
    const t = pendingAngleTiltRef.current;
    const tz = pendingAngleTiltZRef.current;
    if (t === null && tz === null) return;
    const patch: Partial<PlacementState> = {};
    if (t !== null) patch.angleTilt = t;
    if (tz !== null) patch.angleTiltZ = tz;
    useSimStore.getState().updatePlacement(patch);
    pendingAngleTiltRef.current = null;
    pendingAngleTiltZRef.current = null;
  };

  // onDragActiveChangeのラッパー: ドラッグ開始(false→true)の瞬間にlastValidLocalDeltaRefを
  // リセットする以外は、既存の呼び出し元（呼び出し元propそのまま）へ完全に委譲する。
  // useScreenSpaceDrag自体・その呼び出し方は無変更。
  const handleDragActiveChange = (active: boolean) => {
    if (active) lastValidLocalDeltaRef.current.set(0, 0, 0);
    onDragActiveChange?.(active);
  };

  // Phase C-2: 与えられたdragGroupRefローカルdelta（candidate）がCollision-freeかを判定する。
  // useFrame（毎フレーム補正）とonDragEnd（Release時ガード、下記）の両方から呼ぶ共通ロジック。
  // 理由（重要な発見）: useScreenSpaceDragのhandleUp（pointerupのDOMイベント、Frozen）は
  // 「最後のpointermove直後、次のrAFティックより前」に同期的に発火する。つまりuseFrame側の
  // 補正が1フレーム遅れて効くのに対し、pointerupはその補正前のgroup.positionを読んでしまう
  // レースコンディションが存在する（Architectが指摘したTransport側の非対称性と同種の問題が
  // Placement Drag側にも存在すると判明）。そのためRelease時にも同じ判定をもう一度行う。
  const evaluateDragCandidate = (dragLocalDelta: THREE.Vector3): boolean => {
    const anatomyRoot = anatomyRootRef?.current;
    const coordGroup = coordGroupRef?.current;
    if (!anatomyRoot || !coordGroup) {
      return true; // 未対応製品/ref未指定時は制約なし（安全側フォールバック）
    }
    // updateWorldMatrix(true, false)はparent chain（coordGroupRef含む）のmatrixWorldも
    // 同時に更新するため、coordGroup.matrixWorldを読む前にここで1回呼んでおく
    // （Phase C-3 STEP3 Ground Truth Investigation確定: 2回に分けて呼ぶと祖先側が
    // 一フレーム古い値のまま読まれる可能性がある）。
    anatomyRoot.updateWorldMatrix(true, false);
    const candidatePose = composeDragCandidatePose({
      product, shaftLength: selectedLength, basePos,
      lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ,
      shaftRollDeg, dragLocalDelta,
    });
    const proxy = buildProsthesisCollisionProxy({
      product, shaftLength: selectedLength,
      position: candidatePose.position, quaternion: candidatePose.quaternion,
      ancestorMatrix: coordGroup.matrixWorld,
    });

    if (!proxy) {
      return true; // 未対応製品時は制約なし（安全側フォールバック）
    }

    const result = testCollision(proxy, anatomyIndex, DRAG_COLLISION_TARGETS, anatomyRoot.matrixWorld);

    // [C3-P0-1-VERIFY, 一時] Phase B実装後の実機再診断（Architect依頼2026-08-15）。
    if (!p01VerifyLoggedAncestorsRef.current) {
      p01VerifyLoggedAncestorsRef.current = true;
      console.log('[C3-P0-1-VERIFY][DraggableProsthesis][ancestors]', {
        coordGroupMatrixWorld: coordGroup.matrixWorld.toArray(),
        anatomyRootMatrixWorld: anatomyRoot.matrixWorld.toArray(),
      });
    }
    console.log('[C3-P0-1-VERIFY][evaluateDragCandidate]', {
      dragLocalDelta: dragLocalDelta.toArray().map((v) => Number(v.toFixed(4))),
      candidatePosition: candidatePose.position.toArray().map((v) => Number(v.toFixed(4))),
      candidateQuaternion: candidatePose.quaternion.toArray().map((v) => Number(v.toFixed(6))),
      sphereCenters: proxy.spheres.map((s) => s.center.toArray().map((v) => Number(v.toFixed(4)))),
      boxMatrices: proxy.boxes.map((b) => b.matrix.toArray().map((v) => Number(v.toFixed(4)))),
      collided: result.collided,
      anatomyId: result.anatomyId,
    });

    return !result.collided;
  };

  // Phase C-3（Rotation Collision Constraint）: Shift+矢印キーによるangleTilt/angleTiltZの
  // 離散ステップ候補がCollision-freeかを判定する。evaluateDragCandidateと同じCollision Engine
  // （buildProsthesisCollisionProxy/testCollision/anatomyIndex/anatomyRootRef/
  // DRAG_COLLISION_TARGETS）を再利用し、判定ロジック自体は複製しない。dragOffsetX/Y/Zを
  // lateral/vertical/anteriorへ加算するのは、Translation Dragが確定済みの状態でRotationしても
  // 実際に描画されているPivotとCandidate Poseがズレないようにするため（composeDragCandidatePose
  // とは異なりdragLocalDelta項を持たない＝ドラッグ中ではなく静止状態のRotation専用）。
  // useCallbackで安定化する理由: 下部のキーボードuseEffectはisMoveのみを依存配列に持つ既存
  // パターンのため、この関数を素の閉包のまま依存配列に含めるとeslint(react-hooks/
  // exhaustive-deps)が「毎レンダー変わる関数」警告を出す。実際の必要動作（angleTilt等の
  // 最新値を都度反映する）はuseCallback自身の依存配列で保証されるため、警告なく同じ結果を得る。
  const evaluateRotationCandidate = useCallback((axis: 'tilt' | 'tiltZ', candidateAngle: number): boolean => {
    const anatomyRoot = anatomyRootRef?.current;
    const coordGroup = coordGroupRef?.current;
    if (!anatomyRoot || !coordGroup) {
      return true; // 未対応製品/ref未指定時は制約なし（evaluateDragCandidateと同じ安全側フォールバック）
    }
    anatomyRoot.updateWorldMatrix(true, false);
    const candidatePose = composeRotationCandidatePose({
      product, shaftLength: selectedLength, basePos,
      lateralOffset, anteriorOffset, verticalOffset,
      dragOffsetX, dragOffsetY, dragOffsetZ,
      shaftRollDeg,
      candidateAngleTilt: axis === 'tilt' ? candidateAngle : angleTilt,
      candidateAngleTiltZ: axis === 'tiltZ' ? candidateAngle : angleTiltZ,
    });
    const proxy = buildProsthesisCollisionProxy({
      product, shaftLength: selectedLength,
      position: candidatePose.position, quaternion: candidatePose.quaternion,
      ancestorMatrix: coordGroup.matrixWorld,
    });

    if (!proxy) {
      return true; // 未対応製品時は制約なし（evaluateDragCandidateと同じ安全側フォールバック）
    }

    // [Foot-specific Contact Tolerance、Architect承認2026-08-15] evaluateRotationCandidate
    // （Rotate Mode/Keyboard/Boundary Warp共通）にのみFOOT_CONTACT_TOLERANCE_MMを渡す。
    // evaluateDragCandidate（C-2、Freeze維持）はこの引数を渡さず、従来通りの二値判定のまま
    // 変更しない——今回の問題（Rotate Modeが常にCollisionでブロックされる）に対して最小変更で
    // 対応するため、C-2で既にPASS/Freeze済みのDrag側の挙動には一切触れない。
    const result = testCollision(
      proxy, anatomyIndex, DRAG_COLLISION_TARGETS, anatomyRoot.matrixWorld, FOOT_CONTACT_TOLERANCE_MM,
    );

    return !result.collided;
  }, [
    product, selectedLength, basePos,
    lateralOffset, anteriorOffset, verticalOffset,
    dragOffsetX, dragOffsetY, dragOffsetZ,
    shaftRollDeg, angleTilt, angleTiltZ,
    anatomyIndex, anatomyRootRef, coordGroupRef,
  ]);

  // Phase1-B Step3: Placement済みプロステーシスの直接クリック→ドラッグ。ドラッグ終了時、
  // 既存DraggableProsthesis.handleMouseUpと同じ意味論・同じ±3mmクランプでdragOffsetX/Y/Zへ
  // 直接反映する（TransformControlsギズモを経由しない別入力機構、Implementation Prompt §7 Step3）。
  const { onPointerDown: onDirectDragPointerDown } = useScreenSpaceDrag(
    dragGroupRef,
    handleDragActiveChange,
    (localDelta) => {
      // Phase C-2: Release時ガード（上記コメント参照）。collisionしていればlastValidへ差し替える
      // （localDelta自体は変更しない＝useScreenSpaceDrag/handleUpの計算式には一切触れない）。
      const releaseCandidateNonColliding = evaluateDragCandidate(localDelta);
      const effectiveDelta = (COLLISION_CONSTRAINT_ENABLED && directManipulation && !releaseCandidateNonColliding)
        ? lastValidLocalDeltaRef.current
        : localDelta;
      const { placement } = useSimStore.getState();
      useSimStore.getState().updatePlacement({
        dragOffsetX: clamp3(placement.dragOffsetX + effectiveDelta.x),
        dragOffsetY: clamp3(placement.dragOffsetY + effectiveDelta.y),
        dragOffsetZ: clamp3(placement.dragOffsetZ + effectiveDelta.z),
      });
      // Implementation Prompt §7 Step3: ドラッグ終了時にmarkPositionTouched()を呼ぶこと
      // （既存の採点起動条件を壊さないため）。
      useSimStore.getState().markPositionTouched();
    },
  );

  // Phase1-C（Direct Manipulation Rotate Mode、Architect実装指示2026-08-15）: dragMode==='rotate'
  // 時のみ有効。onDirectDragPointerDown（Position、上記）と同じPointer Capture＋
  // window.addEventListener('pointermove'/'pointerup')パターンを踏襲するが、出力はワールド座標の
  // delta（Raycast to Plane、useScreenSpaceDrag）ではなく、画面ピクセルのdelta（clientX/clientYの
  // フレーム間差分）をそのままangleTilt/angleTiltZの差分へ変換する（Implementation指示§14の
  // 「pointerDeltaX→deltaTiltZ, pointerDeltaY→deltaTilt」をそのまま実装）。
  // candidateAngleは必ずevaluateRotationCandidate()（C-3、無変更・迂回しない、Architect指示§8）で
  // Collision判定してからupdatePlacement()する。判定基準となる「現在角度」はuseSimStore.getState()
  // から都度読み直す（Propsのclosure値を使わない。理由: このonPointerDownはドラッグ開始時に1回だけ
  // 呼ばれてhandleMove閉包を生成するため、Propsをそのまま閉包に使うとドラッグ中ずっと開始時点の
  // 値に固定されてしまう。store直読みならドラッグ中も常に最新の確定値を反映できる。Move側の
  // onDirectDragPointerDown/onDragEndコールバックが同じ理由でuseSimStore.getState()を使っている
  // のと同じパターン、上記参照）。
  const onDirectRotatePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return; // 左クリックのみ（Move側のuseScreenSpaceDragと同じ規約）
    e.stopPropagation();
    // [Rotate Smoothness Fix] 前回Dragのpendingを次のDragへ持ち越さない（lastValidLocalDeltaRef
    // と同じInvariant、上記コメント参照）。通常は直前のhandleUpで既にflush済みのはずだが、
    // 念のための防御的リセット。
    pendingAngleTiltRef.current = null;
    pendingAngleTiltZRef.current = null;
    try { gl.domElement.setPointerCapture(e.pointerId); } catch { /* 一部環境で未対応、無視 */ }
    handleDragActiveChange(true);
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - lastClientX;
      const dy = ev.clientY - lastClientY;
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      if (dx === 0 && dy === 0) return;

      const { placement } = useSimStore.getState();

      if (dx !== 0) {
        // [Rotate Smoothness Fix] 起点はpending（まだstoreへflushしていないPASS済み候補）が
        // あればそれを使う。storeの値をそのまま使うと、複数pointermoveがrAF flush前に連続した
        // 場合に直前の加算分を読み落として蓄積が失われるため（?？は0を正当な値として扱う）。
        const baseTiltZ = pendingAngleTiltZRef.current ?? (placement.angleTiltZ ?? 0);
        const candidateTiltZ = clampAngleDeg(baseTiltZ + dx * ROTATE_DEG_PER_PIXEL_TILT_Z);
        if (!COLLISION_CONSTRAINT_ENABLED || evaluateRotationCandidate('tiltZ', candidateTiltZ)) {
          pendingAngleTiltZRef.current = candidateTiltZ;
        }
        // rotateSelectedObject()をbypassする設計上、Collisionで拒否した場合もユーザーが回転を
        // 試みた事実に変わりないため、Keyboard Rotation（上記）と同じく両分岐で確実に呼ぶ。
        // markAngleTouched()自体はidempotent guard済み（useSimStore.ts）でコスト無視できるため
        // rAF化の対象外（Investigation対象はupdatePlacement由来のplacement参照変化のみ）。
        useSimStore.getState().markAngleTouched();
      }
      if (dy !== 0) {
        const baseTilt = pendingAngleTiltRef.current ?? (placement.angleTilt ?? 0);
        const candidateTilt = clampAngleDeg(baseTilt + dy * ROTATE_DEG_PER_PIXEL_TILT);
        if (!COLLISION_CONSTRAINT_ENABLED || evaluateRotationCandidate('tilt', candidateTilt)) {
          pendingAngleTiltRef.current = candidateTilt;
        }
        useSimStore.getState().markAngleTouched();
      }
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      try { gl.domElement.releasePointerCapture(ev.pointerId); } catch { /* 無視 */ }
      // [Rotate Smoothness Fix、Architect指示] Release時ガード: 次のuseFrame tickを待たず、
      // 最後に受理された候補を同期的にflushする（Move側のevaluateDragCandidate Release時
      // 再評価と同じ理由——handleUpは次のrAFティックより前に同期発火しうるため、待つと最後の
      // 数pixel分の回転を取りこぼす）。flush後はrefがnullに戻るため、直後の通常useFrameが
      // 同じフレームで再度flushPendingRotation()を呼んでも二重commitにはならない。
      flushPendingRotation();
      handleDragActiveChange(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // Issue-024（真因）: children方式＋tc.objectからの読み取り自体は正しく機能していた
  // （診断ログでtc.object・onMouseDown・onObjectChangeが全て正常に動作し、位置も正しく
  // 更新されることを確認済み）。真因は別にあった: node_modules/three-stdlib/controls/
  // TransformControls.jsを確認したところ、このバージョンは'mouseDown'/'mouseUp'/
  // 'objectChange'の3種類のみをdispatchEvent()しており、'dragging-changed'は一度も
  // dispatchされない（three.jsのofficial examplesにある同名イベントとは実装が異なる）。
  // 既存コードは存在しないイベントを永遠に待ち続けていたため、attachの配線方法に
  // 関わらず何をしても更新されなかった。'mouseUp'（実測で確実に発火・正しい終了位置を
  // 保持することを確認済み）でstoreへコミットする方式に変更する。
  const handleMouseUp = () => {
    const obj = tcRef.current?.object as THREE.Object3D | undefined;
    if (!obj) return;
    const { placement } = useSimStore.getState();
    useSimStore.getState().updatePlacement({
      dragOffsetX: clamp3(placement.dragOffsetX + obj.position.x),
      dragOffsetY: clamp3(placement.dragOffsetY + obj.position.y),
      dragOffsetZ: clamp3(placement.dragOffsetZ + obj.position.z),
    });
    // Phase17.3: ドラッグ終了時点（mouseUp）で操作済みとして記録する
    // （shojiさん指定「途中状態はまだ確定操作ではない」、ドラッグ終了時マークを採用）。
    useSimStore.getState().markPositionTouched();
    obj.position.set(0, 0, 0);
  };

  // TC は常にマウントしたまま。viewモード時はハンドルを非表示＆操作無効にする。
  const isMove = dragMode === 'move';
  // Phase1-B Step3: directManipulation時はTransformControlsギズモを「ユーザーUXとして
  // 使用しない」（Implementation Prompt §6）。isMove自体（矢印キー操作の判定に使う、上の
  // useEffect参照）は変更しない — 矢印キー微調整は既存のまま維持し、ギズモの表示・有効化
  // のみ抑制する。
  const gizmoActive = isMove && !directManipulation;

  // Phase22.2 GUI Follow-up P1: 矢印キー操作をSTEP6 GUI確認結果を受けて再設計。
  // 通常=translate(移動)、Shift=rotate(回転)、Ctrl=微細移動、Ctrl+Shift=微細回転
  // （shojiさん確認済み。旧「Shift=高速移動0.5mm」は廃止）。
  // ←→=X/lateral・tiltZ(左右傾斜)、↑↓=Y/vertical・tilt(前後傾斜)。Z/anteriorの移動、および
  // 3軸目の回転は今回対象外（将来のボタンUIで対応予定、Root Cause調査でangleTilt/angleTiltZは
  // 既存のPlacementStateフィールドと判明、新規状態ではない）。isMove時のみ有効。
  // 実際の座標計算はuseSimStore.getState().translateSelectedObject()/rotateSelectedObject()に
  // 閉じており、ここではキー判定と定数の選択のみを行う（将来のボタンUIからも同じ関数を呼べる設計）。
  useEffect(() => {
    if (!isMove) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      let axis: 'x' | 'y' | null = null;
      let sign = 0;
      if (e.key === 'ArrowRight') { axis = 'x'; sign = 1; }
      else if (e.key === 'ArrowLeft') { axis = 'x'; sign = -1; }
      else if (e.key === 'ArrowUp') { axis = 'y'; sign = 1; }
      else if (e.key === 'ArrowDown') { axis = 'y'; sign = -1; }
      if (!axis) return;
      e.preventDefault();
      if (e.shiftKey) {
        // Phase C-3（Rotation Collision Constraint）: 回転モード: ←→=左右傾斜(tiltZ)、
        // ↑↓=前後傾斜(tilt)。rotateSelectedObject()（clamp+angleTouchedを同一setで行う）を
        // 経由せず、候補値を先にCollision判定してからupdatePlacement()を直接呼ぶ設計にした
        // ため、rotateSelectedObject内部でも行っているclampAngleDeg()をここで複製する（C-2の
        // clamp3()複製ポリシー踏襲）。
        const rotAxis: 'tilt' | 'tiltZ' = axis === 'x' ? 'tiltZ' : 'tilt';
        const rotStep = e.ctrlKey ? ROTATION_STEP_FINE_DEG : ROTATION_STEP_DEG;
        const currentAngle = rotAxis === 'tilt' ? angleTilt : angleTiltZ;
        const candidateAngle = clampAngleDeg(currentAngle + sign * rotStep);
        if (!COLLISION_CONSTRAINT_ENABLED || evaluateRotationCandidate(rotAxis, candidateAngle)) {
          useSimStore.getState().updatePlacement({ [rotAxis === 'tilt' ? 'angleTilt' : 'angleTiltZ']: candidateAngle });
        }
        // rotateSelectedObject()をbypassしてupdatePlacement()を直接呼ぶ設計上、
        // markAngleTouched()の呼び出し漏れは既知バグの再発になる（Phase22.2、
        // useSimStore.ts:198-203参照）。衝突で書き込みをスキップした場合も、ユーザーは
        // 角度調整を試みた事実に変わりないため、両分岐で確実に呼ぶ。
        useSimStore.getState().markAngleTouched();
      } else {
        const moveStep = e.ctrlKey ? KEYBOARD_STEP_CTRL_MM : KEYBOARD_STEP_MM;
        useSimStore.getState().translateSelectedObject(axis, sign * moveStep);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Phase C-3: angleTilt/angleTiltZをonKeyDown内で直接読む（currentAngleの起点、
    // rotateSelectedObject()のように常にstoreから最新値を読む実装ではなくなったため）。
    // isMoveのみを依存配列に持つ既存パターンのままだと、rotateSelectedObject()経由時は
    // 常にuseSimStore.getState()で最新値を読むため無害だったが、このハンドラはprops
    // (angleTilt/angleTiltZ/evaluateRotationCandidate)を直接参照するため、再登録なしでは
    // 2回目以降のShift+矢印キー押下がstaleなclosureのcurrentAngleを使ってしまい、1ステップ
    // 目以降進まなくなる（実装時に発見、既存のtranslateSelectedObject経路には影響なし）。
  }, [isMove, angleTilt, angleTiltZ, evaluateRotationCandidate]);

  // Phase C-2（Prosthesis-Anatomy Collision Constraint、Placement Drag）: dragGroupRef.position
  // （useScreenSpaceDrag.handleMoveがpointermoveのたびに書き込むraw local delta、Frozen対象の
  // 内部実装は無変更）を毎フレーム読み取り、Collision Testし、衝突していればlastValidへ補正する。
  //
  //   pointermove → useScreenSpaceDrag.handleMove → dragGroupRef.position = candidate（Frozen）
  //                                                        ↓
  //                                        このuseFrame（新規、DraggableProsthesis内のみ）
  //                                                        ↓
  //                              Collision Test → No Collision: lastValid更新
  //                                             → Collision   : dragGroupRef.position = lastValid
  //
  // useScreenSpaceDrag/handleMove/handleUpの計算式・イベント購読は一切変更していない
  // （同じObject3D=dragGroupRefを外側から読み書きするのみ）。Architect承認2026-08-14。
  useFrame(() => {
    if (!COLLISION_CONSTRAINT_ENABLED || !directManipulation) return;
    const group = dragGroupRef.current;
    if (!group) return;
    const candidate = group.position;
    if (candidate.equals(lastValidLocalDeltaRef.current)) return; // 変化なし（非ドラッグ中含む）

    if (evaluateDragCandidate(candidate)) {
      lastValidLocalDeltaRef.current.copy(candidate);
    } else {
      group.position.copy(lastValidLocalDeltaRef.current);
    }
  });

  // [Rotate Smoothness Fix、Architect承認2026-08-16] pendingAngleTilt(Z)Refを1フレームに1回だけ
  // storeへflushする（上記Move側useFrameと同じ「rAFで間引く」パターンをRotateへも適用）。
  // pointerup時は既にhandleUp内のflushPendingRotation()で同期flush済みのため、その直後に同じ
  // フレームでこのuseFrameが走っても二重commitにはならない（flush後はrefがnullに戻るため
  // no-op）。Rotate-drag中でなくてもflushPendingRotation()自体は毎フレーム呼ばれるが、
  // pending refが両方nullのときは即returnする軽量no-opのため、Move-drag中や非ドラッグ中の
  // オーバーヘッドは無視できる。
  useFrame(() => {
    flushPendingRotation();
  });

  return (
    <TransformControls
      ref={tcRef}
      mode="translate"
      space="world"
      showX={gizmoActive}
      showY={gizmoActive}
      showZ={gizmoActive}
      enabled={gizmoActive}
      size={0.65}
      translationSnap={TRANSLATION_SNAP_MM}
      onMouseUp={handleMouseUp}
    >
      <group
        ref={dragGroupRef}
        position={[0, 0, 0]}
        onPointerDown={
          // Phase1-C: dragMode==='rotate'時のみ新しいRotateドラッグ経路へ分岐する。
          // dragMode!=='rotate'（'move'/'view'いずれも）の場合は既存のonDirectDragPointerDown
          // （Position、無変更）のまま＝既存Move挙動は一切変更しない（Architect指示§3）。
          // Root Cause調査（2026-08-15、実機3回再現）で確認済み: Transport段階
          // （manipulation.committed===false）ではこのDraggableProsthesis自体が未マウントのため、
          // dragMode==='rotate'が選ばれていても本分岐には到達しない（DirectTransportProsthesis側の
          // Position dragのみが動く）。この表示上の矛盾はSimulationMode.tsx側のUI修正
          // （PillToggleGroupの選択肢をmanipulationCommittedで出し分け）で解消済み。
          directManipulation
            ? (dragMode === 'rotate' ? onDirectRotatePointerDown : onDirectDragPointerDown)
            : undefined
        }
      >
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          headType={product.headType}
          basePos={basePos.clone()}
          lateralOffset={lateralOffset   + dragOffsetX}
          verticalOffset={verticalOffset + dragOffsetY}
          anteriorOffset={anteriorOffset + dragOffsetZ}
          angleTilt={angleTilt}
          angleTiltZ={angleTiltZ}
          poseOverride={poseOverride}
          interactionHitTarget={directManipulation}
          shaftRollDeg={shaftRollDeg}
        />
      </group>
    </TransformControls>
  );
}

/** XZ ドラッグ量を ±3mm にクランプ */
function clamp3(v: number): number {
  return Math.max(-3, Math.min(3, v));
}

// Phase C-3: angleTilt/angleTiltZの許容範囲クランプ。useSimStore.ts内のclampAngleDeg()と
// 同一式（-180〜+180度）を複製する（clamp3()と同じ複製ポリシー、Phase C-2から踏襲）。
function clampAngleDeg(v: number): number {
  return Math.max(-180, Math.min(180, v));
}

// Phase1-C（Direct Manipulation Rotate Mode）: 1pxのpointer移動あたりの角度変化量（度）。
// 既存のKeyboard Rotation（ROTATION_STEP_DEG等、transformControlsConfig.ts）とは独立した
// 別定数（Implementation指示§14「角度感度は既存Keyboard Rotationとは独立した定数」）。
// 符号は「右ドラッグ→tiltZ+」「上ドラッグ→tilt+」（Keyboard ArrowRight/ArrowUpと同じ方向規約、
// SimScene.tsx内Keyboard Rotationハンドラ参照）になるよう選んである。画面上のドラッグ方向と
// 回転方向が実機で直感に反する場合は、この2定数の符号のみを反転すればよい（Implementation
// 指示§5「実機確認時に反転可能な最小定数」）。
const ROTATE_DEG_PER_PIXEL_TILT_Z = 0.3;
// clientYは画面下方向が正のため、Arrow Up(tilt+)と方向を合わせるため符号を反転する。
const ROTATE_DEG_PER_PIXEL_TILT = -0.3;

// Phase C-2: Placement Dragで対象とするAnatomy。Bone単体から開始し、実機検証を経てから
// Malleus/Stapesを追加する（Architect指示、Phase C-6で拡張予定）。
const DRAG_COLLISION_TARGETS: AnatomyCollisionKey[] = ['bone'];

/**
 * composeDragCandidatePose(): Placement Drag中のCandidate World Poseを計算する。
 * 「committed placement（store確定値、computeProsthesisModelPose()）+ dragGroupRefのraw local
 * delta（useScreenSpaceDrag.handleMoveが書き込む、まだstore未反映）」を合成する
 * （Architect指示: computeProsthesisModelPose()の生の戻り値ではなく、この合成後の値が
 * Candidate Poseである）。shaftRollDegの後乗せもProsthesisModels.tsx:1796-1800と同じ式を
 * ここで再現する（Frozen対象のcomputeProsthesisModelPose自体は無変更、値だけ再利用）。
 */
function composeDragCandidatePose(params: {
  product: KurzProduct;
  shaftLength: number;
  basePos: THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  verticalOffset: number;
  angleTilt: number;
  angleTiltZ: number;
  shaftRollDeg: number;
  /** dragGroupRef.position（ドラッグ中のraw local delta、未確定値）。 */
  dragLocalDelta: THREE.Vector3;
}): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const committed = computeProsthesisModelPose({
    product: params.product, shaftLength: params.shaftLength, basePos: params.basePos,
    lateralOffset: params.lateralOffset, anteriorOffset: params.anteriorOffset, verticalOffset: params.verticalOffset,
    angleTilt: params.angleTilt, angleTiltZ: params.angleTiltZ,
  });
  const position = committed.position.clone().add(params.dragLocalDelta);
  const quaternion = params.shaftRollDeg
    ? committed.quaternion.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (params.shaftRollDeg * Math.PI) / 180),
      )
    : committed.quaternion;
  return { position, quaternion };
}

/**
 * composeRotationCandidatePose(): Rotation Candidate（Shift+矢印キー、angleTilt/angleTiltZの
 * 離散ステップ）のWorld Poseを計算する。composeDragCandidatePose（Placement Drag、dragLocalDelta
 * を後乗せする「まだstore未確定のドラッグ中raw値」用）とは異なり、Rotationはドラッグ中の
 * ジェスチャーではなく静止状態からの離散キー操作のため、dragLocalDelta相当の項は存在しない。
 * 代わりにdragOffsetX/Y/Z（既にstoreへ確定済みのTranslation Drag結果）をlateral/vertical/
 * anteriorへ加算する。理由: Translation Dragが確定済みの状態でRotationしても、実際に
 * 描画されているPivot（ProsthesisModelはlateralOffset+dragOffsetX等で描画される）と
 * Candidate Poseがズレないようにするため（Phase C-3 Architecture Review③）。shaftRollDeg
 * 後乗せの式はcomposeDragCandidatePoseと同一（Frozen対象のcomputeProsthesisModelPose自体は
 * 無変更、値だけ再利用）。
 */
function composeRotationCandidatePose(params: {
  product: KurzProduct;
  shaftLength: number;
  basePos: THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  verticalOffset: number;
  dragOffsetX: number;
  dragOffsetY: number;
  dragOffsetZ: number;
  shaftRollDeg: number;
  /** clampAngleDeg適用済みのRotation Candidate角度。 */
  candidateAngleTilt: number;
  candidateAngleTiltZ: number;
}): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const pose = computeProsthesisModelPose({
    product: params.product, shaftLength: params.shaftLength, basePos: params.basePos,
    lateralOffset: params.lateralOffset + params.dragOffsetX,
    verticalOffset: params.verticalOffset + params.dragOffsetY,
    anteriorOffset: params.anteriorOffset + params.dragOffsetZ,
    angleTilt: params.candidateAngleTilt, angleTiltZ: params.candidateAngleTiltZ,
  });
  const quaternion = params.shaftRollDeg
    ? pose.quaternion.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (params.shaftRollDeg * Math.PI) / 180),
      )
    : pose.quaternion;
  return { position: pose.position, quaternion };
}

// ══════════════════════════════════════════════════════════════════
// SimScene
// ══════════════════════════════════════════════════════════════════
export function SimScene({
  surgicalCase, product, placement, showIdeal = false, showCartilage = false, vis = {}, dragMode = 'view', onStructureClick, viewMode = 'normal', showDebugMarkers = false, onCameraChange,
  microscopeFov, microscopeLight, microscopeFilter, scopePositionMode = false,
  panMode = false,
  manipulation = { ...INITIAL_MANIPULATION_STATE, committed: true },
  onManipulationCommitted,
  onDirectRelease,
  onTransportControlsReady,
  collisionBoundaryWarpRequestId,
  onCollisionBoundaryWarpResult,
  rotationBoundaryWarpRequestId,
  rotationBoundaryWarpAxis,
  rotationBoundaryWarpDirection,
  onRotationBoundaryWarpResult,
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ } = placement;

  // 2026-07-23修正: BellのbasePosは従来product.footType(BELLか否か)のみで決めていたが、
  // 症例のstapes状態(footplate-only等、頭部capitulum欠損)を考慮していなかった。
  // TORP/PISTON(isTotal)は従来通りSTAPES_FOOTPLATE固定(頭部の有無に関わらず臨床的に正しい)。
  // BELL(PORP)はstapes頭部が実在する(intact/suprastructure)場合のみSTAPES_HEADを使い、
  // それ以外(head-loss/footplate-only/absent)はSTAPES_FOOTPLATEへフォールバックする
  // (head-loss用の専用ランドマークは未実測のため新設せず、暫定でfootplate-onlyと同じ扱いにする
  // ── 2026-07-23 shojiさん方針、RecommendedLength_Audit_Template参照)。
  const stapStatus = surgicalCase.ossicularStatus.stapes;
  const bellHeadAvailable = stapStatus === 'intact' || stapStatus === 'suprastructure';
  const isTotal = product.footType === 'FLAT' || product.footType === 'PISTON';
  const basePos = (isTotal || !bellHeadAvailable) ? STAPES_FOOTPLATE : STAPES_HEAD;

  // Phase1-B Step5 state（PlacementStateの外側、interactionFlagsと同じ並置パターン）。
  // 描画にのみ反映する（Safety/Score/GroundTruthには渡さない、Implementation Prompt §3 #1）。
  const interactionShaftRollDeg = useSimStore((s) => s.interactionShaftRollDeg);

  // Phase1-B Step3/6: Direct Manipulation UXでProsthesisを直接ドラッグ中かどうか。
  // OrbitControlsとの競合防止のみに使うローカル状態（DIRECT_MANIPULATION_UX flag OFF時は
  // どのコンポーネントからも呼ばれないため常にfalseのまま、既存挙動に影響しない）。
  const [directDragActive, setDirectDragActive] = useState(false);

  // ── Phase1 Interaction/Transport Layer ──────────────────────────────────
  // transportPose（Transport段階の自由position）はbasePosに依存する初期値を持つため、
  // basePos計算と同じSimScene内にローカルstateとして保持する（ManipulationLayer.tsx側は
  // 純粋関数＋描画コンポーネントのみで、この状態自体は持たない）。DragMode（既存の
  // move/view切替）と同じ「操作メカニクスの状態はUIに近い場所に置く」という前例に従う。
  const [transportPose, setTransportPose] = useState<TransportPose>(() => createInitialTransportPose(basePos));
  // Phase1-B ControlPad Transport対応（T2方式）: Transport段階のTilt一時state。
  // PlacementStateには一切書き込まない、transportPoseと同じライフサイクルのローカルstate。
  const [transportTilt, setTransportTilt] = useState<TransportTilt>(INITIAL_TRANSPORT_TILT);
  // manipulation.committed が false→true になった瞬間に一度だけ、親（呼び出し元）へ通知する
  // ためのガード。
  //
  // [State-management bug修正、Architect承認2026-08-15] 以前はここで
  // commitTransportPoseToOffsets(transportPose, basePos) を再計算し、updatePlacement()で
  // dragOffsetX/Y/Zへ書き込んでいた（コメント上は「冪等な冗長実行」という位置づけ）。
  // しかしtransportPoseはcommitの実際の発生源（DirectTransportProsthesisのonRelease、
  // TEST強制確定ボタン等）と同期している保証がない——特にTEST強制確定はtransportPoseに
  // 一切触れずmanipulation.committedをtrueにするため、Transportで一度も操作していない
  // 場合はtransportPoseがcreateInitialTransportPose()の初期値（basePos+(12,9,6)相当）の
  // ままであり、±3mmクランプにより毎回dragOffsetX/Y/Z=(3,3,3)が書き込まれ、TESTが直前に
  // 設定した正しいdragOffset=(0,0,0)をサイレントに上書きしていた（実機ログで確認、
  // project_kurz_collision_constraintメモリ参照）。offsetsの書き込み責務は、
  // manipulation.committedをtrueにする側（DirectTransportProsthesisのonRelease、または
  // TEST等の強制確定ハンドラ）が既にそれぞれ自分の正しい値でupdatePlacement()している
  // ため、ここでの再計算・再書き込みは常に冗長（正しいケース）か有害（transportPoseが
  // 無関係なケース）のいずれかであり、削除する。
  const hasCommittedRef = useRef(false);
  useEffect(() => {
    if (!manipulation.committed || hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    onManipulationCommitted?.();
  }, [manipulation.committed, onManipulationCommitted]);

  // Phase1-B ControlPad Transport対応: ControlPad（sibling、SimulationMode.tsx側）から
  // transportPose/transportTiltを更新するための薄いコールバック。関数形state更新
  // （setTransportPose(prev => ...)/setTransportTilt(prev => ...)）を使うため、closure内で
  // transportPose/transportTiltの値を直接参照しない＝stale closureは発生しない。
  // useCallback([])で恒等性を安定させ、useEffectがマウント時に1回だけ発火するようにする。
  const translateTransport = useCallback((axis: 'x' | 'y' | 'z', deltaMm: number) => {
    setTransportPose(prev => nudgeTransportPosition(prev, axis, deltaMm));
  }, []);
  const rotateTransport = useCallback((axis: 'tilt' | 'tiltZ', deltaDeg: number) => {
    setTransportTilt(prev => nudgeTransportTilt(prev, axis, deltaDeg));
  }, []);
  useEffect(() => {
    const controls: TransportControls = { translate: translateTransport, rotate: rotateTransport };
    onTransportControlsReady?.(controls);
    return () => onTransportControlsReady?.(null);
  }, [translateTransport, rotateTransport, onTransportControlsReady]);

  // ── Phase20.4c: 実際の配置点でSafety Score算出（DANGER_ZONES近接判定）を都度更新 ──
  // basePos + オフセット = プロステーシス基準点（Placement Frame）。DraggableProsthesis/
  // CartilageSliceが使う実際の配置点と同じ計算式（ProsthesisModel.tsxの`base`＝シャフトの
  // アブミ骨接触端。ヘッドプレート側ではない。Phase20.5.2でshojiさんへの回答として確認済み）。
  // Placement Score（computeScore、明示操作で呼ばれる）とは独立した別軸の評価のため、配置が
  // 変わるたびに無条件で呼ぶ（表示UIはPhase20.5、既存UXへの影響なし）。
  const dangerZonePoint = useMemo<Vec3Tuple>(() => {
    const point: [number, number, number] = [
      basePos.x + lateralOffset  + dragOffsetX,
      basePos.y + verticalOffset + dragOffsetY,
      basePos.z + anteriorOffset + dragOffsetZ,
    ];
    return placementPointToDangerZoneFrame(point);
  }, [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ]);

  useEffect(() => {
    useSimStore.getState().computeSafety(dangerZonePoint);
  }, [dangerZonePoint]);

  // Bell構造デバッグマーカー用の基準点（2026-07-23、shojiさん指摘調査用）。
  // 2026-07-23修正: ProsthesisModel本体（ProsthesisModels.tsx L727-778）の実際の変換式
  // （base→dir→quat→euler+angleTilt/angleTiltZ→mid→footOff）を1対1で再現する。
  // 旧実装はUMBO方向のみでangleTilt/angleTiltZを無視していたため、配置調整中（tilt≠0）に
  // マーカーと実際のBell描画位置がズレていた（shojiさん視認報告、スクリーンショットで確認）。
  // ProsthesisModel/BellFoot本体は一切変更していない（Strangler Pattern、マーカー側のみ修正）。
  const bellMarkers = useMemo(() => {
    const base = new THREE.Vector3(
      basePos.x + lateralOffset  + dragOffsetX,
      basePos.y + verticalOffset + dragOffsetY,
      basePos.z + anteriorOffset + dragOffsetZ,
    );
    const dir = new THREE.Vector3().subVectors(UMBO_POS, base).normalize();
    const top = base.clone().addScaledVector(dir, selectedLength);
    const mid = base.clone().add(top).multiplyScalar(0.5);

    const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(quat);
    const tiltXRad = (angleTilt  * Math.PI) / 180;
    const tiltZRad = (angleTiltZ * Math.PI) / 180;
    const finalEuler = new THREE.Euler(euler.x + tiltXRad, euler.y, euler.z + tiltZRad);

    const footOff = -(selectedLength / 2);
    const rim  = mid.clone().add(new THREE.Vector3(0, footOff, 0).applyEuler(finalEuler));
    const apex = rim.clone().add(new THREE.Vector3(0, BELL_HEIGHT_MM, 0).applyEuler(finalEuler));

    // Step14 P1-2: ローカル方向候補（0/90/180/270度、Three.js LatheGeometryの角度定義
    // x=r*sin(phi)/z=r*cos(phi)に合わせる）とBellローカル座標軸（開発用デバッグ表示のみ）。
    const candidateAngles = [0, 90, 180, 270];
    const candidateLabels = ['A', 'B', 'C', 'D'];
    const candidates = candidateAngles.map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const r1 = BELL_RIM_RADIUS_MM;
      const r2 = BELL_RIM_RADIUS_MM * 1.6;
      const pos      = rim.clone().add(new THREE.Vector3(r1 * Math.sin(rad), 0, r1 * Math.cos(rad)).applyEuler(finalEuler));
      const outerPos = rim.clone().add(new THREE.Vector3(r2 * Math.sin(rad), 0, r2 * Math.cos(rad)).applyEuler(finalEuler));
      return { label: candidateLabels[i], angleDeg: deg, pos, outerPos };
    });
    const AXIS_LEN_MM = 1.5;
    const axisX = rim.clone().add(new THREE.Vector3(AXIS_LEN_MM, 0, 0).applyEuler(finalEuler));
    const axisY = rim.clone().add(new THREE.Vector3(0, AXIS_LEN_MM, 0).applyEuler(finalEuler));
    const axisZ = rim.clone().add(new THREE.Vector3(0, 0, AXIS_LEN_MM).applyEuler(finalEuler));

    return { rim, apex, candidates, axisX, axisY, axisZ };
  }, [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ, selectedLength, angleTilt, angleTiltZ]);
  const bellBase = bellMarkers.rim;
  const bellApex = bellMarkers.apex;
  const bellCandidates = bellMarkers.candidates;
  const bellAxisX = bellMarkers.axisX;
  const bellAxisY = bellMarkers.axisY;
  const bellAxisZ = bellMarkers.axisZ;

  // P4B-3 Step4: Reference Pose = ProsthesisModelが実際に描画へ使うPoseそのもの
  // （computeProsthesisModelPose()、DraggableProsthesisへ渡すPropsと同一の入力）。
  // Acceptance Criteria #3「Shadow比較は本番実出力を基準とする」対応。旧bellMarkers.mid/
  // oldQuaternion（ProsthesisModelを模倣した独立再実装）は廃止し、本番と同じ関数呼び出しに
  // 統一した（再実装ではなく単一の呼び出し元、drift不可能）。
  const referencePose = useMemo(() => computeProsthesisModelPose({
    product,
    shaftLength:    selectedLength,
    basePos:        basePos.clone(),
    lateralOffset:  lateralOffset  + dragOffsetX,
    verticalOffset: verticalOffset + dragOffsetY,
    anteriorOffset: anteriorOffset + dragOffsetZ,
    angleTilt,
    angleTiltZ,
  }), [product, basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ, selectedLength, angleTilt, angleTiltZ]);
  const referenceGhost: GhostPoseInput = { position: referencePose.position, quaternion: referencePose.quaternion };

  // P4-3 Step3-2〜P4B-3 Step4: Candidate Pose（solveBellPose、新Pose Solverの出力）。
  // ?debug=coords かつ footType==='BELL' 時のみ実際に描画される（PoseComparisonOverlay）が、
  // 計算自体はReference Poseと同じく常時実行する（Strangler Pattern、既存挙動には影響しない）。
  // 2026-07-28 P4B-4: angleTilt/angleTiltZをReference Poseと同じ値で渡すよう修正
  // （修正前はcomposeTiltが存在せずtilt入力の経路自体が無かったため、Candidate Ghostがtilt操作に
  // 反応しないという表示・スコアの不整合があった。監査で発見、composeTilt()追加により解消）。
  const candidatePose = useMemo(() => solveBellPose({
    stapesHead:     [basePos.x, basePos.y, basePos.z],
    umboTarget:     [UMBO_POS.x, UMBO_POS.y, UMBO_POS.z],
    tmNormal:       TM_NORMAL,
    shaftLength:    selectedLength,
    lateralOffset:  lateralOffset  + dragOffsetX,
    verticalOffset: verticalOffset + dragOffsetY,
    anteriorOffset: anteriorOffset + dragOffsetZ,
    angleTilt,
    angleTiltZ,
  }), [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ, selectedLength, angleTilt, angleTiltZ]);

  // Three Adapter（poseThreeAdapter.ts）呼び出しはここ1箇所のみ。以降scenes層はTHREE型の
  // candidateGhostだけを扱い、engine Poseの生値(candidatePose)を直接使わない。
  const candidateGhost: GhostPoseInput = useMemo(() => poseToThree(candidatePose), [candidatePose]);

  // P4B-3 Step5（Feature Flag）: NEW Pose Pipeline切替。既定OFF＝既存挙動に一切影響しない
  // （Strangler Pattern）。?debug=coords限定のHUDチェックボックスからのみON/OFF可能
  // （2026-07-28 shojiさん承認: 実運用へは未検証のため、研修者が触れる経路には出さない）。
  const [useNewPoseSolver, setUseNewPoseSolver] = useState(false);

  // P4B-3 Step5（Feature Flag）: CartilageSlice用のCandidate Pose。solveBellPose()はProsthesisModel
  // 用のシャフト中点位置式を内蔵しているため流用できず、solvePose/composeTwist/composeTiltを
  // 直接呼び出しCartilageSlice自身の位置式（base + (shaftLength+1.65)*dir）と組み合わせる
  // （新しい数式は追加していない。PoseComparisonOverlayのGhost複製と同じ理由で、既存の位置定数
  // 1.65をここでも再利用するのみ）。
  // 【既知の技術的負債（2026-07-28、shojiさんレビュー指摘）】理想形はPose生成を1箇所
  // （例: `computeBellPose(...)`）に集約し、ProsthesisModel/CartilageSlice双方がそれを呼ぶ
  // 構造。今回はP4B-4のスコープ（数式を増やさない）を優先しSimScene側で個別に組み立てたが、
  // 将来のリファクタリング候補として残す（P4B完了後、composeNormal導入等のタイミングで検討）。
  const cartilageCandidatePose: GhostPoseInput = useMemo(() => {
    const base: Vec3Tuple = [
      basePos.x + lateralOffset  + dragOffsetX,
      basePos.y + verticalOffset + dragOffsetY,
      basePos.z + anteriorOffset + dragOffsetZ,
    ];
    const forward: Vec3Tuple = [UMBO_POS.x - base[0], UMBO_POS.y - base[1], UMBO_POS.z - base[2]];
    const basis   = solvePose({ position: base, forward });
    const twisted = composeTwist(basis, TM_NORMAL);
    const tilted  = composeTilt(twisted, angleTilt, angleTiltZ);
    const dir     = new THREE.Vector3(basis.forward[0], basis.forward[1], basis.forward[2]);
    const position = new THREE.Vector3(base[0], base[1], base[2]).addScaledVector(dir, selectedLength + 1.65);
    const quaternion = new THREE.Quaternion(tilted.quaternion[0], tilted.quaternion[1], tilted.quaternion[2], tilted.quaternion[3]);
    return { position, quaternion };
  }, [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ, selectedLength, angleTilt, angleTiltZ]);

  // Soft Clip Band Loop ↔ Shaft Integration — Attached Preview (Phase B0、shoji Audit
  // 2026-08-10)用のPose。DraggableProsthesis→ProsthesisModelが内部で使うのと同じ
  // computeProsthesisModelPose()をそのまま呼ぶだけ（新しい数式は追加していない）。
  // headType==='SOFT_CLIP'（footType==='PISTON'）はsupportsNewPoseSolver対象外
  // （下記、BELL限定）のため、poseFlagActive/poseOverrideの分岐は考慮不要
  // （常にcomputeProsthesisModelPose()の値と一致する）。
  const softClipAttachPose = useMemo(() => computeProsthesisModelPose({
    product, shaftLength: selectedLength, basePos: basePos.clone(),
    lateralOffset:  lateralOffset  + dragOffsetX,
    verticalOffset: verticalOffset + dragOffsetY,
    anteriorOffset: anteriorOffset + dragOffsetZ,
    angleTilt, angleTiltZ,
  }), [product, selectedLength, basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ, angleTilt, angleTiltZ]);
  // headOff式(len/2+0.15)はProsthesisModel内の同名ローカル定数と同一。新しい数式は追加
  // していない（ProsthesisModel本体は無変更、位置式のみここで読み取り専用に再利用）。
  const softClipAttachHeadOff = selectedLength / 2 + 0.15;

  // P4B-3 Step5（Feature Flag）: 対応footTypeはBELL（solveBellPose）のみ。FLAT/CLIP/PISTON用の
  // Adapterは未実装のため、それ以外のfootTypeではFlagの値に関わらず常にOLDを使う
  // （2026-07-28 shojiさん承認、Acceptance Criteriaの対象はBELL系に限定）。
  const supportsNewPoseSolver = product.footType === 'BELL';
  const poseFlagActive = useNewPoseSolver && supportsNewPoseSolver;

  // Phase20.5.2: デバッグ・原因切り分け用。warningRadius圏外でも常に最寄りのDANGER_ZONEと
  // 距離を計算する（checkProximityToDangerは圏外を除外するため「あと何mmで警告か」が分からない）。
  const nearestDangerZone = useMemo(() => findNearestDangerZone(dangerZonePoint), [dangerZonePoint]);

  // vis をマージ。耳小骨（ossicles/malleus/incus/stapes）・auricle・外耳道(eac)は
  // RealAnatomy 側では描画しない（hidden）。耳小骨は下で症例別に直接レンダリングし、
  // ユーザーの表示切替（vis）をそこへ反映する。
  const mergedVis: VisibilityMap = {
    ...SIM_DEFAULT_VIS,
    ...vis,
    ossicles: 'hidden',
    malleus:  'hidden',
    incus:    'hidden',
    stapes:   'hidden',
    auricle:  'hidden',
    eac:      'hidden',
  };

  // 症例別 耳小骨 ステータス(stapesは上のbasePos計算で既に取得済みのstapStatusを再利用)
  const { malleus: malStatus, incus: incStatus } = surgicalCase.ossicularStatus;

  // サイドバーの表示モード（個別キー → 旧 ossicles キー → 既定 solid）
  const ossMode = (key: 'malleus' | 'incus' | 'stapes'): OpacityMode =>
    vis[key] ?? vis.ossicles ?? 'solid';

  // 症例ステータスによる基本不透明度（partial=菲薄化）
  const caseOpacity = (status: string): number | undefined =>
    status === 'partial' ? 0.45 : undefined;

  // 表示判定 — vis切替を最優先。absent骨も hidden → 切替で表示可能。
  const showMalleus    = ossMode('malleus') !== 'hidden';
  const showIncus      = ossMode('incus')   !== 'hidden';
  const showStapesGLB  = ossMode('stapes')  !== 'hidden';
  const footplateVisMode = vis['stapesFootplate'];
  const isCaseWithFootplate = stapStatus === 'footplate-only' || stapStatus === 'absent';
  const showFootplateHighlight = footplateVisMode !== 'hidden'
    && (footplateVisMode !== undefined || isCaseWithFootplate);
  const absentOpacity = (mode: OpacityMode): number =>
    mode === 'ghost' ? GHOST_OPACITY : 0.30;
  const malOpacity  = malStatus  === 'absent'
    ? absentOpacity(ossMode('malleus'))
    : ossMode('malleus') === 'ghost' ? GHOST_OPACITY : caseOpacity(malStatus);
  const incOpacity  = incStatus  === 'absent'
    ? absentOpacity(ossMode('incus'))
    : ossMode('incus')   === 'ghost' ? GHOST_OPACITY : caseOpacity(incStatus);
  const stapOpacity = (stapStatus === 'absent' || stapStatus === 'footplate-only')
    ? absentOpacity(ossMode('stapes'))
    : ossMode('stapes')  === 'ghost' ? GHOST_OPACITY : caseOpacity(stapStatus);

  const orbitRef = useRef<any>(null);
  const [initCam] = useState(() => _loadSimCam());
  const [coordDebug] = useState(() => isCoordDebugMode());
  const coordGroupRef = useRef<THREE.Group>(null);
  const coordPanelRef = useRef<HTMLDivElement | null>(null);

  // ── Scene Dump Diagnostic（Occlusion原因診断、一時計装、?debug=scenedump限定） ──────────
  // [Claude Code 実装依頼] Prosthesis–Anatomy Occlusion 原因診断対応。診断専用の読み取り専用
  // instrumentationで、Anatomy/Prosthesisの描画・Material設定には一切触れない。
  const [sceneDumpDebug] = useState(() => isSceneDumpDebugMode());
  const anatomyGroupRef = useRef<THREE.Group>(null);
  const prosthesisGroupRef = useRef<THREE.Group>(null);
  const [sceneDumpCaptureRequestId, setSceneDumpCaptureRequestId] = useState(0);
  const [sceneDumpCaptureLabel, setSceneDumpCaptureLabel] = useState('manual');
  const [lastSceneDumpResult, setLastSceneDumpResult] = useState<SceneDumpResult | null>(null);
  const [sceneDumpHistory, setSceneDumpHistory] = useState<readonly { label: string; at: string }[]>([]);
  const [sceneDumpAutoCapture, setSceneDumpAutoCapture] = useState(false);
  const requestSceneDumpCapture = (label: string) => {
    setSceneDumpCaptureLabel(label);
    setSceneDumpCaptureRequestId((n) => n + 1);
  };
  // どのProsthesis representationが実際に描画されているか（下のJSX分岐と同一の判定式）。
  // Item 4「Drag中/Release後でrepresentationが違うか」の検証にそのまま使う。
  const activeProsthesisRepresentation = manipulation.committed
    ? 'DraggableProsthesis'
    : (DIRECT_MANIPULATION_UX ? 'DirectTransportProsthesis' : 'TransportProsthesis');

  // ── Collision Engine 単独検証（Phase C-1、?debug=collision限定） ────────────────────────
  // [Architect承認 2026-08-14] Manipulation Layer（DraggableProsthesis/DirectTransportProsthesis/
  // TransportProsthesis/TransformControls/useScreenSpaceDrag）には一切接続しない、Collision
  // Engine（anatomyCollisionIndex/prosthesisCollisionGeometry/collisionTest）単体の動作確認専用。
  // anatomyGroupRef（既存、Scene Dump診断用に追加済み）をそのまま再利用する。
  const [collisionVerifyDebug] = useState(() => isCollisionVerifyDebugMode());
  const [collisionVerifyRequestId, setCollisionVerifyRequestId] = useState(0);
  const [collisionVerifyResults, setCollisionVerifyResults] = useState<CollisionVerifyCaseResult[] | null>(null);

  // Phase20.4c: coordDebug時のみSafety Score/Alertsを表示（GUIでの動作確認用、既存UIには影響なし）。
  const safetyScore  = useSimStore((s) => s.safetyScore);
  const safetyAlerts = useSimStore((s) => s.safetyAlerts);

  // Ground Truth Export（2026-07-23、shojiさん仕様確定）: ?debug=coords限定、既存UIには影響なし。
  const [groundTruthJson, setGroundTruthJson] = useState<string | null>(null);
  const [groundTruthCopied, setGroundTruthCopied] = useState(false);

  // P4-3 Step3-2〜P4B-3 Step4: Pose比較Overlay用HUD状態。
  // 「Capture GT」は実際には現在のReference Poseのスナップショットであり真のGround Truthでは
  // ないため、Anchor Poseと呼ぶ（2026-07-24 Reference Poseへ改名、2026-07-28 Reference Poseの
  // 意味をProsthesisModel実出力へ変更したことに伴いAnchor Poseへ再改名、命名衝突回避）。
  // 表示/非表示はReference/Candidate/Anchor個別に切替可能。
  const [anchorPose, setAnchorPose] = useState<GhostPoseInput | null>(null);
  const [poseVisibility, setPoseVisibility] = useState<PoseVisibility>({ reference: true, candidate: true, anchor: true });

  // Soft Clip Band Loop ↔ Shaft Integration — Attached Preview (Phase B0、shoji Audit
  // 2026-08-10)。translation/rotationはPreview parameter(Frozen Geometryではない)。
  // 既定値はgetSoftClipBandLoopDefaultAttachTransform()(bridge/endを仮アンカーとして
  // ローカル原点へ、rotation=0°)。?debug=coords かつ headType==='SOFT_CLIP' 限定のUIから
  // shojiが数値調整してViewer上で目視判断する。Production SoftClipHead()・27制御点・
  // Scoring・Pose Solver・既存のEditorツールには一切影響しない。
  const [softClipAttachTransform, setSoftClipAttachTransform] = useState<SoftClipBandLoopAttachTransform>(
    () => getSoftClipBandLoopDefaultAttachTransform(),
  );

  const poseStats = useMemo(() => {
    return {
      referenceVsCandidate: comparePoses(referenceGhost, candidateGhost),
      referenceVsAnchor:    anchorPose ? comparePoses(referenceGhost, anchorPose) : null,
      candidateVsAnchor:    anchorPose ? comparePoses(candidateGhost, anchorPose) : null,
      // shojiさんレビュー(2026-07-24)対応: Forward Errorだけでは「鼓膜法線からどれだけ
      // 離れているか」が分からないという指摘への数値的回答。PoseModelBaseline.mdの前提
      // 「Head plate normal = Shaft axis(=forward)」に基づき、forwardとTM_NORMALのなす角を
      // 直接表示する。
      referenceFwdVsTmDeg: angleToVectorDeg(referenceGhost.quaternion, TM_NORMAL_VEC3),
      candidateFwdVsTmDeg: angleToVectorDeg(candidateGhost.quaternion, TM_NORMAL_VEC3),
    };
  }, [referenceGhost, candidateGhost, anchorPose]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    {coordDebug && (
      <CoordinateDebugPanel sceneLabel="SimScene" panelRef={coordPanelRef} zIndex={Z_INDEX.modal} />
    )}
    {sceneDumpDebug && (
      <SceneDumpPanel
        zIndex={Z_INDEX.modal}
        onRequestCapture={(label) => {
          requestSceneDumpCapture(label);
          setSceneDumpHistory((h) => [...h, { label, at: new Date().toISOString() }].slice(-8));
        }}
        lastResult={lastSceneDumpResult}
        history={sceneDumpHistory}
        autoCaptureWhileDragging={sceneDumpAutoCapture}
        onToggleAutoCapture={setSceneDumpAutoCapture}
      />
    )}
    {collisionVerifyDebug && (
      <CollisionVerifyPanel
        zIndex={Z_INDEX.modal}
        onRequestVerify={() => setCollisionVerifyRequestId((n) => n + 1)}
        results={collisionVerifyResults}
      />
    )}
    {coordDebug && (
      <div
        style={{
          position: 'absolute', top: 8, left: 8, zIndex: Z_INDEX.modal,
          background: 'rgba(0,0,0,0.78)', color: '#ffd27f',
          fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
          borderRadius: 4, pointerEvents: 'none', whiteSpace: 'pre',
          lineHeight: 1.6, userSelect: 'none', minWidth: 200,
        }}
      >
        <div style={{ color: '#fff', fontWeight: 700, marginBottom: 3 }}>Safety Debug (Phase20.5.2)</div>
        {`Score: ${safetyScore ?? '-'}\nAlerts: ${safetyAlerts.length}`}
        {safetyAlerts.map((a) => `\n${a.level === 'danger' ? '\u{1F534}' : '\u{1F7E1}'} ${a.nameJa} ${a.distanceMm.toFixed(2)}mm`).join('')}
        {`\n\nPlacement Point (Danger Zone Frame):\n  x:${dangerZonePoint[0].toFixed(2)} y:${dangerZonePoint[1].toFixed(2)} z:${dangerZonePoint[2].toFixed(2)}`}
        {nearestDangerZone && (
          `\n\nNearest: ${nearestDangerZone.zone.nameJa}\n  distance: ${nearestDangerZone.distanceMm.toFixed(2)}mm\n  warning : ${nearestDangerZone.zone.warningRadius}mm\n  danger  : ${nearestDangerZone.zone.dangerRadius}mm\n  state   : ${nearestDangerZone.state.toUpperCase()}`
        )}
        <div style={{ marginTop: 8, pointerEvents: 'auto' }}>
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 3 }}>Ground Truth Export</div>
          <button
            type="button"
            onClick={() => {
              const record = buildGroundTruthRecord(surgicalCase.id, product.id, placement);
              const json = JSON.stringify(record, null, 2);
              setGroundTruthJson(json);
              setGroundTruthCopied(false);
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(json)
                  .then(() => setGroundTruthCopied(true))
                  .catch(() => setGroundTruthCopied(false));
              }
            }}
            style={{
              fontFamily: 'monospace', fontSize: 10, padding: '2px 8px',
              cursor: 'pointer', background: '#2a2a2a', color: '#7fd3ff',
              border: '1px solid #555', borderRadius: 3,
            }}
          >
            {groundTruthCopied ? 'Copied!' : 'Copy JSON'}
          </button>
          {groundTruthJson && (
            <pre
              style={{
                marginTop: 4, maxHeight: 180, overflow: 'auto', fontSize: 9,
                userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 3,
              }}
            >
              {groundTruthJson}
            </pre>
          )}
        </div>
      </div>
    )}
    {coordDebug && product.footType === 'BELL' && (
      <div
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: Z_INDEX.modal,
          background: 'rgba(0,0,0,0.78)', color: '#ccc',
          fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
          borderRadius: 4, whiteSpace: 'pre', lineHeight: 1.5, userSelect: 'none', minWidth: 220,
        }}
      >
        <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>Pose Comparison (P4B-3 Step4)</div>
        {/* P4B-3 Step5: Feature Flag。実際にProsthesisModel/CartilageSliceの描画へ反映される
            切替なので、既存のReference/Candidate/Anchor表示トグル（見た目だけの切替）とは別枠で
            強調表示する（誤操作防止）。 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, cursor: 'pointer', color: '#ffd27f' }}>
          <input
            type="checkbox"
            checked={useNewPoseSolver}
            onChange={(e) => setUseNewPoseSolver(e.target.checked)}
          />
          <span>NEW Pose Pipeline を本番描画へ適用 (Step5, BELL限定)</span>
        </label>
        {/* 凡例+表示切替: 2026-07-24 shojiさんレビュー対応、ラベルは3D空間ではなくHUDで管理 */}
        {([
          { key: 'reference' as const, color: POSE_COLOR_REFERENCE, label: 'REFERENCE (ProsthesisModel実出力)' },
          { key: 'candidate' as const, color: POSE_COLOR_CANDIDATE, label: 'CANDIDATE (solvePose)' },
          { key: 'anchor'    as const, color: POSE_COLOR_ANCHOR,    label: 'ANCHOR (手動snapshot)' },
        ]).map((row) => (
          <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={poseVisibility[row.key]}
              onChange={(e) => setPoseVisibility((v) => ({ ...v, [row.key]: e.target.checked }))}
            />
            <span style={{ width: 10, height: 10, background: row.color, display: 'inline-block', borderRadius: 2 }} />
            <span>{row.label}</span>
          </label>
        ))}
        <div style={{ marginTop: 6, borderTop: '1px solid #444', paddingTop: 6 }}>
          {`Ref vs Cand   Forward:${poseStats.referenceVsCandidate.forwardErrorDeg.toFixed(2)}\u00b0  Twist:${poseStats.referenceVsCandidate.twistDeg.toFixed(2)}\u00b0  Pos:${poseStats.referenceVsCandidate.positionDiffMm.toFixed(3)}mm`}
          {poseStats.referenceVsAnchor && `\nRef vs Anchor Forward:${poseStats.referenceVsAnchor.forwardErrorDeg.toFixed(2)}\u00b0  Twist:${poseStats.referenceVsAnchor.twistDeg.toFixed(2)}\u00b0  Pos:${poseStats.referenceVsAnchor.positionDiffMm.toFixed(3)}mm`}
          {poseStats.candidateVsAnchor && `\nCand vs Anchor Forward:${poseStats.candidateVsAnchor.forwardErrorDeg.toFixed(2)}\u00b0  Twist:${poseStats.candidateVsAnchor.twistDeg.toFixed(2)}\u00b0  Pos:${poseStats.candidateVsAnchor.positionDiffMm.toFixed(3)}mm`}
          {!anchorPose && '\nAnchor未キャプチャ'}
          {`\n\nReference Forward \u2220 TM_NORMAL: ${poseStats.referenceFwdVsTmDeg.toFixed(2)}\u00b0`}
          {`\nCandidate Forward \u2220 TM_NORMAL: ${poseStats.candidateFwdVsTmDeg.toFixed(2)}\u00b0`}
        </div>
        <div style={{ marginTop: 6, pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => setAnchorPose({ position: referenceGhost.position.clone(), quaternion: referenceGhost.quaternion.clone() })}
            style={{
              fontFamily: 'monospace', fontSize: 9, padding: '2px 6px', marginRight: 4,
              cursor: 'pointer', background: '#2a2a2a', color: POSE_COLOR_ANCHOR,
              border: '1px solid #555', borderRadius: 3,
            }}
          >
            Capture Anchor Pose (現在のReferenceをスナップショット)
          </button>
          {anchorPose && (
            <button
              type="button"
              onClick={() => setAnchorPose(null)}
              style={{
                fontFamily: 'monospace', fontSize: 9, padding: '2px 6px',
                cursor: 'pointer', background: '#2a2a2a', color: '#ff8888',
                border: '1px solid #555', borderRadius: 3,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    )}
    {coordDebug && product.headType === 'SOFT_CLIP' && (
      <div
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: Z_INDEX.modal,
          background: 'rgba(0,0,0,0.78)', color: '#ccc',
          fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
          borderRadius: 4, lineHeight: 1.5, userSelect: 'none', minWidth: 220,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
          Soft Clip Band Loop Attached Preview (B0)
        </div>
        <div style={{ color: '#ffd27f', marginBottom: 6, fontSize: 9 }}>
          translation/rotationはPreview parameter（Frozen Geometryではない）。
          <br />
          bridge/endは仮アンカー（Evidence B相当、shoji Audit 2026-08-10）。
        </div>
        {([
          { axis: 'x' as const, label: 'Tx (mm)' },
          { axis: 'y' as const, label: 'Ty (mm)' },
          { axis: 'z' as const, label: 'Tz (mm)' },
        ]).map((row) => (
          <label key={row.axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 56, display: 'inline-block' }}>{row.label}</span>
            <input
              type="number"
              step={0.01}
              value={softClipAttachTransform.translation[row.axis]}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return;
                setSoftClipAttachTransform((t) => {
                  const translation = t.translation.clone();
                  translation[row.axis] = v;
                  return { ...t, translation };
                });
              }}
              style={{
                width: 90, fontFamily: 'monospace', fontSize: 10, background: '#1a1a1a',
                color: '#7fd3ff', border: '1px solid #555', borderRadius: 3, padding: '1px 4px',
              }}
            />
          </label>
        ))}
        {([
          { axis: 'x' as const, label: 'Rx (deg)' },
          { axis: 'y' as const, label: 'Ry (deg)' },
          { axis: 'z' as const, label: 'Rz (deg)' },
        ]).map((row) => (
          <label key={row.axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 56, display: 'inline-block' }}>{row.label}</span>
            <input
              type="number"
              step={1}
              value={softClipAttachTransform.rotationDeg[row.axis]}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return;
                setSoftClipAttachTransform((t) => ({
                  ...t,
                  rotationDeg: { ...t.rotationDeg, [row.axis]: v },
                }));
              }}
              style={{
                width: 90, fontFamily: 'monospace', fontSize: 10, background: '#1a1a1a',
                color: '#ff8800', border: '1px solid #555', borderRadius: 3, padding: '1px 4px',
              }}
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => setSoftClipAttachTransform(getSoftClipBandLoopDefaultAttachTransform())}
          style={{
            marginTop: 6, fontFamily: 'monospace', fontSize: 9, padding: '2px 8px',
            cursor: 'pointer', background: '#2a2a2a', color: '#7fd3ff',
            border: '1px solid #555', borderRadius: 3,
          }}
        >
          Reset (bridge/end anchor, 0°)
        </button>
      </div>
    )}
    <Canvas
      camera={{ position: initCam.pos, fov: 38 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050b15']} />
      <SimViewModeController mode={viewMode} fovOverride={microscopeFov} />
      {/* ── 顕微鏡コントローラー ── */}
      {viewMode === 'microscope' && microscopeLight && (
        <MicroscopeLightController on={microscopeLight.on} intensity={microscopeLight.intensity / 100} />
      )}
      {viewMode === 'microscope' && microscopeFilter && (
        <FilterController filter={microscopeFilter} />
      )}

      {/* ── ライティング (world v2 座標: X+=Lateral, Y+=Superior, Z+=Anterior) ── */}
      <directionalLight
        position={[10, 15, 5]} intensity={1.8} color="#fff8f0"
        castShadow shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[18, 3,  2]}  intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-12, 2, -4]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[5, -8,  0]}  intensity={0.25} color="#d0e4ff" />
      <pointLight position={[-8, -2, 0]}  intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[4,   3, 1]}  intensity={2.0} color="#fff4e0" distance={14} decay={2} />
      <pointLight position={[-5,  5, 3]}  intensity={1.2} color="#aaccff" distance={18} decay={2} />

      <Suspense fallback={null}>
        {/*
          座標系 v2: rotation=[π, -π/2, 0]
          GLB[x,y,z] → world[z,-y,x]
          ここに含まれる全てのモデル（GLBリアル解剖・プロステーシス・マーカー）は
          この変換の内側にあり、すべて同じローカル座標系を共有する。
        */}
        <group ref={coordGroupRef} rotation={[Math.PI, -Math.PI / 2, 0]}>
          {/* ── GLBリアルモデル ── */}
          {/* anatomyGroupRef: Scene Dump診断（?debug=scenedump）専用の読み取り専用ref。
              このgroup自体の描画・Materialには一切影響しない（Occlusion原因診断のsubtree特定用）。 */}
          <group position={GLB_OFFSET} ref={anatomyGroupRef}>
            <RealAnatomy vis={mergedVis} onStructureClick={onStructureClick} />
            {showMalleus   && <group onDoubleClick={(e) => { e.stopPropagation(); onStructureClick?.('malleus'); }}><RealMalleus opacityOverride={malOpacity}  /></group>}
            {showIncus     && <group onDoubleClick={(e) => { e.stopPropagation(); onStructureClick?.('incus');   }}><RealIncus   opacityOverride={incOpacity}  /></group>}
            {showStapesGLB && <group onDoubleClick={(e) => { e.stopPropagation(); onStructureClick?.('stapes');  }}><RealStapes  opacityOverride={stapOpacity} /></group>}
            {/* 底板ハイライト: footplate-only / absent 時に発光ディスク表示 */}
            {showFootplateHighlight && <StapesFootplateHighlight />}
          </group>

          {/* ── 理想配置ゴースト（症例別 idealLateralOffset を反映） ── */}
          {showIdeal && (
            <IdealGhostProsthesis
              product={product}
              length={surgicalCase.recommendedLength}
              headType={product.headType}
              idealLateralOffset={surgicalCase.idealLateralOffset}
              idealAngle={surgicalCase.idealAngle}
              basePos={basePos.clone()}
            />
          )}

          {/* ── ターゲットマーカー（症例別 idealLateralOffset 適用） ── */}
          <PlacementMarker pos={basePos.clone().setX(basePos.x + surgicalCase.idealLateralOffset)} />

          {/* ── Danger Zone Overlay（Phase20.4b、?debug=coords 時のみ） ── */}
          {coordDebug && <DangerZoneOverlay />}

          {/* ── Bell構造デバッグマーカー（2026-07-23、?debug=coords かつ PORP(BELL)時のみ） ── */}
          {coordDebug && product.footType === 'BELL' && (
            <BellDebugMarkers base={bellBase} apex={bellApex} />
          )}

          {/* ── Bellローカル方向候補（Step14 P1-2用、2026-07-23） ── */}
          {coordDebug && product.footType === 'BELL' && (
            <BellDirectionCandidates
              base={bellBase}
              candidates={bellCandidates}
              axisX={bellAxisX}
              axisY={bellAxisY}
              axisZ={bellAxisZ}
            />
          )}

          {/* ── Pose比較Ghost Overlay（P4-3 Step3-2〜P4B-3 Step4、?debug=coords限定・footType===BELL時のみ） ── */}
          {coordDebug && product.footType === 'BELL' && (
            <PoseComparisonOverlay
              shaftLength={selectedLength}
              referenceGhost={referenceGhost}
              candidateGhost={candidateGhost}
              anchorGhost={anchorPose}
              visibility={poseVisibility}
            />
          )}

          {/* ── Soft Clip Pocket Preview（Phase1 dev preview、?debug=coords かつ
              headType==='SOFT_CLIP'時のみ。docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md。
              Pocket-local座標系はShaft/Global座標系と未接続のため、basePosから離した
              オフセット位置に単独描画する（実際の装着位置を意味しない、レビュー専用）。 ── */}
          {coordDebug && product.headType === 'SOFT_CLIP' && (
            <group position={[basePos.x + 10, basePos.y + 5, basePos.z]}>
              <SoftClipPocketPreview />
            </group>
          )}

          {/* ── Soft Clip Band Loop Preview（Hypothesis Geometry dev preview、?debug=coords
              かつ headType==='SOFT_CLIP'時のみ。docs/Soft_Clip_Centerline_Proposal_v3.json。
              Band Loop Editorローカル座標系はShaft/Global座標系と未接続のため、Pocket
              Previewと同様basePosから離したオフセット位置に単独描画する（実際の装着位置を
              意味しない、実物写真との形状比較専用）。 ── */}
          {coordDebug && product.headType === 'SOFT_CLIP' && (
            <group position={[basePos.x - 10, basePos.y + 5, basePos.z]}>
              <SoftClipBandLoopPreview />
            </group>
          )}

          {/* ── Soft Clip Band Loop Attached Preview（Phase B0、shoji Audit 2026-08-10、
              ?debug=coords かつ headType==='SOFT_CLIP'時のみ）。上のSoftClipBandLoopPreview
              (Editorローカル原点、±10mmオフセット単独表示)とは別に、SoftClipHead()と同じ
              Shaft/Global pose(basePos+headOff、DraggableProsthesis→ProsthesisModelが使う
              computeProsthesisModelPose()と同一)の子として、単一の剛体変換
              (softClipAttachTransform、右上パネルでshojiが調整するPreview parameter)で
              重ねて描画する。Production SoftClipHead()（Stem/Bridge/Wing）とは別描画で
              共存表示するのみ（置換ではない）。27制御点・Sweep Geometryは無変更。 ── */}
          {coordDebug && product.headType === 'SOFT_CLIP' && (
            <group
              position={[softClipAttachPose.position.x, softClipAttachPose.position.y, softClipAttachPose.position.z]}
              quaternion={softClipAttachPose.quaternion}
            >
              <group position={[0, softClipAttachHeadOff, 0]}>
                <SoftClipBandLoopAttachedPreview transform={softClipAttachTransform} />
              </group>
            </group>
          )}

          {/* ── 軟骨スライス ── */}
          {showCartilage && (
            <CartilageSlice
              product={product}
              shaftLength={selectedLength}
              basePos={basePos.clone()}
              lateralOffset={lateralOffset}
              anteriorOffset={anteriorOffset}
              verticalOffset={verticalOffset}
              angleTilt={angleTilt}
              angleTiltZ={angleTiltZ}
              dragOffsetX={dragOffsetX}
              dragOffsetY={dragOffsetY}
              dragOffsetZ={dragOffsetZ}
              poseOverride={poseFlagActive ? cartilageCandidatePose : undefined}
            />
          )}

          {/* ── ドラッグ可能プロステーシス（Placement段階）／Transportプロステーシス（Transport段階） ──
              Phase1 Interaction/Transport Layer: manipulation.committed が false の間は既存
              DraggableProsthesis（PlacementState連動）を一切マウントせず、TransportProsthesis
              （ManipulationLayer.tsx、PlacementStateには無関係な一時transportPoseのみで動作）を
              代わりに描画する。committed=true になった瞬間から下は完全に既存経路のみ（無変更）。 */}
          {/* prosthesisGroupRef: Scene Dump診断（?debug=scenedump）専用の読み取り専用ref。
              DraggableProsthesis/DirectTransportProsthesis/TransportProsthesisのいずれが実際に
              マウントされていてもこのgroupが親になる（Occlusion原因診断のsubtree特定用、
              描画・Material・既存の分岐ロジックには一切影響しない）。 */}
          <group ref={prosthesisGroupRef}>
          {manipulation.committed ? (
            <DraggableProsthesis
              product={product}
              selectedLength={selectedLength}
              basePos={basePos.clone()}
              lateralOffset={lateralOffset}
              anteriorOffset={anteriorOffset}
              verticalOffset={verticalOffset}
              angleTilt={angleTilt}
              angleTiltZ={angleTiltZ}
              dragOffsetX={dragOffsetX}
              dragOffsetY={dragOffsetY}
              dragOffsetZ={dragOffsetZ}
              dragMode={dragMode}
              poseOverride={poseFlagActive ? candidateGhost : undefined}
              directManipulation={DIRECT_MANIPULATION_UX}
              shaftRollDeg={interactionShaftRollDeg}
              onDragActiveChange={setDirectDragActive}
              anatomyRootRef={anatomyGroupRef}
              coordGroupRef={coordGroupRef}
            />
          ) : DIRECT_MANIPULATION_UX ? (
            // Phase1-B Step6: Transport段階もDirect Manipulation UXへ切り替え。Prosthesis
            // クリックで直接把持→ドラッグ→pointerUp(解放)がそのままonDirectReleaseを呼び、
            // 呼び出し元(SimulationMode.tsx)がmanipulation.committedをtrueにする。
            //
            // Releaseワープ修正（Conditional Commit方式）: DirectTransportProsthesis内部の
            // isTransportPoseWithinPlacementRange()判定により、basePosから±3mm以内での
            // Releaseの場合にのみこのonReleaseが呼ばれる（範囲外Releaseでは呼ばれず、
            // manipulation.committedはfalseのままTransportが継続する）。
            // ここで受け取るoffsetsは「表示されていたtransportPoseをbasePos基準に読み替えた
            // だけの値」（clampは実質no-op）のため、そのままupdatePlacementしても表示位置と
            // 一致する。DraggableProsthesisへ切り替わる前（onDirectRelease呼び出しで
            // manipulation.committedがtrueになる前）に同期的にstoreへ書き込むことで、
            // 切替直後のstale frame（旧dragOffsetX/Y/Z=0での一瞬の誤描画）を防ぐ。
            // （2026-08-15修正: 以前はこの後さらに別のuseEffectがtransportPoseから
            // 再計算・再書き込みしていたが、TEST強制確定などtransportPoseと無関係な
            // commit経路でこの正しいoffsetsを上書きしてしまうバグの原因だったため
            // 削除済み。このonRelease呼び出しがoffsets書き込みの唯一の経路になった）。
            //
            // Phase1-B ControlPad Transport対応（T2方式）: onReleaseのoffsetsに
            // angleTilt/angleTiltZ（transportTiltの値をそのままコピー）も含まれるため、
            // Position/Tiltをまとめて1回のupdatePlacement()で同期的に書き込む。
            <DirectTransportProsthesis
              product={product}
              selectedLength={selectedLength}
              transportPose={transportPose}
              onTransportPoseChange={setTransportPose}
              transportTilt={transportTilt}
              shaftRollDeg={interactionShaftRollDeg}
              onDragActiveChange={setDirectDragActive}
              basePos={basePos}
              onRelease={(offsets) => {
                useSimStore.getState().updatePlacement(offsets);
                useSimStore.getState().markPositionTouched();
                useSimStore.getState().markAngleTouched();
                onDirectRelease?.();
              }}
            />
          ) : (
            <TransportProsthesis
              product={product}
              selectedLength={selectedLength}
              transportPose={transportPose}
              onTransportPoseChange={setTransportPose}
              instrumentSelected={manipulation.instrumentSelected}
              isGrasped={manipulation.isGrasped}
            />
          )}
          </group>
        {/* ── デバッグランドマーク（showDebugMarkers=true のとき表示）── */}
          {showDebugMarkers && (
            <>
              {/* 黄色: アブミ骨底板 local[0.84,-2.65,2.12] → world[2.12,2.65,0.84] */}
              <mesh position={[STAPES_FOOTPLATE.x, STAPES_FOOTPLATE.y, STAPES_FOOTPLATE.z]}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={2} depthTest={false} />
              </mesh>
              {/* シアン: アブミ骨頭 local[0.84,-2.65,4.86] → world[4.86,2.65,0.84] */}
              <mesh position={[STAPES_HEAD.x, STAPES_HEAD.y, STAPES_HEAD.z]}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} depthTest={false} />
              </mesh>
              {/* マゼンタ: 臍部/鼓膜方向 local[0,0,5] → world[5,0,0] */}
              <mesh position={[UMBO_POS.x, UMBO_POS.y, UMBO_POS.z]}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshStandardMaterial color="#ff44ff" emissive="#ff44ff" emissiveIntensity={2} depthTest={false} />
              </mesh>
            </>
          )}
        </group>
        {/* Collision Engine 単独検証（Phase C-1、?debug=collision限定）: useGLTFを使うため
            Suspense境界の内側に置く必要がある。coordGroupRef（回転グループ）の外側の兄弟として
            配置し、Manipulation Layer・TransformControls等には一切依存しない。 */}
        {collisionVerifyDebug && (
          <CollisionVerifyTracker
            anatomyRootRef={anatomyGroupRef}
            coordGroupRef={coordGroupRef}
            verifyRequestId={collisionVerifyRequestId}
            onResults={setCollisionVerifyResults}
          />
        )}
        {/* [TEST-ONLY, 一時] Phase C-2実機検証（Architect依頼2026-08-14、Collision Boundary
            Warp）。collisionBoundaryWarpRequestIdが指定されている場合のみマウントする
            （既存呼び出し元がpropを渡さなければ何も変わらない）。 */}
        {typeof collisionBoundaryWarpRequestId === 'number' && (
          <CollisionBoundaryWarpTracker
            anatomyRootRef={anatomyGroupRef}
            coordGroupRef={coordGroupRef}
            warpRequestId={collisionBoundaryWarpRequestId}
            product={product}
            basePos={basePos}
            shaftLength={selectedLength}
            idealLateralOffset={surgicalCase.idealLateralOffset}
            onWarp={(warpedLateralOffset) => {
              useSimStore.getState().updatePlacement({
                lateralOffset: warpedLateralOffset,
                anteriorOffset: 0, verticalOffset: 0,
                angleTilt: 0, angleTiltZ: 0,
                dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
              });
              useSimStore.getState().markPositionTouched();
              onDirectRelease?.();
            }}
            onResult={(message, success) => onCollisionBoundaryWarpResult?.(message, success)}
          />
        )}
        {/* [TEST-ONLY, 一時] Phase C-3実機検証（Architect依頼2026-08-14、Rotation Boundary
            Warp）。rotationBoundaryWarpRequestId/Axis/Directionが指定されている場合のみ
            マウントする（既存呼び出し元がpropを渡さなければ何も変わらない）。Placement段階
            （manipulation.committed=true）で完結する操作のため、DraggableProsthesisと
            並列にSuspense境界内へ配置する。 */}
        {typeof rotationBoundaryWarpRequestId === 'number' && rotationBoundaryWarpAxis && rotationBoundaryWarpDirection && (
          <RotationBoundaryWarpTracker
            anatomyRootRef={anatomyGroupRef}
            coordGroupRef={coordGroupRef}
            warpRequestId={rotationBoundaryWarpRequestId}
            product={product}
            basePos={basePos}
            shaftLength={selectedLength}
            lateralOffset={lateralOffset}
            anteriorOffset={anteriorOffset}
            verticalOffset={verticalOffset}
            dragOffsetX={dragOffsetX}
            dragOffsetY={dragOffsetY}
            dragOffsetZ={dragOffsetZ}
            shaftRollDeg={interactionShaftRollDeg}
            axis={rotationBoundaryWarpAxis}
            currentAngle={rotationBoundaryWarpAxis === 'tilt' ? angleTilt : angleTiltZ}
            otherAxisAngle={rotationBoundaryWarpAxis === 'tilt' ? angleTiltZ : angleTilt}
            direction={rotationBoundaryWarpDirection}
            onWarp={(angleDeg) => {
              useSimStore.getState().updatePlacement({
                [rotationBoundaryWarpAxis === 'tilt' ? 'angleTilt' : 'angleTiltZ']: angleDeg,
              });
              useSimStore.getState().markAngleTouched();
            }}
            onResult={(message, success) => onRotationBoundaryWarpResult?.(message, success)}
          />
        )}
      </Suspense>

      {/* ギズモ v2: X=右(Lateral), Y=上(Superior), Z=前(Anterior) */}
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport
          axisColors={['#ff6655', '#88ee88', '#5599ff']}
          labelColor="#ffffff"
          labels={['右', '上', '前']}
        />
      </GizmoHelper>
      {coordDebug && (
        <CoordinateDebugTracker
          panelRef={coordPanelRef}
          anatomyRootRef={coordGroupRef}
          getCameraView={getSimCam}
          viewPresets={[...ANATOMICAL_VIEWS, ...SURGICAL_VIEWS]}
        />
      )}
      {coordDebug && <CoordinateDebugScene3D anatomyRootRef={coordGroupRef} />}
      {sceneDumpDebug && (
        <SceneDumpTracker
          captureRequestId={sceneDumpCaptureRequestId}
          captureLabel={sceneDumpCaptureLabel}
          anatomyRootRef={anatomyGroupRef}
          prosthesisRootRef={prosthesisGroupRef}
          activeRepresentation={activeProsthesisRepresentation}
          manipulationCommitted={manipulation.committed}
          directDragActive={directDragActive}
          onCaptured={setLastSceneDumpResult}
          autoCaptureWhileDragging={sceneDumpAutoCapture}
        />
      )}

      <OrbitControls
        makeDefault
        ref={(r: any) => { (orbitRef as any).current = r; _simOrbit = r; }}
        target={initCam.target}
        enablePan={true}
        enableRotate={viewMode !== 'microscope' || scopePositionMode}
        enableZoom={true}
        minDistance={8}
        maxDistance={85}
        autoRotate={false}
        // Phase1 Interaction/Transport Layer: 把持中(isGrasped)はTransportProsthesis側の
        // TransformControlsとジェスチャーが競合しないよう、既存のdragMode==='view'判定に
        // !isGraspedを追加する（dragMode自体の意味・既定値は無変更。manipulation未指定時は
        // isGrasped=falseのため、この条件は従来のdragMode==='view'と完全に同じ結果になる）。
        // Phase1-B Step3/6: Direct Manipulation UXでのドラッグ中(directDragActive)も同様に
        // OrbitControlsと競合するため無効化する（flag OFF時はdirectDragActiveが常にfalseの
        // ため、この条件追加は既存挙動に影響しない）。
        enabled={dragMode === 'view' && !manipulation.isGrasped && !directDragActive}
        mouseButtons={{
          // Phase22.2 GUI Follow-up P1: 通常/内視鏡モードでもpanMode(既存prop)を尊重するよう拡張。
          // 元の条件（viewMode==='microscope' && scopePositionMode && panMode）はmicroscope固定/移動中
          // トグルの既存挙動を完全に保持したまま、viewMode!=='microscope'の場合のみpanMode単独で
          // 判定する分岐を追加（両条件はviewModeで排他のため、既存の顕微鏡挙動は無変更）。
          LEFT:   (panMode && (viewMode !== 'microscope' || scopePositionMode)) ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  (panMode && (viewMode !== 'microscope' || scopePositionMode)) ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        }}
        onChange={() => {
          if (!_simOrbit) return;
          const p = _simOrbit.object.position;
          const t = _simOrbit.target;
          _simCam = { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
          onCameraChange?.([p.x, p.y, p.z], [t.x, t.y, t.z]);
        }}
      />
    </Canvas>
    </div>
  );
}
