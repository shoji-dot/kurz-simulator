/**
 * RealAnatomyModels.tsx  -- ALPHA dataset real anatomical 3D models
 *
 * Coordinate system:
 *   All GLBs are placed with stapes footplate at origin (0,0,0).
 *   Z+ = toward EAC (camera side)
 *   Y+ = up
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

// -- Display mode types --
export type OpacityMode  = 'solid' | 'ghost' | 'hidden';

/** 耳介の位置・回転・左右反転を自由に調整するためのデバッグ用トランスフォーム */
export interface AuricleTransform {
  /** 位置オフセット [x, y, z] (mm単位、GLB座標系) */
  position: [number, number, number];
  /** 回転角度 [x, y, z] (ラジアン) */
  rotation: [number, number, number];
  /** スケール（傾き） [x, y, z] — 1.0が等倍 */
  scale: [number, number, number];
  /** 表裏反転（X軸スケール符号反転） */
  flip: boolean;
}

export const DEFAULT_AURICLE_TRANSFORM: AuricleTransform = {
  // 正規化済みGLB（XY centroid=0, Zmin=0）を Bone.glb 座標に合わせる確定値
  // scale/rotation/position は Auricle_aligned.glb の焼き込みパラメータと同一
  position: [-4, 16, 18],
  rotation: [-0.8378, -0.2094, -3.1416],
  scale: [0.910, 1.440, 0.300],
  flip: true,
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
  bone:          'solid',
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

export const GHOST_OPACITY = 0.18;

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

        // ── 法線スムージング ──────────────────────────────────────────
        // 医療CTセグメンテーション由来のメッシュはフラット法線が多く、
        // 継ぎ接ぎ感の原因になる。ジオメトリをクローンして頂点法線を
        // 再計算することで、ジオメトリを変えずに滑らかな見た目にする。
        const geo = m.geometry.clone();
        geo.deleteAttribute('normal');   // 既存の面法線を削除
        geo.computeVertexNormals();      // 隣接面を平均した頂点法線を生成
        m.geometry = geo;
        // ────────────────────────────────────────────────────────────

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

/**
 * StapesFootplateHighlight
 *
 * アブミ骨底板（footplate）が残存する症例（footplate-only / absent など）で
 * 底板位置を視覚的に強調するオーバーレイ。
 * GLB_OFFSETグループ内に配置 → 世界座標でアブミ骨底板上に現れる。
 *
 * 底板解剖:  ~3.0mm × 1.4mm の楕円形プレート
 * GLB座標系: 底板は原点 (0,0,0) 付近、アブミ骨は Z+ 方向に伸びる
 * → XY平面 (rotation無し) に楕円ディスクを配置
 */
export function StapesFootplateHighlight() {
  // パルスアニメーション用
  const [t, setT] = useState(0);
  useEffect(() => {
    let id: number;
    const animate = () => {
      setT((prev) => prev + 0.04);
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);
  const pulse = 0.55 + 0.45 * Math.sin(t);

  // 楕円シェイプ: 長軸 3.0mm (X), 短軸 1.4mm (Y)
  const ellipseShape = useMemo(() => {
    const s = new THREE.Shape();
    s.ellipse(0, 0, 1.5, 0.7, 0, Math.PI * 2, false, 0);
    return s;
  }, []);

  return (
    <group position={[0, 0, 0]}>
      {/* メイン底板ディスク（シアン発光） */}
      <mesh renderOrder={2}>
        <shapeGeometry args={[ellipseShape]} />
        <meshStandardMaterial
          color="#00e5ff"
          emissive="#00e5ff"
          emissiveIntensity={1.2 * pulse}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 外縁グローリング */}
      <mesh renderOrder={1}>
        <ringGeometry args={[1.6, 2.4, 48]} />
        <meshStandardMaterial
          color="#00b4d8"
          emissive="#00b4d8"
          emissiveIntensity={0.7 * pulse}
          transparent
          opacity={0.35 * pulse}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* ラベル */}
      <Html position={[0, 2.2, 0]} center distanceFactor={20} zIndexRange={[10, 20]}>
        <div style={{
          background: 'rgba(0,30,50,.85)',
          border: '1px solid #00e5ff',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 10,
          color: '#00e5ff',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          fontFamily: 'sans-serif',
          letterSpacing: '0.05em',
        }}>
          🔵 底板 (Footplate)
        </div>
      </Html>
    </group>
  );
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
 * Auricle (Pinna) — 患者別GLB版
 *
 * Auricle_aligned.glb は subj_T に確定トランスフォームを焼き込み済み（identity表示）。
 * 他の患者GLBは正規化のみ（XY centroid=0, Zmin=0）なので、
 * React側で同じトランスフォームを適用して Bone.glb 座標系に合わせる。
 *
 * 焼き込みパラメータ（subj_T 実測確定値）:
 *   scale    [0.910 * -1(flip), 1.440, 0.300]
 *   rotation [-0.8378, -0.2094, -3.1416] (XYZ Euler rad)
 *   position [-4, 16, 18]
 */

/** 正規化済みGLB（XY centroid=0, Zmin=0）を Bone.glb 座標に合わせるトランスフォーム */
const SCAN_ALIGN_TRANSFORM: AuricleTransform = {
  position: [-4, 16, 18],
  rotation: [-0.8378, -0.2094, -3.1416],
  scale:    [0.910, 1.440, 0.300],
  flip:     true,
};

const ALL_PATIENT_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'] as const;

function scanGlbUrl(patientId?: string): string {
  const id = patientId?.toUpperCase() ?? 'T';
  const valid = (ALL_PATIENT_LETTERS as readonly string[]).includes(id);
  return valid
    ? `/models/ears/Auricle_${id}.glb`
    : '/models/ears/Auricle_aligned.glb';
}

interface AuricleProps extends StructureProps {
  transform?: AuricleTransform;
  patientId?: string;
}
export function RealAuricle({ opacityOverride, transform, patientId }: AuricleProps) {
  const url = scanGlbUrl(patientId);
  // デバッグ用 transform が渡されていればそれを優先、なければアライン済みトランスフォームを使用
  const t   = transform ?? SCAN_ALIGN_TRANSFORM;
  const sc  = t.scale ?? [1, 1, 1];
  const flipX = t.flip ? -1 : 1;
  return (
    <group
      position={t.position}
      rotation={t.rotation}
      scale={[sc[0] * flipX, sc[1], sc[2]]}
    >
      <GLBMesh url={url} matKey="auricle" opacityOverride={opacityOverride} />
    </group>
  );
}

// -- Full anatomy set --
interface RealAnatomyProps {
  vis?: VisibilityMap;
  auricleTransform?: AuricleTransform;
  /** ハイライトする構造キー（StructureKey または 'tympanic'/'membrane'） */
  highlightedKey?: string | null;
  /** 耳介スキャンID (T/J/A/H/E) */
  patientId?: string;
  /** 側頭骨のghost時不透明度（0–1、デフォルト GHOST_OPACITY=0.18） */
  boneGhostOpacity?: number;
}
export function RealAnatomy({ vis = {}, auricleTransform, highlightedKey, patientId, boneGhostOpacity }: RealAnatomyProps) {
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];
  const show    = (key: StructureKey) => getMode(key) !== 'hidden';
  const opacity = (key: StructureKey): number | undefined => {
    if (getMode(key) !== 'ghost') return undefined;
    if (key === 'bone') return boneGhostOpacity ?? GHOST_OPACITY;
    return GHOST_OPACITY;
  };
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
      {show('auricle')       && <RealAuricle          opacityOverride={opacity('auricle')}       transform={auricleTransform} patientId={patientId} />}
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
// 実スキャン耳介（PatientId 対応 5件）
useGLTF.preload('/models/ears/Auricle_aligned.glb');
