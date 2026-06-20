/**
 * ProsthesisModels.tsx  -- KURZ ossicular prosthesis 3D models
 *
 * Coordinate: 1 unit = 1 mm (OssicleModels convention)
 *
 * KURZ catalog dimensions (Duesseldorf / Dresden series):
 *   Head plate   : 3.0 mm diam, 0.25 mm thick   (all types)
 *   PORP Bell    : 2.5 mm diam bell cup           (cradles stapes head)
 *   TORP Flat    : 4.5 mm diam disc               (rests on footplate)
 *   Clip Dresden : 2.0 mm spring clip             (grips stapes head)
 *   Shaft        : 0.5 mm diam titanium cylinder
 *
 * NOTE on BellFoot orientation:
 *   The foot group sits below the shaft bottom.
 *   Y=0 in foot-local space = shaft connection point (top of foot).
 *   Cup opens DOWNWARD (Y negative) toward the stapes head.
 *   Old code had radiusTop=1.25 (wide at top) -- WRONG (inverted).
 *   Fixed: LatheGeometry traces narrow top -> flared rim -> inner cup.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { KurzProduct } from '../../data/products';
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS } from './OssicleModels';

// -- Titanium appearance --
const TI_COLOR = '#c8d4dc';

function TitaniumMat({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.86}
      roughness={0.14}
      transparent={ghost}
      opacity={ghost ? 0.30 : 1.0}
    />
  );
}

// DoubleSide titanium for cup interiors
function TitaniumMatDS({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.86}
      roughness={0.14}
      transparent={ghost}
      opacity={ghost ? 0.30 : 1.0}
      side={THREE.DoubleSide}
    />
  );
}

// -- Head plate: 3.0 mm diam disc, 0.25 mm thick (all types) --
function HeadPlate({ ghost }: { ghost?: boolean }) {
  return (
    <mesh>
      <cylinderGeometry args={[1.5, 1.5, 0.25, 32]} />
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

// ----------------------------------------------------------------
// PORP Bell foot (Duesseldorf)
//
// LatheGeometry profile sweeps around the Y axis.
// Y=0 is shaft connection (top of foot group).
// Profile traces: outer wall down to rim, then back up inner wall.
// Result: a concave cup (2.5 mm diam) that cradles the stapes head.
// ----------------------------------------------------------------
function BellFoot({ ghost }: { ghost?: boolean }) {
  const points = useMemo(() => [
    // outer surface: shaft -> flare -> rim
    new THREE.Vector2(0.28,  0.00),  // shaft connection (top, r=0.28)
    new THREE.Vector2(0.42, -0.12),  // flare begins
    new THREE.Vector2(0.72, -0.35),  // bell outer curve
    new THREE.Vector2(1.08, -0.52),  // outer wall
    new THREE.Vector2(1.25, -0.62),  // rim outer edge (r=1.25 = 2.5 mm diam)
    new THREE.Vector2(1.25, -0.76),  // rim bottom outer
    // inner surface: rim -> inner cup -> back up
    new THREE.Vector2(1.10, -0.76),  // rim bottom inner
    new THREE.Vector2(1.10, -0.62),  // rim inner edge
    new THREE.Vector2(0.80, -0.50),  // inner bell wall
    new THREE.Vector2(0.50, -0.32),  // inner cup curve
    new THREE.Vector2(0.40, -0.12),  // inner top (stapes head sits here)
    new THREE.Vector2(0.28,  0.00),  // close back at shaft
  ], []);

  return (
    <mesh>
      <latheGeometry args={[points, 28]} />
      <TitaniumMatDS ghost={ghost} />
    </mesh>
  );
}

// ----------------------------------------------------------------
// TORP Flat foot (Duesseldorf)
// 4.5 mm diam disc, 0.20 mm thick.
// Three small hemisphere nubs on the underside for centering.
// ----------------------------------------------------------------
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[2.25, 2.25, 0.20, 36]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.cos(rad) * 1.55, -0.16, Math.sin(rad) * 1.55]}>
            <sphereGeometry args={[0.10, 8, 6]} />
            <TitaniumMat ghost={ghost} />
          </mesh>
        );
      })}
    </group>
  );
}

// ----------------------------------------------------------------
// Clip foot (Dresden Clip Partial)
//
// Two C-shaped spring arms, each built as a TubeGeometry along a
// CatmullRomCurve3 path.  Arms curve inward at the tip to grip the
// stapes head.  A short horizontal bar connects them at the top.
// ----------------------------------------------------------------
function ClipArm({ side, ghost }: { side: number; ghost?: boolean }) {
  const tube = useMemo(() => {
    const pts = [
      new THREE.Vector3(side * 0.52,  0.28,  0),
      new THREE.Vector3(side * 0.58,  0.05,  0),
      new THREE.Vector3(side * 0.62, -0.20,  0),
      new THREE.Vector3(side * 0.56, -0.44,  0),
      new THREE.Vector3(side * 0.40, -0.61,  0),
      new THREE.Vector3(side * 0.20, -0.68,  0),
      new THREE.Vector3(side * 0.05, -0.62,  0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 14, 0.09, 8, false);
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
      {/* Cross-bar connecting both arms at the top */}
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 1.04, 8]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ================================================================
// ProsthesisModel
//
// Shaft runs base -> top (stapes -> umbo direction).
// Head plate at top (+headOffset from group center).
// Foot at bottom (-footOffset from group center).
//
// Args:
//   product        : selects footType (BELL | FLAT | CLIP)
//   shaftLength    : catalog shaft length [mm]
//   basePos        : shaft bottom world pos (default: stapes head/plate)
//   direction      : shaft unit vector (default: auto toward umbo)
//   lateralOffset  : X nudge [mm]
//   anteriorOffset : Z nudge [mm]
//   angleTilt      : tilt around X axis [deg]
//   ghost          : semi-transparent ideal-placement display
// ================================================================
interface ProsthesisProps {
  product:        KurzProduct;
  shaftLength:    number;
  basePos?:       THREE.Vector3;
  direction?:     THREE.Vector3;
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

  const top = base.clone().addScaledVector(dir, shaftLength);
  const mid = base.clone().add(top).multiplyScalar(0.5);
  const len = shaftLength;

  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  const tiltRad  = (angleTilt * Math.PI) / 180;
  const headOff  = len / 2 + 0.15;
  const footOff  = -(len / 2) - 0.20;

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltRad, euler.y, euler.z]}
    >
      {/* Head plate */}
      <group position={[0, headOff, 0]}>
        <HeadPlate ghost={ghost} />
      </group>

      {/* Shaft: 0.5 mm diam titanium cylinder */}
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, len, 16]} />
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
