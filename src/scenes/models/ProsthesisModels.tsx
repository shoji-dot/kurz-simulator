
import type { KurzProduct } from '../../data/products';

const TITANIUM = '#c0cdd6';



interface ProsthesisProps {
  product: KurzProduct;
  shaftLength: number; // actual selected length in mm
  position?: [number, number, number];
  tilt?: number; // degrees
  lateral?: number;
  anterior?: number;
  ghost?: boolean;
}

// Scale: scene units ≈ mm * 0.5 for visibility
const S = 0.5;

function TitaniumMaterial({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TITANIUM}
      metalness={0.85}
      roughness={0.15}
      transparent={ghost}
      opacity={ghost ? 0.35 : 1}
    />
  );
}

// Head plate — flat disc (3mm diameter → 1.5 * S units radius)
function HeadPlate({ ghost }: { ghost?: boolean }) {
  return (
    <mesh position={[0, 0, 0]}>
      <cylinderGeometry args={[1.5 * S, 1.5 * S, 0.25 * S, 32]} />
      <TitaniumMaterial ghost={ghost} />
    </mesh>
  );
}

// PORP Bell foot
function BellFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[1.25 * S, 0.8 * S, 0.4 * S, 20]} />
        <TitaniumMaterial ghost={ghost} />
      </mesh>
      {/* Bell rim ring */}
      <mesh position={[0, -0.25 * S, 0]}>
        <torusGeometry args={[1.1 * S, 0.15 * S, 8, 24]} />
        <TitaniumMaterial ghost={ghost} />
      </mesh>
    </group>
  );
}

// TORP Flat foot
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[2.25 * S, 2.25 * S, 0.25 * S, 32]} />
        <TitaniumMaterial ghost={ghost} />
      </mesh>
      {/* Three support legs */}
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.cos(rad) * 1.5 * S, -0.3 * S, Math.sin(rad) * 1.5 * S]}>
            <cylinderGeometry args={[0.12 * S, 0.12 * S, 0.3 * S, 8]} />
            <TitaniumMaterial ghost={ghost} />
          </mesh>
        );
      })}
    </group>
  );
}

// Clip foot — U-shaped clip
function ClipFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* clip arms */}
      {[-0.6 * S, 0.6 * S].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[0.15 * S, 0.8 * S, 0.6 * S]} />
          <TitaniumMaterial ghost={ghost} />
        </mesh>
      ))}
      {/* connector */}
      <mesh position={[0, -0.4 * S, 0]}>
        <boxGeometry args={[1.4 * S, 0.15 * S, 0.6 * S]} />
        <TitaniumMaterial ghost={ghost} />
      </mesh>
    </group>
  );
}

export function ProsthesisModel({ product, shaftLength, position = [0,0,0], tilt = 0, lateral = 0, anterior = 0, ghost = false }: ProsthesisProps) {
  const shaftH = shaftLength * S;
  const footOffset = -(shaftH / 2) - 0.25 * S;
  const headOffset = shaftH / 2 + 0.15 * S;

  const px = position[0] + lateral * 1.5;
  const py = position[1];
  const pz = position[2] + anterior * 1.5;
  const tiltRad = (tilt * Math.PI) / 180;

  return (
    <group position={[px, py, pz]} rotation={[tiltRad, 0, tiltRad * 0.3]}>
      {/* Head plate */}
      <group position={[0, headOffset, 0]}>
        <HeadPlate ghost={ghost} />
      </group>

      {/* Shaft */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.25 * S, 0.25 * S, shaftH, 16]} />
        <TitaniumMaterial ghost={ghost} />
      </mesh>

      {/* Foot */}
      <group position={[0, footOffset, 0]}>
        {product.footType === 'BELL' && <BellFoot ghost={ghost} />}
        {product.footType === 'FLAT' && <FlatFoot ghost={ghost} />}
        {product.footType === 'CLIP' && <ClipFoot ghost={ghost} />}
      </group>
    </group>
  );
}

// Ideal ghost placement for reference
export function IdealGhostProsthesis({ product, length, baseY }: { product: KurzProduct; length: number; baseY: number }) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      position={[0, baseY, 0]}
      ghost={true}
    />
  );
}
