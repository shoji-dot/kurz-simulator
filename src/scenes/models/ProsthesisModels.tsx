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

// ================================================================
// SOFT CLIP POCKET (Phase 1, dev preview only — not wired into SoftClipHead)
// ================================================================
// 実装仕様: docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md(v1.2)
// Scope: Pocket区間(入口→最深部)のみ。Shaft/Bridge/Lower Arm/Hook/Terminalは対象外
// (Improvement Spec v1.4 §0-B Phase2/3、Position Evidence未取得のため)。
//
// Pocket-local座標系(Centerline Parameter Definition §3): 原点=Pocket入口基準面
// 中心(Upper Arm先端下面)。+Y=D軸(深さ方向)、+X=W軸(Arm Gap/Pocket Maximum Widthの
// 測定方向)、+Z=N軸(厚み方向、Evidence不足・Reference only、§5.2)。
// Shaft/Global座標系(SoftClipHead等が使うシャフト軸ローカル座標)とは未接続。
// 原点はレビュー目的で仮に(0,0,0)に固定している(Phase2でShaft接続位置[M1/M3]の
// mm絶対値が確定した後に合成する、Improvement Spec §0-B Phase2 Exit条件)。
//
// **本節はSoftClipHead()には組み込まれておらず、既存の臨床シーン描画には一切
// 影響しない(Strangler Pattern、Small Change)。開発用プレビュー([[SoftClipPocketPreview]])
// からのみ参照される。**

/** Pocket Depth(入口→最深部)。Evidence A+(Interpretation v1.7 §1.5)。 */
export const SOFT_CLIP_POCKET_DEPTH_MM = 3.30;
/** Arm Gap(Opening、入口の開口幅)= 幅プロファイルのt=0値。Evidence A+。 */
export const SOFT_CLIP_POCKET_ARM_GAP_MM = 0.75;
/** Pocket Maximum Width(内部空間の最大幅)= 幅プロファイルのt=1値。Evidence A+。
 *  t=1(最深部)で到達するという扱いはEvidence-derived Design Decision
 *  (Centerline Parameter Definition §5.1、新形状の創作ではない)。 */
export const SOFT_CLIP_POCKET_MAX_WIDTH_MM = 1.40;
/** N軸(幅と直交する厚み方向)の参考値。Band Loop断面厚さ(Evidence A)の流用であり、
 *  Pocket自体の実測値ではない(Known Limitation、Centerline Parameter Definition
 *  §5.2)。Reference onlyとして扱い、Pocket自体の測定値として主張しない。 */
export const SOFT_CLIP_POCKET_N_REF_MM = 0.10;

/** Pocket-local座標系でのAnchor Points(t=0=入口、t=1=最深部)。
 *  Centerline Parameter Definition §2/§4に対応。 */
export function getSoftClipPocketAnchorPoints(): THREE.Vector3[] {
  return [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, SOFT_CLIP_POCKET_DEPTH_MM, 0),
  ];
}

/** Centerline(Curve実装方式はCenterline Parameter Definition §4.2で固定:
 *  THREE.CatmullRomCurve3)。t=0→1の2点のみ(将来Phase2/3で中間制御点がEvidenceと
 *  共に追加された場合も同じCurveクラスをそのまま拡張使用する設計)。 */
export function getSoftClipPocketCenterline(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(getSoftClipPocketAnchorPoints(), false);
}

/** 幅プロファイル w(t)(Centerline Parameter Definition §4.1): t=0で0.75mm
 *  (Arm Gap)からt=1で1.40mm(Pocket Maximum Width)へ単調線形増加。
 *  Evidence-derived Design Decision(§5.1)。決定論的(同一入力に対し常に同一出力)。 */
export function getSoftClipPocketWidthAt(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return (
    SOFT_CLIP_POCKET_ARM_GAP_MM +
    (SOFT_CLIP_POCKET_MAX_WIDTH_MM - SOFT_CLIP_POCKET_ARM_GAP_MM) * clamped
  );
}

// ── Commit2: Constant Section Sweep ────────────────────────────────
// 実装依頼: Centerline Parameter Definition v1.4 §4.2(Curve方式固定)・
// v1.4 §5.2(N軸=Ribbon断面、shoji指定2026-08-05)に対応。
//
// 断面は「Ribbon」(N軸=0の数学的平面)。W軸のみEvidence A+(Arm Gap 0.75mm)で
// 定義し、幅プロファイル(§4.1、0.75mm→1.40mm)はCommit3スコープのため本Commitでは
// 適用しない(幅は全区間0.75mm固定)。N軸にBand Loop厚さ(0.10mm、Reference only)を
// 流用しない — Evidence階層の異なる値を混在させないため(shoji指定)。
//
// SOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MM: ExtrudeGeometryが技術的に0厚みの断面を
// 扱えないためだけに存在するレンダリング上の微小値。**Geometry Parameterでは
// ない**(Evidence値でもDesign Decisionでもない、Three.jsの実装上の制約を回避する
// ためだけの値)。将来ExtrudeGeometryが0厚みを扱えることが確認できれば削除してよい。
const SOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MM = 0.001;

/** Commit2用のRibbon断面Shape(W軸のみ、N軸はレンダリング用epsilon)。
 *  widthMmはCommit2では常にSOFT_CLIP_POCKET_ARM_GAP_MM(0.75mm)固定で呼ばれる
 *  (幅プロファイル適用はCommit3、本関数自体はCommit3で再利用可能なようwidthMmを
 *  引数化しておく)。 */
function buildSoftClipPocketRibbonShape(widthMm: number): THREE.Shape {
  const halfW = widthMm / 2;
  const halfN = SOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MM / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfN);
  shape.lineTo(halfW, -halfN);
  shape.lineTo(halfW, halfN);
  shape.lineTo(-halfW, halfN);
  shape.closePath();
  return shape;
}

/** Commit2 Sweep Mesh本体。Centerline(t=0→1の直線、2点のみ)にRibbon断面を
 *  ExtrudeGeometry+extrudePath(Method Decision v1.4 4-4=Option A)で掃引する。
 *  決定論的(同一Anchor Points・同一幅に対し常に同一頂点列、§8.3)。
 *  Centerlineが直線(2点)のため急カーブによるFrenetフレーム破綻(2026-07-02、
 *  SoftClipWing/Bridgeで発生した既知問題)のリスクは低い。 */
export function getSoftClipPocketSweepGeometry(): THREE.ExtrudeGeometry {
  const curve = getSoftClipPocketCenterline();
  const shape = buildSoftClipPocketRibbonShape(SOFT_CLIP_POCKET_ARM_GAP_MM);
  return new THREE.ExtrudeGeometry(shape, {
    steps: 32,
    bevelEnabled: false,
    extrudePath: curve,
  });
}

