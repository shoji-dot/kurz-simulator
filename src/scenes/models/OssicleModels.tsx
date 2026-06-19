
import * as THREE from 'three';
import type { OssicleStatus, StapesStatus } from '../../data/cases';

const BONE_COLOR = '#e8d5b0';
const BONE_DARK  = '#c4a97a';
const MEMBRANE_COLOR = '#f5e6c8';

interface Props {
  malleus: OssicleStatus;
  incus: OssicleStatus;
  stapes: StapesStatus;
  highlight?: string | null;
}

function useHighlight(name: string, highlight?: string | null) {
  return highlight === name ? '#00b4d8' : undefined;
}

// Tympanic membrane — thin translucent cone
export function TympanicMembrane({ opacity = 0.55 }) {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4.5, 4.0, 0.15, 32]} />
        <meshStandardMaterial color={MEMBRANE_COLOR} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Malleus — handle + head
export function Malleus({ status, highlight }: { status: OssicleStatus; highlight?: string | null }) {
  const col = useHighlight('malleus', highlight) ?? BONE_COLOR;
  if (status === 'absent') return null;
  return (
    <group>
      {/* Handle (manubrium) */}
      <mesh position={[0, -1.5, 0]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.25, 0.18, 3.5, 12]} />
        <meshStandardMaterial color={col} roughness={0.4} metalness={0.05} />
      </mesh>
      {/* Head */}
      {status !== 'partial' && (
        <mesh position={[0.3, 0.8, 0]}>
          <sphereGeometry args={[0.6, 14, 14]} />
          <meshStandardMaterial color={col} roughness={0.4} metalness={0.05} />
        </mesh>
      )}
    </group>
  );
}

// Incus — body + short process
export function Incus({ status, highlight }: { status: OssicleStatus; highlight?: string | null }) {
  const col = useHighlight('incus', highlight) ?? BONE_DARK;
  if (status === 'absent') return null;
  return (
    <group position={[0.9, 0.5, 0]}>
      <mesh>
        <sphereGeometry args={[0.5, 14, 14]} />
        <meshStandardMaterial color={col} roughness={0.45} />
      </mesh>
      {/* Long process */}
      <mesh position={[0.1, -1.4, 0.1]} rotation={[0.1, 0, 0.05]}>
        <cylinderGeometry args={[0.15, 0.12, 2.5, 10]} />
        <meshStandardMaterial color={col} roughness={0.45} />
      </mesh>
    </group>
  );
}

// Stapes — head + two crura + footplate
export function Stapes({ status, highlight }: { status: StapesStatus; highlight?: string | null }) {
  const col = useHighlight('stapes', highlight) ?? BONE_COLOR;
  if (status === 'absent') return null;

  const hasSuprastructure = status === 'intact' || status === 'suprastructure';
  return (
    <group position={[1.2, -1.8, 0]}>
      {/* Footplate */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.2, 24]} />
        <meshStandardMaterial color={col} roughness={0.35} />
      </mesh>
      {hasSuprastructure && (
        <>
          {/* Two crura (arch) */}
          <mesh position={[-0.45, 0.6, 0]} rotation={[0, 0, 0.25]}>
            <cylinderGeometry args={[0.1, 0.1, 1.4, 8]} />
            <meshStandardMaterial color={col} roughness={0.35} />
          </mesh>
          <mesh position={[0.45, 0.6, 0]} rotation={[0, 0, -0.25]}>
            <cylinderGeometry args={[0.1, 0.1, 1.4, 8]} />
            <meshStandardMaterial color={col} roughness={0.35} />
          </mesh>
          {/* Head / capitulum */}
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial color={col} roughness={0.35} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Full anatomy scene helper — combines all structures
export function OssicleChain({ malleus, incus, stapes, highlight }: Props) {
  return (
    <group>
      <TympanicMembrane />
      <Malleus status={malleus} highlight={highlight} />
      <Incus status={incus} highlight={highlight} />
      <Stapes status={stapes} highlight={highlight} />
    </group>
  );
}
