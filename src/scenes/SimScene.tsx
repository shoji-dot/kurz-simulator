import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels';
import { ProsthesisModel, IdealGhostProsthesis } from './models/ProsthesisModels';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';
import type { PlacementState } from '../store/useSimStore';

interface SimSceneProps {
  surgicalCase: SurgicalCase;
  product: KurzProduct;
  placement: PlacementState;
  showIdeal?: boolean;
  scored?: boolean;
}

function CavityWalls() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[7.5, 32, 24]} />
        <meshStandardMaterial color="#1a2f50" transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

function Crosshair({ lateral, anterior }: { lateral: number; anterior: number }) {
  return (
    <group position={[lateral * 1.5, -4.4, anterior * 1.5]}>
      {/* Center dot */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 12]} />
        <meshStandardMaterial color="#00b4d8" emissive="#00b4d8" emissiveIntensity={1} />
      </mesh>
      {/* Cross lines */}
      <mesh>
        <boxGeometry args={[2, 0.03, 0.03]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.5} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.03, 0.03, 2]} />
        <meshStandardMaterial color="#00b4d8" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function SimScene({ surgicalCase, product, placement, showIdeal = false }: Omit<SimSceneProps, 'scored'>) {
  const { selectedLength, lateralOffset, anteriorOffset, angleTilt } = placement;

  // Prosthesis base Y: stapes footplate is at y=-4, head plate near tympanic membrane at y=0
  const prosthesisY = -4 + (selectedLength * 0.5) / 2;

  return (
    <Canvas
      camera={{ position: [14, 8, 14], fov: 42 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050b15']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 14, 8]} intensity={1.1} castShadow />
      <pointLight position={[-8, 4, -4]} intensity={0.6} color="#3366ff" />
      <pointLight position={[4, -4, 8]} intensity={0.4} color="#ffffff" />
      {/* Rim light for titanium */}
      <pointLight position={[0, 2, -10]} intensity={0.8} color="#88ccff" />

      <Suspense fallback={null}>
        <CavityWalls />

        {/* Ossicular chain with case-specific status */}
        <OssicleChain
          malleus={surgicalCase.ossicularStatus.malleus}
          incus={surgicalCase.ossicularStatus.incus}
          stapes={surgicalCase.ossicularStatus.stapes}
        />

        {/* Ideal ghost (reference) */}
        {showIdeal && (
          <IdealGhostProsthesis
            product={product}
            length={surgicalCase.recommendedLength}
            baseY={-4 + (surgicalCase.recommendedLength * 0.5) / 2}
          />
        )}

        {/* Actual prosthesis placement */}
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          position={[0, prosthesisY, 0]}
          tilt={angleTilt}
          lateral={lateralOffset}
          anterior={anteriorOffset}
        />

        {/* Footplate / stapes marker */}
        <mesh position={[1.2 * 0.5, -4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.9 * 0.5, 0.9 * 0.5, 0.15, 24]} />
          <meshStandardMaterial color="#e8d5b0" roughness={0.4} />
        </mesh>

        {/* Placement crosshair on footplate */}
        <Crosshair lateral={lateralOffset} anterior={anteriorOffset} />
      </Suspense>

      <OrbitControls
        enablePan={true}
        minDistance={8}
        maxDistance={28}
        autoRotate={false}
      />
    </Canvas>
  );
}