// ── Commit3b: Variable Width Profile (section interpolation Sweep) ─────────
// 実装依頼: Centerline Parameter Definition v1.5 §4.2(Mesh生成APIの例外規定、
// Freeze解除ではない)・§4.1(幅プロファイルLinear確定)に対応。
//
// ExtrudeGeometry+extrudePathは単一Shapeの掃引にのみ対応し、経路上でのShape寸法
// 変化(テーパー)には対応しない。そのため本Commitでは経路をt刻みでサンプリングし
// (section interpolation)、各tでのRing(4頂点、Commit2と同じRibbon断面)を手動で
// triangulateするLoft手法を用いる。Sweep Geometry concept自体(Centerlineに沿った
// 断面掃引)はCommit2から不変であり、Mesh生成APIのみが異なる(§4.2 v1.5例外規定、
// ExtrudeGeometryの廃止・置換ではない)。getSoftClipPocketSweepGeometry()(Commit2)
// は変更しない。
//
// W_hat/N_hatはCenterlineの接線(Frenetフレーム)に追従させず、Pocket-local座標系
// (§3: +X=W軸、+Z=N軸)に固定する。Centerlineが直線2点(t=0→1)のみのPhase1スコープ
// (§7 Non-goals: 中間制御点は対象外)ではW/N軸の向きは経路上で変化しないため、
// Frenetフレームは不要かつ意図的に使用しない(SoftClipWing/Bridgeで過去発生した
// Frenetフレーム破綻[2026-07-02]のリスクを構造的に排除する設計)。

/** Ring分割数(t=0..1をこのステップ数で刻む)。Commit2のExtrudeGeometry(steps:32)
 *  と視覚的解像度を合わせるための値であり、**Geometry Parameterではない**
 *  (SOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MMと同様、Evidence値でもDesign Decisionでも
 *  ない実装上のtessellation解像度)。 */
const SOFT_CLIP_POCKET_VARIABLE_WIDTH_STEPS = 32;

/** Pocket-local座標系(§3)に固定したW軸・N軸。Centerlineの接線には追従しない
 *  (上記コメント参照)。 */
const SOFT_CLIP_POCKET_W_HAT = new THREE.Vector3(1, 0, 0);
const SOFT_CLIP_POCKET_N_HAT = new THREE.Vector3(0, 0, 1);

/** tにおけるRing(4頂点)をワールド座標で返す。頂点順序はCommit2の
 *  buildSoftClipPocketRibbonShapeと同じ((-W,-N)→(+W,-N)→(+W,+N)→(-W,+N))。
 *  中心位置はCenterline(curve.getPointAt(t))、半幅はgetSoftClipPocketWidthAt(t)/2
 *  (Linear、§4.1・v1.5確定)、半厚みはCommit2と同じSOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MM
 *  (レンダリング用epsilon)を使う。 */
function getSoftClipPocketRingAt(curve: THREE.CatmullRomCurve3, t: number): THREE.Vector3[] {
  const center = curve.getPointAt(t);
  const halfW = getSoftClipPocketWidthAt(t) / 2;
  const halfN = SOFT_CLIP_POCKET_SWEEP_RENDER_EPS_MM / 2;
  const w = SOFT_CLIP_POCKET_W_HAT;
  const n = SOFT_CLIP_POCKET_N_HAT;
  return [
    center.clone().addScaledVector(w, -halfW).addScaledVector(n, -halfN),
    center.clone().addScaledVector(w, halfW).addScaledVector(n, -halfN),
    center.clone().addScaledVector(w, halfW).addScaledVector(n, halfN),
    center.clone().addScaledVector(w, -halfW).addScaledVector(n, halfN),
  ];
}

/** Commit3b Sweep Mesh本体。Ring(t=0..1、SOFT_CLIP_POCKET_VARIABLE_WIDTH_STEPS+1個)を
 *  section interpolationで生成し、側面4辺×区間+両端キャップを手動でtriangulateする。
 *  non-indexed BufferGeometry(頂点非共有)で構築する — Phase1のVariable Width
 *  validationでは面単位(triangleごと)のnormal確認を優先するためであり、indexed化
 *  によるメモリ最適化やsmooth shading対応は本Commitのscopeに含めない(Centerline
 *  Parameter Definition v1.5 §8.2補足、将来scope)。
 *  決定論的(同一Anchor Points・同一幅プロファイルに対し常に同一頂点列を生成、§8.3)。 */
