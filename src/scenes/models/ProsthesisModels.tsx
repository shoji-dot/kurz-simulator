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
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS, UMBO_POS_TORP } from './OssicleModels';

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
//   Oval outer ring (A=1.80 long, B=1.35 short) + 4 spokes + hub.
//   Head plate shape: egg-shaped oval (confirmed from 20x scale photos).
// ================================================================
function HeadPlateFenestrated({ ghost }: { ghost?: boolean }) {
  const A          = 1.80;   // semi-major (long axis)  3.60 mm = 71.6/20×½
  const B          = 1.30;   // semi-minor (short axis) 2.60 mm = 52.0/20×½
  const hubR       = 0.30;
  const plateThick = 0.22;
  const rimTubeR   = 0.14;

  // Elliptical outer rim (TubeGeometry along ellipse path)
  const outerTube = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(A * Math.cos(t), 0, B * Math.sin(t)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.TubeGeometry(curve, 80, rimTubeR, 12, true);
  }, []);

  // 4 spokes reaching the elliptical rim
  const spokeGeometries = useMemo(() => {
    return [0, 90, 180, 270].map((deg) => {
      const rad  = (deg * Math.PI) / 180;
      const endX = A * Math.cos(rad);
      const endZ = B * Math.sin(rad);
      const dist = Math.sqrt(endX * endX + endZ * endZ);
      const sc   = (dist - rimTubeR) / dist;    // stop just before rim tube
      const from = new THREE.Vector3(Math.cos(rad) * hubR, 0, Math.sin(rad) * hubR);
      const to   = new THREE.Vector3(endX * sc, 0, endZ * sc);
      const curve = new THREE.CatmullRomCurve3([from, to]);
      return new THREE.TubeGeometry(curve, 6, 0.095, 5, false);
    });
  }, []);

  return (
    <group>
      {/* Elliptical outer rim */}
      <mesh geometry={outerTube}>
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Central hub */}
      <mesh>
        <cylinderGeometry args={[hubR, hubR + 0.04, plateThick, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh position={[0, plateThick / 2 + 0.025, 0]}>
        <cylinderGeometry args={[hubR + 0.04, hubR, 0.05, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* 4 spokes */}
      {spokeGeometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <TitaniumMat ghost={ghost} />
        </mesh>
      ))}
    </group>
  );
}

// ── 2. Disc (oval flat disc) ──────────────────────────────────────
//   Oval/egg-shaped flat disc (confirmed from 20x scale photos).
//   Uses ExtrudeGeometry with ellipse shape for accurate oval profile.
// ================================================================
function HeadPlateDisc({ ghost }: { ghost?: boolean }) {
  const A     = 1.80;   // semi-major  3.60 mm = 71.6/20×½
  const B     = 1.30;   // semi-minor  2.60 mm = 52.0/20×½
  const THICK = 0.18;

  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, A, B, 0, Math.PI * 2, false, 0);
    return new THREE.ExtrudeGeometry(shape, {
      depth:          THICK,
      bevelEnabled:   true,
      bevelSize:      0.055,
      bevelThickness: 0.055,
      bevelSegments:  2,
    });
  }, []);

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -THICK / 2, 0]}>
      <TitaniumMat ghost={ghost} />
    </mesh>
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

