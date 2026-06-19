/**
 * SimScene.tsx  ── シミュレーションモード 3D シーン
 *
 * OssicleModels / ProsthesisModels に統一した座標系を使用
 *   1 unit = 1 mm
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain, STAPES_HEAD, STAPES_FOOTPLATE } from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';
import type { PlacementState } from '../store/useSimStore';

interface SimSceneProps {
  surgicalCase:  SurgicalCase;
  product:       KurzProduct;
  placement:     PlacementState;
  showIdeal?:    boolean;
}

// ── 簡易骨壁（シミュレーション用） ─────────────────────────────────
function CavityWalls() {
  return (
    <>
      {/* 内耳壁（背景） */}
      <mesh position={[0, 1, -6.0]}>
        <planeGeometry args={[14, 16]} />
        <meshStandardMaterial color="#c8bca8" roughness={0.55} />
      </mesh>
      {/* 岬角 */}
      <mesh position={[0.5, -1.5, -5.5]}>
        <sphereGeometry args={[2.0, 20, 20]} />
        <meshStandardMaterial color="#bdb09a" roughness={0.5} />
      </mesh>
      {/* 卵円窓マーカー */}
      <mesh position={[-0.4, -2.5, -5.2]} rotation={[0, 0, 0.3]} scale={[1, 0.55, 1]}>
        <circleGeometry args={[1.0, 24]} />
        <meshStandardMaterial color="#607090" roughness={0.3} />
      </mesh>
      {/* 上壁 */}
      <mesh position={[0, 7.0, -0.5]}>
        <boxGeometry args={[12, 1.5, 14]} />
        <meshStandardMaterial color="#e0d4be" roughness={0.6} />
      </mesh>
      {/* 骨輪（外耳道端） */}
      <mesh position={[0, 2.0, 5.5]}>
        <ringGeometry args={[4.6, 6.0, 40]} />
        <meshStandardMaterial color="#d8cdb8" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ── 配置ターゲットマーカー（アブミ骨頭 / 底板上） ──────────────────
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
        <cylinderGeometry args={[0.08, 0.08, 0.05, 12]} />
        <meshStandardMaterial color="#00b4d8" emissive="#00b4d8" emissiveIntensity={1.0} />
      </mesh>
      {/* クロスライン */}
      <mesh>
        <boxGeometry args={[2.5, 0.04, 0.04]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.5} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.04, 0.04, 2.5]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.5} />
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
  const isTotal   = product.footType === 'FLAT';
  const basePos   = isTotal ? STAPES_FOOTPLATE : STAPES_HEAD;

  return (
    <Canvas
      camera={{ position: [6, 8, 22], fov: 40 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050b15']} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 8, 12]} intensity={1.2} color="#fffaf0" castShadow />
      <directionalLight position={[-8, 2, 6]}  intensity={0.35} color="#d8e8ff" />
      <pointLight position={[0, 0, -8]} intensity={0.5} color="#8899bb" />
      {/* チタン用リムライト */}
      <pointLight position={[2, 4, -6]} intensity={0.8} color="#aaccff" />

      <Suspense fallback={null}>
        {/* 骨壁 */}
        <CavityWalls />

        {/* 耳小骨連鎖（症例に応じた状態） */}
        <OssicleChain
          malleus={surgicalCase.ossicularStatus.malleus}
          incus={surgicalCase.ossicularStatus.incus}
          stapes={surgicalCase.ossicularStatus.stapes}
          showLabels={false}
        />

        {/* 理想配置ゴースト */}
        {showIdeal && (
          <IdealGhostProsthesis
            product={product}
            length={surgicalCase.recommendedLength}
          />
        )}

        {/* 実際のプロテーゼ配置 */}
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          basePos={basePos.clone()}
          lateralOffset={lateralOffset}
          anteriorOffset={anteriorOffset}
          angleTilt={angleTilt}
        />

        {/* 配置ターゲットマーカー */}
        <PlacementMarker
          pos={basePos}
          lateralOffset={lateralOffset}
          anteriorOffset={anteriorOffset}
        />
      </Suspense>

      <OrbitControls
        target={[0, 1, 0]}
        enablePan={true}
        minDistance={10}
        maxDistance={35}
        autoRotate={false}
      />
    </Canvas>
  );
}
