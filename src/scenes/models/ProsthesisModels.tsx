/**
 * ProsthesisModels.tsx  -- KURZ ossicular prosthesis 3D models
 *
 * Updated 2026-06-23 v2: Catalog-accurate revision (M9600320_0723).
 * All prostheses: Pure Titanium ASTM F67 Medical Grade.
 *
 * Head plate variants:
 *   'FENESTRATED'  - Düsseldorf type (4-spoke, outer torus ring) -- all standard products
 *   'DISC'         - Simple flat disc (20x scale model display only)
 *   'OVAL_RING'    - Oval frame with figure-8 inner cutouts (20x scale model display)
 *   'DOME_4FIN'    - 4-fin dome, CNC-machined from solid egg blank (MunichLMU style)
 *
 * Foot variants:
 *   'BELL'   - Titanium conical bell, 4 narrow slits (~2°) for stapedius tendon clearance
 *   'FLAT'   - Cannulated (hollow) distal footing, AERIAL Total type
 *   'CLIP'   - 2 spring foil arms (filigree clip legs), titanium ribbon foil
 *
 * Shaft: circular cross-section, 0.2mm diameter (scaled), matte titanium finish.
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

// ── BELL foot (PORP Düsseldorf / TTP-Tuebingen) ──────────────────
//   Catalog: "conically shaped bell, Pure Titanium ASTM F67"
//   "recessed slots allow adequate space for stapedius tendon"
//   4 narrow slits at 90° (only ~2° each) → bell appears nearly solid.
//   Inner surface: concave cup cradles stapes capitulum.
// ================================================================
function BellFoot({ ghost }: { ghost?: boolean }) {
  const petalPoints = useMemo<THREE.Vector2[]>(() => [
    new THREE.Vector2(0.22,  0.00),   // top: shaft attachment collar
    new THREE.Vector2(0.30,  0.18),
    new THREE.Vector2(0.50,  0.55),
    new THREE.Vector2(0.72,  0.95),
    new THREE.Vector2(0.82,  1.20),   // max flare (2.6mm dia in catalog)
    new THREE.Vector2(0.78,  1.38),   // rim outer edge
    new THREE.Vector2(0.62,  1.38),   // rim inner edge (wall ~0.16)
    new THREE.Vector2(0.50,  1.22),   // inner wall
    new THREE.Vector2(0.30,  0.85),   // concave bowl
    new THREE.Vector2(0.10,  0.50),
    new THREE.Vector2(0.00,  0.20),   // bowl center (deepest - cradles stapes head)
  ], []);

  // Narrow slits: 2° gap per slit (0.035 rad) → bell looks nearly complete
  const SLIT_GAP  = 0.035;
  const PETAL_ARC = Math.PI / 2 - SLIT_GAP;

  return (
    <group rotation={[Math.PI, 0, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i}>
          <latheGeometry
            args={[petalPoints, 14, i * (Math.PI / 2) + SLIT_GAP / 2, PETAL_ARC]}
          />
          <TitaniumMatDS ghost={ghost} />
        </mesh>
      ))}
    </group>
  );
}

// ── FLAT foot (TORP Düsseldorf AERIAL) ───────────────────────────
//   Catalog: "cannulated distal footing to increase fluid adhesion
//   force to the stapes footplate" → hollow shaft tip, not a disc.
//   Slightly widened terminal cylinder with visible hollow center.
// ================================================================
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* Tapered terminal cylinder (cannulated end) */}
      <mesh>
        <cylinderGeometry args={[0.24, 0.18, 0.42, 16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Hollow interior — creates fluid adhesion force */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.28, 8]} />
        <meshStandardMaterial color="#050810" transparent opacity={ghost ? 0.0 : 0.90} />
      </mesh>
    </group>
  );
}

// ── CLIP foot (Dresden Type) ──────────────────────────────────────
//   Catalog: "spring-loaded, atraumatic foils", "filigree clip legs"
//   "elastic CliP ensures a secure fit on the stapes head"
//   Structure: 2 thin titanium ribbon spring foils (NOT 4 arms).
//   Each foil: C-shaped sweep from top bar → outward → inward hook.
//   Total spread: 2.6mm. Arms grip LEFT and RIGHT of stapes capitulum.
//   TubeGeometry radialSegments=4 → square cross-section ≈ ribbon foil.
// ================================================================
function ClipArm({ side, ghost }: { side: 1 | -1; ghost?: boolean }) {
  const tube = useMemo(() => {
    // C-curve: from top bar → lateral sweep → downward → hook tip inward
    const pts = [
      new THREE.Vector3(side * 0.08,  0.18,  0),   // top bar junction
      new THREE.Vector3(side * 0.30,  0.10,  0),   // sweeping outward
      new THREE.Vector3(side * 0.50,  0.00,  0),   // max lateral (≈1.3mm half-spread)
      new THREE.Vector3(side * 0.55, -0.20,  0),   // arm descends
      new THREE.Vector3(side * 0.48, -0.42,  0),
      new THREE.Vector3(side * 0.30, -0.58,  0),   // curves inward
      new THREE.Vector3(side * 0.12, -0.64,  0),   // hook tip (grips stapes neck)
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    // Thin ribbon foil: small radius, square cross-section (radialSegments=4)
    return new THREE.TubeGeometry(curve, 24, 0.052, 4, false);
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
      {/* Top connecting bar (joins 2 spring foil arms) */}
      <mesh position={[0, 0.20, 0]}>
        <boxGeometry args={[0.54, 0.09, 0.11]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* Two spring foil arms (filigree clip legs) */}
      <ClipArm side={ 1} ghost={ghost} />
      <ClipArm side={-1} ghost={ghost} />

      {/* Junction collar at shaft base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.13, 10]} />
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
