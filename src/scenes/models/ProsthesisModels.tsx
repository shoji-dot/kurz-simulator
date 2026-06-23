/**
 * ProsthesisModels.tsx  -- KURZ ossicular prosthesis 3D models
 *
 * Updated 2026-06-23: Revised geometry based on 20x scale physical reference models.
 *
 * Head plate variants:
 *   'FENESTRATED'  - Düsseldorf type (4-spoke, outer torus ring) -- original design
 *   'DISC'         - Simple flat disc (PORP Düsseldorf, confirmed from photos)
 *   'OVAL_RING'    - Oval frame with figure-8 inner cutouts (TORP Aerial variant)
 *   'DOME_4FIN'    - 4-fin dome, CNC-machined from solid egg blank (TORP variant)
 *
 * Foot variants:
 *   'BELL'   - HDPE cone, 4 radial slits at 90° (confirmed from photos)
 *   'FLAT'   - Flat titanium disc, 3 nubs on underside (TORP footplate contact)
 *   'CLIP'   - Double-arm spring clip: upper pair (wide) + lower pair (tight)
 *
 * Shaft: circular cross-section (confirmed), matte titanium finish.
 * BELL material: white HDPE / polyethylene (not titanium).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { KurzProduct } from '../../data/products';
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS } from './OssicleModels';

// ── Materials ─────────────────────────────────────────────────────────────────

const TI_COLOR   = '#c0ccd4';
const HDPE_COLOR = '#f0ede4';

function TitaniumMat({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TI_COLOR}
      metalness={0.88}
      roughness={0.18}
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
      roughness={0.18}
      side={THREE.DoubleSide}
      transparent={ghost}
      opacity={ghost ? 0.28 : 1.0}
    />
  );
}
function HdpeMat({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={HDPE_COLOR}
      metalness={0.0}
      roughness={0.75}
      transparent={ghost}
      opacity={ghost ? 0.22 : 1.0}
    />
  );
}

// ================================================================
// HEAD PLATE VARIANTS
// ================================================================

// ── 1. Fenestrated (Düsseldorf Type) ─────────────────────────────
//   4-spoke + outer torus ring + inner hub
// ================================================================
function HeadPlateFenestrated({ ghost }: { ghost?: boolean }) {
  const outerR     = 1.80;
  const hubR       = 0.30;
  const plateThick = 0.22;
  const rimTubeR   = 0.14;
  const rimCenterR = outerR - rimTubeR;
  const spokeLen   = rimCenterR - hubR;

  const spokeGeometries = useMemo(() => {
    return [0, 90, 180, 270].map((deg) => {
      const rad  = (deg * Math.PI) / 180;
      const from = new THREE.Vector3(Math.cos(rad) * hubR,       0, Math.sin(rad) * hubR);
      const to   = new THREE.Vector3(Math.cos(rad) * rimCenterR, 0, Math.sin(rad) * rimCenterR);
      const mid1 = new THREE.Vector3().lerpVectors(from, to, 0.33);
      const mid2 = new THREE.Vector3().lerpVectors(from, to, 0.67);
      const curve = new THREE.CatmullRomCurve3([from, mid1, mid2, to]);
      return new THREE.TubeGeometry(curve, 8, 0.095, 5, false);
    });
  }, []);

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimCenterR, rimTubeR, 14, 44]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[hubR, hubR + 0.04, plateThick, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh position={[0, plateThick / 2 + 0.025, 0]}>
        <cylinderGeometry args={[hubR + 0.04, hubR, 0.05, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {spokeGeometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <TitaniumMat ghost={ghost} />
        </mesh>
      ))}
      {/* stapes-arch clearance slits */}
      <mesh position={[0, 0, outerR - 0.05]}>
        <boxGeometry args={[0.60, plateThick + 0.02, 0.22]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={ghost ? 0.0 : 1.0} />
      </mesh>
      <mesh position={[outerR * 0.5, 0, outerR * 0.866]}>
        <boxGeometry args={[0.35, plateThick + 0.02, 0.18]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={ghost ? 0.0 : 1.0} />
      </mesh>
    </group>
  );
}

