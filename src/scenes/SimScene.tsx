/**
 * SimScene.tsx  ── シミュレーションモード 3D シーン（GLBリアルモデル版）
 *
 * ▼ 座標系 v2（world空間）
 *   GLB[x, y, z] → world[z, -y, x]
 *   X+ = 患者右側 / 外側 (Lateral)
 *   Y+ = 頭頂側   (Superior)
 *   Z+ = 顔面側   (Anterior)
 *
 * ▼ モデル変換
 *   <group rotation={[Math.PI, -Math.PI/2, 0]}>
 *   内包する全ての子（GLBモデル・プロステーシス）に適用
 *
 * ▼ GLBオフセット
 *   GLB座標系の原点 = アブミ骨底板 = ローカル[0.84, -2.65, 2.12]
 *   → GLBグループを STAPES_FOOTPLATE (ローカル値) 位置にオフセット
 *   → world v2 でのアブミ骨底板位置 = [2.12, 2.65, 0.84]
 *
 * ▼ TransformControls によるドラッグ配置
 *   プロステーシスを world 空間でドラッグ → mouseup 時に dragOffset を更新
 *   OrbitControls はドラッグ中に無効化
 */

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import {
  STAPES_HEAD,
  STAPES_FOOTPLATE,
  UMBO_POS,
} from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';

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
  const groupRef = useRef<THREE.Group>(null);
  const tcRef    = useRef<any>(null);

  // ドラッグ完了時に offset を store に積み込む
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleDraggingChanged = (e: { value: boolean }) => {
      if (e.value) return; // ドラッグ開始: 何もしない（Orbitは dragMode で制御）
      const g = groupRef.current;
      if (!g) return;
      const { placement } = useSimStore.getState();
      useSimStore.getState().updatePlacement({
        dragOffsetX: clamp3(placement.dragOffsetX + g.position.x),
        dragOffsetY: clamp3(placement.dragOffsetY + g.position.y),
        dragOffsetZ: clamp3(placement.dragOffsetZ + g.position.z),
      });
      g.position.set(0, 0, 0);
    };

    tc.addEventListener('dragging-changed', handleDraggingChanged);
    return () => tc.removeEventListener('dragging-changed', handleDraggingChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TC は常にマウントしたまま。viewモード時はハンドルを非表示＆操作無効にする。
  const isMove = dragMode === 'move';
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
    >
      <group ref={groupRef}>
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
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ } = placement;

  const isTotal = product.footType === 'FLAT' || product.footType === 'PISTON';
  const basePos = isTotal ? STAPES_FOOTPLATE : STAPES_HEAD;

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

  return (
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
        <group rotation={[Math.PI, -Math.PI / 2, 0]}>
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
          LEFT:   (viewMode === 'microscope' && scopePositionMode && panMode) ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  (viewMode === 'microscope' && scopePositionMode && panMode) ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
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
  );
}
