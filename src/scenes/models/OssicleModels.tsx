/**
 * OssicleModels.tsx  ── 解剖学的耳小骨モデル（完全版）
 *
 * ▼ 座標系（1 unit = 1 mm）
 *   Origin: 鼓室中央（おおよそ）
 *   Z+  : 外耳道方向（カメラ・術者側）
 *   Y+  : 上方
 *   X+  : 前方
 *
 * ▼ 重要ランドマーク（OpenEar ALPHA 実測値 2026-06-20、アブミ骨頭・臍部は2026-07-22実測補正）
 *   鼓膜中心   : [0, 2.0,  5.0]  （未検証のまま、参考値）
 *   臍部(umbo) : [-3.236, 1.0663, 2.3439]  ← Malleus.glb manubrium先端の実測ベース
 *     （2026-07-22: Interactive Landmark Tool実測、Reviewer: Shoji。旧値[0,0,5.0]は
 *      STAPES_HEADと同じ旧OpenEar解析バッチ由来の未検証値だったため廃止。
 *      詳細はLandmarkMeasurements.md参照）
 *   ツチ骨頭   : [0.0, 3.6, 4.2]  （未検証のまま、参考値）
 *   キヌタ骨体 : [-0.8, 2.2, 3.8] （未検証のまま、参考値）
 *   アブミ骨頭 : [-0.7249, -0.0273, 3.5259]  ← PORP シャフト下端
 *     （2026-07-22: Interactive Landmark Tool実測PORP_CONTACT_POINTベースに補正。
 *      旧値[0.84,-2.65,4.86]は「footplateがGLBローカル原点にある」という誤った前提に
 *      基づく粗い推定値だったため廃止。詳細はLandmarkMeasurements.md参照）
 *   アブミ骨底板: [0.84, -2.65, 2.12] ← TORP シャフト下端（実測未反映、据え置き）
 *
 * ▼ プロステーシス長の意味（3D 実測値、寸法自体は製品カタログ値=selectedLengthで別管理）
 *   PORP シャフト長（新アブミ骨頭・新臍部間の実測距離） = |臍部 − アブミ骨頭| → 2.98 mm（参考値）
 *   TORP シャフト長 = |臍部 − 底板|  → 4.00 mm（無変更、UMBO_POS_TORPは合成点のため影響なし）
 *   ※ 耳小骨連鎖の走行方向は臍部実測により変化。要目視確認。
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { OssicleStatus, StapesStatus } from '../../data/cases';

// ── 色定数 ──────────────────────────────────────────────────────────
const BONE      = '#d4b896';
const BONE_DARK = '#b88d5a';
const MEM_COLOR = '#e8d090';

// ══════════════════════════════════════════════════════════════════
// ラベルコンポーネント
// ══════════════════════════════════════════════════════════════════
interface LabelProps { position: [number, number, number]; text: string }
function Label({ position, text }: LabelProps) {
  return (
    <Html position={position} center distanceFactor={20} zIndexRange={[0, 10]}>
      <div style={{
        background: 'rgba(0,20,40,.88)',
        border: '1px solid #00b4d8',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 10,
        color: '#d0eeff',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        fontFamily: 'sans-serif',
      }}>{text}</div>
    </Html>
  );
}

// ══════════════════════════════════════════════════════════════════
// ユーティリティ: 2点間チューブ
// ══════════════════════════════════════════════════════════════════
function Tube({
  from, to, r, color, opacity = 1,
}: {
  from: THREE.Vector3; to: THREE.Vector3;
  r: number; color: string; opacity?: number;
}) {
  const dir  = new THREE.Vector3().subVectors(to, from);
  const len  = dir.length();
  if (len < 0.01) return null;
  const mid  = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <mesh position={[mid.x, mid.y, mid.z]} rotation={[euler.x, euler.y, euler.z]}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial color={color} roughness={0.4} transparent opacity={opacity} />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 鼓膜 (Tympanic Membrane)
//
// 実際の鼓膜は平面ではなく浅いコーン状（内側に凸）。
// 臍部（umbo）が最も内側（Z-方向）に約 1.2mm 凹んでいる。
//
// 実装: 大半径球体の球冠（spherical cap）を使用
//   大球半径 R = 17mm, 球冠角度 θ ≈ 0.27 rad
//   → 冠の円弧半径 ≈ 4.5mm, 深さ ≈ 1.2mm
//
// 中心（線維輪中心）: [0, 2.0, 5.0]
// 臍部: [0, 0.0, 4.0]（中心より 2mm 下, 1mm 奥）
// ══════════════════════════════════════════════════════════════════
export function TympanicMembrane({ opacity = 0.55 }: { opacity?: number }) {
  const coneGeo = useMemo(() => {
    // 球冠ジオメトリ: R=17, 角度 0→0.27rad = 外縁半径 4.5mm
    const R = 17;
    const theta = 0.27;           // ≈ 15.5°
    const geo = new THREE.SphereGeometry(R, 40, 14, 0, Math.PI * 2, 0, theta);
    // 球の頂点（極）を原点にシフト → 中央が最も内側
    geo.translate(0, 0, -R);
    // Z は [−depth, 0]。外周が Z=0、中央（臍部）が Z=-depth
    // Y 方向にオフセット: 中心は umbo より 2mm 上
    geo.rotateX(-Math.PI / 2); // 球極が -Y 方向 → -Z 方向へ
    return geo;
  }, []);

  return (
    <group position={[0, 2.0, 5.0]}>
      {/* 鼓膜本体（コーン形状）*/}
      <mesh geometry={coneGeo}>
        <meshStandardMaterial
          color={MEM_COLOR}
          transparent opacity={opacity}
          side={THREE.DoubleSide}
          roughness={0.65}
        />
      </mesh>

      {/* 鼓膜輪（Fibrous annulus / Tympanic ring）*/}
      <mesh>
        <ringGeometry args={[4.0, 4.7, 48]} />
        <meshStandardMaterial color="#9a7228" roughness={0.5} />
      </mesh>

      {/* 光錘（Light reflex）: 前下方の三角形ハイライト */}
      <mesh position={[1.2, -1.5, 0.06]} rotation={[0, 0, -0.4]}>
        <circleGeometry args={[0.7, 3]} />
        <meshStandardMaterial color="#fff8d0" transparent opacity={0.55} roughness={0.2} />
      </mesh>

      {/* 臍部（Umbo）*/}
      <mesh position={[0, -2.0, -0.8]}>
        <sphereGeometry args={[0.32, 10, 10]} />
        <meshStandardMaterial color="#b08040" roughness={0.4} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// ツチ骨 (Malleus)