// ── 2. Disc (PORP, simple flat disc) ─────────────────────────────
//   Confirmed from photos: completely flat, circular, thin.
//   Outer edge has a slight torus bead.
// ================================================================
function HeadPlateDisc({ ghost }: { ghost?: boolean }) {
  const R     = 1.80;
  const THICK = 0.18;
  return (
    <group>
      {/* Main disc */}
      <mesh>
        <cylinderGeometry args={[R, R, THICK, 64]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Edge bead (round cross-section confirmed) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R - 0.10, 0.10, 10, 48]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ── 3. Oval Ring Head (TORP Aerial variant) ───────────────────────
//   Large oval frame (figure-8 inner cutout, KURZ logo position).
//   Outer frame: ellipse tube (a=3.0, b=2.0, tubeR=0.18).
//   Inner bridge: forms two oval openings.
//   Cross-section of frame tube: circular (confirmed from photos).
// ================================================================
function HeadPlateOvalRing({ ghost }: { ghost?: boolean }) {
  const A       = 3.00;   // semi-major (long axis)
  const B       = 2.00;   // semi-minor (short axis)
  const TUBE_R  = 0.18;   // tube cross-section radius (circular, confirmed)
  const BRIDGE_R = 0.14;

  const outerTube = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(A * Math.cos(t), 0, B * Math.sin(t)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.TubeGeometry(curve, 80, TUBE_R, 10, true);
  }, []);

  // Inner horizontal bridge creating figure-8 cutout
  const innerBridge = useMemo(() => {
    const pts = [
      new THREE.Vector3(-A * 0.55, 0,  0),
      new THREE.Vector3( 0,        0,  0),
      new THREE.Vector3( A * 0.55, 0,  0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 12, BRIDGE_R, 10, false);
  }, []);

  // Vertical spine (center, connects top/bottom of oval)
  const spineBridge = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0, -B * 0.70),
      new THREE.Vector3(0, 0,  0),
      new THREE.Vector3(0, 0,  B * 0.70),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 10, BRIDGE_R * 0.85, 10, false);
  }, []);

  return (
    <group>
      <mesh geometry={outerTube}>
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh geometry={innerBridge}>
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh geometry={spineBridge}>
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ── 4. Dome 4-Fin Head (TORP variant) ────────────────────────────
//   CNC-machined from a single egg-shaped blank.
//   Result: 4 arc-sector fins remain after 4 wedge cutouts.
//   Fins are propeller-offset ~22.5°. Central dome is hemisphere.
//   Fin cross-section: uniform arc thickness (confirmed).
// ================================================================
function HeadPlateDome4Fin({ ghost }: { ghost?: boolean }) {
  const R_DOME   = 1.20;   // hemisphere radius
  const R_INNER  = R_DOME + 0.05;
  const R_OUTER  = 2.20;   // fin outer radius
  const FIN_ARC  = Math.PI * 0.38;   // ~68° per fin
  const FIN_THICK = 0.26;            // extrusion depth
  const OFFSET   = Math.PI / 8;      // 22.5° propeller rotation

  const finGeometries = useMemo(() => {
    return [0, 1, 2, 3].map((i) => {
      const startAngle = i * (Math.PI / 2) + OFFSET;
      const endAngle   = startAngle + FIN_ARC;

      const shape = new THREE.Shape();
      // Outer arc
      shape.absarc(0, 0, R_OUTER, startAngle, endAngle, false);
      // Inner arc back to start
      shape.absarc(0, 0, R_INNER, endAngle, startAngle, true);
      shape.closePath();

      return new THREE.ExtrudeGeometry(shape, {
        depth:            FIN_THICK,
        bevelEnabled:     true,
        bevelSize:        0.035,
        bevelThickness:   0.035,
        bevelSegments:    2,
      });
    });
  }, []);

  return (
    <group>
      {/* Central hemisphere */}
      <mesh>
        <sphereGeometry args={[R_DOME, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* 4 arc-sector fins, laid horizontal at dome base level */}
      {finGeometries.map((geo, i) => (
        <mesh
          key={i}
          geometry={geo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, FIN_THICK * 0.10, 0]}
        >
          <TitaniumMat ghost={ghost} />
        </mesh>
      ))}
    </group>
  );
}

// ── Head plate selector ───────────────────────────────────────────
export type HeadType = 'FENESTRATED' | 'DISC' | 'OVAL_RING' | 'DOME_4FIN';

function HeadPlate({ headType = 'FENESTRATED', ghost }: { headType?: HeadType; ghost?: boolean }) {
  switch (headType) {
    case 'DISC':      return <HeadPlateDisc      ghost={ghost} />;
    case 'OVAL_RING': return <HeadPlateOvalRing  ghost={ghost} />;
    case 'DOME_4FIN': return <HeadPlateDome4Fin  ghost={ghost} />;
    default:          return <HeadPlateFenestrated ghost={ghost} />;
  }
}

// ================================================================
// FOOT VARIANTS
// ================================================================

// ── BELL foot (PORP Düsseldorf) ───────────────────────────────────
//   Material: white HDPE/polyethylene (confirmed from photos).
//   Shape: truncated cone with outward flare at rim.
//   4 radial slits at 90° intervals (confirmed: up/down/left/right).
//   Each slit divides the cone into 4 independent petals.
//   Inner surface: concave cup cradles stapes capitulum.
// ================================================================
function BellFoot({ ghost }: { ghost?: boolean }) {
  // 4 quadrant petal sections (simulate 4 slits by rendering 4 separate LatheGeometry sectors)
  const petalPoints = useMemo<THREE.Vector2[]>(() => {
    // Outer profile: concical with outward flare at rim, concave interior
    return [
      new THREE.Vector2(0.22,  0.00),   // top: shaft attachment
      new THREE.Vector2(0.30,  0.18),
      new THREE.Vector2(0.50,  0.55),
      new THREE.Vector2(0.72,  0.95),
      new THREE.Vector2(0.82,  1.20),   // max flare
      new THREE.Vector2(0.78,  1.38),   // rim outer edge
      new THREE.Vector2(0.62,  1.38),   // rim inner edge (wall thickness ~0.16)
      new THREE.Vector2(0.50,  1.22),   // inner wall
      new THREE.Vector2(0.30,  0.85),   // inner concave bowl
      new THREE.Vector2(0.10,  0.50),
      new THREE.Vector2(0.00,  0.20),   // bowl center
    ];
  }, []);

  const SLIT_GAP = 0.06; // angular gap for slit (radians)
  const PETAL_ARC = Math.PI / 2 - SLIT_GAP;

  return (
    <group>
      {[0, 1, 2, 3].map((i) => {
        const phiStart = i * (Math.PI / 2) + SLIT_GAP / 2;
        return (
          <mesh key={i} rotation={[Math.PI, 0, phiStart]}>
            <latheGeometry args={[petalPoints, 16, 0, PETAL_ARC]} />
            <HdpeMat ghost={ghost} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── FLAT foot (TORP Düsseldorf) ───────────────────────────────────
//   2.6 mm radius flat titanium disc + 3 small sphere nubs on underside.
// ================================================================
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[1.30, 1.30, 0.22, 32]} />
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

// ── CLIP foot (Dresden Type) ──────────────────────────────────────
//   Confirmed from photos: double-arm spring clip.
//   Structure:
//     TopBar     – rectangular flat plate (ribbon cross-section)
//     UpperArms  – 2 wide C-curves, open upward, larger radius
//     LowerArms  – 2 tight C-curves, open downward, smaller radius
//     JunctionBlock – connects arms to shaft
//
//   Upper arms grip ABOVE stapes capitulum.
//   Lower arms grip BELOW capitulum / around neck.
//   Together: 4-point axial lock on stapes head.
// ================================================================
function ClipArm({
  level,
  side,
  ghost,
}: {
  level: 'upper' | 'lower';
  side: 1 | -1;
  ghost?: boolean;
}) {
  const tube = useMemo(() => {
    let pts: THREE.Vector3[];

    if (level === 'upper') {
      // Wide C-curve: from TopBar end → sweeps upward/outward → hooks inward
      pts = [
        new THREE.Vector3(side * 0.22,  0.24,  0),
        new THREE.Vector3(side * 0.48,  0.18,  0),
        new THREE.Vector3(side * 0.62,  0.00,  0),
        new THREE.Vector3(side * 0.68, -0.28,  0),
        new THREE.Vector3(side * 0.56, -0.52,  0),
        new THREE.Vector3(side * 0.32, -0.62,  0),
        new THREE.Vector3(side * 0.10, -0.60,  0),
      ];
    } else {
      // Tight C-curve: from JunctionBlock → sweeps downward/outward → hooks inward
      pts = [
        new THREE.Vector3(side * 0.18, -0.05,  0),
        new THREE.Vector3(side * 0.38, -0.08,  0),
        new THREE.Vector3(side * 0.50, -0.24,  0),
        new THREE.Vector3(side * 0.52, -0.44,  0),
        new THREE.Vector3(side * 0.40, -0.60,  0),
        new THREE.Vector3(side * 0.20, -0.68,  0),
        new THREE.Vector3(side * 0.06, -0.64,  0),
      ];
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    // Ribbon cross-section: flatten tubular segments (4 radial segments = square approx)
    return new THREE.TubeGeometry(curve, 20, 0.07, 4, false);
  }, [level, side]);

  return (
    <mesh geometry={tube}>
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

function ClipFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* TopBar – horizontal rectangular bar */}
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[0.50, 0.10, 0.16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* Upper arm pair (wide C-curves, open upward) */}
      <ClipArm level="upper" side={ 1} ghost={ghost} />
      <ClipArm level="upper" side={-1} ghost={ghost} />

      {/* Lower arm pair (tight C-curves, open downward) */}
      <ClipArm level="lower" side={ 1} ghost={ghost} />
      <ClipArm level="lower" side={-1} ghost={ghost} />

      {/* Junction block */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.24, 0.12, 0.16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ================================================================
// ProsthesisModel  -- shaft + head plate + foot
// ================================================================
export type { KurzProduct };

interface ProsthesisProps {
  product:          KurzProduct;
  shaftLength:      number;
  headType?:        HeadType;
  basePos?:         THREE.Vector3;
  direction?:       THREE.Vector3;
  lateralOffset?:   number;
  anteriorOffset?:  number;
  verticalOffset?:  number;
  angleTilt?:       number;
  angleTiltZ?:      number;
  ghost?:           boolean;
}

export function ProsthesisModel({
  product,
  shaftLength,
  headType        = 'FENESTRATED',
  basePos,
  direction,
  lateralOffset   = 0,
  anteriorOffset  = 0,
  verticalOffset  = 0,
  angleTilt       = 0,
  angleTiltZ      = 0,
  ghost           = false,
}: ProsthesisProps) {

  const base = (basePos ?? (product.footType === 'FLAT' ? STAPES_FOOTPLATE : STAPES_HEAD)).clone();
  base.x += lateralOffset;
  base.y += verticalOffset;
  base.z += anteriorOffset;

  const dir = direction
    ? direction.clone().normalize()
    : new THREE.Vector3().subVectors(UMBO_POS, base).normalize();

  const top  = base.clone().addScaledVector(dir, shaftLength);
  const mid  = base.clone().add(top).multiplyScalar(0.5);
  const len  = shaftLength;

  const quat  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  const tiltXRad = (angleTilt  * Math.PI) / 180;
  const tiltZRad = (angleTiltZ * Math.PI) / 180;
  const headOff  = len / 2 + 0.15;
  const footOff  = -(len / 2);

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltXRad, euler.y, euler.z + tiltZRad]}
    >
      {/* Head plate */}
      <group position={[0, headOff, 0]}>
        <HeadPlate headType={headType} ghost={ghost} />
      </group>

      {/* Shaft – circular cross-section (confirmed) */}
      <mesh>
        <cylinderGeometry args={[0.10, 0.10, len, 16]} />
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

// ── Ideal ghost ───────────────────────────────────────────────────
export function IdealGhostProsthesis({
  product,
  length,
  headType           = 'FENESTRATED',
  idealLateralOffset = 0,
  idealAngle         = 0,
}: {
  product:             KurzProduct;
  length:              number;
  headType?:           HeadType;
  idealLateralOffset?: number;
  idealAngle?:         number;
}) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      headType={headType}
      lateralOffset={idealLateralOffset}
      angleTilt={idealAngle}
      ghost={true}
    />
  );
}

// ── Named exports for standalone use / testing ────────────────────
export {
  HeadPlateFenestrated,
  HeadPlateDisc,
  HeadPlateOvalRing,
  HeadPlateDome4Fin,
  BellFoot,
  FlatFoot,
  ClipFoot,
};
