/**
 * AnatomyScene.tsx
 * 解剖学的中耳シーン（骨壁・耳小骨・内耳壁）
 *
 * 座標系: OssicleModels に準拠（1 unit = 1 mm）
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels';
import type { OssicleStatus, StapesStatus } from '../data/cases';
import { useSimStore } from '../store/useSimStore';

// ── 骨色定数 ─────────────────────────────────────────────────────
const BONE_WALL  = '#e8dcc8';
const BONE_INNER = '#d8cdb8';
const PROM_COLOR = '#cfc4b0';

// ══════════════════════════════════════════════════════════════════
// 内耳壁（迷路壁）: 岬角・卵円窓・正円窓
// ══════════════════════════════════════════════════════════════════
function MedialWall() {
  return (
    <group position={[0, 1, -6.0]}>
      {/* 壁面 */}
      <mesh>
        <planeGeometry args={[14, 17]} />
        <meshStandardMaterial color={BONE_INNER} roughness={0.55} />
      </mesh>
      {/* 岬角 (Promontory) — 蝸牛第一回転の隆起 */}
      <mesh position={[0.5, -1.5, 0.5]}>
        <sphereGeometry args={[2.2, 20, 20]} />
        <meshStandardMaterial color={PROM_COLOR} roughness={0.5} />
      </mesh>
      {/* 卵円窓 (Oval Window) */}
      <mesh position={[-0.4, 0.8, 0.8]} rotation={[0, 0, 0.3]} scale={[1, 0.55, 1]}>
        <circleGeometry args={[1.0, 24]} />
        <meshStandardMaterial color="#607090" roughness={0.3} />
      </mesh>
      {/* 正円窓 (Round Window) */}
      <mesh position={[0.3, -3.5, 0.8]}>
        <circleGeometry args={[0.6, 20]} />
        <meshStandardMaterial color="#405060" roughness={0.3} />
      </mesh>
      {/* アブミ骨筋腱錐隆起 */}
      <mesh position={[-1.5, 0.5, 0.4]}>
        <cylinderGeometry args={[0.2, 0.2, 0.8, 8]} />
        <meshStandardMaterial color={BONE_INNER} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 側頭骨骨壁（鼓室を囲む壁）
// 外耳道側（+Z）は開放（カメラ方向）
// ══════════════════════════════════════════════════════════════════
function TemporalBoneWalls() {
  return (
    <group>
      {/* 鼓室蓋 (Tegmen tympani) — 上壁 */}
      <mesh position={[0, 7.0, -0.5]}>
        <boxGeometry args={[13, 1.8, 14]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.6} />
      </mesh>
      {/* 下壁（鼓室床） */}
      <mesh position={[0, -6.5, -0.5]}>
        <boxGeometry args={[13, 1.8, 14]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.6} />
      </mesh>
      {/* 後壁（乳突洞入口） */}
      <mesh position={[0, 0, -7.0]}>
        <boxGeometry args={[13, 17, 2.0]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.6} />
      </mesh>
      {/* 前壁（耳管開口） */}
      <mesh position={[5.0, -0.5, -0.5]}>
        <boxGeometry args={[3.0, 11, 14]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.6} />
      </mesh>
      {/* 上鼓室（Attic）側壁 */}
      <mesh position={[-3.5, 5.5, 1.5]}>
        <boxGeometry args={[7.0, 3.0, 8]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.6} />
      </mesh>
      {/* 内耳壁 */}
      <MedialWall />
      {/* 外耳道骨輪（鼓膜縁を支える） */}
      <mesh position={[0, 2.0, 5.5]}>
        <ringGeometry args={[4.6, 6.2, 40]} />
        <meshStandardMaterial color={BONE_INNER} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 鼓索神経（Chorda tympani）
// 黄色の細い神経線維、鼓室を横断する
// ══════════════════════════════════════════════════════════════════
function ChordaTympani() {
  const points = [
    new THREE.Vector3( 1.8,  2.8,  4.8),
    new THREE.Vector3( 0.9,  1.2,  4.6),
    new THREE.Vector3(-0.2, -0.5,  3.8),
    new THREE.Vector3(-1.0, -1.8,  2.5),
  ];
  const curve   = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.10, 8, false);
  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color="#d4b040" roughness={0.6} transparent opacity={0.85} />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// メイン解剖シーン
// ══════════════════════════════════════════════════════════════════
export function AnatomyScene() {
  const highlight = useSimStore((s) => s.highlightedStructure);

  return (
    <Canvas
      camera={{ position: [5, 8, 24], fov: 40 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />

      {/* ライティング */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 8, 14]} intensity={1.2} color="#fffaf0" />
      <directionalLight position={[-8, 2, 6]}  intensity={0.4} color="#d8e8ff" />
      <directionalLight position={[5, -6, 8]}  intensity={0.3} color="#fff8e0" />
      <pointLight       position={[0, 0, -8]}  intensity={0.6} color="#8899bb" />

      <Suspense fallback={null}>
        <TemporalBoneWalls />
        <ChordaTympani />
        <OssicleChain
          malleus="intact"
          incus="intact"
          stapes="intact"
          highlight={highlight}
          showLabels={true}
        />
      </Suspense>

      <OrbitControls
        target={[0, 1, 0]}
        enablePan={true}
        minDistance={10}
        maxDistance={36}
        autoRotate={false}
      />
    </Canvas>
  );
}

// ══════════════════════════════════════════════════════════════════
// 症例プレビュー（シミュレーション選択画面用）
// ══════════════════════════════════════════════════════════════════
interface CaseSceneProps {
  malleus: string;
  incus:   string;
  stapes:  string;
}
export function CasePreviewScene({ malleus, incus, stapes }: CaseSceneProps) {
  return (
    <Canvas
      camera={{ position: [4, 6, 24], fov: 44 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 14]} intensity={1.1} color="#fffaf0" />
      <directionalLight position={[-6, 2, 6]} intensity={0.3} color="#d8e8ff" />

      <Suspense fallback={null}>
        <OssicleChain
          malleus={malleus as OssicleStatus}
          incus={incus as OssicleStatus}
          stapes={stapes as StapesStatus}
          showLabels={false}
        />
        {/* 簡易壁（プレビュー用） */}
        <mesh position={[0, 1, -6.0]}>
          <planeGeometry args={[14, 17]} />
          <meshStandardMaterial color="#d8cdb8" roughness={0.55} />
        </mesh>
        <mesh position={[0, 2.0, 5.5]}>
          <ringGeometry args={[4.6, 6.2, 40]} />
          <meshStandardMaterial color="#d8cdb8" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      </Suspense>

      <OrbitControls
        target={[0, 1, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
