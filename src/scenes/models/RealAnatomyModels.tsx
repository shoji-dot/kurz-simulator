/**
 * RealAnatomyModels.tsx  ── ALPHA データセット由来の実解剖学的3Dモデル
 *
 * 側頭骨CBCTセグメンテーション（2018年）から生成されたPLYを
 * GLBに変換して読み込む。
 *
 * ▼ 座標系
 *   全GLBはアブミ骨底板を原点(0,0,0)として配置済み。
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 *
 *   使用時は <group position={STAPES_FOOTPLATE}> で包んで
 *   シーン座標系に配置すること。
 */

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ── 解剖構造ごとのマテリアル設定 ─────────────────────────────────
// 解剖標本（ホルマリン固定）のような質感を目標とする
const MAT: Record<string, { color: string; roughness: number; metalness?: number; opacity?: number }> = {
  // 耳小骨: 象牙質・骨の質感（乳白色〜黄白色、やや光沢あり）
  malleus:   { color: '#f0e6c8', roughness: 0.38, metalness: 0.04 },
  incus:     { color: '#eee0be', roughness: 0.38, metalness: 0.04 },
  stapes:    { color: '#e8d8a8', roughness: 0.35, metalness: 0.06 },
  // 鼓膜: 半透明の薄い膜（真珠光沢）
  tympanic:  { color: '#f8d8c0', roughness: 0.55, metalness: 0.02, opacity: 0.75 },
  // 蝸牛（膜迷路）: 水色系、半透明
  scalaTym:  { color: '#60b8e0', roughness: 0.45, metalness: 0.0, opacity: 0.82 },
  scalaVest: { color: '#80cce8', roughness: 0.45, metalness: 0.0, opacity: 0.78 },
  // 顔面神経: 解剖学的標準色（黄色）
  facial:    { color: '#f5d820', roughness: 0.60, metalness: 0.0, opacity: 0.92 },
  // 鼓索神経: 顔面神経より細い・やや橙味
  chorda:    { color: '#f0b830', roughness: 0.62, metalness: 0.0, opacity: 0.90 },
  // 外耳道: ほぼ透明な骨質（輪郭把握用）
  eac:       { color: '#d8c8a0', roughness: 0.70, metalness: 0.0, opacity: 0.18 },
  // 正円窓: 濃青灰（膜性）
  roundWin:  { color: '#5888a8', roughness: 0.30, metalness: 0.05 },
  // 蝸牛前庭神経: 明黄色
  nerve:     { color: '#f8e840', roughness: 0.58, metalness: 0.0, opacity: 0.85 },
  // 側頭骨: 皮質骨（白〜淡黄色、やや光沢）
  bone:      { color: '#f2ead8', roughness: 0.42, metalness: 0.05, opacity: 0.88 },
  // 耳介: 皮膚質感（やや暖色、マット）
  auricle:   { color: '#e8c8a8', roughness: 0.72, metalness: 0.0 },
};

// ── 単一GLBローダー ──────────────────────────────────────────────
interface GLBMeshProps {
  url: string;
  matKey: keyof typeof MAT;
  castShadow?: boolean;
}

function GLBMesh({ url, matKey, castShadow = true }: GLBMeshProps) {
  const { scene } = useGLTF(url);
  const cfg = MAT[matKey];

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: cfg.roughness,
      metalness: cfg.metalness ?? 0.05,
      transparent: (cfg.opacity ?? 1) < 1,
      opacity: cfg.opacity ?? 1,
      side: THREE.DoubleSide,
    });
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material = mat;
        m.castShadow = castShadow;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, cfg, castShadow]);

  return <primitive object={cloned} />;
}

// ── 耳小骨3骨（Real Ossicles）─────────────────────────────────────
export function RealOssicles() {
  return (
    <group>
      <GLBMesh url="/models/Malleus.glb" matKey="malleus" />
      <GLBMesh url="/models/Incus.glb"   matKey="incus"   />
      <GLBMesh url="/models/Stapes.glb"  matKey="stapes"  />
    </group>
  );
}

// ── 鼓膜（Real Tympanic Membrane）────────────────────────────────
export function RealTympanicMembrane() {
  return <GLBMesh url="/models/Tympanic_Membrane.glb" matKey="tympanic" castShadow={false} />;
}

// ── 内耳（Real Inner Ear）────────────────────────────────────────
// Scala Tympani + Scala Vestibuli で蝸牛を表現
export function RealInnerEar() {
  return (
    <group>
      <GLBMesh url="/models/Scala_Tympani.glb"  matKey="scalaTym"  castShadow={false} />
      <GLBMesh url="/models/Scala_Vestibuli.glb" matKey="scalaVest" castShadow={false} />
    </group>
  );
}

// ── 神経系（Real Nerves）─────────────────────────────────────────
export function RealNerves() {
  return (
    <group>
      <GLBMesh url="/models/Facial_Nerve.glb"            matKey="facial" castShadow={false} />
      <GLBMesh url="/models/Chorda_Tympani.glb"          matKey="chorda" castShadow={false} />
      <GLBMesh url="/models/Cochleo_Vestibular_Nerve.glb" matKey="nerve"  castShadow={false} />
    </group>
  );
}

// ── 外耳道（Real EAC）────────────────────────────────────────────
export function RealEAC() {
  return <GLBMesh url="/models/External_Auditory_Canal.glb" matKey="eac" castShadow={false} />;
}

// ── 正円窓（Real Round Window）───────────────────────────────────
export function RealRoundWindow() {
  return <GLBMesh url="/models/Round_Window.glb" matKey="roundWin" />;
}

// ── 側頭骨（Temporal Bone）───────────────────────────────────────
// ALPHA CBCTデータから生成（2.3M面→80K面にデシメーション済み）
export function RealTemporalBone() {
  return (
    <GLBMesh
      url="/models/Bone.glb"
      matKey="bone"
      castShadow={false}
    />
  );
}

// ── 耳介（Auricle / Pinna）───────────────────────────────────────
// 解剖学的計測値から手続き的に生成（helix・concha・lobule）
export function RealAuricle() {
  return <GLBMesh url="/models/Auricle.glb" matKey="auricle" />;
}

// ── 全解剖構造セット（学習モード用）─────────────────────────────
interface RealAnatomyProps {
  showNerves?:  boolean;
  showInnerEar?: boolean;
  showEAC?:     boolean;
  showBone?:    boolean;
  showAuricle?: boolean;
}

export function RealAnatomy({
  showNerves   = true,
  showInnerEar = true,
  showEAC      = true,
  showBone     = true,
  showAuricle  = true,
}: RealAnatomyProps) {
  return (
    <group>
      {showBone     && <RealTemporalBone />}
      {showAuricle  && <RealAuricle />}
      <RealTympanicMembrane />
      <RealOssicles />
      <RealRoundWindow />
      {showInnerEar && <RealInnerEar />}
      {showNerves   && <RealNerves />}
      {showEAC      && <RealEAC />}
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
