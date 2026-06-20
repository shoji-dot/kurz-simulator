/**
 * PinnaModel.tsx  ── 耳介 STL モデル（Viking HRTF Dataset v2 / CC-BY 4.0）
 *
 * ▼ ソース
 *   subj_T.stl : KEMAR 標準人工左耳介
 *   スキャン解像度 1mm / Creaform Go!SCAN 20
 *   ライセンス: CC-BY 4.0
 *   引用: Spagnol et al. (2020) The Viking HRTF dataset v2, DOI:10.5281/zenodo.4160401
 *
 * ▼ STL 座標系（原点 = 耳介重心、単位 mm）
 *   EAC 入口中心: (-2.25, 2.40, 0.0)  ← Step1で定義
 *   Z+ : 耳介前面（外側方向）
 *   Z=0: KEMARへの取付け面（EAC入口側）
 *   Z=24.8: 耳介最突出点（耳輪）
 *
 * ▼ シミュレーター座標系への変換
 *   シミュレーター Z+ = 外耳道方向（カメラ側）
 *   外耳道長 ≈ 25mm → 鼓膜(Z=5)から Z≈30 が皮膚表面
 *   pinna Z=0（EAC入口）→ sim Z=30
 *   pinna Z=24.8（耳輪）→ sim Z=54.8
 *
 *   変換:
 *     position = [eacOffset.x, eacOffset.y, 30]  EAC入口を sim Z=30 に合わせる
 *     rotation = [-π/2, 0, 0]  STL Z+ → sim Z+ に回転
 *     EAC入口オフセット補正: x += 2.25, y -= 2.40
 */

import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

// EAC 入口の STL 内座標（Step1 解析値）
const EAC_IN_STL = { x: -2.25, y: 2.40, z: 0.0 };

// シミュレーター上の EAC 入口 Z 座標（外耳道長 25mm + 鼓膜 Z=5）
const EAC_SIM_Z = 30;

interface PinnaModelProps {
  /** 表示/非表示 */
  visible?: boolean;
  /** 不透明度 */
  opacity?: number;
  /** 表面色 */
  color?: string;
}

export function PinnaModel({
  visible = true,
  opacity = 0.85,
  color = '#c8956c',
}: PinnaModelProps) {
  const geometry = useLoader(STLLoader, '/models/pinna_subj_T.stl');

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
  }), [color, opacity]);

  if (!visible) return null;

  // STL は mm 単位 → シミュレーターも mm 単位なのでスケール変換不要
  // EAC入口 (-2.25, 2.40, 0) → sim (0, 0, EAC_SIM_Z) に補正
  const posX = 0 - EAC_IN_STL.x;   // +2.25
  const posY = 0 - EAC_IN_STL.y;   // -2.40
  const posZ = EAC_SIM_Z - EAC_IN_STL.z; // 30.0

  return (
    <mesh
      geometry={geometry}
      material={mat}
      position={[posX, posY, posZ]}
      rotation={[
        -Math.PI / 2,  // STL Y+ → sim Y+ (STL の Z+ を sim の Z+ に向ける)
        0,
        Math.PI,       // 左耳を正しい向きに（ミラー補正）
      ]}
      castShadow
      receiveShadow
    />
  );
}

// プリロード
// ※ STLLoader は useGLTF.preload 形式ではなく手動で preload するか
//    Suspense でフォールバックを使う