// 柄 : 鼓膜内, 臍部 → 前上方へ斜走
// 頸部: 鼓膜面から後内方へ橋渡し
// 頭部: 上鼓室（attic）内
// ══════════════════════════════════════════════════════════════════
export function Malleus({
  status, highlight, showLabels = true,
}: {
  status: OssicleStatus; highlight?: string | null; showLabels?: boolean;
}) {
  if (status === 'absent') return null;
  const col = highlight === 'malleus' ? '#00b4d8' : BONE;

  // 世界座標系ランドマーク（OpenEar ALPHA 実測値）
  const umbo       = new THREE.Vector3(0.0,  0.0, 5.0);   // 臍部
  const latProc    = new THREE.Vector3(0.5,  1.2, 5.0);   // 短突起（鼓膜面上）
  const neckStart  = new THREE.Vector3(0.3,  2.0, 4.8);   // 頸部開始
  const neckEnd    = new THREE.Vector3(0.1,  2.8, 4.4);   // 頸部終端
  const headCenter = new THREE.Vector3(0.0,  3.6, 4.2);   // 頭部（attic 内）臍部から 3.62 mm 上方

  return (
    <group>
      {/* 柄（manubrium）: 臍部 → 短突起 */}
      <Tube from={umbo} to={latProc} r={0.22} color={col} />

      {/* 短突起 */}
      <mesh position={[latProc.x, latProc.y, latProc.z]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color={col} roughness={0.4} />
      </mesh>

      {/* 頸部: 短突起 → 頭部 */}
      <Tube from={neckStart} to={neckEnd}    r={0.20} color={col} />
      <Tube from={neckEnd}   to={headCenter} r={0.22} color={col} />

      {/* 頭部 */}
      {status !== 'partial' && (
        <>
          <mesh position={[headCenter.x, headCenter.y, headCenter.z]}>
            <sphereGeometry args={[0.90, 16, 16]} />
            <meshStandardMaterial color={col} roughness={0.35} metalness={0.05} />
          </mesh>
          {showLabels && (
            <Label position={[2.0, 4.5, 4.2]} text="ツチ骨頭 (Malleus Head)" />
          )}
        </>
      )}
      {showLabels && (
        <Label position={[-1.5, -0.5, 6.0]} text="ツチ骨柄 (Manubrium)" />
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// キヌタ骨 (Incus)
// 体部: ツチ骨頭の後内方（鞍関節）
// 短脚: 後方へ
// 長脚: 下方へ走りアブミ骨頭と関節（豆状突起）
// ══════════════════════════════════════════════════════════════════
export function Incus({
  status, highlight, showLabels = true,
}: {
  status: OssicleStatus; highlight?: string | null; showLabels?: boolean;
}) {
  if (status === 'absent') return null;
  const col = highlight === 'incus' ? '#00b4d8' : BONE_DARK;

  const body       = new THREE.Vector3(-0.8,  2.2,  3.8);   // 体部（OpenEar実測）
  const shortProc  = new THREE.Vector3(-1.5,  1.8,  1.5);   // 短脚先端（後内方）
  const lpStart    = new THREE.Vector3(-0.7,  1.5,  4.0);   // 長脚起点（体部下端）
  const lpEnd      = new THREE.Vector3(-0.7249,-0.0273, 3.5259);  // 豆状突起（= STAPES_HEAD、2026-07-22実測補正）

  return (
    <group>
      {/* 体部 */}
      <mesh position={[body.x, body.y, body.z]}>
        <sphereGeometry args={[0.68, 14, 14]} />
        <meshStandardMaterial color={col} roughness={0.42} />
      </mesh>
      {showLabels && (
        <Label position={[-2.5, 3.2, 3.8]} text="キヌタ骨体部 (Incus Body)" />
      )}

      {/* 短脚 */}
      <Tube from={body} to={shortProc} r={0.13} color={col} />

      {/* 長脚（下方走行）: 体部下端 → 豆状突起 */}
      <Tube from={lpStart} to={lpEnd} r={0.12} color={col} />
      {showLabels && (
        <Label position={[-2.2, -0.5, 4.5]} text="キヌタ骨長脚 (Long Process)" />
      )}

      {/* 豆状突起（incudostapedial joint 側） */}
      <mesh position={[lpEnd.x, lpEnd.y, lpEnd.z]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color={col} roughness={0.38} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// アブミ骨 (Stapes)
//
// 底板中心  : STAPES_FOOTPLATE = [0.84, -2.65, 2.12]  ← TORP 下端（実測未反映、footplateワールド位置は据え置き）
// 頭部      : STAPES_HEAD      = [-0.7249, -0.0273, 3.5259]  ← PORP 下端
//   2026-07-22: Interactive Landmark Toolによる実測PORP_CONTACT_POINTベースに補正。
//   旧値[0.84,-2.65,4.86]（Z軸方向のみ2.74mm、というOpenEar解析からの粗い推定値）は
//   「footplateがGLBローカル原点にある」という誤った前提に基づいており廃止。
//   詳細・実測ログはLandmarkMeasurements.md参照（Reviewer: Shoji, 2026-07-22）。
//
// TORP シャフト長: |臍部 − 底板| = 4.00 mm（OpenEar 実測、STAPES_FOOTPLATE基準のため無変更）
// 耳小骨連鎖は主に Y（下方）に走行、Z 差は最小（実測 0.14 mm、旧STAPES_HEAD基準の記述のため要再検証）
// ══════════════════════════════════════════════════════════════════

/** アブミ骨底板の世界座標（OpenEar ALPHA 実測: |臍部→底板| = 4.00 mm） */
export const STAPES_FOOTPLATE = new THREE.Vector3(0.84, -2.65, 2.12);
/** アブミ骨頭（capitulum）の世界座標。PORPフット部の接触点（PORP_CONTACT_POINT）実測値ベース。
 *  Measured from Stapes.glb via Interactive Landmark Tool v2 / PORP_CONTACT_POINT /
 *  Reviewer: Shoji / Date: 2026-07-22（footplateワールド位置[0.84,-2.65,2.12]は据え置き、
 *  ローカル実測ベクトルのみ適用。詳細はLandmarkMeasurements.md参照） */
export const STAPES_HEAD      = new THREE.Vector3(-0.7249, -0.0273, 3.5259);
/** 臍部（umbo）の世界座標 ── プロステーシス上端の基準。Malleus.glb manubrium先端の実測ベース。
 *  Measured from Malleus.glb via Interactive Landmark Tool v2 / manubrium /
 *  Reviewer: Shoji / Date: 2026-07-22（footplateワールド位置[0.84,-2.65,2.12]は据え置き、
 *  ローカル実測ベクトルのみ適用。旧値(0,0,5.0)はSTAPES_HEADと同じ旧バッチ由来の未検証値のため
 *  廃止。詳細はLandmarkMeasurements.md参照） */
export const UMBO_POS         = new THREE.Vector3(-3.236, 1.0663, 2.3439);

/** TORPおよびPISTONの自然方向用ターゲット：底板の真上（垂直方向）。
 *  底板 [0.84,-2.65,2.12] から真上 5mm → [0.84, 2.35, 2.12]
 *  この座標への方向 [0,1,0] = Y+ (垂直) により、
 *  angleTilt=0 のとき TORP/PISTON が完全垂直に立つ。 */
export const UMBO_POS_TORP    = new THREE.Vector3(0.84,  2.35, 2.12);

// ── アブミ骨弓チューブ（CatmullRomCurve3 で自然な弓形）──────────────
function StapesCrus({
  fp, hd, side, color,
}: {
  fp: THREE.Vector3; hd: THREE.Vector3;
  side: 'anterior' | 'posterior'; color: string;
}) {
  const geo = useMemo(() => {
    // X 方向のオフセット（前弓=+, 後弓=-）で左右に広がる
    // 底板幅 2.74 mm に合わせて半幅 ±1.3 mm に拡大（実測値）
    const sign = side === 'anterior' ? 1 : -1;
    const fpEdge = new THREE.Vector3(fp.x + sign * 1.3, fp.y + 0.15, fp.z);
    const mid    = new THREE.Vector3(
      hd.x + sign * 0.7,
      fp.y + (hd.y - fp.y) * 0.5,
      fp.z + (hd.z - fp.z) * 0.45,
    );
    const curve = new THREE.CatmullRomCurve3([fpEdge, mid, hd], false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 24, 0.09, 6, false);
  }, [fp, hd, side]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.32} metalness={0.05} />
    </mesh>
  );
}

export function Stapes({
  status, highlight, showLabels = true,
}: {
  status: StapesStatus; highlight?: string | null; showLabels?: boolean;
}) {
  if (status === 'absent') return null;
  const col = highlight === 'stapes' ? '#00b4d8' : BONE;
  const hasSuprastructure = status === 'intact' || status === 'suprastructure';

  const fp = STAPES_FOOTPLATE.clone();
  const hd = STAPES_HEAD.clone();

  return (
    <group>
      {/* 底板（卵円窓を塞ぐ楕円プレート）
          OpenEar 実測: 2.74 mm × 2.43 mm → scale = [1.37, 1.215, 0.14] */}
      <mesh position={[fp.x, fp.y, fp.z]} scale={[1.37, 1.215, 0.14]}>
        <sphereGeometry args={[1.0, 18, 12]} />
        <meshStandardMaterial color={col} roughness={0.25} metalness={0.05} />
      </mesh>
      {showLabels && (
        <Label position={[fp.x + 2.5, fp.y, fp.z]} text="底板 (Footplate) → 卵円窓" />
      )}

      {hasSuprastructure && (
        <>
          {/* 前弓（Anterior crus）*/}
          <StapesCrus fp={fp} hd={hd} side="anterior"  color={col} />
          {/* 後弓（Posterior crus）*/}
          <StapesCrus fp={fp} hd={hd} side="posterior" color={col} />

          {/* 頭部（Capitulum）*/}
          <mesh position={[hd.x, hd.y, hd.z]}>
            <sphereGeometry args={[0.32, 14, 12]} />
            <meshStandardMaterial color={col} roughness={0.28} metalness={0.05} />
          </mesh>
          {showLabels && (
            <Label position={[hd.x + 2.0, hd.y + 0.5, hd.z]} text="アブミ骨頭 (Capitulum)" />
          )}
        </>
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 耳小骨連鎖（まとめ）
// ══════════════════════════════════════════════════════════════════
interface ChainProps {
  malleus:   OssicleStatus;
  incus:     OssicleStatus;
  stapes:    StapesStatus;
  highlight?: string | null;
  showLabels?: boolean;
}
export function OssicleChain({
  malleus, incus, stapes, highlight, showLabels = true,
}: ChainProps) {
  return (
    <group>
      <TympanicMembrane />
      <Malleus status={malleus} highlight={highlight} showLabels={showLabels} />
      <Incus   status={incus}   highlight={highlight} showLabels={showLabels} />
      <Stapes  status={stapes}  highlight={highlight} showLabels={showLabels} />
      {showLabels && (
        <Label position={[0, -2.5, 6.5]} text="鼓膜 (Tympanic Membrane)" />
      )}
    </group>
  );
}
