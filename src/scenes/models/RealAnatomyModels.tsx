/**
 * RealAnatomyModels.tsx  -- ALPHA dataset real anatomical 3D models
 *
 * Coordinate system:
 *   All GLBs are placed with stapes footplate at origin (0,0,0).
 *   Z+ = toward EAC (camera side)
 *   Y+ = up
 */

import { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// -- Display mode types --
export type OpacityMode  = 'solid' | 'ghost' | 'hidden';

/** 耳介の位置・回転・左右反転を自由に調整するためのデバッグ用トランスフォーム */
export interface AuricleTransform {
  /** 位置オフセット [x, y, z] (mm単位、GLB座標系) */
  position: [number, number, number];
  /** 回転角度 [x, y, z] (ラジアン) */
  rotation: [number, number, number];
  /** 表裏反転（X軸スケール -1） */
  flip: boolean;
}

export const DEFAULT_AURICLE_TRANSFORM: AuricleTransform = {
  position: [0, 0, 42],   // Auricle.glb: Z+42mm = 外耳道開口部相当（セッション12暫定値）
  rotation: [0, 0, 0],
  flip: false,
};

export type StructureKey =
  | 'bone' | 'auricle' | 'ossicles'
  | 'malleus' | 'incus' | 'stapes'
  | 'tympanic'
  | 'innerEar' | 'facialNerve' | 'chordaTympani' | 'eac' | 'roundWindow';
export type VisibilityMap = Partial<Record<StructureKey, OpacityMode>>;

/** 個別制御する耳小骨キー */
export const OSSICLE_KEYS = ['malleus', 'incus', 'stapes'] as const;

export const DEFAULT_MODES: Record<StructureKey, OpacityMode> = {
  bone:          'ghost',
  auricle:       'hidden',
  ossicles:      'solid',   // 後方互換: 個別キー未指定時のフォールバック
  malleus:       'solid',
  incus:         'solid',
  stapes:        'solid',
  tympanic:      'solid',
  innerEar:      'solid',
  facialNerve:   'solid',
  chordaTympani: 'solid',
  eac:           'solid',
  roundWindow:   'solid',
};

export const GHOST_OPACITY = 0.12;

// -- Material config --
const MAT: Record<string, { color: string; roughness: number; metalness?: number; opacity?: number }> = {
  // 耳小骨：側頭骨（淡クリーム）と明確に区別するゴールド〜アンバー系。
  // 3骨それぞれを微妙に色相変化させ、連鎖内での識別も容易にする。
  malleus:   { color: '#e6a93a', roughness: 0.34, metalness: 0.32 },  // ツチ骨：ウォームゴールド
  incus:     { color: '#d9892a', roughness: 0.34, metalness: 0.32 },  // キヌタ骨：ディープアンバー
  stapes:    { color: '#f2cb54', roughness: 0.30, metalness: 0.40 },  // アブミ骨：ブライトゴールド
  tympanic:  { color: '#f8d8c0', roughness: 0.55, metalness: 0.02, opacity: 0.72 },
  scalaTym:  { color: '#60b8e0', roughness: 0.45, metalness: 0.0,  opacity: 0.82 },
  scalaVest: { color: '#80cce8', roughness: 0.45, metalness: 0.0,  opacity: 0.78 },
  facial:    { color: '#f5d820', roughness: 0.60, metalness: 0.0,  opacity: 0.92 },
  chorda:    { color: '#f0b830', roughness: 0.62, metalness: 0.0,  opacity: 0.90 },
  eac:       { color: '#d8c8a0', roughness: 0.70, metalness: 0.0,  opacity: 0.20 },
  roundWin:  { color: '#5888a8', roughness: 0.30, metalness: 0.05 },
  nerve:     { color: '#f8e840', roughness: 0.58, metalness: 0.0,  opacity: 0.85 },
  bone:      { color: '#f2ead8', roughness: 0.42, metalness: 0.05 },
  // Auricle.glb: same OpenEar ALPHA CT as Bone.glb -- no offset needed, opacity 0.55
  auricle:   { color: '#e8c8a8', roughness: 0.72, metalness: 0.0,  opacity: 0.55 },
};

// -- GLB mesh loader --
interface GLBMeshProps {
  url: string;
  matKey: keyof typeof MAT;
  castShadow?: boolean;
  opacityOverride?: number;
  /** ハイライト表示（emissive glow） */
  highlighted?: boolean;
}

function GLBMesh({ url, matKey, castShadow = true, opacityOverride, highlighted }: GLBMeshProps) {
  const { scene } = useGLTF(url);
  const cfg       = MAT[matKey];
  const matRef    = useRef<THREE.MeshStandardMaterial | null>(null);
  const overrideRef = useRef(opacityOverride);
  overrideRef.current = opacityOverride;

  const cloned = useMemo(() => {
    const c   = scene.clone(true);
    const ov  = overrideRef.current;
    const opacity = ov !== undefined ? ov : (cfg.opacity ?? 1);
    const mat = new THREE.MeshStandardMaterial({
      color:       cfg.color,
      roughness:   cfg.roughness,
      metalness:   cfg.metalness ?? 0.05,
      transparent: opacity < 1,
      opacity,
      side:        THREE.DoubleSide,
      depthWrite:  opacity >= 0.99,
    });
    matRef.current = mat;
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material      = mat;
        m.castShadow    = castShadow;
        m.receiveShadow = true;
        m.renderOrder   = opacity < 0.99 ? 1 : 0;
      }
    });
    return c;
  }, [scene, cfg, castShadow]);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const opacity = opacityOverride !== undefined ? opacityOverride : (cfg.opacity ?? 1);
    mat.opacity     = opacity;
    mat.transparent = opacity < 1;
    mat.depthWrite  = opacity >= 0.99;
    mat.needsUpdate = true;
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.renderOrder = opacity < 0.99 ? 1 : 0;
      }
    });
  }, [opacityOverride, cfg.opacity, cloned]);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    if (highlighted) {
      mat.emissive.set(cfg.color);
      mat.emissiveIntensity = 0.55;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0;
    }
    mat.needsUpdate = true;
  }, [highlighted, cfg.color]);

  return <primitive object={cloned} />;
}

