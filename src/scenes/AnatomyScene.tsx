/**
 * AnatomyScene.tsx  ── 解剖学的中耳シーン（実モデル版）
 *
 * ALPHA データセット（側頭骨CBCT）由来のGLBモデルを使用。
 * 手続き的ボックスジオメトリを廃止し、実解剖モデルのみで構成。
 *
 * ▼ 座標系（GLB基準）
 *   アブミ骨底板 = 原点 (0,0,0)
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels'; // CasePreviewSceneで使用
import { RealAnatomy, type RealAnatomyProps } from './models/RealAnatomyModels';
import type { OssicleStatus, StapesStatus } from '../data/cases';

// ══════════════════════════════════════════════════════════════════
// メイン解剖シーン（AnatomyScene）
// ══════════════════════════════════════════════════════════════════
export function AnatomyScene({ visibility }: { visibility?: RealAnatomyProps }) {
  return (
    <Canvas
      camera={{ position: [8, 5, 22], fov: 46 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0f1a']} />

      {/* ── ライティング ── */}
      <directionalLight position={[5, 15, 10]} intensity={1.8} color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[2, 3, 18]}  intensity={0.9} color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6} color="#c0d8ff" />
      <directionalLight position={[0, -8, 5]}  intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1,  3,  4]} intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      <Suspense fallback={null}>
        <RealAnatomy {...visibility} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.15} />
        </mesh>
      </Suspense>

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={true}
        minDistance={4}
        maxDistance={55}
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
      <ambientLight intensity={0.50} />
      <directionalLight position={[4, 8, 14]} intensity={1.1} color="#fffaf0" />
      <directionalLight position={[-6, 2, 6]} intensity={0.30} color="#d8e8ff" />

      <Suspense fallback={null}>
        <OssicleChain
          malleus={malleus as OssicleStatus}
          incus={incus   as OssicleStatus}
          stapes={stapes as StapesStatus}
          showLabels={false}
        />
        {/* 簡易内側壁（プレビュー用）*/}
        <mesh position={[0, 0.5, 1.0]}>
          <planeGeometry args={[14, 17]} />
          <meshStandardMaterial color="#d0c4aa" roughness={0.55} />
        </mesh>
        {/* 岬角（プレビュー用）*/}
        <mesh position={[2.84, -4.15, 1.9]}>
          <sphereGeometry args={[2.2, 16, 12]} />
          <meshStandardMaterial color="#c4b890" roughness={0.48} />
        </mesh>
        {/* 外耳道骨輪（プレビュー用）*/}
        <mesh position={[0, 2.0, 5.5]}>
          <ringGeometry args={[4.4, 5.0, 44]} />
          <meshStandardMaterial color="#d0c4aa" roughness={0.50} side={THREE.DoubleSide} />
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
