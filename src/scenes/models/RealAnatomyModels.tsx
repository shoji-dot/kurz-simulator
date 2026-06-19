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

// ── 解剖構造ごとの色 ──────────────────────────────────────────────
const MAT: Record<string, { color: string; roughness: number; metalness?: number; opacity?: number }> = {
  malleus:   { color: '#e8d4a0', roughness: 0.55 },
  incus:     { color: '#dfc890', roughness: 0.55 },
  stapes:    { color: '#d8bc7c', roughness: 0.50 },
  tympanic:  { color: '#f4a898', roughness: 0.72, opacity: 0.85 },
  scalaTym:  { color: '#7ec4e0', roughness: 0.60, opacity: 0.80 },
  scalaVest: { color: '#9ad4f0', roughness: 0.60, opacity: 0.80 },
  facial:    { color: '#f0e060', roughness: 0.65, opacity: 0.90 },
  chorda:    { color: '#f0c840', roughness: 0.65, opacity: 0.88 },
  eac:       { color: '#e0c8a8', roughness: 0.68, opacity: 0.30 },
  roundWin:  { color: '#4a88a8', roughness: 0.28 },
  nerve:     { color: '#f8f060', roughness: 0.60, opacity: 0.80 },
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

// ── 全解剖構造セット（学習モード用）─────────────────────────────
interface RealAnatomyProps {
  showNerves?: boolean;
  showInnerEar?: boolean;
  showEAC?: boolean;
}

export function RealAnatomy({
  showNerves   = true,
  showInnerEar = true,
  showEAC      = true,
}: RealAnatomyProps) {
  return (
    <group>
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
