/**
 * RealAnatomyModels.tsx  ── ALPHA データセット由来の実解剖学的3Dモデル
 *
 * ▼ 座標系
 *   全GLBはアブミ骨底板を原点(0,0,0)として配置済み。
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 */

import { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ── 表示モード型定義 ──────────────────────────────────────────────
export type OpacityMode  = 'solid' | 'ghost' | 'hidden';
export type StructureKey =
  | 'bone' | 'auricle' | 'ossicles' | 'tympanic'
  | 'innerEar' | 'nerves' | 'eac' | 'roundWindow';
export type VisibilityMap = Partial<Record<StructureKey, OpacityMode>>;

/** 各構造のデフォルト表示モード */
export const DEFAULT_MODES: Record<StructureKey, OpacityMode> = {
  bone:        'ghost',   // 骨は初期半透明（内部が見えるように）
  auricle:     'hidden',  // 耳介は初期非表示
  ossicles:    'solid',
  tympanic:    'solid',
  innerEar:    'solid',
  nerves:      'solid',
  eac:         'solid',
  roundWindow: 'solid',
};

const GHOST_OPACITY = 0.12;

// ── マテリアル設定 ────────────────────────────────────────────────
const MAT: Record<string, { color: string; roughness: number; metalness?: number; opacity?: number }> = {
  malleus:   { color: '#f0e6c8', roughness: 0.38, metalness: 0.04 },
  incus:     { color: '#eee0be', roughness: 0.38, metalness: 0.04 },
  stapes:    { color: '#e8d8a8', roughness: 0.35, metalness: 0.06 },
  tympanic:  { color: '#f8d8c0', roughness: 0.55, metalness: 0.02, opacity: 0.72 },
  scalaTym:  { color: '#60b8e0', roughness: 0.45, metalness: 0.0,  opacity: 0.82 },
  scalaVest: { color: '#80cce8', roughness: 0.45, metalness: 0.0,  opacity: 0.78 },
  facial:    { color: '#f5d820', roughness: 0.60, metalness: 0.0,  opacity: 0.92 },
  chorda:    { color: '#f0b830', roughness: 0.62, metalness: 0.0,  opacity: 0.90 },
  eac:       { color: '#d8c8a0', roughness: 0.70, metalness: 0.0,  opacity: 0.20 },
  roundWin:  { color: '#5888a8', roughness: 0.30, metalness: 0.05 },
  nerve:     { color: '#f8e840', roughness: 0.58, metalness: 0.0,  opacity: 0.85 },
  bone:      { color: '#f2ead8', roughness: 0.42, metalness: 0.05 }, // opacity はモードで制御
  auricle:   { color: '#e8c8a8', roughness: 0.72, metalness: 0.0  },
};

// ── 単一GLBローダー ──────────────────────────────────────────────
interface GLBMeshProps {
  url: string;
  matKey: keyof typeof MAT;
  castShadow?: boolean;
  opacityOverride?: number; // undefined = MAT デフォルト使用
}

function GLBMesh({ url, matKey, castShadow = true, opacityOverride }: GLBMeshProps) {
  const { scene } = useGLTF(url);
  const cfg       = MAT[matKey];
  const matRef    = useRef<THREE.MeshStandardMaterial | null>(null);
  // 最新の opacityOverride を useMemo 内で参照するためのリーフRef
  const overrideRef = useRef(opacityOverride);
  overrideRef.current = opacityOverride;

  // scene / cfg / castShadow が変わった時のみ再クローン
  const cloned = useMemo(() => {
    const c   = scene.clone(true);
    const ov  = overrideRef.current;
    const opacity = ov !== undefined ? ov : (cfg.opacity ?? 1);
    const mat = new THREE.MeshStandardMaterial({
      color:      cfg.color,
      roughness:  cfg.roughness,
      metalness:  cfg.metalness ?? 0.05,
      transparent: opacity < 1,
      opacity,
      side:       THREE.DoubleSide,
      depthWrite: opacity >= 0.99,
    });
    matRef.current = mat;
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material     = mat;
        m.castShadow   = castShadow;
        m.receiveShadow = true;
        m.renderOrder  = opacity < 0.99 ? 1 : 0;
      }
    });
    return c;
  }, [scene, cfg, castShadow]);

  // 透明度だけを差分更新（再クローン不要）
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const opacity = opacityOverride !== undefined ? opacityOverride : (cfg.opacity ?? 1);
    mat.opacity     = opacity;
    mat.transparent = opacity < 1;
    mat.depthWrite  = opacity >= 0.99;
    mat.needsUpdate = true;
    // traverse で renderOrder も更新
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.renderOrder = opacity < 0.99 ? 1 : 0;
      }
    });
  }, [opacityOverride, cfg.opacity, cloned]);

  return <primitive object={cloned} />;
}

// ── 各構造コンポーネント ──────────────────────────────────────────
interface StructureProps { opacityOverride?: number }

