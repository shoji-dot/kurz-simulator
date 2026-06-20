/**
 * TympanoCavityModel.tsx  ── 鼓室 (Tympanic Cavity) 解剖モデル
 *
 * ▼ 座標系（OssicleModels.tsx と共通）
 *   Origin: 鼓室中央
 *   Z+  : 外耳道方向（カメラ・術者側）
 *   Y+  : 上方
 *   X+  : 前方
 *
 * ▼ 鼓室 6 壁
 *   外側壁 (Lateral)  : 鼓膜＋骨性外耳道（Z+方向）     Z ≈ 5
 *   内側壁 (Medial)   : 迷路壁、岬角、卵円窓、正円窓    Z ≈ 1
 *   上壁   (Superior) : 被蓋 (Tegmen tympani)           Y ≈ +4.5
 *   下壁   (Inferior) : 頸静脈窩 (Jugular wall)          Y ≈ -5
 *   前壁   (Anterior) : 頸動脈壁、耳管開口部             X ≈ +5
 *   後壁   (Posterior): 乳突壁、顔面神経（垂直部）       X ≈ -5
 *
 * ▼ 重要ランドマーク
 *   岬角中心       : [0,   -2.5, 1.0]
 *   卵円窓         : [0.84, -2.65, 2.12]  ← STAPES_FOOTPLATE
 *   正円窓         : [0.84, -4.2,  1.5]
 *   顔面神経水平部  : [-0.5, -0.5, 1.5] → [2.0, -0.5, 3.5]
 *   鼓索神経       : [0.0, 2.8,  4.5] → [2.0, -3.0, 5.0]
 *   耳管開口部      : [4.5, -2.0, 4.0]
 *   被蓋           : [0,   +4.5, 3.0]
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { STAPES_FOOTPLATE } from './OssicleModels';

// ── 色定数 ──────────────────────────────────────────────────────────
const C = {
  bone:      '#e8dcc8',
  boneDark:  '#c8b898',
  boneDeep:  '#b8a880',
  membrane:  '#f8d890',
  nerve:     '#f5d820',
  chorda:    '#f0b830',
  mucosa:    '#e8a0a0',
  window:    '#6090b0',
  cartilage: '#a0c090',
  eustach:   '#c0d0a0',
  vessel:    '#cc4444',
  fluid:     '#80b8e0',
};

// ── ラベル ──────────────────────────────────────────────────────────
function Label({
  position, text, color = '#d0eeff',
}: {
  position: [number, number, number]; text: string; color?: string;
}) {
  return (
    <Html position={position} center distanceFactor={22} zIndexRange={[0, 10]}>
      <div style={{
        background: 'rgba(0,15,35,.88)',
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 10,
        color,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        fontFamily: 'sans-serif',
      }}>{text}</div>
    </Html>
  );
}

// ── チューブ（2点間） ──────────────────────────────────────────────
function Tube({
  from, to, r, color, opacity = 1,
}: {
  from: THREE.Vector3; to: THREE.Vector3;
  r: number; color: string; opacity?: number;
}) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.01) return null;
  const mid  = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <mesh position={[mid.x, mid.y, mid.z]} rotation={[euler.x, euler.y, euler.z]}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial
        color={color} roughness={0.45}
        transparent={opacity < 1} opacity={opacity}
      />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 被蓋 Tegmen Tympani（上壁）
// ══════════════════════════════════════════════════════════════════
function Tegmen() {
  return (
    <group>
      <mesh position={[0, 4.5, 3.0]}>
        <boxGeometry args={[12, 0.6, 6]} />
        <meshStandardMaterial color={C.bone} roughness={0.45} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 頸静脈窩 Jugular Wall（下壁）
// ══════════════════════════════════════════════════════════════════
function JugularWall() {
  return (
    <mesh position={[0, -5.2, 3.0]}>
      <boxGeometry args={[12, 0.6, 6]} />
      <meshStandardMaterial color={C.boneDark} roughness={0.5} />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 内側壁 Medial Wall（迷路壁）
// 岬角・卵円窓・正円窓・顔面神経管を含む
// ══════════════════════════════════════════════════════════════════
function MedialWall({ showLabels }: { showLabels: boolean }) {
  // 卵円窓
  const OW = STAPES_FOOTPLATE.clone(); // [0.84, -2.65, 2.12]

  // 正円窓（卵円窓の後下方）
  const RW = new THREE.Vector3(0.84, -4.2, 1.5);

  return (
    <group>
      {/* 内側壁本体 */}
      <mesh position={[0, -0.5, 0.4]}>
        <boxGeometry args={[12, 10, 0.6]} />
        <meshStandardMaterial color={C.boneDeep} roughness={0.55} />
      </mesh>

      {/* 岬角 Promontory（迷路壁の外側突出） */}
      <mesh position={[0, -2.5, 1.0]}>
        <sphereGeometry args={[2.2, 24, 18]} />
        <meshStandardMaterial color={C.boneDark} roughness={0.42} />
      </mesh>
      {showLabels && (
        <Label position={[-3.5, -2.5, 1.5]} text="岬角 Promontory" />
      )}

      {/* 岬角鼓室神経叢（表面の細い神経） */}
      <mesh position={[0, -2.5, 1.2]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 3.5, 6]} />
        <meshStandardMaterial color={C.nerve} roughness={0.5} />
      </mesh>
      <mesh position={[0, -2.5, 1.2]} rotation={[0, 0, 0.8]}>
        <cylinderGeometry args={[0.04, 0.04, 3.0, 6]} />
        <meshStandardMaterial color={C.nerve} roughness={0.5} />
      </mesh>

      {/* 卵円窓 Oval Window */}
      <mesh position={[OW.x, OW.y, OW.z + 0.1]} scale={[1.4, 1.1, 0.15]}>
        <sphereGeometry args={[1.0, 20, 14]} />
        <meshStandardMaterial color={C.window} roughness={0.2} transparent opacity={0.85} />
      </mesh>
      {showLabels && (
        <Label position={[3.5, -2.2, 2.0]} text="卵円窓 Oval Window" color="#80ccff" />
      )}

      {/* 正円窓 Round Window */}
      <mesh position={[RW.x, RW.y, RW.z + 0.1]} scale={[0.9, 0.9, 0.12]}>
        <sphereGeometry args={[1.0, 20, 14]} />
        <meshStandardMaterial color={C.window} roughness={0.2} transparent opacity={0.72} />
      </mesh>
      <mesh position={[RW.x, RW.y, RW.z + 0.25]} rotation={[0, 0, 0]} scale={[0.85, 0.85, 0.05]}>
        <sphereGeometry args={[1.0, 20, 14]} />
        <meshStandardMaterial color={C.membrane} roughness={0.5} transparent opacity={0.6} />
      </mesh>
      {showLabels && (
        <Label position={[3.5, -4.5, 1.5]} text="正円窓 Round Window" color="#80ccff" />
      )}

      {/* 鼓岬稜（卵円窓と正円窓の間の骨隆起） */}
      <mesh position={[OW.x, (OW.y + RW.y) / 2, 1.4]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 1.5, 10]} />
        <meshStandardMaterial color={C.boneDark} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 顔面神経 Facial Nerve（水平部 Horizontal Segment）
