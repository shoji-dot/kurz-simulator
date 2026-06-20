/**
 * ProsthesisModels.tsx  -- KURZ ossicular prosthesis 3D models
 *
 * Coordinate: 1 unit = 1 mm (OssicleModels convention)
 *
 * KURZ catalog dimensions (catalog M9600320_0723, Duesseldorf / Dresden):
 *   Head plate   : 3.6 mm diam  (all types)        -- was 3.0 mm (wrong)
 *   Shaft        : 0.2 mm diam  (all types)        -- was 0.5 mm (wrong)
 *   PORP Bell    : 2.6 mm diam spherical-arc dome  -- cups stapes head
 *   TORP Aerial  : 2.6 mm diam flat disc           -- rests on footplate
 *   Clip Dresden : 2.6 mm spread spring clip       -- grips stapes head
 *
 * BellFoot geometry note:
 *   Catalog photo shows a smooth, oblate dome (spherical cap), NOT a funnel.
 *   LatheGeometry traces a circular arc (sphere R=1.6) from dome pole to rim.
 *   DoubleSide material makes the inner concave surface visible.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { KurzProduct } from '../../data/products';
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS } from './OssicleModels';

// -- Titanium appearance (KURZ pure titanium, ASTM F67) --
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

// DoubleSide variant for concave / hollow surfaces
function TitaniumMatDS({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.88}
      roughness={0.12}
      transparent={ghost}
      opacity={ghost ? 0.28 : 1.0}
      side={THREE.DoubleSide}
    />
  );
}

// ----------------------------------------------------------------
// Head plate  3.6 mm diam, 0.25 mm thick  (all prosthesis types)
// ----------------------------------------------------------------
function HeadPlate({ ghost }: { ghost?: boolean }) {
  return (
    <mesh>
      <cylinderGeometry args={[1.8, 1.8, 0.25, 32]} />
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

// ----------------------------------------------------------------
// PORP Bell foot  (Duesseldorf Type Bell Partial Prosthesis)
//
// Catalog spec: 2.6 mm diameter, smooth oblate dome shape.
// Modeled as a spherical-arc cap (arc sphere R=1.6 mm).
// Outer dome: circular arc from pole (top, r=0) to rim (r=1.3, y~-0.67).
// Inner surface: gentle concave bowl that cradles the stapes head.
// Y=0 in foot-local space = shaft connection point (top of bell).
// ----------------------------------------------------------------
function BellFoot({ ghost }: { ghost?: boolean }) {
  const points = useMemo(() => {
    const R = 1.6;      // sphere radius for outer arc
    const rimR = 1.3;   // 2.6 mm diam / 2
    const maxTheta = Math.asin(rimR / R);  // ~54.3 deg
    const pts: THREE.Vector2[] = [];

    // Outer dome: spherical arc, pole at y=0, rim at y=-rimDepth
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * maxTheta;
      pts.push(new THREE.Vector2(
        R * Math.sin(theta),
        -(R - R * Math.cos(theta))   // dome opens downward
      ));
    }

    const rimY = -(R - R * Math.cos(maxTheta));  // approx -0.666

    // Rim edge (thin wall at circumference)
    pts.push(new THREE.Vector2(rimR,        rimY - 0.09));
    pts.push(new THREE.Vector2(rimR - 0.20, rimY - 0.09));
    pts.push(new THREE.Vector2(rimR - 0.20, rimY));

    // Inner concave bowl -- stapes head (r ~0.45 mm) rests here
    pts.push(new THREE.Vector2(0.90, rimY + 0.16));
    pts.push(new THREE.Vector2(0.50, rimY + 0.38));
    pts.push(new THREE.Vector2(0.22, rimY + 0.52));
    pts.push(new THREE.Vector2(0.0,  rimY + 0.58));  // inner pole

    return pts;
  }, []);

  return (
    <mesh>
      <latheGeometry args={[points, 30]} />
      <TitaniumMatDS ghost={ghost} />
    </mesh>
  );
}

// ----------------------------------------------------------------
// TORP Flat foot  (Duesseldorf Type AERIAL Total Prosthesis)
//
// Catalog: 2.6 mm diameter foot disc resting on stapes footplate.
// Three small hemisphere nubs on underside aid centering.
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// Dresden Clip foot  (CliP Partial Prosthesis Dresden Type)
//
// Two elastic spring arms that grip the stapes head (diam ~0.9 mm).
// Each arm is a TubeGeometry following a CatmullRomCurve3 path:
//   - starts at shaft base, curves outward then inward (C-shape)
//   - arm tips meet near stapes head surface
// Total clip spread at widest: ~2.6 mm.  Tip gap: ~0.5 mm.
// ----------------------------------------------------------------
function ClipArm({ side, ghost }: { side: number; ghost?: boolean }) {
  const tube = useMemo(() => {
    const pts = [
      new THREE.Vector3(side * 0.22,  0.24,  0),   // near shaft
      new THREE.Vector3(side * 0.40,  0.06,  0),   // spreading outward
      new THREE.Vector3(side * 0.55, -0.18,  0),   // mid arm, peak spread
      new THREE.Vector3(side * 0.58, -0.40,  0),   // lower arm
      new THREE.Vector3(side * 0.46, -0.58,  0),   // curving inward
      new THREE.Vector3(side * 0.26, -0.68,  0),   // closing in
      new THREE.Vector3(side * 0.10, -0.72,  0),   // tip (gap ~0.2 mm per side)
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
      {/* Horizontal bar connecting both arms at shaft base */}
      <mesh position={[0, 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.80, 8]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ================================================================
// ProsthesisModel
//
// Shaft runs base (stapes) → top (umbo direction).
// Head plate at top;  foot at bottom.
//
// Catalog shaft diameter 0.2 mm → cylinderGeometry radius 0.10.
//
// Args:
//   product        : selects footType (BELL | FLAT | CLIP)
//   shaftLength    : catalog shaft length [mm]
//   basePos        : shaft bottom world coord (default: stapes head/plate)
//   direction      : unit vector along shaft  (default: auto toward umbo)
//   lateralOffset  : X nudge [mm]
//   anteriorOffset : Z nudge [mm]
//   angleTilt      : tilt around shaft-perpendicular axis [deg]
//   ghost          : semi-transparent ideal-placement overlay
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
  const footOff = -(len / 2);       // foot group at shaft bottom (no gap)

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltRad, euler.y, euler.z]}
    >
      {/* Head plate  3.6 mm diam */}
      <group position={[0, headOff, 0]}>
        <HeadPlate ghost={ghost} />
      </group>

      {/* Shaft  0.2 mm diam (r=0.10) -- characteristic of KURZ titanium */}
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

// -- Ideal placement ghost --
export function IdealGhostProsthesis({
  product,
  length,
}: {
  product: KurzProduct;
  length:  number;
}) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      ghost={true}
    />
  );
}
