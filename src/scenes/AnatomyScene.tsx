import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels';
import { useSimStore } from '../store/useSimStore';

// 外耳道壁（半透明の卵形シェル）
function CavityWalls() {
  return (
    <mesh>
      <sphereGeometry args={[8.5, 32, 24]} />
      <meshStandardMaterial color="#1a3055" transparent opacity={0.07} side={THREE.BackSide} />
    </mesh>
  );
}

// 内耳壁（蝸牛・卵円窓側）を示す平面
function MedialWall() {
  return (
    <group position={[0, -1, -5.5]}>
      <mesh rotation={[0.15, 0, 0]}>
        <planeGeometry args={[7, 6]} />
        <meshStandardMaterial color="#0e2040" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* 卵円窓（アブミ骨底板が嵌まる窓） */}
      <mesh position={[-0.6, 0.5, 0.02]} rotation={[0, 0, 0.3]} scale={[1, 0.6, 1]}>
        <circleGeometry args={[0.9, 24]} />
        <meshStandardMaterial color="#0a4060" transparent opacity={0.6} />
      </mesh>
      {/* 正円窓 */}
      <mesh position={[-0.6, -1.2, 0.02]}>
        <circleGeometry args={[0.55, 24]} />
        <meshStandardMaterial color="#0a3050" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ── メイン解剖シーン ─────────────────────────────────────
export function AnatomyScene() {
  const highlight = useSimStore((s) => s.highlightedStructure);

  return (
    <Canvas
      // 術者視点: 外耳道方向（Z+）から中耳を覗き込む角度
      camera={{ position: [3, 3, 16], fov: 42 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />

      {/* ライティング */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 8]} intensity={1.1} />
      <pointLight position={[-6, 4, 8]} intensity={0.6} color="#4488ff" />
      <pointLight position={[4, -4, 6]} intensity={0.4} color="#ffffff" />

      <Suspense fallback={null}>
        <CavityWalls />
        <MedialWall />
        <OssicleChain
          malleus="intact"
          incus="intact"
          stapes="intact"
          highlight={highlight}
          showLabels={true}
        />
      </Suspense>

      <OrbitControls
        target={[0, 0, -2]}
        enablePan={true}
        minDistance={8}
        maxDistance={28}
        autoRotate={false}
      />
    </Canvas>
  );
}

// ── 症例プレビュー（シミュレーション用・小さめ） ─────────────
interface CaseSceneProps {
  malleus: string;
  incus: string;
  stapes: string;
}
export function CasePreviewScene({ malleus, incus, stapes }: CaseSceneProps) {
  return (
    <Canvas
      camera={{ position: [3, 3, 16], fov: 45 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 8]} intensity={1.0} />
      <pointLight position={[-4, 4, 6]} intensity={0.5} color="#4488ff" />

      <Suspense fallback={null}>
        <OssicleChain
          malleus={malleus as any}
          incus={incus as any}
          stapes={stapes as any}
          showLabels={false}
        />
      </Suspense>

      <OrbitControls
        target={[0, 0, -2]}
        enablePan={false}
        minDistance={8}
        maxDistance={22}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
