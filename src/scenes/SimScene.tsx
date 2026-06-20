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
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  OssicleChain,
  STAPES_HEAD,
  STAPES_FOOTPLATE,
} from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';
import {
  RealTemporalBone,
  RealTympanicMembrane,
  RealInnerEar,
  RealEAC,
  RealRoundWindow,
} from './models/RealAnatomyModels';
import { TympanoCavity } from './models/TympanoCavityModel';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';
import type { PlacementState } from '../store/useSimStore';

// GLBモデル群をアブミ骨底板（STAPES_FOOTPLATE）位置にオフセットするためのベクトル
// GLB origin (0,0,0) → procedural STAPES_FOOTPLATE [0.84, -2.65, 2.12]
const GLB_OFFSET: [number, number, number] = [
  STAPES_FOOTPLATE.x,
  STAPES_FOOTPLATE.y,
  STAPES_FOOTPLATE.z,
];

interface SimSceneProps {
  surgicalCase:  SurgicalCase;
  product:       KurzProduct;
  placement:     PlacementState;
  showIdeal?:    boolean;
}

// ── 配置ターゲットマーカー ───────────────────────────────────────────
function PlacementMarker({
  pos, lateralOffset, anteriorOffset,
}: {
  pos: THREE.Vector3; lateralOffset: number; anteriorOffset: number;
}) {
  const mx = pos.x + lateralOffset;
  const my = pos.y;
  const mz = pos.z + anteriorOffset;
  return (
    <group position={[mx, my, mz]}>
      {/* 中心ドット */}
      <mesh>
        <cylinderGeometry args={[0.10, 0.10, 0.05, 12]} />
        <meshStandardMaterial color="#00b4d8" emissive="#00b4d8" emissiveIntensity={1.2} />
      </mesh>
      {/* クロスライン */}
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

// ══════════════════════════════════════════════════════════════════
// SimScene
// ══════════════════════════════════════════════════════════════════
export function SimScene({
  surgicalCase, product, placement, showIdeal = false,
}: SimSceneProps) {
  const { selectedLength, lateralOffset, anteriorOffset, angleTilt } = placement;

  // PORP / TORP でシャフト下端を切り替え
  const isTotal = product.footType === 'FLAT';
  const basePos = isTotal ? STAPES_FOOTPLATE : STAPES_HEAD;

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

      {/* ── ライティング（学習モードと同等） ── */}
      <directionalLight
        position={[5, 15, 10]} intensity={1.8} color="#fff8f0"
        castShadow shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[2,  3, 18]}  intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[0, -8,  5]}  intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]}  intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1,  3,  4]}  intensity={2.0} color="#fff4e0" distance={14} decay={2} />
      {/* チタン用リムライト */}
      <pointLight position={[3,  5, -5]}  intensity={1.2} color="#aaccff" distance={18} decay={2} />

      <Suspense fallback={null}>
        {/* ── GLBリアルモデル（骨・鼓膜・内耳）── */}
        {/* GLBはアブミ骨底板を原点としているのでSTAPES_FOOTPLATEにオフセット */}
        <group position={GLB_OFFSET}>
          {/* 側頭骨（半透明: 内部が見えるように） */}
          <RealTemporalBone opacityOverride={0.18} />
          {/* 外耳道（半透明） */}
          <RealEAC opacityOverride={0.12} />
          {/* 鼓膜 */}
          <RealTympanicMembrane opacityOverride={0.70} />
          {/* 内耳（半透明） */}
          <RealInnerEar opacityOverride={0.55} />
          {/* 正円窓 */}
          <RealRoundWindow opacityOverride={0.90} />
        </group>

        {/* ── 鼓室壁ランドマーク（TympanoCavity: 手続き座標系で定義済み）── */}
        <TympanoCavity
          showLabels={false}
          wallOpacity={0.12}
          showNerves={true}
          showEAC={false}
        />

        {/* ── 耳小骨連鎖（症例に応じた状態・手続き座標系）── */}
        <OssicleChain
          malleus={surgicalCase.ossicularStatus.malleus}
          incus={surgicalCase.ossicularStatus.incus}
          stapes={surgicalCase.ossicularStatus.stapes}
          showLabels={false}
        />

        {/* ── 理想配置ゴースト ── */}
        {showIdeal && (
          <IdealGhostProsthesis
            product={product}
            length={surgicalCase.recommendedLength}
          />
        )}

        {/* ── 実際のプロテーゼ配置 ── */}
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          basePos={basePos.clone()}
          lateralOffset={lateralOffset}
          anteriorOffset={anteriorOffset}
          angleTilt={angleTilt}
        />

        {/* ── 配置ターゲットマーカー ── */}
        <PlacementMarker
          pos={basePos}
          lateralOffset={lateralOffset}
          anteriorOffset={anteriorOffset}
        />

        {/* 影受け面 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.12} />
        </mesh>
      </Suspense>

      <OrbitControls
        target={[0.5, -0.5, 3]}
        enablePan={true}
        minDistance={8}
        maxDistance={40}
        autoRotate={false}
      />
    </Canvas>
  );
}
