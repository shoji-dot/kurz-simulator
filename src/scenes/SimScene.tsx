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

import { Suspense, useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
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
import { isCoordDebugMode } from '../utils/debugMode';
import { CoordinateDebugPanel, CoordinateDebugTracker, CoordinateDebugScene3D } from './debug/CoordinateDebugOverlay';
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
import { TRANSLATION_SNAP_MM, KEYBOARD_STEP_MM, KEYBOARD_STEP_CTRL_MM, ROTATION_STEP_DEG, ROTATION_STEP_FINE_DEG, DIRECT_MANIPULATION_UX } from './transformControlsConfig';
import {
  TransportProsthesis,
  DirectTransportProsthesis,
  createInitialTransportPose,
  commitTransportPoseToOffsets,
  useScreenSpaceDrag,
  INITIAL_MANIPULATION_STATE,
  type TransportPose,
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

export type DragMode = 'move' | 'view';
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
   * はここでmanipulation.committedをtrueにする（実際のPlacementStateへのCommit処理自体は
   * 既存のuseEffect（commitTransportPoseToOffsets）がmanipulation.committedの変化を検知して
   * 行う、無変更）。
   */
  onDirectRelease?: () => void;
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
}: DraggableProsthesisProps) {
  const tcRef = useRef<any>(null);
  const dragGroupRef = useRef<THREE.Group>(null);

  // Phase1-B Step3: Placement済みプロステーシスの直接クリック→ドラッグ。ドラッグ終了時、
  // 既存DraggableProsthesis.handleMouseUpと同じ意味論・同じ±3mmクランプでdragOffsetX/Y/Zへ
  // 直接反映する（TransformControlsギズモを経由しない別入力機構、Implementation Prompt §7 Step3）。
  const { onPointerDown: onDirectDragPointerDown } = useScreenSpaceDrag(
    dragGroupRef,
    onDragActiveChange ?? (() => {}),
    (localDelta) => {
      const { placement } = useSimStore.getState();
      useSimStore.getState().updatePlacement({
        dragOffsetX: clamp3(placement.dragOffsetX + localDelta.x),
        dragOffsetY: clamp3(placement.dragOffsetY + localDelta.y),
        dragOffsetZ: clamp3(placement.dragOffsetZ + localDelta.z),
      });
      // Implementation Prompt §7 Step3: ドラッグ終了時にmarkPositionTouched()を呼ぶこと
      // （既存の採点起動条件を壊さないため）。
      useSimStore.getState().markPositionTouched();
    },
  );

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
        // 回転モード: ←→=左右傾斜(tiltZ)、↑↓=前後傾斜(tilt)
        const rotAxis: 'tilt' | 'tiltZ' = axis === 'x' ? 'tiltZ' : 'tilt';
        const rotStep = e.ctrlKey ? ROTATION_STEP_FINE_DEG : ROTATION_STEP_DEG;
        useSimStore.getState().rotateSelectedObject(rotAxis, sign * rotStep);
      } else {
        const moveStep = e.ctrlKey ? KEYBOARD_STEP_CTRL_MM : KEYBOARD_STEP_MM;
        useSimStore.getState().translateSelectedObject(axis, sign * moveStep);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMove]);
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
        onPointerDown={directManipulation ? onDirectDragPointerDown : undefined}
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
  // manipulation.committed が false→true になった瞬間に一度だけ、Transport→Placementの
  // Commit（唯一の変換点）を実行するためのガード。
  const hasCommittedRef = useRef(false);
  useEffect(() => {
    if (!manipulation.committed || hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    const offsets = commitTransportPoseToOffsets(transportPose, basePos);
    // 既存のPlacementState setterをそのまま使う（意味・クランプ範囲とも無変更）。
    useSimStore.getState().updatePlacement(offsets);
    useSimStore.getState().markPositionTouched();
    onManipulationCommitted?.();
  }, [manipulation.committed, transportPose, basePos, onManipulationCommitted]);

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

  // vis をマージ。耳小骨（ossicles/malleus/incus/stapes）と auricle は
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
          <group position={GLB_OFFSET}>
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
            />
          ) : DIRECT_MANIPULATION_UX ? (
            // Phase1-B Step6: Transport段階もDirect Manipulation UXへ切り替え。Prosthesis
            // クリックで直接把持→ドラッグ→pointerUp(解放)がそのままonDirectReleaseを呼び、
            // 呼び出し元(SimulationMode.tsx)がmanipulation.committedをtrueにする
            // （実際のPlacementStateへのCommitは既存useEffectのまま、無変更）。
            <DirectTransportProsthesis
              product={product}
              selectedLength={selectedLength}
              transportPose={transportPose}
              onTransportPoseChange={setTransportPose}
              shaftRollDeg={interactionShaftRollDeg}
              onDragActiveChange={setDirectDragActive}
              onRelease={() => onDirectRelease?.()}
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
