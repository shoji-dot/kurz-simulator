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

import { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  STAPES_HEAD,
  STAPES_FOOTPLATE,
} from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';
import {
  RealAnatomy,
  RealMalleus,
  RealIncus,
  RealStapes,
  GHOST_OPACITY,
  type OpacityMode,
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
  bone:          'ghost',
  auricle:       'hidden',
  ossicles:      'hidden',   // GLB 耳小骨は症例別に直接レンダリング（旧キー）
  malleus:       'solid',    // 個別制御：サイドバー既定は実体
  incus:         'solid',
  stapes:        'solid',
  tympanic:      'solid',
  innerEar:      'ghost',
  facialNerve:   'ghost',    // 顔面神経：ghost で存在感を示す
  chordaTympani: 'solid',    // 鼓索神経：手術視野に近いため solid
  eac:           'ghost',
  roundWindow:   'solid',
};

export type DragMode = 'move' | 'view';

interface SimSceneProps {
  surgicalCase:  SurgicalCase;
  product:       KurzProduct;
  placement:     PlacementState;
  showIdeal?:    boolean;
  /** 表示切替（学習モードと同一形式） */
  vis?:          VisibilityMap;
  /** 操作モード: 'move'=プロテーゼ移動, 'view'=ビュー操作 */
  dragMode?:     DragMode;
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
  surgicalCase, product, placement, showIdeal = false, vis = {}, dragMode = 'view',
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ } = placement;

  const isTotal = product.footType === 'FLAT';
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

  // 症例ステータスによる基本不透明度（partial=菲薄化, footplate-only=底板のみ）
  const caseOpacity = (status: string): number | undefined =>
    status === 'partial' ? 0.45 : status === 'footplate-only' ? 0.35 : undefined;

  // 表示判定：症例で absent でなく、かつユーザーが hidden にしていない場合のみ表示
  // 不透明度：ghost モードなら GHOST_OPACITY、それ以外は症例ステータス由来の値
  const showMalleus = malStatus  !== 'absent' && ossMode('malleus') !== 'hidden';
  const showIncus   = incStatus  !== 'absent' && ossMode('incus')   !== 'hidden';
  const showStapes  = stapStatus !== 'absent' && ossMode('stapes')  !== 'hidden';
  const malOpacity  = ossMode('malleus') === 'ghost' ? GHOST_OPACITY : caseOpacity(malStatus);
  const incOpacity  = ossMode('incus')   === 'ghost' ? GHOST_OPACITY : caseOpacity(incStatus);
  const stapOpacity = ossMode('stapes')  === 'ghost' ? GHOST_OPACITY : caseOpacity(stapStatus);

  const orbitRef = useRef<any>(null);

  return (
    <Canvas
      camera={{ position: [8, 6, 26], fov: 38 }}
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
        {/* ── GLBリアルモデル ── */}
        <group position={GLB_OFFSET}>
          <RealAnatomy vis={mergedVis} />
          {showMalleus && <RealMalleus opacityOverride={malOpacity}  />}
          {showIncus   && <RealIncus   opacityOverride={incOpacity}  />}
          {showStapes  && <RealStapes  opacityOverride={stapOpacity} />}
        </group>

        {/* ── 理想配置ゴースト（症例別 idealLateralOffset を反映） ── */}
        {showIdeal && (
          <IdealGhostProsthesis
            product={product}
            length={surgicalCase.recommendedLength}
            idealLateralOffset={surgicalCase.idealLateralOffset}
            idealAngle={surgicalCase.idealAngle}
          />
        )}

        {/* ── ターゲットマーカー（症例別 idealLateralOffset 適用） ── */}
        <PlacementMarker pos={basePos.clone().setX(basePos.x + surgicalCase.idealLateralOffset)} />

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

        {/* 影受け面 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.12} />
        </mesh>
      </Suspense>

      <OrbitControls
        ref={orbitRef}
        target={[0.5, -0.5, 3]}
        enablePan={true}
        minDistance={8}
        maxDistance={40}
        autoRotate={false}
        enabled={dragMode === 'view'}
      />
    </Canvas>
  );
}