export function getSoftClipPocketVariableWidthSweepGeometry(): THREE.BufferGeometry {
  const curve = getSoftClipPocketCenterline();
  const steps = SOFT_CLIP_POCKET_VARIABLE_WIDTH_STEPS;
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= steps; i++) {
    rings.push(getSoftClipPocketRingAt(curve, i / steps));
  }

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  // 側面: 4辺(v0-v1, v1-v2, v2-v3, v3-v0) × 区間(steps個)
  const edges: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (let i = 0; i < steps; i++) {
    const ringA = rings[i];
    const ringB = rings[i + 1];
    for (const [a, b] of edges) {
      // 巻き順は外向き法線(outward normal)になるよう選択している。決定根拠:
      // Node検証スクリプト(divergence theoremによる符号付き体積計算+directed-edge
      // manifold check)で全260三角形の法線が期待方向とdot>0(退化三角形0、
      // 自己交差なし、開いた境界なし)であることを確認済み(GUIレビュー2026-08-06
      // 指摘を受けての修正)。
      pushTri(ringA[a], ringB[b], ringA[b]);
      pushTri(ringA[a], ringB[a], ringB[b]);
    }
  }

  // 端面キャップ(Commit2のExtrudeGeometry自動キャップと同じく両端を閉じる。
  // §6 Tangent Rule: 最深部は開いた形状ではなく閉じた形状として扱う)。
  const entrance = rings[0];
  pushTri(entrance[0], entrance[1], entrance[2]); // 法線 -D方向(入口側)
  pushTri(entrance[0], entrance[2], entrance[3]);
  const deepest = rings[steps];
  pushTri(deepest[0], deepest[2], deepest[1]); // 法線 +D方向(最深部側)
  pushTri(deepest[0], deepest[3], deepest[2]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ================================================================
// SOFT CLIP BAND LOOP (Hypothesis Geometry, dev preview only — not wired into SoftClipHead)
// ================================================================
// 実装依頼: 「Soft Clip Band Loop — Current Evidence-Based Geometry Implementation Task」
// (2026-08-08、shoji指定)。現行版(v6)出典:
//   docs/Soft_Clip_Centerline_Proposal_v6.json(shoji作成+Claude修正、v5候補ベース)
//   docs/Soft_Clip_Centerline_Proposal_v6_Review.md(self-intersection 4→0確認)
//   docs/Soft_Clip_Centerline_Proposal_v5_candidate_shoji_2026-08-08.json(shoji作成、
//     UpperArm8点構成・RearFlex中央部改善の出典)
//   docs/Soft_Clip_Geometry_Editor_Design_v1.0.md(v1.5、Region/Role/chainOrder定義元)
//   docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md(断面寸法Evidence A+の出典)
//
// **Hypothesis Geometry(Geometry Freeze未実施)**: 以下の制御点座標(Band Loop Editor
// ローカル座標系、z一定平面)はEvidence A/A+ではなくHypothesis(shojiによるEditor上での
// 写真トレース結果)。断面寸法(幅0.25mm/厚さ0.10mm)のみEvidence A+
// (Measurement Record v1.0 §0)。
//
// **座標系(Small Change判断)**: Proposal v3はBand Loop Editor独自のローカル座標系
// (Global/Shaft座標系とは未接続、Editor Design v1.5 §3.1、Coordinate Integration=
// Tier C課題として意図的に未解決)。Pocket Phase1([[getSoftClipPocketSweepGeometry]])と
// 同じ方針で、本Previewも独自ローカル原点のまま描画し、Shaft/Global座標系への統合は
// 行わない(Frozen Coordinate Systemには一切触れない)。
//
// **本節はSoftClipHead()には組み込まれておらず、既存の臨床シーン描画には一切
// 影響しない(Strangler Pattern、Small Change、Pocket Phase1と同じ位置づけ)。
// 開発用プレビュー([[SoftClipBandLoopPreview]])からのみ、?debug=coords限定で参照される。**

/** Band Loop断面: 幅(Evidence A+、Measurement Record v1.0 §0)。 */
export const SOFT_CLIP_BAND_LOOP_WIDTH_MM = 0.25;
/** Band Loop断面: 厚さ(Evidence A+、Measurement Record v1.0 §0)。 */
export const SOFT_CLIP_BAND_LOOP_THICKNESS_MM = 0.10;

interface SoftClipBandLoopControlPoint {
  id: string;
  chainOrder: number;
  position: THREE.Vector3;
}

/** 全27制御点(chainOrder昇順)。系譜: Proposal v3(23点、Small Change導入時)→v4
 *  (lowerArm/start自己交差修正)→v5候補(shoji作成、RearFlex中央部の滑らかさ改善+
 *  UpperArmを4点→8点へ拡張し「2つの山」形状を再現、docs/Soft_Clip_Centerline_
 *  Proposal_v5_candidate_shoji_2026-08-08.json)→**v6(本バージョン、2026-08-08)**。
 *
 *  **v6での変更点(v5候補からの差分、3箇所のみ)**:
 *  1. `upperArm/curve/6`のz: 1.6131370913305092 → 1.9(shoji修正、TransformControls
 *     操作時の意図しないZドラッグと判明。v5候補Reviewで指摘した異常点)。
 *  2. `lowerArm/start`のy: 2.8998480454435365 → 2.6998480454435367(dy=-0.20mm)。
 *  3. `upperArm/curve/0`のy: 3.496894373489493 → 3.6468943734894932(dy=+0.15mm)。
 *  2・3は、v5候補で新規発生していた自己交差2箇所(`rearFlex/curve/3`↔`lowerArm/start`、
 *  `rearFlex/curve/4`↔`upperArm/curve/0`。v5候補ReviewでLevel A判定)を解消するための
 *  最小限の修正(Node検証、production設定 STEPS=400・MIN_GAP=15でself-intersection
 *  4→0を確認)。詳細: docs/Soft_Clip_Centerline_Proposal_v6.json、
 *  docs/Soft_Clip_Centerline_Proposal_v6_Review.md
 *
 *  **upperArm/curve/0..3(旧4点構成)の由来(v5候補で置換済み、参考)**: 元はProposal v3の
 *  Raw値からEditor上でshojiが3点移動平均で平滑化した値だったが、v5候補でRearFlex
 *  curve5-7の滑らかさを基準に8点構成へ全面的に再設計されている(旋回角の符号反転密度が
 *  改善、v5候補Review §4で定量確認)。 */
const SOFT_CLIP_BAND_LOOP_CONTROL_POINTS: SoftClipBandLoopControlPoint[] = [
  { id: 'hook/end',           chainOrder: 0,          position: new THREE.Vector3(0.1414178322984369, 2.1119308493240965, 1.9) },
  { id: 'hook/curve/0',       chainOrder: 1,          position: new THREE.Vector3(0.25439342335153775, 2.170207268380656, 1.9) },
  { id: 'hook/curve/1',       chainOrder: 1.5,        position: new THREE.Vector3(0.37878895982766625, 2.7341334811037137, 1.9) },
  { id: 'hook/start',         chainOrder: 2,          position: new THREE.Vector3(0.2748395034604978, 2.8317050058135287, 1.9) },
  { id: 'pocket/entrance',    chainOrder: 3,          position: new THREE.Vector3(0.13301644205356888, 2.9, 1.9) },
  { id: 'bridge/approach/0',  chainOrder: 4,          position: new THREE.Vector3(-0.06667295800350283, 2.830306266487419, 1.9) },
  { id: 'bridge/end',         chainOrder: 5,          position: new THREE.Vector3(-0.3027957008544402, 2.784901616962019, 1.9084141123734004) },
  { id: 'bridge/departure/0', chainOrder: 6,          position: new THREE.Vector3(-0.5499679785373885, 2.83, 1.9) },
  // lowerArm/start: v6で変更(自己交差解消、上記v6コメント参照)。v5候補位置
  // (y=2.8998480454435365)からy-0.20mm。
  { id: 'lowerArm/start',     chainOrder: 8,          position: new THREE.Vector3(-0.7304564432703485, 2.6998480454435367, 1.9) },
  { id: 'rearFlex/curve/0',   chainOrder: 9,          position: new THREE.Vector3(-1.2656294676966109, 2.5182848414433976, 1.9) },
  { id: 'rearFlex/curve/1',   chainOrder: 10,         position: new THREE.Vector3(-1.4537093187668275, 2.644017062559282, 1.9) },
  { id: 'rearFlex/curve/2',   chainOrder: 10.5,       position: new THREE.Vector3(-1.3595083855254386, 2.826488118093293, 1.9) },
  { id: 'rearFlex/curve/3',   chainOrder: 10.75,      position: new THREE.Vector3(-0.7524819074155867, 3.05727409750886, 1.9) },
  { id: 'pocket/deepest',     chainOrder: 10.875,     position: new THREE.Vector3(-0.6808566589075552, 3.2063648884808638, 1.9) },
  { id: 'rearFlex/curve/4',   chainOrder: 10.9375,    position: new THREE.Vector3(-0.737576409783926, 3.336913400183387, 1.9) },
  { id: 'rearFlex/curve/5',   chainOrder: 10.96875,   position: new THREE.Vector3(-1.2391505749643992, 3.4987160616399406, 1.9) },
  { id: 'rearFlex/curve/6',   chainOrder: 10.984375,  position: new THREE.Vector3(-1.2916650723743408, 3.6735476360556722, 1.9) },
  { id: 'rearFlex/curve/7',   chainOrder: 10.9921875, position: new THREE.Vector3(-1.1601872161349602, 3.7741848469287094, 1.9) },
  // upperArm/curve/0: v6で変更(自己交差解消、上記v6コメント参照)。v5候補位置
  // (y=3.496894373489493)からy+0.15mm。
  { id: 'upperArm/curve/0',   chainOrder: 11,         position: new THREE.Vector3(-0.6774557698425141, 3.6468943734894932, 1.9) },
  { id: 'upperArm/curve/1',   chainOrder: 11.5,       position: new THREE.Vector3(-0.4581844035750978, 3.539531577665855, 1.9) },
  { id: 'upperArm/curve/2',   chainOrder: 11.75,      position: new THREE.Vector3(-0.2477447764436741, 3.5709354833095848, 1.9) },
  { id: 'upperArm/curve/3',   chainOrder: 11.875,     position: new THREE.Vector3(-0.01558487021688204, 3.492690086221288, 1.9) },
  { id: 'upperArm/curve/4',   chainOrder: 11.9375,    position: new THREE.Vector3(0.21585214699099187, 3.4273620816661357, 1.9) },
  { id: 'upperArm/curve/5',   chainOrder: 11.96875,   position: new THREE.Vector3(0.47565999137364756, 3.55527099080158, 1.9) },
  // upperArm/curve/6: z=1.9(shoji修正、上記v6コメント参照)。v5候補のz=1.6131370913305092は
  // TransformControls誤操作によるZドラッグと判明。
  { id: 'upperArm/curve/6',   chainOrder: 11.984375,  position: new THREE.Vector3(0.87305848246888, 3.655845452332891, 1.9) },
  { id: 'upperArm/curve/7',   chainOrder: 11.9921875, position: new THREE.Vector3(1.1462071254305506, 3.5682213449628097, 1.9) },
  { id: 'upperArm/end',       chainOrder: 12,         position: new THREE.Vector3(1.3207478396262586, 3.3455760205743075, 1.9) },
];

/** Centerline(Editor Design v1.5 §3.1と同じくCatmullRomCurve3、closed=false — Hook側/
 *  UpperArm側の両端は自由端であり閉じたループではない一筆書きのChain)。 */
export function getSoftClipBandLoopCenterline(): THREE.CatmullRomCurve3 {
  const points = SOFT_CLIP_BAND_LOOP_CONTROL_POINTS.map((p) => p.position);
  return new THREE.CatmullRomCurve3(points, false);
}

/** Control Point一覧(id等含む、プレビュー表示用)。座標のみ必要な場合は
 *  getSoftClipBandLoopCenterline()を使うこと。 */
export function getSoftClipBandLoopControlPoints(): SoftClipBandLoopControlPoint[] {
  return SOFT_CLIP_BAND_LOOP_CONTROL_POINTS;
}

// ── Ring-loft Sweep(Pocket Commit3bと同じ手法、Frenetフレーム不使用) ──────────
// 全27制御点がz=1.9の平面上にある(平面Curve)ため、Pocketと同じくTubeGeometry/
// extrudePathのFrenetフレーム自動追従(2026-07-02、SoftClipWing/Bridgeで発生した既知の
// 破綻問題)は使わない。固定の平面法線(N軸、厚み方向)と、その法線に対する各tでの接線の
// 外積(W軸、幅方向)を都度計算する明示的フレームを使う。z軸は接線と常に非平行
// (接線もこの平面内にあるため、cross(N,T)が退化しない)であり、Frenetフレーム特有の
// 急カーブでの反転は構造的に発生しない(Pocket Commit3bのW_HAT/N_HAT固定方式を、
// 大きく方向転換するBand Loop全体に一般化: 固定軸ではなく「固定N軸+可変W軸」)。
const SOFT_CLIP_BAND_LOOP_PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

/** Ring分割数。SOFT_CLIP_POCKET_VARIABLE_WIDTH_STEPSと同様、視覚解像度のための値であり
 *  Geometry Parameterではない。全長7.6mm・急カーブ複数(Hook/RearFlex折り返し)を
 *  考慮しPocketの32より高い分割数を使用。 */
const SOFT_CLIP_BAND_LOOP_STEPS = 400;

/** tにおけるRing(4頂点)をワールド座標で返す。頂点順序はPocketと同じ
 *  ((-W,-N)→(+W,-N)→(+W,+N)→(-W,+N))。 */
function getSoftClipBandLoopRingAt(curve: THREE.CatmullRomCurve3, t: number): THREE.Vector3[] {
  const center = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).clone().normalize();
  const nHat = SOFT_CLIP_BAND_LOOP_PLANE_NORMAL;
  const wHat = new THREE.Vector3().crossVectors(nHat, tangent);
  if (wHat.lengthSq() < 1e-8) {
    // 接線がN軸と平行になる場合のフォールバック(平面Curveでは理論上発生しないはずだが、
    // 数値誤差での縮退に備える防御的処理)。
    wHat.set(1, 0, 0);
  } else {
    wHat.normalize();
  }
  const halfW = SOFT_CLIP_BAND_LOOP_WIDTH_MM / 2;
  const halfN = SOFT_CLIP_BAND_LOOP_THICKNESS_MM / 2;
  return [
    center.clone().addScaledVector(wHat, -halfW).addScaledVector(nHat, -halfN),
    center.clone().addScaledVector(wHat, halfW).addScaledVector(nHat, -halfN),
    center.clone().addScaledVector(wHat, halfW).addScaledVector(nHat, halfN),
    center.clone().addScaledVector(wHat, -halfW).addScaledVector(nHat, halfN),
  ];
}

