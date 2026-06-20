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
  ossicles:      'hidden',   // GLB 耳小骨は症例別に直接レンダリング
  tympanic:      'solid',
  innerEar:      'ghost',
  facialNerve:   'ghost',    // 顔面神経：ghost で存在感を示す
  chordaTympani: 'solid',    // 鼓索神経：手術視野に近いため solid
  eac:           'ghost',
  roundWindow:   'solid',
};

interface SimSceneProps {
  surgicalCase:  SurgicalCase;
  product:       KurzProduct;
  placement:     PlacementState;
  showIdeal?:    boolean;
  /** 表示切替（学習モードと同一形式） */
  vis?:          VisibilityMap;
}

// ── 配置ターゲットマーカー（理想位置 = 常にアブミ骨頭中央）───────────
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
  product:       KurzProduct;
  selectedLength: number;
  basePos:       THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  angleTilt:     number;
  dragOffsetX:   number;
  dragOffsetZ:   number;
  orbitRef:      React.RefObject<any>;
}

function DraggableProsthesis({
  product, selectedLength, basePos,
  lateralOffset, anteriorOffset, angleTilt,
  dragOffsetX, dragOffsetZ,
  orbitRef,
}: DraggableProsthesisProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tcRef    = useRef<any>(null);

  // TransformControls の dragging-changed イベントで OrbitControls を on/off
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleDraggingChanged = (e: { value: boolean }) => {
      // ドラッグ開始 → OrbitControls 無効
      if (e.value) {
        if (orbitRef.current) orbitRef.current.enabled = false;
        return;
      }
      // ドラッグ終了 → OrbitControls 有効・位置を store に焼き込み
      if (orbitRef.current) orbitRef.current.enabled = true;
      const g = groupRef.current;
      if (!g) return;
      const { placement } = useSimStore.getState();
      useSimStore.getState().updatePlacement({
        dragOffsetX: clamp3(placement.dragOffsetX + g.position.x),
        dragOffsetZ: clamp3(placement.dragOffsetZ + g.position.z),
      });
      // グループ位置をリセット（store の値で ProsthesisModel が再描画される）
      g.position.set(0, 0, 0);
    };

    tc.addEventListener('dragging-changed', handleDraggingChanged);
    return () => tc.removeEventListener('dragging-changed', handleDraggingChanged);
  // orbitRef は ref なので依存なし。意図的に空 dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TransformControls
      ref={tcRef}
      mode="translate"
      showY={false}
      size={0.65}
    >
      <group ref={groupRef}>
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          basePos={basePos.clone()}
          lateralOffset={lateralOffset + dragOffsetX}
          anteriorOffset={anteriorOffset + dragOffsetZ}
          angleTilt={angleTilt}
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
  surgicalCase, product, placement, showIdeal = false, vis = {},
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, angleTilt, dragOffsetX, dragOffsetZ } = placement;

  const isTotal = product.footType === 'FLAT';
  const basePos = isTotal ? STAPES_FOOTPLATE : STAPES_HEAD;

  // vis をマージ（ossicles / auricle は常に hidden: 下で症例別にレンダリング）
  const mergedVis: VisibilityMap = {
    ...SIM_DEFAULT_VIS,
    ...vis,
    ossicles: 'hidden',
    auricle:  'hidden',
  };

  // 症例別 耳小骨 表示設定
  const { malleus: malStatus, incus: incStatus, stapes: stapStatus } = surgicalCase.ossicularStatus;
  const showMalleus = malStatus  !== 'absent';
  const showIncus   = incStatus  !== 'absent';
  const showStapes  = stapStatus !== 'absent';
  const malOpacity  = malStatus  === 'partial'       ? 0.45 : undefined;
  const incOpacity  = incStatus  === 'partial'       ? 0.45 : undefined;
  const stapOpacity = stapStatus === 'footplate-only' ? 0.35 : undefined;

  // OrbitControls ref（ドラッグ中に無効化するため）
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

        {/* ── 理想配置ゴースト ── */}
        {showIdeal && (
          <IdealGhostProsthesis
            product={product}
            length={surgicalCase.recommendedLength}
          />
        )}

        {/* ── ターゲットマーカー（理想位置 = アブミ骨頭中央） ── */}
        <PlacementMarker pos={basePos} />

        {/* ── ドラッグ可能プロテーゼ ── */}
        <DraggableProsthesis
          product={product}
          selectedLength={selectedLength}
          basePos={basePos.clone()}
          lateralOffset={lateralOffset}
          anteriorOffset={anteriorOffset}
          angleTilt={angleTilt}
          dragOffsetX={dragOffsetX}
          dragOffsetZ={dragOffsetZ}
          orbitRef={orbitRef}
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
      />
    </Canvas>
  );
}
