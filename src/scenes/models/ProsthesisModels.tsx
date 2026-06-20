/**
 * ProsthesisModels.tsx  -- KURZ ossicular prosthesis 3D models
 *
 * Dimensions from KURZ catalog M9600320_0723 + reference photos:
 *
 *   Head plate   : 3.6 mm diam, FENESTRATED (4 spokes + hub + outer ring)
 *   Shaft        : 0.2 mm diam  (extremely thin -- characteristic KURZ design)
 *   PORP Bell    : 2.6 mm diam, ~1.0 mm deep dome  (near-hemispherical)
 *   TORP Aerial  : 2.6 mm diam flat disc
 *   Clip Dresden : spring clip, 2.6 mm spread
 *
 * Head plate design (Duesseldorf Type -- reference photo):
 *   - Outer torus rim (3.6 mm diam)
 *   - 4 large fenestrations (for visual access during surgery)
 *   - Inner hub cylinder (shaft connection)
 *   - 4 spokes connecting hub to rim
 *   - 2 slits visible in catalog (0.6 mm stapes-arch slit, 0.35 mm slit)
 *
 * Bell foot design (reference photos images 1 and 3):
 *   - Near-hemispherical dome (spherical arc R=1.35, maxTheta~74 deg)
 *   - Smooth convex outer surface
 *   - Concave inner cup cradles stapes head
 *   - Thin titanium shell (~0.15 mm wall at pole)
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { KurzProduct } from '../../data/products';
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS } from './OssicleModels';

// -- Titanium material --
const TI_COLOR = '#c8d4dc';

function TitaniumMat({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.88}
      roughness={0.12}
      transparent={ghost}
      opacity={ghost ? 0.28 : 1.0}
    />
  );
}

function TitaniumMatDS({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.88}
      roughness={0.12}
      side={THREE.DoubleSide}
      transparent={ghost}
      opacity={ghost ? 0.28 : 1.0}
    />
  );
}

// ================================================================
// Head plate  -- Duesseldorf Type  (3.6 mm diam, fenestrated)
//
// Structure (visible in catalog reference photo):
//   - Outer torus ring
//   - 4 spokes at 0/90/180/270 deg
//   - Inner hub cylinder (connects to shaft)
//   - Large fenestrations between spokes for surgical visibility
//   - Slits in outer rim (0.6 mm stapes-arch slit, 0.35 mm slit)
// ================================================================
function HeadPlate({ ghost }: { ghost?: boolean }) {
  const outerR     = 1.80;   // 3.6 mm diam / 2
  const hubR       = 0.30;   // inner hub radius (~0.6 mm diam)
  const plateThick = 0.22;   // thickness in Y
  const rimTubeR   = 0.13;   // torus tube radius
  const rimCenterR = outerR - rimTubeR;  // 1.67
  const spokeLen   = rimCenterR - hubR;  // 1.37
  const spokeW     = 0.17;   // spoke width
  const midR       = hubR + spokeLen / 2; // spoke center radius

  return (
    <group>
      {/* Outer rim: torus ring lying flat (rotated into XZ plane) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimCenterR, rimTubeR, 8, 36]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* Inner hub (shaft connects here) */}
      <mesh>
        <cylinderGeometry args={[hubR, hubR, plateThick, 16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* 4 spokes at 0, 90, 180, 270 degrees */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh
            key={deg}
            position={[Math.cos(rad) * midR, 0, Math.sin(rad) * midR]}
            rotation={[0, -rad, 0]}
          >
            <boxGeometry args={[spokeLen, plateThick, spokeW]} />
            <TitaniumMat ghost={ghost} />
          </mesh>
        );
      })}

      {/* Slit indicators: two small notches on outer rim (0.6 mm and 0.35 mm) */}
      {/* Slit 0.6mm: for stapes arch clearance */}
      <mesh position={[0, 0, outerR - 0.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.60, plateThick + 0.02, 0.20]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={ghost ? 0.0 : 1.0} />
      </mesh>
      {/* Slit 0.35mm: smaller slit */}
      <mesh position={[outerR * 0.5, 0, outerR * 0.866]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.35, plateThick + 0.02, 0.18]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={ghost ? 0.0 : 1.0} />
      </mesh>
    </group>
  );
}

