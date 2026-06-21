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
//   - Outer torus ring (beveled, 14-segment tube)
//   - 4 blade-like spokes (TubeGeometry with elliptic cross-section)
//   - Inner hub cylinder (connects to shaft)
//   - Large fenestrations between spokes
//   - Slits in outer rim (0.6 mm / 0.35 mm)
//
// Improvements (v2):
//   - Spokes: TubeGeometry along radial CatmullRom curve → smoother, blade-like
//   - Rim torus: 14 tube segments for finer circular cross-section
//   - Hub: slight chamfer cap for realistic look
// ================================================================
function HeadPlate({ ghost }: { ghost?: boolean }) {
  const outerR     = 1.80;
  const hubR       = 0.30;
  const plateThick = 0.22;
  const rimTubeR   = 0.14;
  const rimCenterR = outerR - rimTubeR;  // 1.66
  const spokeLen   = rimCenterR - hubR;  // 1.36
  const midR       = hubR + spokeLen / 2;

  // ── スポーク: TubeGeometry で刃状（薄×幅）プロファイル ───────────────
  // EllipseCurve で断面を楕円にする代わりに、thin boxを使うがスムースな
  // TubeGeometry + custom path を利用して縁に丸みを付ける
  const spokeGeometries = useMemo(() => {
    return [0, 90, 180, 270].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      // スポーク中心軸（hub外縁→rim内縁）
      const from = new THREE.Vector3(Math.cos(rad) * hubR,       0, Math.sin(rad) * hubR);
      const to   = new THREE.Vector3(Math.cos(rad) * rimCenterR, 0, Math.sin(rad) * rimCenterR);
      const mid1 = new THREE.Vector3().lerpVectors(from, to, 0.33);
      const mid2 = new THREE.Vector3().lerpVectors(from, to, 0.67);
      const curve = new THREE.CatmullRomCurve3([from, mid1, mid2, to]);
      // tubularSegments=12, radius=spoke half-width (0.10 → 0.20mm 幅), radialSegments=5
      return new THREE.TubeGeometry(curve, 8, 0.095, 5, false);
    });
  }, []);

  return (
    <group>
      {/* Outer rim: torus (14 tube segments → smoother) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimCenterR, rimTubeR, 14, 44]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* Inner hub */}
      <mesh>
        <cylinderGeometry args={[hubR, hubR + 0.04, plateThick, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Hub top cap (chamfer) */}
      <mesh position={[0, plateThick / 2 + 0.025, 0]}>
        <cylinderGeometry args={[hubR + 0.04, hubR, 0.05, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* 4 blade-like spokes */}
      {spokeGeometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <TitaniumMat ghost={ghost} />
        </mesh>
      ))}

      {/* Slit 0.6mm (stapes arch clearance) */}
      <mesh position={[0, 0, outerR - 0.05]}>
        <boxGeometry args={[0.60, plateThick + 0.02, 0.22]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={ghost ? 0.0 : 1.0} />
      </mesh>
      {/* Slit 0.35mm */}
      <mesh position={[outerR * 0.5, 0, outerR * 0.866]}>
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
//
// Improvements (v2):
//   - 28-step outer dome for smoother silhouette
//   - Slight outward rim flare (KURZ characteristic)
//   - Elliptic inner bowl: a=1.17, b=0.80 (ellipse arc quarter-circle)
//   - 20-step inner bowl for smooth concavity
//   - 48 lathe segments for clean circular profile
// ================================================================
function BellFoot({ ghost }: { ghost?: boolean }) {
  const points = useMemo(() => {
    const R       = 1.35;   // outer sphere radius
    const rimR    = 1.30;   // 2.6 mm diam / 2
    const wallT   = 0.13;   // wall thickness at rim
    const maxTheta = Math.asin(rimR / R);  // ~74.5 deg
    const OUTER_STEPS = 28;
    const BOWL_STEPS  = 20;

    const pts: THREE.Vector2[] = [];

    // ── 外側ドーム（球弧、極→リム）────────────────────────────────
    for (let i = 0; i <= OUTER_STEPS; i++) {
      const theta = (i / OUTER_STEPS) * maxTheta;
      pts.push(new THREE.Vector2(
        R * Math.sin(theta),
        -(R - R * Math.cos(theta))   // ドームは下方向（Y負）に開く
      ));
    }

    const rimY = -(R - R * Math.cos(maxTheta));  // ≈ -0.992

    // ── リム: わずかな外側フレア（KURZ特徴）─────────────────────────
    pts.push(new THREE.Vector2(rimR + 0.032, rimY - 0.038));
    pts.push(new THREE.Vector2(rimR + 0.042, rimY - 0.082));  // フレア先端
    pts.push(new THREE.Vector2(rimR + 0.010, rimY - 0.118));  // 外底
    pts.push(new THREE.Vector2(rimR - wallT,  rimY - 0.118)); // 内底
    pts.push(new THREE.Vector2(rimR - wallT,  rimY - 0.005)); // 内壁上端

    // ── 内側凹面ボウル（楕円弧：a=1.17, b=0.80）─────────────────────
    // 楕円パラメータ: r = a·cos(t), y_offset = b·sin(t), t: 0 → π/2
    // t=0 → (rimR-wallT, rimY)  =内壁上端にマッチ
    // t=π/2 → (0, rimY+0.80)   =ボウル中央（最深部）
    const a = rimR - wallT;  // 1.17
    const b = 0.80;          // ボウル深さ
    for (let i = 1; i <= BOWL_STEPS; i++) {
      const t = (i / BOWL_STEPS) * (Math.PI / 2);
      pts.push(new THREE.Vector2(
        a * Math.cos(t),
        rimY + b * Math.sin(t)
      ));
    }
    // ボウル中央極（r=0, ボウル最深部）
    pts.push(new THREE.Vector2(0, rimY + b));

    return pts;
  }, []);

  return (
    <mesh>
      <latheGeometry args={[points, 48]} />
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
  product:          KurzProduct;
  shaftLength:      number;
  basePos?:         THREE.Vector3;
  direction?:       THREE.Vector3;
  lateralOffset?:   number;
  anteriorOffset?:  number;
  verticalOffset?:  number;  // Y軸オフセット（上下）
  angleTilt?:       number;  // 前後傾斜 degrees（-180〜+180）
  angleTiltZ?:      number;  // 左右傾斜 degrees（-180〜+180）
  ghost?:           boolean;
}

export function ProsthesisModel({
  product,
  shaftLength,
  basePos,
  direction,
  lateralOffset  = 0,
  anteriorOffset = 0,
  verticalOffset = 0,
  angleTilt      = 0,
  angleTiltZ     = 0,
  ghost          = false,
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

  const tiltXRad = (angleTilt  * Math.PI) / 180;  // 前後傾斜
  const tiltZRad = (angleTiltZ * Math.PI) / 180;  // 左右傾斜
  const headOff = len / 2 + 0.15;
  const footOff = -(len / 2);   // foot connects flush to shaft bottom

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltXRad, euler.y, euler.z + tiltZRad]}
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
  idealLateralOffset = 0,
  idealAngle = 0,
}: {
  product: KurzProduct;
  length:  number;
  idealLateralOffset?: number;
  idealAngle?: number;
}) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      lateralOffset={idealLateralOffset}
      angleTilt={idealAngle}
      ghost={true}
    />
  );
}
