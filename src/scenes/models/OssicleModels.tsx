/**
 * OssicleModels.tsx  ── 解剖学的耳小骨モデル（完全版）
 *
 * ▼ 座標系（1 unit = 1 mm）
 *   Origin: 鼓室中央（おおよそ）
 *   Z+  : 外耳道方向（カメラ・術者側）
 *   Y+  : 上方
 *   X+  : 前方
 *
 * ▼ 重要ランドマーク
 *   鼓膜中心   : [0, 2.0,  5.0]  → 臍部 [0, 0.0, 5.0]
 *   ツチ骨頭   : [0.1, 5.0, 1.5]
 *   キヌタ骨体 : [-0.8, 5.0, 0.5]
 *   アブミ骨頭 : [-0.4, -2.5, -3.5]  ← PORP シャフト下端
 *   アブミ骨底板: [-0.4, -5.0, -5.0] ← TORP シャフト下端
 *
 * ▼ プロテーゼ長の意味
 *   PORP シャフト長 = 臍部 Y(0.0) − アブミ骨頭 Y(-2.5) → 約 2.5 mm
 *   TORP シャフト長 = 臍部 Y(0.0) − 底板 Y(-5.0)  → 約 5.0 mm
 */

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
// 中心 [0, 2.0, 5.0], 半径 4.5mm, +Z を向く
// 臍部 (umbo) = [0, 0.0, 5.0]（中心より 2mm 下）
// ══════════════════════════════════════════════════════════════════
export function TympanicMembrane({ opacity = 0.48 }: { opacity?: number }) {
  return (
    <group position={[0, 2.0, 5.0]}>
      {/* 鼓膜本体 */}
      <mesh>
        <circleGeometry args={[4.5, 48]} />
        <meshStandardMaterial
          color={MEM_COLOR} transparent opacity={opacity}
          side={THREE.DoubleSide} roughness={0.7}
        />
      </mesh>
      {/* 線維輪 */}
      <mesh>
        <ringGeometry args={[4.1, 4.6, 48]} />
        <meshStandardMaterial color="#a07830" roughness={0.5} />
      </mesh>
      {/* 臍部マーカー（umbo）: ツチ骨柄の付着点 */}
      <mesh position={[0, -2.0, 0.02]}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial color="#b08040" />
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

  // 世界座標系ランドマーク
  const umbo       = new THREE.Vector3(0.3,  0.0, 5.0);   // 臍部
  const latProc    = new THREE.Vector3(0.9,  1.5, 5.0);   // 短突起（ツチ骨短突起）
  const neckStart  = new THREE.Vector3(0.5,  2.5, 4.2);   // 頸部開始
  const neckEnd    = new THREE.Vector3(0.2,  3.8, 2.5);   // 頸部終端
  const headCenter = new THREE.Vector3(0.1,  5.0, 1.5);   // 頭部（attic 内）

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
            <Label position={[2.0, 6.2, 1.5]} text="ツチ骨頭 (Malleus Head)" />
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

  const body       = new THREE.Vector3(-0.8,  5.0,  0.5);   // 体部
  const shortProc  = new THREE.Vector3(-1.5,  4.5, -2.0);   // 短脚先端（後方）
  const lpStart    = new THREE.Vector3(-0.7,  5.0,  0.0);   // 長脚起点（体部）
  const lpEnd      = new THREE.Vector3(-0.4, -2.5, -3.5);   // 豆状突起（アブミ骨頭と関節）

  return (
    <group>
      {/* 体部 */}
      <mesh position={[body.x, body.y, body.z]}>
        <sphereGeometry args={[0.68, 14, 14]} />
        <meshStandardMaterial color={col} roughness={0.42} />
      </mesh>
      {showLabels && (
        <Label position={[-2.5, 6.0, 0.5]} text="キヌタ骨体部 (Incus Body)" />
      )}

      {/* 短脚 */}
      <Tube from={body} to={shortProc} r={0.13} color={col} />

      {/* 長脚（下方走行） */}
      <Tube from={lpStart} to={lpEnd} r={0.12} color={col} />
      {showLabels && (
        <Label position={[-2.2, 0.5, -3.0]} text="キヌタ骨長脚 (Long Process)" />
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
// 底板中心  : STAPES_FOOTPLATE = [-0.4, -5.0, -5.0]  ← TORP 下端
// 頭部      : STAPES_HEAD      = [-0.4, -2.5, -3.5]  ← PORP 下端
//   (頭部 = 底板 + [0, +2.5, +1.5])
//
// PORP シャフト長の基準:  臍部 Y(0.0) − 頭部 Y(-2.5)  = 2.5 mm
// TORP シャフト長の基準:  臍部 Y(0.0) − 底板 Y(-5.0)  = 5.0 mm
// ══════════════════════════════════════════════════════════════════

/** アブミ骨底板の世界座標 */
export const STAPES_FOOTPLATE = new THREE.Vector3(-0.4, -5.0, -5.0);
/** アブミ骨頭（capitulum）の世界座標 */
export const STAPES_HEAD      = new THREE.Vector3(-0.4, -2.5, -3.5);
/** 臍部（umbo）の世界座標 ── プロテーゼ上端の基準 */
export const UMBO_POS         = new THREE.Vector3(0.0,   0.0,  5.0);

export function Stapes({
  status, highlight, showLabels = true,
}: {
  status: StapesStatus; highlight?: string | null; showLabels?: boolean;
}) {
  if (status === 'absent') return null;
  const col = highlight === 'stapes' ? '#00b4d8' : BONE;
  const hasSuprastructure = status === 'intact' || status === 'suprastructure';

  const fp  = STAPES_FOOTPLATE.clone();  // 底板中心
  const hd  = STAPES_HEAD.clone();       // 頭部（capitulum）

  // 弓の中間点（前弓・後弓）
  const fpAnt  = new THREE.Vector3(fp.x + 0.6, fp.y, fp.z);
  const fpPost = new THREE.Vector3(fp.x - 0.6, fp.y, fp.z);
  const midAnt  = new THREE.Vector3(hd.x + 0.3, (fp.y + hd.y) / 2, (fp.z + hd.z) / 2);
  const midPost = new THREE.Vector3(hd.x - 0.3, (fp.y + hd.y) / 2, (fp.z + hd.z) / 2);

  return (
    <group>
      {/* 底板（卵円窓を塞ぐ楕円プレート）*/}
      <mesh position={[fp.x, fp.y, fp.z]} scale={[1.5, 0.58, 0.12]}>
        <sphereGeometry args={[1.0, 16, 10]} />
        <meshStandardMaterial color={col} roughness={0.28} metalness={0.05} />
      </mesh>
      {showLabels && (
        <Label position={[fp.x + 2.5, fp.y, fp.z]} text="底板 → 卵円窓" />
      )}

      {hasSuprastructure && (
        <>
          {/* 前弓 */}
          <Tube from={fpAnt}  to={midAnt}  r={0.09} color={col} />
          <Tube from={midAnt}  to={hd}     r={0.09} color={col} />
          {/* 後弓 */}
          <Tube from={fpPost} to={midPost} r={0.09} color={col} />
          <Tube from={midPost} to={hd}     r={0.09} color={col} />
          {/* 頭部（capitulum） */}
          <mesh position={[hd.x, hd.y, hd.z]}>
            <sphereGeometry args={[0.30, 12, 12]} />
            <meshStandardMaterial color={col} roughness={0.30} metalness={0.05} />
          </mesh>
          {showLabels && (
            <Label position={[hd.x + 1.8, hd.y, hd.z]} text="アブミ骨頭 (Capitulum)" />
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