// -- Individual structure components --
interface StructureProps { opacityOverride?: number; highlighted?: boolean }

export function RealMalleus({ opacityOverride, highlighted }: StructureProps) {
  return <GLBMesh url="/models/Malleus.glb" matKey="malleus" opacityOverride={opacityOverride} highlighted={highlighted} />;
}
export function RealIncus({ opacityOverride, highlighted }: StructureProps) {
  return <GLBMesh url="/models/Incus.glb" matKey="incus" opacityOverride={opacityOverride} highlighted={highlighted} />;
}
export function RealStapes({ opacityOverride, highlighted }: StructureProps) {
  return <GLBMesh url="/models/Stapes.glb" matKey="stapes" opacityOverride={opacityOverride} highlighted={highlighted} />;
}

export function RealOssicles({ opacityOverride, highlighted }: StructureProps) {
  return (
    <group>
      <RealMalleus opacityOverride={opacityOverride} highlighted={highlighted} />
      <RealIncus   opacityOverride={opacityOverride} highlighted={highlighted} />
      <RealStapes  opacityOverride={opacityOverride} highlighted={highlighted} />
    </group>
  );
}

export function RealTympanicMembrane({ opacityOverride, highlighted }: StructureProps) {
  return (
    <GLBMesh
      url="/models/Tympanic_Membrane.glb"
      matKey="tympanic"
      castShadow={false}
      opacityOverride={opacityOverride}
      highlighted={highlighted}
    />
  );
}

export function RealInnerEar({ opacityOverride, highlighted }: StructureProps) {
  return (
    <group>
      <GLBMesh url="/models/Scala_Tympani.glb"           matKey="scalaTym"  castShadow={false} opacityOverride={opacityOverride} highlighted={highlighted} />
      <GLBMesh url="/models/Scala_Vestibuli.glb"          matKey="scalaVest" castShadow={false} opacityOverride={opacityOverride} highlighted={highlighted} />
      <GLBMesh url="/models/Cochleo_Vestibular_Nerve.glb" matKey="nerve"     castShadow={false} opacityOverride={opacityOverride} highlighted={highlighted} />
    </group>
  );
}

export function RealFacialNerve({ opacityOverride, highlighted }: StructureProps) {
  return (
    <GLBMesh url="/models/Facial_Nerve.glb" matKey="facial" castShadow={false} opacityOverride={opacityOverride} highlighted={highlighted} />
  );
}
export function RealChordaTympani({ opacityOverride, highlighted }: StructureProps) {
  return (
    <GLBMesh url="/models/Chorda_Tympani.glb" matKey="chorda" castShadow={false} opacityOverride={opacityOverride} highlighted={highlighted} />
  );
}

