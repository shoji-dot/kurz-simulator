import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels';
import { useSimStore } from '../store/useSimStore';

function RotatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12;
  });
  return <group ref={ref}>{children}</group>;
}

function CavityWalls() {
  return (
    <group>
      {/* Outer shell (transparent) */}
      <mesh>
        <sphereGeometry args={[7, 32, 32]} />
        <meshStandardMaterial color="#2a4060" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.5, 0]}>
        <circleGeometry args={[5, 32]} />
        <meshStandardMaterial color="#1a3050" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

export function AnatomyScene() {
  const highlight = useSimStore((s) => s.highlightedStructure);

  return (
    <Canvas
      camera={{ position: [12, 8, 14], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow />
      <pointLight position={[-8, 4, -4]} intensity={0.5} color="#4488ff" />
      <pointLight position={[4, -4, 8]} intensity={0.3} color="#ffffff" />

      <Suspense fallback={null}>
        <RotatingGroup>
          <CavityWalls />
          <OssicleChain
            malleus="intact"
            incus="intact"
            stapes="intact"
            highlight={highlight}
          />
        </RotatingGroup>
      </Suspense>

      <OrbitControls
        enablePan={true}
        minDistance={6}
        maxDistance={30}
        autoRotate={false}
      />
    </Canvas>
  );
}

// Static scene for case preview (no rotation)
interface CaseSceneProps {
  malleus: string;
  incus: string;
  stapes: string;
}

export function CasePreviewScene({ malleus, incus, stapes }: CaseSceneProps) {
  return (
    <Canvas
      camera={{ position: [10, 6, 12], fov: 45 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 10, 8]} intensity={1.0} />
      <pointLight position={[-6, 4, 4]} intensity={0.4} color="#4488ff" />

      <Suspense fallback={null}>
        <OssicleChain
          malleus={malleus as any}
          incus={incus as any}
          stapes={stapes as any}
        />
      </Suspense>

      <OrbitControls enablePan={false} minDistance={8} maxDistance={22} autoRotate autoRotateSpeed={1.5} />
    </Canvas>
  );
}
