/**
 * SimScene.tsx  ── シミュレーションモード 3D シーン（GLBリアルモデル版）
 *
 * ▼ 座標系（OssicleModels.tsx と共通）
 *   1 unit = 1 mm
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 *   Origin = 鼓室中央（手続き的モデル基準）
 *
 * ▼ GLBオフセット
 *   GLB座標系の原点 = アブミ骨底板 = STAPES_FOOTPLATE [0.84, -2.65, 2.12]
 *   → GLBグループを STAPES_FOOTPLATE 位置にオフセットすることで整合
 *
 * ▼ TransformControls によるドラッグ配置
 *   プロテーゼを XZ 平面でドラッグ → mouseup 時に dragOffsetX/Z を更新
 *   OrbitControls はドラッグ中に無効化
 */

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  STAPES_HEAD,
  STAPES_FOOTPLATE,
  UMBO_POS,
} from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';

// ── カメラ視点 保存/復元 ────────────────────────────────────────
const _SIM_KEY = 'kurz_cam_sim';
const _SIM_DEFAULT: { pos: [number,number,number]; target: [number,number,number] } = {
  pos: [5, 70, 30], target: [0.5, 0.5, 3],
};
function _loadSimCam() {
  try {
    const raw = localStorage.getItem(_SIM_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.pos) && d.pos.length === 3 && Array.isArray(d.target) && d.target.length === 3)
        return d as typeof _SIM_DEFAULT;
    }
  } catch { /* */ }
  return _SIM_DEFAULT;
}
let _simCam = { ..._SIM_DEFAULT };
let _simOrbit: any = null;
export function saveSimCam(): void {
  localStorage.setItem(_SIM_KEY, JSON.stringify(_simCam));
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
  // BellTop 3Dモデルは外径 ry=0.90mm（カタログ寸法3.6mmの半スケール描画）
  // headPlateDiameter / 4 = 3.6/4 = 0.90 でレンダリング外径に一致
  const r = (product.headPlateDiameter ?? 3.0) / 4;
  const THICK = 0.25; // 軟骨スライス厚さ 0.25mm（ユーザー指定）

  return (
    <group
      position={[center.x, center.y, center.z]}
      rotation={[euler.x + tiltXRad, euler.y, euler.z + tiltZRad]}
    >
      {/* 軟骨本体（2mm 厚） */}
      <mesh>
        <cylinderGeometry args={[r, r, THICK, 32]} />
        <meshStandardMaterial color="#e8d5a0" transparent opacity={0.82} roughness={0.65} metalness={0} />
      </mesh>
      {/* 上面・下面の輪郭を強調 */}
      <mesh position={[0,  THICK / 2, 0]}>
        <cylinderGeometry args={[r * 0.99, r * 0.99, 0.06, 32]} />
        <meshStandardMaterial color="#c4a86a" transparent opacity={0.9} roughness={0.4} />
      </mesh>
      <mesh position={[0, -THICK / 2, 0]}>
        <cylinderGeometry args={[r * 0.99, r * 0.99, 0.06, 32]} />
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
  /** 操作モード: 'move'=プロテーゼ移動, 'view'=ビュー操作 */
  dragMode?:      DragMode;
  /** ダブルクリックで構造の表示モードを切替するコールバック */
  onStructureClick?: (key: StructureKey) => void;
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

// ── ドラッグ可能プロテーゼ（TransformControls） ──────────────────────
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
  // アンマウント→再マウントするとグループが再生成されて position がリセットされるため。
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
  surgicalCase, product, placement, showIdeal = false, showCartilage = false, vis = {}, dragMode = 'view', onStructureClick,
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
  // absent/footplate-only 骨を表示する場合は「参照解剖」として薄いゴーストで表示。
  const showMalleus    = ossMode('malleus') !== 'hidden';
  const showIncus      = ossMode('incus')   !== 'hidden';
  const showStapesGLB  = ossMode('stapes')  !== 'hidden';
  const footplateVisMode = vis['stapesFootplate'];
  const isCaseWithFootplate = stapStatus === 'footplate-only' || stapStatus === 'absent';
  const showFootplateHighlight = footplateVisMode !== 'hidden'
    && (footplateVisMode !== undefined || isCaseWithFootplate);
  // absent/footplate-only 骨：ユーザーが表示切替した場合は見える不透明度を使用
  // solid → 0.30（参照解剖として識別可能）, ghost → GHOST_OPACITY（薄い参照）
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

      {/* ── ライティング ── */}
      <directionalLight
        position={[5, 15, 10]} intensity={1.8} color="#fff8f0"
        castShadow shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[2,  3, 18]}  intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[0, -8,  5]}  intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]}  intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1,  3,  4]}  intensity={2.0} color="#fff4e0" distance={14} decay={2} />
      <pointLight position={[3,  5, -5]}  intensity={1.2} color="#aaccff" distance={18} decay={2} />

      <Suspense fallback={null}>
        {/* Y軸反転グループ（GLBがY-down座標系のため） */}
        <group scale={[1, -1, 1]}>
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

          {/* ── ドラッグ可能プロテーゼ ── */}
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
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        ref={(r: any) => { (orbitRef as any).current = r; _simOrbit = r; }}
        target={initCam.target}
        enablePan={true}
        minDistance={8}
        maxDistance={85}
        autoRotate={false}
        enabled={dragMode === 'view'}
        onChange={() => {
          if (!_simOrbit) return;
          const p = _simOrbit.object.position;
          const t = _simOrbit.target;
          _simCam = { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
        }}
      />
    </Canvas>
  );
}