export function RealEAC({ opacityOverride, highlighted }: StructureProps) {
  return (
    <GLBMesh
      url="/models/External_Auditory_Canal.glb"
      matKey="eac"
      castShadow={false}
      opacityOverride={opacityOverride}
      highlighted={highlighted}
    />
  );
}

export function RealRoundWindow({ opacityOverride, highlighted }: StructureProps) {
  return <GLBMesh url="/models/Round_Window.glb" matKey="roundWin" opacityOverride={opacityOverride} highlighted={highlighted} />;
}

export function RealTemporalBone({ opacityOverride, highlighted }: StructureProps) {
  return (
    <GLBMesh
      url="/models/Bone.glb"
      matKey="bone"
      castShadow={false}
      opacityOverride={opacityOverride}
      highlighted={highlighted}
    />
  );
}

/**
 * Auricle (Pinna)
 *
 * Auricle.glb is from the same OpenEar ALPHA CT scan as Bone.glb.
 * Already aligned in the same GLB coordinate space (measured Z: 6.65-24.85).
 * transform プロパティで位置・回転・表裏反転をデバッグ調整できる。
 */
interface AuricleProps extends StructureProps {
  transform?: AuricleTransform;
}
export function RealAuricle({ opacityOverride, transform }: AuricleProps) {
  const t = transform ?? DEFAULT_AURICLE_TRANSFORM;
  return (
    <group
      position={t.position}
      rotation={t.rotation}
      scale={t.flip ? [-1, 1, 1] : [1, 1, 1]}
    >
      <GLBMesh url="/models/Auricle.glb" matKey="auricle" opacityOverride={opacityOverride} />
    </group>
  );
}

// -- Full anatomy set --
interface RealAnatomyProps {
  vis?: VisibilityMap;
  auricleTransform?: AuricleTransform;
  /** ハイライトする構造キー（StructureKey または 'tympanic'/'membrane'） */
  highlightedKey?: string | null;
}
export function RealAnatomy({ vis = {}, auricleTransform, highlightedKey }: RealAnatomyProps) {
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];
  const show    = (key: StructureKey) => getMode(key) !== 'hidden';
  const opacity = (key: StructureKey): number | undefined =>
    getMode(key) === 'ghost' ? GHOST_OPACITY : undefined;
  const hl      = (key: string) => highlightedKey === key;

  // 耳小骨の個別モード：個別キー → 旧 ossicles キー → デフォルト の順でフォールバック
  const ossicleMode = (key: 'malleus' | 'incus' | 'stapes'): OpacityMode =>
    vis[key] ?? vis.ossicles ?? DEFAULT_MODES[key];
  const ossicleShow    = (key: 'malleus' | 'incus' | 'stapes') => ossicleMode(key) !== 'hidden';
  const ossicleOpacity = (key: 'malleus' | 'incus' | 'stapes'): number | undefined =>
    ossicleMode(key) === 'ghost' ? GHOST_OPACITY : undefined;

  return (
    <group>
      {show('bone')          && <RealTemporalBone    opacityOverride={opacity('bone')}          highlighted={hl('bone')} />}
      {show('auricle')       && <RealAuricle          opacityOverride={opacity('auricle')}       transform={auricleTransform} />}
      {show('tympanic')      && <RealTympanicMembrane opacityOverride={opacity('tympanic')}      highlighted={hl('tympanic') || hl('membrane')} />}
      {ossicleShow('malleus') && <RealMalleus opacityOverride={ossicleOpacity('malleus')} highlighted={hl('malleus')} />}
      {ossicleShow('incus')   && <RealIncus   opacityOverride={ossicleOpacity('incus')}   highlighted={hl('incus')} />}
      {ossicleShow('stapes')  && <RealStapes  opacityOverride={ossicleOpacity('stapes')}  highlighted={hl('stapes')} />}
      {show('roundWindow')   && <RealRoundWindow       opacityOverride={opacity('roundWindow')}   highlighted={hl('roundWindow')} />}
      {show('innerEar')      && <RealInnerEar          opacityOverride={opacity('innerEar')}      highlighted={hl('innerEar')} />}
      {show('facialNerve')   && <RealFacialNerve       opacityOverride={opacity('facialNerve')}   highlighted={hl('facialNerve')} />}
      {show('chordaTympani') && <RealChordaTympani     opacityOverride={opacity('chordaTympani')} highlighted={hl('chordaTympani')} />}
      {show('eac')           && <RealEAC               opacityOverride={opacity('eac')}           highlighted={hl('eac')} />}
    </group>
  );
}

// -- Preload --
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
