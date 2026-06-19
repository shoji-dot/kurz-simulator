/**
 * InnerEarModels.tsx  ── 内耳モデル（手続き的ジオメトリ）
 *
 * STL データなしで解剖学的に認識可能な内耳迷路を再現
 *
 * ▼ 参考寸法（成人平均値 / 文献値）
 *   蝸牛 (Cochlea)
 *     底回転径     : 9 mm（半径 4.5 mm）
 *     頂点径       : ~1.5 mm
 *     底→頂点高さ : 4.5 mm
 *     回転数       : 2.5 回転
 *     蝸牛管径     : ~1.2 mm（チューブ半径 0.6 mm）
 *   前庭 (Vestibule)
 *     楕円径       : 4 × 3 mm
 *   各半規管 (Semicircular Canal)
 *     曲率半径     : 3.0–3.5 mm
 *     管径         : ~0.9 mm（チューブ半径 0.45 mm）
 *
 * ▼ 座標系（OssicleModels と共通, 1 unit = 1 mm）
 *   Z+  : 外耳道方向（カメラ側）
 *   Y+  : 上方
 *   内耳は Z < −7.0 の側頭骨内部に配置
 *   卵円窓基準    : [-0.8, -1.5, -6.8]
 *   前庭中心      : VESTIBULE_CENTER = [-0.8, -1.5, -9.0]
 *   蝸牛底回転中心: COCHLEA_CENTER   = [ 1.5, -4.0, -9.5]
 */

import { useMemo } from 'react';
import * as THREE from 'three';

// ── 位置定数 ──────────────────────────────────────────────────────────
/** 前庭中心（卵円窓の直内側） */
export const VESTIBULE_CENTER = new THREE.Vector3(-0.8, -1.5, -9.0);
/** 蝸牛底回転の中心（前庭の前下方） */
export const COCHLEA_CENTER   = new THREE.Vector3( 1.5, -4.0, -9.5);

// ── 色定数 ──────────────────────────────────────────────────────────
const COCHLEA_COL   = '#d4b896'; // 骨迷路色（蝸牛管）
const VESTIBULE_COL = '#b8ddf5'; // 膜迷路色（前庭）
const CANAL_H_COL   = '#70b8e8'; // 水平半規管
const CANAL_A_COL   = '#50a8d8'; // 前半規管
const CANAL_P_COL   = '#60b0e0'; // 後半規管

// ══════════════════════════════════════════════════════════════════
// 蝸牛（Cochlea）— 2.5 回転螺旋チューブ
//
// モジオラス軸 = Y 方向（垂直）
// 螺旋は XZ 平面内で展開しながら Y(上)方向に上昇
// ══════════════════════════════════════════════════════════════════
function Cochlea() {
  const geometry = useMemo(() => {
    const { x: cx, y: cy, z: cz } = COCHLEA_CENTER;
    const points: THREE.Vector3[] = [];

    const TURNS = 2.5;
    const STEPS = 220;
    const R_BASE = 4.5;   // 底回転半径 (mm)
    const R_APEX = 0.7;   // 頂点半径 (mm)
    const H      = 4.5;   // 底→頂点 高さ (mm)

    for (let i = 0; i <= STEPS; i++) {
      const t     = i / STEPS;
      const angle = t * TURNS * Math.PI * 2;
      // 半径: 底回転→頂点へ線形減少
      const r = R_BASE + (R_APEX - R_BASE) * t;
      // XZ 平面内の螺旋 + Y 方向上昇
      const x = cx + r * Math.cos(angle);
      const z = cz + r * Math.sin(angle);
      const y = cy + H * t;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 220, 0.62, 8, false);
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={COCHLEA_COL}
        roughness={0.48} metalness={0.06}
        transparent opacity={0.90}
      />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 前庭（Vestibule）— 楕円体
//
// 卵円窓と蝸牛の間に位置する膜迷路の中枢腔
// 球体を scale で楕円形に変形
// ══════════════════════════════════════════════════════════════════
function Vestibule() {
  const { x, y, z } = VESTIBULE_CENTER;
  return (
    <mesh position={[x, y, z]} scale={[1.8, 1.4, 1.6]}>
      <sphereGeometry args={[1.0, 18, 14]} />
      <meshStandardMaterial
        color={VESTIBULE_COL}
        roughness={0.30} metalness={0.08}
        transparent opacity={0.88}
      />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════
// 三半規管（Semicircular Canals）
//
// 各管を「開いたトーラス（約 300°）」で近似。
// アンプラ（膨大部）側を開放することで T 字接続を表現。
//
// 配置・傾き（解剖学的概略）:
//   水平（外側）管  : 水平面から後上方へ約 30° 傾斜
//   前（上）半規管  : 矢状断面に近い平面、前下方に約 45° 傾斜
//   後半規管        : 前管とほぼ直交（冠状断面に近い）
// ══════════════════════════════════════════════════════════════════
interface CanalProps {
  position: [number, number, number];
  rotation: [number, number, number];
  radius: number;
  color: string;
  arc?: number; // ラジアン（デフォルト ~300°）
}
function Canal({ position, rotation, radius, color, arc = Math.PI * 1.72 }: CanalProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, 0.45, 8, 48, arc]} />
      <meshStandardMaterial
        color={color}
        roughness={0.30} metalness={0.08}
        transparent opacity={0.84}
      />
    </mesh>
  );
}

function SemicircularCanals() {
  const { x: vx, y: vy, z: vz } = VESTIBULE_CENTER;

  return (
    <group>
      {/* ── 水平（外側）半規管
          平面: 水平面から後上方へ約 30° 傾斜
          前庭後外側から始まるループ */}
      <Canal
        position={[vx - 0.8, vy + 1.0, vz - 1.5]}
        rotation={[Math.PI / 5.5,  0.10,  0.0]}
        radius={3.0}
        color={CANAL_H_COL}
      />

      {/* ── 前（上）半規管
          平面: 矢状断に近い（前後方向）、水平から約 60° 立ち上がる */}
      <Canal
        position={[vx + 0.2, vy + 2.8, vz - 2.2]}
        rotation={[Math.PI / 2.1,  0.32,  0.42]}
        radius={3.3}
        color={CANAL_A_COL}
      />

      {/* ── 後半規管
          平面: 前管とほぼ直交（冠状断に近い、後外方向） */}
      <Canal
        position={[vx - 2.2, vy + 2.0, vz - 1.8]}
        rotation={[Math.PI / 2.0, -0.26, Math.PI / 2.2]}
        radius={3.2}
        color={CANAL_P_COL}
      />
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 内耳迷路 全体（エクスポート）
// ══════════════════════════════════════════════════════════════════
export function InnerEar() {
  return (
    <group>
      <Cochlea />
      <Vestibule />
      <SemicircularCanals />
    </group>
  );
}
