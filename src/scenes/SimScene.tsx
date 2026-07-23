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
import { ProsthesisModel, IdealGhostProsthesis, BELL_HEIGHT_MM } from './models/ProsthesisModels';
import { ANATOMICAL_VIEWS, SURGICAL_VIEWS } from './ViewPresets';
import { Z_INDEX } from '../components/ui';
import { isCoordDebugMode } from '../utils/debugMode';
import { CoordinateDebugPanel, CoordinateDebugTracker, CoordinateDebugScene3D } from './debug/CoordinateDebugOverlay';
import { DANGER_ZONES } from '../data/dangerZones';
import { placementPointToDangerZoneFrame, dangerZonePointToPlacementFrame } from '../engine/coordinates/placementFrame';
import { findNearestDangerZone } from '../engine/safety';
import { buildGroundTruthRecord } from '../engine/groundTruth/exportGroundTruth';
import type { Vec3Tuple } from '../engine/coordinates/types';
import { TRANSLATION_SNAP_MM, KEYBOARD_STEP_MM, KEYBOARD_STEP_CTRL_MM, ROTATION_STEP_DEG, ROTATION_STEP_FINE_DEG } from './transformControlsConfig';

// ── カメラ視点 保存/復元 ────────────────────────────────────────
const _SIM_KEY     = 'kurz_cam_sim';
const _SIM_VERSION = 4;
const _SIM_DEFAULT: { pos: [number,number,number]; target: [number,number,number] } = {
  // overview 方向（外側＋前方＋上方）+ SIM_OFF[2.12,2.65,0.84]
  pos: [-37.88, -22.35, 45.84], target: [2.12, 14.65, -2.16],
};
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
}

function CartilageSlice({
  product, shaftLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,
  angleTilt, angleTiltZ,
  dragOffsetX, dragOffsetY, dragOffsetZ,
}: CartilageSliceProps) {
  const base = basePos.clone();
  base.x += lateralOffset   + dragOffsetX;
  base.y += verticalOffset  + dragOffsetY;
  base.z += anteriorOffset  + dragOffsetZ;

  const dir = new THREE.Vector3().subVectors(UMBO_POS, base).normalize();

  // ヘッドプレート中心 ≒ base + (len + 0.15) * dir
  // 軟骨スライス中心 = ヘッドプレートから 1.5mm 上（鼓膜側）
  const center = base.clone().addScaledVector(dir, shaftLength + 1.65);

  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  const tiltXRad = (angleTilt  * Math.PI) / 180;
  const tiltZRad = (angleTiltZ * Math.PI) / 180;
  // BELL_TOP: 楕円 rx=1.30mm（短辺2.6mm）× rz=1.80mm（長辺3.6mm） ← BellTopヘッドプレート実寸に一致
  // その他: headPlateDiameter/4 の真円
  const isBellTop = product.headType === 'BELL_TOP';
  const RX = isBellTop ? 1.30 : (product.headPlateDiameter ?? 3.0) / 4;
  const RZ = isBellTop ? 1.80 : RX;
  const THICK = 0.25; // 軟骨スライス厚さ 0.25mm

  return (
    <group
      position={[center.x, center.y, center.z]}
      rotation={[euler.x + tiltXRad, euler.y, euler.z + tiltZRad]}
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
}

function DraggableProsthesis({
  product, selectedLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,
  angleTilt, angleTiltZ,
  dragOffsetX, dragOffsetY, dragOffsetZ,
  dragMode,
}: DraggableProsthesisProps) {
  const tcRef = useRef<any>(null);

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
      showX={isMove}
      showY={isMove}
      showZ={isMove}
      enabled={isMove}
      size={0.65}
      translationSnap={TRANSLATION_SNAP_MM}
      onMouseUp={handleMouseUp}
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
      />
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
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ } = placement;

  const isTotal = product.footType === 'FLAT' || product.footType === 'PISTON';
  const basePos = isTotal ? STAPES_FOOTPLATE : STAPES_HEAD;

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
  // dangerZonePoint算出と同じbase計算式（basePos+lateralOffset+dragOffsetX等）を再利用。
  // footType!=='BELL'のときは呼び出し側で描画しないため、方向はUMBO_POS固定で問題ない。
  const bellBase = useMemo(
    () => new THREE.Vector3(
      basePos.x + lateralOffset  + dragOffsetX,
      basePos.y + verticalOffset + dragOffsetY,
      basePos.z + anteriorOffset + dragOffsetZ,
    ),
    [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ],
  );
  const bellApex = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(UMBO_POS, bellBase).normalize();
    return bellBase.clone().addScaledVector(dir, BELL_HEIGHT_MM);
  }, [bellBase]);

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

  // 症例別 耳小骨 ステータス
  const { malleus: malStatus, incus: incStatus, stapes: stapStatus } = surgicalCase.ossicularStatus;

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
            />
          )}

          {/* ── ドラッグ可能プロステーシス ── */}
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
          />
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
        enabled={dragMode === 'view'}
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