// ── BELL TOP head plate (TTP-VARIAC PORP) ────────────────────────
//   Structure (ChatGPT + real photo analysis 2026-06-24):
//   - Outer oval ring (portrait: rx=1.30=short2.6mm, ry=1.80=long3.6mm)
//   - 3 fenestrations:
//       [1] Top:    small oval, center(0, +0.52)
//       [2] BotL:   large oval, center(-0.26, -0.20)
//       [3] BotR:   large oval, center(+0.26, -0.20)
//   - Elastic locking strut = material between holes (T-shape):
//       Horizontal bar: y=0.24→0.32 (between top hole and bottom holes)
//       Vertical connector: x=-0.04→+0.04 (between left and right holes)
//   - Shaft fixation pin on strut (small cylinder protrusion on top face)
// ================================================================
function BellTop({ ghost }: { ghost?: boolean }) {
  const discGeo = useMemo<THREE.BufferGeometry>(() => {
    const ellipsePoints = (cx: number, cy: number, rx: number, ry: number, n = 48): THREE.Vector2[] => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(new THREE.Vector2(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
      }
      return pts;
    };

    // ── Outer portrait oval ─────────────────────────────────────────────
    // 20× caliper confirmed: H 71.6mm → 3.58mm (ry=1.80), W 51.5mm → 2.575mm (rx=1.30)
    // Disc geometric center offset from shaft: (+0.14, -0.24) [unchanged]
    const shape = new THREE.Shape(ellipsePoints(+0.14, -0.24, 1.30, 1.80));

    // ── Fenestration 1: UPPER (horizontal ellipse) ───────────────────────
    // Caliper: W 25.6/20=1.28mm → rx=0.64; H 11.8/20=0.59mm → ry=0.295
    // Top rim 6.2/20=0.31mm: disc_top(+1.56)−hole_top(+1.25)=0.31 ✓
    // Disc-space center: (0, +1.195) → shaft-space: (+0.14, +0.955)
    const hole1 = new THREE.Path(ellipsePoints(+0.14, +0.955, 0.64, 0.295));
    shape.holes.push(hole1);

    // ── Fenestration 2: LOWER-LEFT (vertical ellipse) ───────────────────
    // Caliper: W 14.9/20=0.745mm → rx=0.37; H 25.9/20=1.295mm → ry=0.65
    // Disc-space center: (-0.68, -0.65) → shaft-space: (-0.54, -0.89)
    // Strut to hole3: 0.37mm horizontal gap ✓
    const hole2 = new THREE.Path(ellipsePoints(-0.54, -0.89, 0.37, 0.65));
    shape.holes.push(hole2);

    // ── Fenestration 3: LOWER-RIGHT (large vertical ellipse / D-shape) ──
    // Caliper: W 19.5/20=0.975mm → rx=0.49; H 41.4/20=2.07mm → ry=1.035
    // Strut below hole1: 0.15mm; bottom rim: 0.31mm ✓
    // Disc-space center: (+0.55, -0.285) → shaft-space: (+0.69, -0.525)
    const hole3 = new THREE.Path(ellipsePoints(+0.69, -0.525, 0.49, 1.035));
    shape.holes.push(hole3);

    return new THREE.ExtrudeGeometry(shape, { depth: 0.10, bevelEnabled: false });
  }, []);

  return (
    <group>
      {/* Asymmetric fenestrated disc — rotate front face → Y+ (TM side) */}
      <mesh geometry={discGeo} rotation={[Math.PI / 2, 0, 0]}>
        <TitaniumMatDS ghost={ghost} />
      </mesh>
      {/* Shaft fixation pin — centered on shaft axis (world origin of this group) */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.13, 0.10, 0.04, 10]} />
        <TitaniumMatDS ghost={ghost} />
      </mesh>
      {/* Collar: shaft-to-disc junction piece */}
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[0.10, 0.10, 0.13, 12]} />
        <TitaniumMatDS ghost={ghost} />
      </mesh>
    </group>
  );
}