/** Band Loop Sweep Mesh本体。Hook〜UpperArmの一筆書きChainにRing-loftでBand断面
 *  (幅0.25mm×厚さ0.10mm、Evidence A+)を掃引する。非indexed BufferGeometry
 *  (Pocket Commit3bと同じ方式)。両端(hook/end・upperArm/end)は自由端だが、
 *  Geometryとしては閉じた形状として端面キャップを付ける(Pocket Commit3bと同じ扱い)。
 *
 *  **更新履歴(自己交差解消)**:
 *  - v4(2026-08-08): `lowerArm/start`↔`rearFlex/curve/3`付近の自己交差2箇所を
 *    `lowerArm/start`のy-0.16mm調整で解消(23点構成、旧UpperArm4点時代)。
 *  - v6(2026-08-08): v5候補(UpperArm8点構成への拡張)で新規発生していた自己交差
 *    2箇所(`rearFlex/curve/3`↔`lowerArm/start`系統の再発、`rearFlex/curve/4`↔
 *    `upperArm/curve/0`)を、`lowerArm/start`のy-0.20mm・`upperArm/curve/0`のy+0.15mm
 *    調整で解消。Node検証(production設定 STEPS=400・MIN_GAP=15)でself-intersection
 *    4→0、NaN=0、退化フレーム=0を確認済み。詳細: docs/Soft_Clip_Centerline_Proposal_v6_Review.md */