// ================================================================
// PORP Bell foot  (Duesseldorf Type Bell Partial Prosthesis)
//
// Shape from reference photos (images 1 and 3):
//   Near-hemispherical smooth dome, convex outside, concave inside.
//   Spherical arc: R=1.35, maxTheta=74.5 deg, height ~1.0 mm.
//   Diameter: 2.6 mm  (catalog spec).
//   The dome cradles the stapes head (capitulum, diam ~0.9 mm).
// ================================================================
function BellFoot({ ghost }: { ghost?: boolean }) {
  const points = useMemo(() => {
    const R     = 1.35;  // sphere arc radius
    const rimR  = 1.30;  // 2.6 mm diam / 2
    // maxTheta = arcsin(rimR / R) = arcsin(0.963) ~ 74.5 deg
    const maxTheta = Math.asin(rimR / R);
    const pts: THREE.Vector2[] = [];

    // Outer dome: spherical arc from pole (r=0, y=0) to rim
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * maxTheta;
      pts.push(new THREE.Vector2(
        R * Math.sin(theta),
        -(R - R * Math.cos(theta))   // dome opens downward (Y negative)
      ));
    }

    // rimY = dome depth at rim edge
    const rimY = -(R - R * Math.cos(maxTheta));  // ~ -0.992

    // Rim edge: thin flat band at bottom circumference
    pts.push(new THREE.Vector2(rimR,        rimY - 0.09));  // outer bottom
    pts.push(new THREE.Vector2(rimR - 0.18, rimY - 0.09));  // inner bottom
    pts.push(new THREE.Vector2(rimR - 0.18, rimY));          // inner top of rim

    // Inner concave surface (stapes head sits in this bowl)
    pts.push(new THREE.Vector2(0.90, rimY + 0.18));
    pts.push(new THREE.Vector2(0.55, rimY + 0.52));
    pts.push(new THREE.Vector2(0.22, rimY + 0.84));
    pts.push(new THREE.Vector2(0.0,  rimY + 0.90));  // inner pole (~y=-0.09)

    return pts;
  }, []);

  return (
    <mesh>
      <latheGeometry args={[points, 32]} />
      <TitaniumMatDS ghost={ghost} />
    </mesh>
  );
}

// ================================================================
// TORP flat foot  (Duesseldorf Type AERIAL Total Prosthesis)
// 2.6 mm diam disc, three small sphere nubs on underside.
// ================================================================
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[1.3, 1.3, 0.22, 32]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.cos(rad) * 0.80, -0.17, Math.sin(rad) * 0.80]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <TitaniumMat ghost={ghost} />
          </mesh>
        );
      })}
    </group>
  );
}

// ================================================================
// Dresden Clip foot  (CliP Partial Prosthesis Dresden Type)
// Two C-shaped elastic spring arms, 2.6 mm total spread.
// ================================================================
function ClipArm({ side, ghost }: { side: number; ghost?: boolean }) {
  const tube = useMemo(() => {
    const pts = [
      new THREE.Vector3(side * 0.22,  0.24,  0),
      new THREE.Vector3(side * 0.42,  0.06,  0),
      new THREE.Vector3(side * 0.56, -0.18,  0),
      new THREE.Vector3(side * 0.58, -0.40,  0),
      new THREE.Vector3(side * 0.46, -0.58,  0),
      new THREE.Vector3(side * 0.26, -0.68,  0),
      new THREE.Vector3(side * 0.10, -0.72,  0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 16, 0.07, 8, false);
  }, [side]);

  return (
    <mesh geometry={tube}>
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

function ClipFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <ClipArm side={ 1} ghost={ghost} />
      <ClipArm side={-1} ghost={ghost} />
      <mesh position={[0, 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.80, 8]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ================================================================
// ProsthesisModel  -- assembles shaft + head plate + foot
// ================================================================
interface ProsthesisProps {
  product:         KurzProduct;
  shaftLength:     number;
  basePos?:        THREE.Vector3;
  direction?:      THREE.Vector3;
  lateralOffset?:  number;
  anteriorOffset?: number;
  angleTilt?:      number;
  ghost?:          boolean;
}

export function ProsthesisModel({
  product,
  shaftLength,
  basePos,
  direction,
  lateralOffset  = 0,
  anteriorOffset = 0,
  angleTilt      = 0,
  ghost          = false,
}: ProsthesisProps) {

  const base = (basePos ?? (product.footType === 'FLAT' ? STAPES_FOOTPLATE : STAPES_HEAD)).clone();
  base.x += lateralOffset;
  base.z += anteriorOffset;

  const dir = direction
    ? direction.clone().normalize()
    : new THREE.Vector3().subVectors(UMBO_POS, base).normalize();

  const top  = base.clone().addScaledVector(dir, shaftLength);
  const mid  = base.clone().add(top).multiplyScalar(0.5);
  const len  = shaftLength;

  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  const tiltRad = (angleTilt * Math.PI) / 180;
  const headOff = len / 2 + 0.15;
  const footOff = -(len / 2);   // foot connects flush to shaft bottom

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltRad, euler.y, euler.z]}
    >
      {/* Head plate  3.6 mm diam, fenestrated */}
      <group position={[0, headOff, 0]}>
        <HeadPlate ghost={ghost} />
      </group>

      {/* Shaft  0.2 mm diam -- pure titanium characteristic thin design */}
      <mesh>
        <cylinderGeometry args={[0.10, 0.10, len, 12]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* Foot */}
      <group position={[0, footOff, 0]}>
        {product.footType === 'BELL' && <BellFoot ghost={ghost} />}
        {product.footType === 'FLAT' && <FlatFoot ghost={ghost} />}
        {product.footType === 'CLIP' && <ClipFoot ghost={ghost} />}
      </group>
    </group>
  );
}

// -- Ideal ghost --
export function IdealGhostProsthesis({
  product,
  length,
}: {
  product: KurzProduct;
  length:  number;
}) {
  return (
    <ProsthesisModel product={product} shaftLength={length} ghost={true} />
  );
}