// ── SOFT CLIP head (Soft Clip Stapes Prosthesis) ─────────────────
//   リバースエンジニアリング 2026-07-02: 20倍デモモデル
//   (ノギス実測 + 6方向写真 + Scaniverse GLBスキャン、Phase1-3レポート)
//
//   確定寸法（実物 = ノギス値 ÷20、優先度①②で確定）:
//     帯材(ワイヤー)断面    : 幅0.235mm × 厚み0.095mm  [ノギス実測flat stock片。カタログ"0.25mm"と誤差6%で一致]
//     フック(先端ループ)幅  : 0.195mm                   [ノギス実測 "3.9"/20]
//     ブリッジ〜シャフト高さ: 0.56mm                    [ノギス実測 "11.2"/20]
//     シャフト/コラー径     : 既存ProsthesisModel実装(Φ0.4mm)を維持（カラー実測7.9-8.0/20≈0.40mmと一致）
//
//   暫定値（要追加ノギス計測、③④のみで組み立て・フラグ付き）:
//     全体スパン(両ウィング先端間): 約1.8mm  [GLB点群概算のみ、ノギス未実測]
//     ウィング/フックの曲率半径R  : 未確定  [写真・GLBとも複雑形状のため特定不可、形状は写真プロポーション参考]
//     ブリッジ波形振幅            : 写真からの概算
//   → 上記3点はPhase4監査で「要追加計測」として報告し、実測値取得後に再調整する。
//
//   Feature Tree 相当（将来的な真CADポーティング用）:
//     1) Sketch  : ウィング中心線スプライン（片側のみ）
//     2) Sweep   : 矩形断面(0.235×0.095mm)を中心線に沿って掃引 → 片側ウィング
//     3) Mirror  : シャフト軸を含む対称面でミラー → 対辺ウィング
//     4) Sketch+Sweep: ブリッジ（ウィング基部間の波状接続材、同断面）
//     5) Revolve : 中央ステム（円柱、ブリッジ〜シャフト接続）
//   ※Three.js実装注記: 矩形断面をExtrudeGeometry+extrudePathで掃引すると
//     急カーブでFrenetフレームが破綻し黒い塊状ジオメトリになったため、
//     見た目優先でTubeGeometry(円形断面, R≈0.10mm)に暫定変更(2026-07-02)。
//     真の矩形断面(0.235×0.095mm)はCAD化時に再現する。
// ================================================================
// ワイヤー半径: 断面0.235×0.095mmの平均的な太さを円形チューブで近似
// （ExtrudeGeometry+extrudePathは急カーブでFrenetフレームが破綻し
//   黒い塊状ジオメトリになる不具合があったため、TubeGeometryに変更 2026-07-02）
const CLIP_WIRE_R = 0.10;

// ステム高さ（実測0.56mmのうちステム分を暫定按分、残りはウィング/ブリッジ側）
const CLIP_STEM_H = 0.20;

