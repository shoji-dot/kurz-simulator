/**
 * PinnaModel.tsx  ── 耳介 STL モデル（患者バリエーション対応）
 *
 * ▼ ソース
 *   Viking HRTF Dataset v2 (CC-BY 4.0)
 *   Spagnol et al. (2020) DOI:10.5281/zenodo.4160401
 *
 * ▼ 対応患者ID: J / T / A / H / E
 *
 * ▼ 座標変換
 *   EAC入口 (eacInStl) → sim Z=EAC_SIM_Z (30mm)
 *   STL は重心中心化済み。eacInStl のオフセットで補正。
 *   rotation: [-π/2, 0, π] で STL 軸をシミュレーター軸に整合
 */

import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';
import { getPinnaUrl, getPatientById, PATIENTS } from '../../data/patients';

// シミュレーター上の EAC 入口 Z 座標（RealAuricle.glb オフセット = 42mm に合わせる）
const EAC_SIM_Z = 42;

interface PinnaModelProps {
  /** 患者ID (J / T / A / H / E) */
  patientId?: string;
  /** 不透明度 */
  opacity?: number;
  /** 表面色 */
  color?: string;
}

/** 単一 STL ローダー（useLoader は hooks ルールのため呼び出し元で patientId を固定する） */
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
  const geometry = useLoader(STLLoader, url);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
  }), [color, opacity]);

  return (
    <mesh
      geometry={geometry}
      material={mat}
      position={position}
      rotation={[-Math.PI / 2, 0, Math.PI]}
      castShadow
      receiveShadow
    />
  );
}

export function PinnaModel({
  patientId = 'T',
  opacity = 0.85,
  color = '#c8956c',
}: PinnaModelProps) {
  const patient = getPatientById(patientId) ?? PATIENTS[1]; // fallback: T
  const { eacInStl } = patient;
  const url = getPinnaUrl(patientId);

  // EAC入口 (eacInStl) をシミュレーター上の (0, 0, EAC_SIM_Z) に合わせる補正
  // rotation [-π/2, 0, π] の変換行列: (x,y,z) → (-x, -z, -y)
  // world_eac = (posX - eacX, posY - eacZ, posZ - eacY) = (0, 0, EAC_SIM_Z)
  // よって: posX = eacInStl.x, posY = eacInStl.z, posZ = EAC_SIM_Z + eacInStl.y
  const posX = eacInStl.x;
  const posY = eacInStl.z;
  const posZ = EAC_SIM_Z + eacInStl.y;

  return (
    <PinnaSTL
      url={url}
      position={[posX, posY, posZ]}
      opacity={opacity}
      color={color}
    />
  );
}

// ── 患者選択UI用サムネイルコンポーネント ──────────────────────────
/** 患者一覧から選択するためのプレビュー（将来拡張用） */
export { PATIENTS } from '../../data/patients';
