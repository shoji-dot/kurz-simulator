/**
 * PinnaModel.tsx  ── 耳介 STL モデル（患者バリエーション対応）
 *
 * ▼ ソース
 *   Viking HRTF Dataset v2 (CC-BY 4.0)
 *   Spagnol et al. (2020) DOI:10.5281/zenodo.4160401
 *
 * ▼ 対応患者ID: J / T / A / H / E
 *
 * ▼ 座標変換（STL実測バウンディングボックスより確定）
 *   subj_T 実測値:
 *     X: -28.6 ~ +28.6 (57.2mm = 幅)
 *     Y: -33.6 ~ +33.6 (67.3mm = 高さ)  ← Y が縦軸！
 *     Z:  0.0  ~ +24.8 (24.8mm = 奥行き, Z=0 が頭側 = EAC 面)
 *   セントロイド後 Z 範囲: -12.4 ~ +12.4
 *
 *   rotation = [0, 0, 0]（恒等回転）
 *     → STL の Y（縦）がそのまま World Y（縦）に対応
 *     → 旧 [-π/2, 0, π] は Y→Z にマッピングしており90°ずれていた
 *
 *   メッシュ位置算出（恒等回転: world_vertex = mesh_pos + stl_vertex）
 *     world_eac = mesh_pos + eacInStl = (0, EAC_Y_CENTER, EAC_SIM_Z)
 *     → posX = -eacInStl.x
 *        posY =  EAC_Y_CENTER - eacInStl.y
 *        posZ =  EAC_SIM_Z   - eacInStl.z
 */

import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import * as THREE from 'three';
import { getPinnaUrl, getPatientById, PATIENTS } from '../../data/patients';

// GLB解析結果: External_Auditory_Canal.glb の外側開口部（頂点実測 2026-06-20）
//   Z=13~14.44mm の頂点群: 中心 X=-1.28, Y=6.32, 半径 X=1.19, Y=3.24
//   → EAC は楕円形（横1.19×縦3.24mm 半径）で左方向に-1.28mmオフセット
//   Bone.glb maxZ=30.93 は外耳道ではなく乳様突起/鼓室板（Y=-15〜+6の下部領域）
const EAC_SIM_Z    = 14.44; // EAC 外側開口部の Z 座標（GLB空間、実測値）
const EAC_X_CENTER = -1.28; // EAC 外側開口部の X 座標（左側にオフセット）
const EAC_Y_CENTER =  6.32; // EAC 外側開口部の Y 座標（実測、旧値5.8から修正）
const EAC_RING_R   =  3.8;  // EAC 入口マーカーリング半径（mm、視認用）

interface PinnaModelProps {
  /** 患者ID (J / T / A / H / E) */
  patientId?: string;
  /** 不透明度 */
  opacity?: number;
  /** 表面色 */
  color?: string;
}

/** 単一 STL ローダー */
function PinnaSTL({
  url,
  position,
  opacity,
  color,
}: {
  url: string;
  position: [number, number, number];
  opacity: number;
  color: string;
}) {
  const rawGeometry = useLoader(STLLoader, url);

  // STLLoader はジオメトリを自動センタリングしない。
  // eacInStl 座標は重心（centroid）基準で測定済みのため、
  // ここでセンタリングして整合させる。
  // 実測: subj_T STL Z[0, 24.8] → 重心Z=12.4mm → center()後 Z[-12.4, +12.4]
  const geometry = useMemo(() => {
    const g = rawGeometry.clone();
    g.center();
    return g;
  }, [rawGeometry]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 0.99,
  }), [color, opacity]);

  return (
    <mesh
      geometry={geometry}
      material={mat}
      position={position}
      rotation={[0, 0, 0]}   // 恒等回転: STL Y（縦）→ World Y（縦）
      castShadow
      receiveShadow
    />
  );
}

export function PinnaModel({
  patientId = 'T',
  opacity = 0.55,            // 半透明デフォルト: EAC 周辺の解剖が透けて見える
  color = '#c8956c',
}: PinnaModelProps) {
  const patient = getPatientById(patientId) ?? PATIENTS[1]; // fallback: T
  const { eacInStl } = patient;
  const url = getPinnaUrl(patientId);

  // 恒等回転 [0,0,0] での位置補正
  // world_vertex = mesh_pos + stl_vertex  →  eacInStl + mesh_pos = EAC world 位置
  // posX + eacInStl.x = EAC_X_CENTER   → posX = EAC_X_CENTER - eacInStl.x
  // posY + eacInStl.y = EAC_Y_CENTER   → posY = EAC_Y_CENTER - eacInStl.y
  // posZ + eacInStl.z = EAC_SIM_Z      → posZ = EAC_SIM_Z   - eacInStl.z
  const posX =  EAC_X_CENTER - eacInStl.x;
  const posY =  EAC_Y_CENTER - eacInStl.y;
  const posZ =  EAC_SIM_Z   - eacInStl.z;

  return (
    <group>
      {/* 耳介 STL メッシュ */}
      <PinnaSTL
        url={url}
        position={[posX, posY, posZ]}
        opacity={opacity}
        color={color}
      />
      {/* EAC 入口マーカーリング（GLB EAC 外側開口部に固定表示）
          外耳道入口の位置を明示し、解剖との対応関係を示す */}
      <mesh
        position={[EAC_X_CENTER, EAC_Y_CENTER, EAC_SIM_Z]}
        rotation={[0, 0, 0]}
      >
        <torusGeometry args={[EAC_RING_R, 0.22, 8, 40]} />
        <meshStandardMaterial
          color="#44aaff"
          emissive="#2288ff"
          emissiveIntensity={1.2}
          transparent
          opacity={0.90}
        />
      </mesh>
    </group>
  );
}

// ── 患者選択UI用サムネイルコンポーネント ──────────────────────────
/** 患者一覧から選択するためのプレビュー（将来拡張用） */
export { PATIENTS } from '../../data/patients';