function SoftClipWing({ side, ghost }: { side: 1 | -1; ghost?: boolean }) {
  const geo = useMemo(() => {
    // 暫定パス（要実測R確認）: ブリッジ基部→外側へ展開→緩やかなフック
    // 急激な反転(180°ターン)はTubeGeometryでも歪みの原因になるため、
    // カーブは単調外側→内側への緩やかな巻き込みに留める。
    const pts = [
      new THREE.Vector3(side * 0.03, 0.540, 0.00),
      new THREE.Vector3(side * 0.28, 0.565, 0.05),
      new THREE.Vector3(side * 0.55, 0.520, 0.09),
      new THREE.Vector3(side * 0.78, 0.420, 0.05),
      new THREE.Vector3(side * 0.90, 0.300, -0.02),
      new THREE.Vector3(side * 0.86, 0.200, -0.08),
      new THREE.Vector3(side * 0.74, 0.180, -0.06),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    return new THREE.TubeGeometry(curve, 48, CLIP_WIRE_R, 8, false);
  }, [side]);

  return (
    <mesh geometry={geo}>
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

function SoftClipBridge({ ghost }: { ghost?: boolean }) {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector3(-0.03, 0.540, 0.000),
      new THREE.Vector3(-0.015, 0.565, 0.015),
      new THREE.Vector3( 0.00, 0.545, 0.000),
      new THREE.Vector3( 0.015, 0.565, 0.015),
      new THREE.Vector3( 0.03, 0.540, 0.000),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false);
    return new THREE.TubeGeometry(curve, 24, CLIP_WIRE_R, 8, false);
  }, []);
  return (
    <mesh geometry={geo}>
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

function SoftClipStem({ ghost }: { ghost?: boolean }) {
  return (
    <mesh position={[0, CLIP_STEM_H / 2, 0]}>
      <cylinderGeometry args={[0.06, 0.07, CLIP_STEM_H, 10]} />
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

function SoftClipHead({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <SoftClipStem   ghost={ghost} />
      <SoftClipBridge ghost={ghost} />
      <SoftClipWing side={ 1} ghost={ghost} />
      <SoftClipWing side={-1} ghost={ghost} />
    </group>
  );
}

// ── Head plate selector ───────────────────────────────────────────
export type HeadType = 'FENESTRATED' | 'DISC' | 'OVAL_RING' | 'DOME_4FIN' | 'BELL_TOP' | 'SOFT_CLIP';

function HeadPlate({ headType = 'FENESTRATED', ghost }: { headType?: HeadType; ghost?: boolean }) {
  switch (headType) {
    case 'DISC':      return <HeadPlateDisc      ghost={ghost} />;
    case 'OVAL_RING': return <HeadPlateOvalRing  ghost={ghost} />;
    case 'DOME_4FIN': return <HeadPlateDome4Fin  ghost={ghost} />;
    case 'BELL_TOP':  return <BellTop            ghost={ghost} />;
    case 'SOFT_CLIP': return <SoftClipHead ghost={ghost} />;
    default:          return <HeadPlateFenestrated ghost={ghost} />;
  }
}

// ================================================================
// FOOT VARIANTS
// ================================================================

// ── BELL foot (TTP-VARIAC PORP) ─────────────────────────────────
//   Reverse-engineered from physical specimen (2026-07-01).
//   Parametric CAD model — all dimensions from direct measurement.
//
//   Measured (as-built):
//     Outer dia at rim      : 2.15 mm  → R_rim  = 1.075 mm
//     Outer dia at slit top : 1.62 mm  → R_slit = 0.810 mm
//     Total height          : 1.48 mm
//     Slit height (from rim): 0.97 mm
//     Slit width at top     : 0.80 mm  (wider — tapered)
//     Slit width at rim     : 0.60 mm  (narrower)
//     Wall thickness        : 0.13 mm  (uniform)
//     Slits                 : 4 × 90°, tapered
//
//   Derived geometry:
//     Lower 0.97 mm : conical frustum  (half-angle 15.3° from axis)
//     Upper 0.51 mm : spherical cap    (R_outer = 0.898, Y_center = 0.582)
//     Inner shell   : concentric surfaces offset −0.13 mm
//     Rim ring      : annular closure at open bottom
//
//   Slit angles (4 equal, referenced at rim):
//     slit  = 31.98° (0.558 rad) each
//     solid = 58.02° (1.013 rad) each sector
// ================================================================
/**
 * Bell全高（スケール後、mm）。実測1.48mm × スケール係数0.7395 = 1.095mm。
 * BellFoot()のローカルY=0（リム/底面）〜BELL_HEIGHT_MM（頂点/apex）の中空カップ形状を定義する値。
 * 2026-07-23、shojiさん指摘のBELLフット×シャフト構造矛盾の調査でSimScene.tsxのDebug Overlay
 * （Bell Apex/Bell Rimマーカー）からも参照するため、BellFoot()内のローカル定数から export に昇格。
 * 数値自体は変更していない（挙動変更なし、単一情報源化のみ）。
 */
export const BELL_HEIGHT_MM = 1.095;

function BellFoot({ ghost }: { ghost?: boolean }) {
  // ── Parameters scaled to 1/20 from 20× physical model ───────
  // 20× model: bottom dia 31.8 mm → 1/20 = 1.59 mm (dia), R = 0.795
  // Scale factor: 0.795 / 1.075 = 0.7395  (applied uniformly to all dims)
  const BELL_H     = BELL_HEIGHT_MM;   // total bell height   (1.48 × 0.7395)
  const RIM_R      = 0.795;   // outer radius at rim       (dia 1.59 mm, from 20× model)
  const SLIT_TOP_R = 0.599;   // outer radius at slit top  (0.810 × 0.7395)
  const SLIT_H     = 0.717;   // slit height from rim      (0.97 × 0.7395)
  const WALL_T     = 0.096;   // uniform wall thickness    (0.13 × 0.7395)
  const SLIT_W_BOT = 0.444;   // slit chord width at rim   (0.60 × 0.7395)
  // SLIT_W_TOP ≈ 0.592       // slit chord width at slit-top (0.80 × 0.7395)

  // ── Derived geometry ─────────────────────────────────────────
  const CAP_H  = BELL_H - SLIT_H;   // 0.51 mm
  // Sphere through apex (r=0,y=BELL_H) and junction (r=SLIT_TOP_R,y=SLIT_H):
  //   SLIT_TOP_R² = CAP_H · (BELL_H + SLIT_H − 2·Y_C)  → Y_C
  const Y_C    = (BELL_H + SLIT_H - (SLIT_TOP_R * SLIT_TOP_R) / CAP_H) / 2; // ≈ 0.582
  const R_SPH  = BELL_H - Y_C;      // outer sphere radius ≈ 0.898 mm
  const R_SPHI = R_SPH - WALL_T;    // inner sphere radius ≈ 0.768 mm

  // ── Slit / sector angles ──────────────────────────────────────
  // 4 equal slits centered at 0°/90°/180°/270°; reference width at rim
  const SLIT_ANG = SLIT_W_BOT / RIM_R;                        // 0.558 rad (32.0°)
  const SECT_ANG = (Math.PI * 2 - 4 * SLIT_ANG) / 4;          // 1.013 rad (58.0°)

  // ── Profile segment counts ────────────────────────────────────
  const N_CONE = 12;   // conical frustum segments
  const N_CAP  = 18;   // spherical cap segments
  const N_ANG  = 24;   // angular subdivisions per sector

  // ── Outer shell profile: rim (y=0) → junction → apex ─────────
  const outerProfile = useMemo<THREE.Vector2[]>(() => {
    const pts: THREE.Vector2[] = [];
    // Conical frustum
    for (let i = 0; i <= N_CONE; i++) {
      const t = i / N_CONE;
      pts.push(new THREE.Vector2(RIM_R + (SLIT_TOP_R - RIM_R) * t, t * SLIT_H));
    }
    // Spherical cap
    for (let i = 1; i <= N_CAP; i++) {
      const y = SLIT_H + (i / N_CAP) * CAP_H;
      const r = Math.sqrt(Math.max(0, R_SPH * R_SPH - (y - Y_C) * (y - Y_C)));
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  // ── Inner shell profile (wall offset −WALL_T) ─────────────────
  const innerProfile = useMemo<THREE.Vector2[]>(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= N_CONE; i++) {
      const t = i / N_CONE;
      const r = Math.max(0.02, RIM_R + (SLIT_TOP_R - RIM_R) * t - WALL_T);
      pts.push(new THREE.Vector2(r, t * SLIT_H));
    }
    for (let i = 1; i <= N_CAP; i++) {
      const y = SLIT_H + (i / N_CAP) * CAP_H;
      const r = Math.sqrt(Math.max(0, R_SPHI * R_SPHI - (y - Y_C) * (y - Y_C)));
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  // ── Rim annular strip: closes open bottom (inner→outer) ───────
  const rimProfile = useMemo<THREE.Vector2[]>(() => [
    new THREE.Vector2(RIM_R - WALL_T, 0),
    new THREE.Vector2(RIM_R,          0),
  ], []);

  return (
    <group>
      {[0, 1, 2, 3].map((i) => {
        const phiStart = i * (Math.PI / 2) + SLIT_ANG / 2;
        return (
          <group key={i}>
            {/* Outer wall */}
            <mesh>
              <latheGeometry args={[outerProfile, N_ANG, phiStart, SECT_ANG]} />
              <TitaniumMatDS ghost={ghost} />
            </mesh>
            {/* Inner wall */}
            <mesh>
              <latheGeometry args={[innerProfile, N_ANG, phiStart, SECT_ANG]} />
              <TitaniumMatDS ghost={ghost} />
            </mesh>
            {/* Rim ring (annular closure) */}
            <mesh>
              <latheGeometry args={[rimProfile, N_ANG, phiStart, SECT_ANG]} />
              <TitaniumMatDS ghost={ghost} />
            </mesh>
          </group>
        );
      })}
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


// ── PISTON foot (Soft Clip Stapes / Stapedotomy) ─────────────────
//   Catalog Ø0.4/0.6mm shaft. Rounded piston tip enters oval window.
//   Small hemisphere + short cylinder ≈ clinical piston shape.
// ================================================================
function PistonFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* Rounded hemisphere tip (enters oval window fenestration) */}
      <mesh>
        <sphereGeometry args={[0.20, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Short cylindrical collar above the tip */}
      <mesh position={[0, 0.10, 0]}>
        <cylinderGeometry args={[0.20, 0.20, 0.20, 12]} />
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

  const base = (basePos ?? (['FLAT', 'PISTON'].includes(product.footType) ? STAPES_FOOTPLATE : STAPES_HEAD)).clone();
  base.x += lateralOffset;
  base.y += verticalOffset;
  base.z += anteriorOffset;

  // FLAT/PISTON（TORP/Stapedotomy）は底板真上方向（垂直）を自然方向とする
  const _umboTarget = ['FLAT', 'PISTON'].includes(product.footType) ? UMBO_POS_TORP : UMBO_POS;
  const dir = direction
    ? direction.clone().normalize()
    : new THREE.Vector3().subVectors(_umboTarget, base).normalize();

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

      {/* Shaft – circular cross-section; PISTON type uses Ø0.4mm */}
      {/* 2026-07-23修正: footType==='BELL'の場合のみ、シャフトの描画区間をBell rim(Y=0)起点では
          なくBell apex(Y=BELL_HEIGHT_MM)起点に変更。実物はBellの閉じた頂点からシャフトが立ち
          上がる構造で、rim起点のままだとBellカップ内部とシャフトが重なって描画されていた
          （shojiさん実機確認・BellDebugMarkersで裏付け済み）。base/dir/shaftLength/headOff/
          footOff（Safety Engine・スコア計算が参照する値）は一切変更しない、純粋な描画修正。 */}
      {(() => {
        const r        = product.type === 'PISTON' ? 0.20 : 0.10;
        const isBell   = product.footType === 'BELL';
        const shaftLen = isBell ? Math.max(0.01, len - BELL_HEIGHT_MM) : len;
        const shaftY   = isBell ? BELL_HEIGHT_MM / 2 : 0;
        return (
          <mesh position={[0, shaftY, 0]}>
            <cylinderGeometry args={[r, r, shaftLen, 16]} />
            <TitaniumMat ghost={ghost} />
          </mesh>
        );
      })()}

      {/* Foot */}
      <group position={[0, footOff, 0]}>
        {product.footType === 'BELL'   && <BellFoot   ghost={ghost} />}
        {product.footType === 'FLAT'   && <FlatFoot   ghost={ghost} />}
        {product.footType === 'CLIP'   && <ClipFoot   ghost={ghost} />}
        {product.footType === 'PISTON' && <PistonFoot ghost={ghost} />}
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
  basePos,
}: {
  product:             KurzProduct;
  length:              number;
  headType?:           HeadType;
  idealLateralOffset?: number;
  idealAngle?:         number;
  /** 2026-07-23追加: 呼び出し元(症例)がbasePosを渡さない場合、footType既定値
   *  (STAPES_HEAD/STAPES_FOOTPLATE)にフォールバックする(下のProsthesisModel既定ロジック)。
   *  SimScene.tsxはstapes状態を考慮した実際のbasePosを渡すため、これを省略せず渡すこと。 */
  basePos?:            THREE.Vector3;
}) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      headType={headType}
      basePos={basePos}
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
  SoftClipHead,
  PistonFoot,
};