export function RealOssicles({ opacityOverride }: StructureProps) {
  return (
    <group>
      <GLBMesh url="/models/Malleus.glb" matKey="malleus" opacityOverride={opacityOverride} />
      <GLBMesh url="/models/Incus.glb"   matKey="incus"   opacityOverride={opacityOverride} />
      <GLBMesh url="/models/Stapes.glb"  matKey="stapes"  opacityOverride={opacityOverride} />
    </group>
  );
}

export function RealTympanicMembrane({ opacityOverride }: StructureProps) {
  return (
    <GLBMesh
      url="/models/Tympanic_Membrane.glb"
      matKey="tympanic"
      castShadow={false}
      opacityOverride={opacityOverride}
    />
  );
}

export function RealInnerEar({ opacityOverride }: StructureProps) {
  return (
    <group>
      <GLBMesh url="/models/Scala_Tympani.glb"   matKey="scalaTym"  castShadow={false} opacityOverride={opacityOverride} />
      <GLBMesh url="/models/Scala_Vestibuli.glb"  matKey="scalaVest" castShadow={false} opacityOverride={opacityOverride} />
    </group>
  );
}

export function RealNerves({ opacityOverride }: StructureProps) {
  return (
    <group>
      <GLBMesh url="/models/Facial_Nerve.glb"             matKey="facial" castShadow={false} opacityOverride={opacityOverride} />
      <GLBMesh url="/models/Chorda_Tympani.glb"           matKey="chorda" castShadow={false} opacityOverride={opacityOverride} />
      <GLBMesh url="/models/Cochleo_Vestibular_Nerve.glb" matKey="nerve"  castShadow={false} opacityOverride={opacityOverride} />
    </group>
  );
}

export function RealEAC({ opacityOverride }: StructureProps) {
  return (
    <GLBMesh
      url="/models/External_Auditory_Canal.glb"
      matKey="eac"
      castShadow={false}
      opacityOverride={opacityOverride}
    />
  );
}

export function RealRoundWindow({ opacityOverride }: StructureProps) {
  return <GLBMesh url="/models/Round_Window.glb" matKey="roundWin" opacityOverride={opacityOverride} />;
}

export function RealTemporalBone({ opacityOverride }: StructureProps) {
  return (
    <GLBMesh
      url="/models/Bone.glb"
      matKey="bone"
      castShadow={false}
      opacityOverride={opacityOverride}
    />
  );
}

/**
 * 耳介（Auricle / Pinna）
 *
 * ▼ 位置補正
 *   生成時の keypoints は原点付近（Z≈0）にあるため、
 *   ここで外耳道開口部相当の Z+42mm へ移動する。
 *   外耳道長（約25mm）＋鼓膜〜外耳道開口部（約17mm）≒ 42mm 側方
 */
export function RealAuricle({ opacityOverride }: StructureProps) {
  return (
    <group position={[0, 0, 42]}>
      <GLBMesh url="/models/Auricle.glb" matKey="auricle" opacityOverride={opacityOverride} />
    </group>
  );
}

// ── 全解剖構造セット ─────────────────────────────────────────────
export function RealAnatomy({ vis = {} }: { vis?: VisibilityMap }) {
  const getMode  = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];
  const show     = (key: StructureKey) => getMode(key) !== 'hidden';
  const opacity  = (key: StructureKey): number | undefined =>
    getMode(key) === 'ghost' ? GHOST_OPACITY : undefined;

  return (
    <group>
      {show('bone')        && <RealTemporalBone    opacityOverride={opacity('bone')}        />}
      {show('auricle')     && <RealAuricle          opacityOverride={opacity('auricle')}     />}
      {show('tympanic')    && <RealTympanicMembrane opacityOverride={opacity('tympanic')}    />}
      {show('ossicles')    && <RealOssicles          opacityOverride={opacity('ossicles')}    />}
      {show('roundWindow') && <RealRoundWindow       opacityOverride={opacity('roundWindow')} />}
      {show('innerEar')    && <RealInnerEar          opacityOverride={opacity('innerEar')}    />}
      {show('nerves')      && <RealNerves            opacityOverride={opacity('nerves')}      />}
      {show('eac')         && <RealEAC              opacityOverride={opacity('eac')}         />}
    </group>
  );
}

// ── Preload ───────────────────────────────────────────────────────
useGLTF.preload('/models/Malleus.glb');
useGLTF.preload('/models/Incus.glb');
useGLTF.preload('/models/Stapes.glb');
useGLTF.preload('/models/Tympanic_Membrane.glb');
useGLTF.preload('/models/Scala_Tympani.glb');
useGLTF.preload('/models/Scala_Vestibuli.glb');
useGLTF.preload('/models/Facial_Nerve.glb');
useGLTF.preload('/models/Chorda_Tympani.glb');
useGLTF.preload('/models/Cochleo_Vestibular_Nerve.glb');
useGLTF.preload('/models/External_Auditory_Canal.glb');
useGLTF.preload('/models/Round_Window.glb');
useGLTF.preload('/models/Bone.glb');
useGLTF.preload('/models/Auricle.glb');