// ══════════════════════════════════════════════════════════════════
function FacialNerveHorizontal({ showLabels }: { showLabels: boolean }) {
  // 水平部: 膝神経節(geniculate ganglion)から卵円窓上方を通り第2膝へ
  const points = [
    new THREE.Vector3( 3.0, -0.2, 1.0),  // 第1膝（膝神経節）
    new THREE.Vector3( 1.0, -0.4, 1.2),
    new THREE.Vector3(-0.5, -0.5, 1.5),  // 卵円窓上方
    new THREE.Vector3(-2.0, -0.6, 1.8),  // 第2膝へ
    new THREE.Vector3(-3.0, -0.8, 2.0),
  ];

  const tubeGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 30, 0.22, 8, false);
  }, []);

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={C.nerve} roughness={0.5} emissive={C.nerve} emissiveIntensity={0.06} />
      </mesh>
      {showLabels && (
        <Label position={[-1.0, 1.0, 1.5]} text="顔面神経（水平部）Facial N." color="#f5d820" />
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 鼓索神経 Chorda Tympani
// 顔面神経から分岐し、鼓室内を前上方へ走行
// ══════════════════════════════════════════════════════════════════
function ChordaTympani({ showLabels }: { showLabels: boolean }) {
  const from = new THREE.Vector3(-2.5, -0.6, 1.8);  // 顔面神経からの分岐
  const mid1 = new THREE.Vector3(-1.0,  1.5, 3.5);  // 鼓室内（上方弧）
  const mid2 = new THREE.Vector3( 1.0,  2.8, 4.5);  // ツチ骨頸部内側を通過
  const to   = new THREE.Vector3( 2.5, -2.5, 5.2);  // 岩鼓裂へ

  const tubeGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([from, mid1, mid2, to]);
    return new THREE.TubeGeometry(curve, 28, 0.10, 6, false);
  }, []);

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={C.chorda} roughness={0.55} transparent opacity={0.9} />
      </mesh>
      {showLabels && (
        <Label position={[2.0, 3.5, 4.5]} text="鼓索神経 Chorda Tympani" color="#f0b830" />
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 耳管 Eustachian Tube（開口部）
// ══════════════════════════════════════════════════════════════════
function EustachianTube({ showLabels }: { showLabels: boolean }) {
  return (
    <group>
      {/* 開口部 */}
      <mesh position={[4.5, -2.0, 4.0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[1.0, 0.7, 1.5, 16, 1, true]} />
        <meshStandardMaterial color={C.eustach} roughness={0.6} side={THREE.BackSide} />
      </mesh>
      {showLabels && (
        <Label position={[6.0, -2.0, 4.0]} text="耳管開口部 Eustachian Tube" color="#a0d080" />
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 外耳道接続部（EAC入口からの接続ビジュアル）
// ══════════════════════════════════════════════════════════════════
function EACConnection({ showEAC }: { showEAC: boolean }) {
  if (!showEAC) return null;

  return (
    <group>
      {/* 外耳道管（半透明） */}
      <mesh position={[0, 2, 9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4.5, 4.0, 10, 20, 1, true]} />
        <meshStandardMaterial
          color={C.boneDark} roughness={0.6}
          transparent opacity={0.18} side={THREE.BackSide}
        />
      </mesh>
      {/* EAC入口リング */}
      <mesh position={[0, 2, 14]}>
        <ringGeometry args={[4.0, 4.8, 36]} />
        <meshStandardMaterial color="#00ff88" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Label position={[0, 6, 14]} text="EAC入口 / 外耳道口" color="#00ff88" />
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 鼓室粘膜（Mucosa）- 鼓室内壁の粘膜被覆
// ══════════════════════════════════════════════════════════════════
function TympanicMucosa() {
  return (
    <mesh position={[0, -0.5, 3.0]}>
      <sphereGeometry args={[5.5, 28, 22]} />
      <meshStandardMaterial
        color={C.mucosa} roughness={0.7}
        transparent opacity={0.07}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 主コンポーネント: TympanoCavity
// ══════════════════════════════════════════════════════════════════
export interface TympanoCavityProps {
  /** 解剖ラベルを表示 */
  showLabels?: boolean;
  /** 壁の不透明度 0〜1 */
  wallOpacity?: number;
  /** 顔面神経を表示 */
  showNerves?: boolean;
  /** EAC接続を表示 */
  showEAC?: boolean;
  /** 岬角・窓構造を強調 */
  highlightMedial?: boolean;
}

export function TympanoCavity({
  showLabels = true,
  wallOpacity = 0.18,
  showNerves = true,
  showEAC = false,
  highlightMedial = false,
}: TympanoCavityProps) {
  return (
    <group>
      {/* 鼓室外囲（半透明シェル） */}
      <TympanicMucosa />

      {/* 上壁: 被蓋 */}
      <group>
        <mesh position={[0, 4.5, 3.0]}>
          <boxGeometry args={[12, 0.6, 6]} />
          <meshStandardMaterial
            color={C.bone} roughness={0.45}
            transparent opacity={wallOpacity}
          />
        </mesh>
        {showLabels && (
          <Label position={[0, 5.8, 3.0]} text="被蓋 Tegmen Tympani（上壁）" />
        )}
      </group>

      {/* 下壁: 頸静脈窩 */}
      <group>
        <mesh position={[0, -5.2, 3.0]}>
          <boxGeometry args={[12, 0.6, 6]} />
          <meshStandardMaterial
            color={C.boneDark} roughness={0.5}
            transparent opacity={wallOpacity}
          />
        </mesh>
        {showLabels && (
          <Label position={[0, -6.5, 3.0]} text="頸静脈窩 Jugular Wall（下壁）" />
        )}
      </group>

      {/* 内側壁（迷路壁）: 岬角・卵円窓・正円窓 */}
      <MedialWall showLabels={showLabels} />

      {/* 神経 */}
      {showNerves && (
        <>
          <FacialNerveHorizontal showLabels={showLabels} />
          <ChordaTympani showLabels={showLabels} />
        </>
      )}

      {/* 耳管 */}
      <EustachianTube showLabels={showLabels} />

      {/* EAC接続 */}
      <EACConnection showEAC={showEAC} />

      {/* 被蓋・下壁ラベル補助 */}
      {showLabels && (
        <>
          <Label position={[-6.5, -0.5, 3.0]} text="後壁→乳突" />
          <Label position={[ 6.5, -0.5, 3.0]} text="前壁→耳管" />
        </>
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 教育モード用: 鼓室解剖フルビュー（AnatomyScene から呼び出す）
// ══════════════════════════════════════════════════════════════════
export function TympanoCavityEdu() {
  return (
    <TympanoCavity
      showLabels={true}
      wallOpacity={0.15}
      showNerves={true}
      showEAC={true}
      highlightMedial={true}
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// 手術モード用: 術野シミュレーション（SurgicalScene から呼び出す）
// ══════════════════════════════════════════════════════════════════
export function TympanoCavitySurgical({
  showNerves = true,
  wallOpacity = 0.22,
}: {
  showNerves?: boolean;
  wallOpacity?: number;
}) {
  return (
    <TympanoCavity
      showLabels={false}
      wallOpacity={wallOpacity}
      showNerves={showNerves}
      showEAC={false}
    />
  );
}