export function getSoftClipBandLoopSweepGeometry(): THREE.BufferGeometry {
  const curve = getSoftClipBandLoopCenterline();
  const steps = SOFT_CLIP_BAND_LOOP_STEPS;
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= steps; i++) {
    rings.push(getSoftClipBandLoopRingAt(curve, i / steps));
  }

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const edges: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (let i = 0; i < steps; i++) {
    const ringA = rings[i];
    const ringB = rings[i + 1];
    for (const [a, b] of edges) {
      pushTri(ringA[a], ringB[b], ringA[b]);
      pushTri(ringA[a], ringB[a], ringB[b]);
    }
  }

  // 端面キャップ(Pocket Commit3bと同じ、両端を閉じた形状として扱う)。
  const startRing = rings[0];
  pushTri(startRing[0], startRing[1], startRing[2]);
  pushTri(startRing[0], startRing[2], startRing[3]);
  const endRing = rings[steps];
  pushTri(endRing[0], endRing[2], endRing[1]);
  pushTri(endRing[0], endRing[3], endRing[2]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Soft Clip Band Loop(Hypothesis Geometry)開発用プレビュー。既存の臨床シーン描画には
 *  一切影響しない(SoftClipPocketPreviewと同じくSimSceneの?debug=coords限定表示から
 *  のみ参照)。Centerline・Control Points・Sweep Meshを表示する。 */
function SoftClipBandLoopPreview({
  showCenterline = true,
  showControlPoints = true,
  showSweepMesh = true,
}: {
  showCenterline?: boolean;
  showControlPoints?: boolean;
  showSweepMesh?: boolean;
}) {
  const { centerlineObject, controlPoints } = useMemo(() => {
    const curve = getSoftClipBandLoopCenterline();
    const samples = curve.getPoints(400);
    const geo = new THREE.BufferGeometry().setFromPoints(samples);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffcc00' }));
    return {
      centerlineObject: line,
      controlPoints: getSoftClipBandLoopControlPoints(),
    };
  }, []);

  const sweepGeo = useMemo(() => getSoftClipBandLoopSweepGeometry(), []);

  return (
    <group name="SoftClipBandLoopPreview">
      {showCenterline && <primitive object={centerlineObject} />}
      {showControlPoints &&
        controlPoints.map((p) => (
          <mesh key={p.id} position={p.position}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={p.id === 'hook/end' || p.id === 'upperArm/end' ? '#00ff00' : '#ff3333'} />
          </mesh>
        ))}
      {showSweepMesh && (
        <mesh geometry={sweepGeo}>
          <TitaniumMatDS />
        </mesh>
      )}
    </group>
  );
}

/** Soft Clip Pocket(Phase1)開発用プレビュー。GUIレビュー項目(Centerline Parameter
 *  Definition §8.1)に対応する表示トグルを個別に受け取る。
 *  Commit1(Centerline Construction): Centerline/Control Points。
 *  Commit2(Constant Section Sweep): Sweep Mesh(幅0.75mm固定・幅プロファイル未適用・
 *  Ribbon断面)。
 *  Commit3b(Variable Width Profile): Variable Width Sweep Mesh(本Commitで追加、
 *  section interpolation・幅0.75mm→1.40mm Linear)。Commit2のSweep Meshとは別トグル
 *  で、マテリアル色を変えて重ねて比較表示する(色分けはGeometry比較レビュー用の
 *  debug visualizationであり、Geometry ParameterでもUI Design Decisionでもない、
 *  §8.1 v1.5追記)。
 *  **開発用。既存の症例シーン(SoftClipHead経由の描画)には一切影響しない。** */
function SoftClipPocketPreview({
  showCenterline = true,
  showControlPoints = true,
  showSweepMesh = true,
  showVariableWidthSweep = true,
}: {
  showCenterline?: boolean;
  showControlPoints?: boolean;
  showSweepMesh?: boolean;
  showVariableWidthSweep?: boolean;
}) {
  const { centerlineObject, anchorPoints } = useMemo(() => {
    const curve = getSoftClipPocketCenterline();
    const samples = curve.getPoints(32);
    const geo = new THREE.BufferGeometry().setFromPoints(samples);
    // THREE.Line(geometry, material)を直接構築し<primitive>で描画する。
    // JSX <line>イントリンシックはTypeScriptのDOM/SVG型定義と衝突するリスクが
    // あるため、既存コード(RealAnatomyModels.tsxのTHREE.LineSegments+<primitive>
    // パターン)に合わせて回避する。
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffcc00' }));
    return {
      centerlineObject: line,
      anchorPoints: getSoftClipPocketAnchorPoints(),
    };
  }, []);

  const sweepGeo = useMemo(() => getSoftClipPocketSweepGeometry(), []);
  const variableWidthSweepGeo = useMemo(() => getSoftClipPocketVariableWidthSweepGeometry(), []);

  return (
    <group name="SoftClipPocketPreview">
      {showCenterline && <primitive object={centerlineObject} />}
      {showControlPoints &&
        anchorPoints.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={i === 0 ? '#00ff00' : '#ff3333'} />
          </mesh>
        ))}
      {showSweepMesh && (
        <mesh geometry={sweepGeo}>
          {/* debug visualization用の識別色。Geometry ParameterでもUI Design
              Decisionでもない(Centerline Parameter Definition §8.1 v1.5追記)。 */}
          <meshBasicMaterial color="#33aaff" side={THREE.DoubleSide} wireframe />
        </mesh>
      )}
      {showVariableWidthSweep && (
        <mesh geometry={variableWidthSweepGeo}>
          {/* debug visualization用の識別色(Commit2と区別するための配色のみ)。
              Geometry ParameterでもUI Design Decisionでもない(§8.1 v1.5追記)。 */}
          <meshBasicMaterial color="#ffaa33" side={THREE.DoubleSide} wireframe />
        </mesh>
      )}
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

/**
 * Bell Rim（開口部）の半径（スケール後、mm）。実測1.59mm(dia) × スケール係数0.7395 / 2 = 0.795mm。
 * BellFoot()内のローカル定数だったが、Step14（Bell境界ランドマーク測定、LandmarkMeasurements.md）の
 * P1-2デバッグ表示（BellDirectionCandidates、SimScene.tsx）から参照するためexportに昇格。
 * 数値自体は変更していない（挙動変更なし、単一情報源化のみ）。2026-07-23。
 */
export const BELL_RIM_RADIUS_MM = 0.795;

function BellFoot({ ghost }: { ghost?: boolean }) {
  // ── Parameters scaled to 1/20 from 20× physical model ───────
  // 20× model: bottom dia 31.8 mm → 1/20 = 1.59 mm (dia), R = 0.795
  // Scale factor: 0.795 / 1.075 = 0.7395  (applied uniformly to all dims)
  const BELL_H     = BELL_HEIGHT_MM;   // total bell height   (1.48 × 0.7395)
  const RIM_R      = BELL_RIM_RADIUS_MM;   // outer radius at rim (dia 1.59 mm, from 20x model)
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
//
//   Phase G3-2改訂(2026-07-30、Evidence A+): 20倍模型ノギス実測に基づく寸法更新。
//   詳細出典: docs/TORP_SoftClip_Geometry_Audit_v1.0.md §1.1(開口部寸法)、
//   docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md(仕様・shoji決定)。
//
//   【v7(最終、shoji GUI指摘によりv6の残存バグを修正)】v6の問題:
//   v6は天井を「外周(0.395)→内周(0.295)の輪(annulus)」として閉じていたため、
//   半径0.295の同心円状の穴が天井中心に残ったままだった(壁厚0.10mmぶんの細い
//   リングしか塞がっていない)。shoji実機確認: 「天井が抜けている」「断面はコの字型
//   (外壁→天井で完全に閉じる、内壁は存在しない)で下面が解放されているのが正解」。
//   さらに、天井中心の穴からProsthesisModel()側のシャフトがFoot中心(Anchor)まで
//   突き抜けて見える副作用も指摘された。
//
//   修正方針: Profileを3点(外壁下端→外壁上端→中心r=0)に単純化。半径0が
//   THREE.LatheGeometryの仕様上、全ての分割角度が1点に収束するため天井が自動的に
//   完全な円盤(穴なし)として閉じる。内壁は作らない(壁厚0.10mmの表現は廃止、
//   コの字型カップとして単一の連続Profileで表現)。底面はProfileの始点(外壁下端)を
//   中心へ戻さないことで開口のまま維持する。
//
//   実測値(実寸、÷20換算後、Evidence A+):
//     全高          : 0.80 mm
//     開口部(底面)外径 : 0.395 mm
//
//   Reference Coordinate(G3-1 §4決定、案A): Anchor(=STAPES_FOOTPLATE)はFoot groupの
//   ローカル原点(0,0,0)のまま変更しない。「Anchor=foot中央」を維持するため、メッシュは
//   現状踏襲で原点を中心に対称配置する(開口部 y=-0.40 〜 天井 y=+0.40)。
//   FLAT_CEILING_Y_MM(=0.40)はこの天井のy座標で、ProsthesisModel()のシャフト
//   短縮計算(BellFoot向けBELL_HEIGHT_MMと同じパターン)から参照する。
// ================================================================
/**
 * FlatFoot天井のローカルY座標(mm)。FlatFoot()のローカル原点(0,0,0、Anchor=
 * STAPES_FOOTPLATE)を基準に、天井は+0.40、開口部(底面)は-0.40。
 * v7でシャフトがFoot内部(Anchor)まで突き抜けていた不具合の修正で、
 * ProsthesisModel()のシャフト短縮計算(isFlat分岐)から参照するため
 * ローカル定数からexportに昇格。BELL_HEIGHT_MM/BELL_RIM_RADIUS_MMと同じ理由・パターン。
 */
export const FLAT_CEILING_Y_MM = 0.40;

function FlatFoot({ ghost }: { ghost?: boolean }) {
  // 単一の連続Profile(一筆書き): 外壁(下端の開口→上端)→天井中心(r=0、完全に閉じる)。
  // 内壁は作らない(v6の「壁厚0.10mmの輪」が天井中心に穴を残していた反省)。
  // 底面(y=-0.40)は中心へ戻さないため自然に開口したまま。コの字型カップ形状。
  const shellProfile = useMemo<THREE.Vector2[]>(() => [
    new THREE.Vector2(0.395, -FLAT_CEILING_Y_MM),  // 外壁の下端(開口部外径、Evidence A+)
    new THREE.Vector2(0.395,  FLAT_CEILING_Y_MM),  // 外壁の上端
    new THREE.Vector2(0,      FLAT_CEILING_Y_MM),  // 天井中心(r=0で完全な円盤として閉じる)
    // ここで終わり = 底面は開口のまま(中心へ戻すポリラインを追加しない)
  ], []);

  const shellGeo = useMemo(() => new THREE.LatheGeometry(shellProfile, 24), [shellProfile]);

  return (
    <group>
      <mesh geometry={shellGeo}>
        <TitaniumMatDS ghost={ghost} />
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
//
//   G3-3 Phase 1(2026-07-30、`docs/Soft_Clip_Geometry_Audit_v1.0.md` §3.2で新規発見・
//   shoji承認済み): `collar`(cylinderGeometry、半径0.20mm)はローカルy=[0, 0.20]に位置する。
//   従来`ProsthesisModel()`のシャフト計算にPISTON用の短縮分岐が無く、シャフト
//   (PISTON時も半径0.20mm)がFoot group原点(ローカルy=0、collar下端と一致)まで伸びていた
//   ため、シャフトとcollarが局所y=[0, 0.20]の区間で同一半径・同軸のまま完全に重複していた
//   (Bell:2026-07-23、Flat:v7で対応済みと同一パターン)。`PISTON_COLLAR_TOP_Y_MM`は
//   collar上端のローカルY座標で、`ProsthesisModel()`のシャフト短縮計算(BELL_HEIGHT_MM/
//   FLAT_CEILING_Y_MMと同じパターン)から参照するためexportする。
// ================================================================
/**
 * PistonFoot collar上端のローカルY座標(mm)。PistonFoot()のローカル原点(0,0,0、Anchor=
 * STAPES_FOOTPLATE)を基準に、collar(cylinderGeometry、半径0.20mm)はローカルy=[0, 0.20]。
 * G3-3 Phase 1でシャフトがcollar内部まで重複していた不具合の修正で、
 * ProsthesisModel()のシャフト短縮計算(isPiston分岐)から参照するためローカル定数から
 * exportに昇格。BELL_HEIGHT_MM/FLAT_CEILING_Y_MMと同じ理由・パターン。
 */
export const PISTON_COLLAR_TOP_Y_MM = 0.20;

/**
 * Shaft Lower(Band Loopから見て最も遠い側の固定長区間)の長さ・半径(mm、実寸)。
 * Evidence A+(`Soft_Clip_Component_Tree_v1.0.md` v1.2、20倍模型実測43.4mm/8mm径
 * →実寸2.17mm/径0.40mm)。PistonFoot collar上端(PISTON_COLLAR_TOP_Y_MM)に隣接する
 * 固定長区間。G3-3 Priority2 Tier A(2026-08-07)でProsthesisModel()のシャフト描画
 * から参照するためexportする。BELL_HEIGHT_MM/FLAT_CEILING_Y_MM/PISTON_COLLAR_TOP_Y_MM
 * と同じ理由・パターン。
 */
export const SOFT_CLIP_SHAFT_LOWER_LEN_MM = 2.17;
export const SOFT_CLIP_SHAFT_LOWER_R_MM   = 0.20;

/**
 * Shaft Middle(製品の8種類の長さラインナップに対応し長さのみ変化する区間)の半径
 * (mm、実寸)。Evidence A+(`Soft_Clip_Component_Tree_v1.0.md` v1.2、20倍模型実測
 * 26.6mm/4.0mm径→実寸1.33mm/径0.20mm)。長さはshaftLength依存
 * (len - PISTON_COLLAR_TOP_Y_MM - SOFT_CLIP_SHAFT_LOWER_LEN_MM)のためexportしない。
 */
export const SOFT_CLIP_SHAFT_MIDDLE_R_MM  = 0.10;

function PistonFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* Rounded hemisphere tip (enters oval window fenestration) */}
      <mesh>
        <sphereGeometry args={[0.20, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Short cylindrical collar above the tip */}
      <mesh position={[0, PISTON_COLLAR_TOP_Y_MM / 2, 0]}>
        <cylinderGeometry args={[0.20, 0.20, PISTON_COLLAR_TOP_Y_MM, 12]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ================================================================
// Current Axis Alignment Pose（PoseModelBaseline.md §4で命名された現行姿勢生成方式）
// ================================================================
/**
 * ProsthesisModel/CartilageSliceが共有する現行のPose生成ロジック。P4B-3 Acceptance Criteria
 * #1「ProsthesisModelとCartilageSliceは同一Poseモデルを使用すること」・#3「Shadow比較は
 * ProsthesisModel本体の実出力を基準とすること」に対応するため、ProsthesisModel内に元々
 * インライン実装されていた計算をこの関数へ抽出した（数式は一切変更していない）。
 *
 * 【検証】ProsthesisModelは元々`rotation={[euler.x+tiltX, euler.y, euler.z+tiltZ]}`という
 * Eulerタプルを<group>へ渡していた。本関数はこれと数学的に同一の最終回転を
 * `quaternion=setFromEuler(new THREE.Euler(..., 'XYZ'))`として返す。Node実行で200件の
 * ランダム入力（base/target/tilt角）について両アプローチの最終quaternionの角度差を検証し、
 * 最大差 3.4e-6°（浮動小数点誤差レベル、実質ゼロ）であることを確認済み（2026-07-28）。
 */
export interface CurrentAxisAlignmentOrientationInput {
  base:         THREE.Vector3;
  target:       THREE.Vector3;
  direction?:   THREE.Vector3;
  angleTilt?:   number;
  angleTiltZ?:  number;
}

export interface CurrentAxisAlignmentOrientation {
  /** base→target方向（direction指定時はそれを正規化した値）。位置計算（base + k*dir）は
   *  用途ごとに異なる（ProsthesisModelはシャフト中点、CartilageSliceはヘッドプレート上方の
   *  オフセット位置）ため、本関数は位置を決め打ちしない。 */
  dir:        THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * PoseModelBaseline.md §4で「CurrentAxisAlignmentModel」と命名された現行姿勢生成方式のうち、
 * 回転（quaternion）部分のみを担う下位関数。ProsthesisModel/CartilageSliceが独立実装していた
 * `dir=normalize(target-base)` → `setFromUnitVectors(Y,dir)` → tilt加算ロジックを共通化する
 * （P4B-3 Acceptance Criteria #1）。位置(position)はcaller側で組み立てる。
 */
export function computeCurrentAxisAlignmentOrientation({
  base,
  target,
  direction,
  angleTilt  = 0,
  angleTiltZ = 0,
}: CurrentAxisAlignmentOrientationInput): CurrentAxisAlignmentOrientation {
  const dir = direction
    ? direction.clone().normalize()
    : new THREE.Vector3().subVectors(target, base).normalize();

  const quat0  = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler0 = new THREE.Euler().setFromQuaternion(quat0);

  const tiltXRad = (angleTilt  * Math.PI) / 180;
  const tiltZRad = (angleTiltZ * Math.PI) / 180;

  const finalEuler = new THREE.Euler(euler0.x + tiltXRad, euler0.y, euler0.z + tiltZRad, 'XYZ');
  const quaternion  = new THREE.Quaternion().setFromEuler(finalEuler);

  return { dir, quaternion };
}

export interface CurrentAxisAlignmentPoseInput {
  base:         THREE.Vector3;
  target:       THREE.Vector3;
  shaftLength:  number;
  direction?:   THREE.Vector3;
  angleTilt?:   number;
  angleTiltZ?:  number;
}

export interface CurrentAxisAlignmentPose {
  position:   THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/** ProsthesisModel用の便宜ラッパー。位置＝シャフト中点（base〜(base+shaftLength*dir)の中点）。 */
export function computeCurrentAxisAlignmentPose({
  base,
  target,
  shaftLength,
  direction,
  angleTilt  = 0,
  angleTiltZ = 0,
}: CurrentAxisAlignmentPoseInput): CurrentAxisAlignmentPose {
  const { dir, quaternion } = computeCurrentAxisAlignmentOrientation({ base, target, direction, angleTilt, angleTiltZ });

  const top = base.clone().addScaledVector(dir, shaftLength);
  const mid = base.clone().add(top).multiplyScalar(0.5);

  return { position: mid, quaternion };
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
  /**
   * P4B-3 Step5（Feature Flag）: 指定時、computeProsthesisModelPose()の代わりにこの
   * position/quaternionをそのまま使う。CartilageSlice側の同名propと同時に切り替えることで
   * 「片方だけNEW」という中間状態を防ぐ（[[docs/P4B-3_Acceptance_Criteria_v1.0.md]] Criteria#2）。
   * 未指定時は従来通りcomputeProsthesisModelPose()を使う（Flag OFF＝既存動作は完全無変更）。
   */
  poseOverride?:    { position: THREE.Vector3; quaternion: THREE.Quaternion };
}

/**
 * P4B-3 Step4: ProsthesisModelが実際に描画へ使うPoseを、コンポーネント外からも取得できる形で
 * 公開する（Acceptance Criteria #3「Shadow比較は本番実出力を基準とする」対応）。
 * ProsthesisModel本体はこの関数を呼ぶだけになり、SimScene.tsx側のShadow比較も同じ関数・
 * 同じ入力を渡して呼べば、bit-for-bit同一の値を得られる（再実装ではなく単一の呼び出し元）。
 * ghost（IdealGhostProsthesis用の見た目調整）は姿勢計算に影響しないため引数に含めない。
 */
export function computeProsthesisModelPose({
  product,
  shaftLength,
  basePos,
  direction,
  lateralOffset  = 0,
  anteriorOffset = 0,
  verticalOffset = 0,
  angleTilt      = 0,
  angleTiltZ     = 0,
}: Omit<ProsthesisProps, 'headType' | 'ghost'>): CurrentAxisAlignmentPose {
  const base = (basePos ?? (['FLAT', 'PISTON'].includes(product.footType) ? STAPES_FOOTPLATE : STAPES_HEAD)).clone();
  base.x += lateralOffset;
  base.y += verticalOffset;
  base.z += anteriorOffset;

  // FLAT/PISTON（TORP/Stapedotomy）は底板真上方向（垂直）を自然方向とする
  const target = ['FLAT', 'PISTON'].includes(product.footType) ? UMBO_POS_TORP : UMBO_POS;

  return computeCurrentAxisAlignmentPose({ base, target, shaftLength, direction, angleTilt, angleTiltZ });
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
  poseOverride,
}: ProsthesisProps) {

  // P4B-3: 姿勢計算はcomputeProsthesisModelPose()へ委譲（数式は無変更、抽出のみ）。
  // P4B-3 Step5: poseOverride指定時はこちらを優先する（Feature Flag ON時、Candidate Poseを
  // 直接使う。??演算子のため未指定時はcomputeProsthesisModelPose()のみ評価される）。
  const pose = poseOverride ?? computeProsthesisModelPose({
    product, shaftLength, basePos, direction,
    lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ,
  });
  const mid = pose.position;
  const len = shaftLength;

  const headOff  = len / 2 + 0.15;
  const footOff  = -(len / 2);

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      quaternion={pose.quaternion}
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
          footOff（Safety Engine・スコア計算が参照する値）は一切変更しない、純粋な描画修正。
          2026-07-30追加: footType==='FLAT'の場合も同じパターンでシャフトをFlatFoot天井
          (Y=FLAT_CEILING_Y_MM)止まりに短縮。従来はfootOff（=FlatFootのローカル原点=Anchor=
          Foot中央）まで伸びていたため、v7で天井の穴を塞いだ結果、シャフトが天井を突き抜けて
          Foot内部（中空カップの中心）まで侵入して見える不具合をshojiさんが指摘
          （FLATFOOTの内部にシャフトは存在しない）。base/dir/shaftLength/headOff/footOff
          は一切変更しない、純粋な描画修正。
          2026-07-30追加(G3-3 Phase 1): footType==='PISTON'の場合も同じパターンでシャフトを
          PistonFoot collar上端(Y=PISTON_COLLAR_TOP_Y_MM)止まりに短縮。従来footOff（=
          PistonFootのローカル原点=Anchor）まで伸びていたため、collar（半径0.20mm、局所
          y=[0, 0.20]）とシャフト（PISTON時も半径0.20mm）が同一半径・同軸のまま完全に重複
          していた不具合（`docs/Soft_Clip_Geometry_Audit_v1.0.md` §3.2で新規発見、shoji承認
          済み）を修正。SoftClipHead/Wing/Bridge/Stem・base/dir/shaftLength/headOff/footOff
          は一切変更しない、純粋な描画修正。 */}
      {(() => {
        const r        = product.type === 'PISTON' ? 0.20 : 0.10;
        const isBell   = product.footType === 'BELL';
        const isFlat   = product.footType === 'FLAT';
        const isPiston = product.footType === 'PISTON';

        // G3-3 Priority2 Tier A(2026-08-07、`Soft_Clip_Component_Tree_v1.0.md` v1.2、
        // Evidence A+反映): PISTON(Soft Clip)のシャフトはShaft Lower(固定長2.17mm・
        // 半径0.20mm)とShaft Middle(可変長・半径0.10mm)の2段円柱で構成される。従来は
        // 全長を一律半径0.20mmの単一円柱で描画しておりShaft Middle区間の半径が誤って
        // いた(Component Tree §4で既出の発見)。base/dir/shaftLength/headOff/footOff
        // (Safety Engine・Pose Solver参照値)は一切変更しない、純粋な描画修正。
        // BELL/FLAT/その他のfootTypeの描画・寸法は無変更。
        if (isPiston) {
          const lowerLen  = SOFT_CLIP_SHAFT_LOWER_LEN_MM;
          const lowerR    = SOFT_CLIP_SHAFT_LOWER_R_MM;
          const middleR   = SOFT_CLIP_SHAFT_MIDDLE_R_MM;
          const middleLen = Math.max(0.01, len - PISTON_COLLAR_TOP_Y_MM - lowerLen);
          // bottomY: collar上端(footOff + PISTON_COLLAR_TOP_Y_MM)と同一。旧実装の
          // shaftY=PISTON_COLLAR_TOP_Y_MM/2・shaftLen=len-PISTON_COLLAR_TOP_Y_MMから
          // 導かれる下端(0.20 - len/2)と数式的に一致し、上端(len/2)も不変。
          const bottomY   = -(len / 2) + PISTON_COLLAR_TOP_Y_MM;
          const lowerY    = bottomY + lowerLen / 2;
          const middleY   = bottomY + lowerLen + middleLen / 2;
          return (
            <>
              <mesh position={[0, lowerY, 0]}>
                <cylinderGeometry args={[lowerR, lowerR, lowerLen, 16]} />
                <TitaniumMat ghost={ghost} />
              </mesh>
              <mesh position={[0, middleY, 0]}>
                <cylinderGeometry args={[middleR, middleR, middleLen, 16]} />
                <TitaniumMat ghost={ghost} />
              </mesh>
            </>
          );
        }

        const shaftLen = isBell ? Math.max(0.01, len - BELL_HEIGHT_MM)
                        : isFlat ? Math.max(0.01, len - FLAT_CEILING_Y_MM)
                        : len;
        const shaftY   = isBell ? BELL_HEIGHT_MM / 2
                        : isFlat ? FLAT_CEILING_Y_MM / 2
                        : 0;
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
  // Soft Clip Pocket (Phase1 dev preview, docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md)
  SoftClipPocketPreview,
  // Soft Clip Band Loop (Hypothesis Geometry dev preview, docs/Soft_Clip_Centerline_Proposal_v6.json)
  SoftClipBandLoopPreview,
};
