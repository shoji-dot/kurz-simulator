/**
 * InteractiveDrillScene.tsx  ─── S6: インタラクティブ削開練習
 *
 * 3mm 球形ダイヤモンドバー（KURZ TTP-VARIAC に付属の指示ドリルを想定）で
 * 側頭骨を削開するインタラクティブシミュレーション。
 *
 * フラグメントシェーダーで vWorldPos が drillRadius 内に入ったら discard することで
 * 骨が「溶けるように削れる」視覚表現を実現する。
 *
 * 操作:
 *   Drill ON 時  : 左ドラッグ = 削開 / 右ドラッグ = 視点回転
 *   Drill OFF 時 : 左ドラッグ = 視点回転
 */

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DANGER_ZONES } from '../data/dangerZones';
import { regionAt, BONE_MATERIALS, remainingThicknessToDanger } from '../engine/boneMaterial';
import { DEFAULT_BURR, DRILL_BURRS, getBurrById } from '../engine/drillModel';
import { computeContactAngleDeg, growthRateMmPerSec, advanceHole } from '../engine/removalModel';
import { DrillAudioEngine, computeAudioState } from '../engine/audioEngine';
import { computeDangerState, dangerTintColor } from '../engine/dangerModel';
import { selectEducationCard } from '../engine/educationCards';
import {
  computeScoreBreakdown, stepDamageTracker, initialDamageTrackerState,
  appendScoreHistory, generateScoreReview,
} from '../engine/scoring';
import type { ScoreReviewItem } from '../engine/scoring';
import type { DrillHoleState, RpmPreset, EducationCardContent, ScoreBreakdown, DamageEvent } from '../engine/types';


// ── FovController: 顕微鏡モード FOV 切替 ─────────────────────────────
const DRILL_VIEW_FOV: Record<string, number> = {
  normal:     38,
  microscope: 12,
  endoscope:  110,
};
function FovController({ viewMode }: { viewMode: string }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = DRILL_VIEW_FOV[viewMode] ?? 38;
    cam.updateProjectionMatrix();
  }, [viewMode, camera]);
  return null;
}

// ── 定数 ──────────────────────────────────────────────────────────────
const MAX_HOLES      = 200;  // シェーダー配列サイズ（WebGL2上限内で200まで実用的）
const DRILL_RADIUS   = 1.5;  // 3mm 径バーの半径 (scene unit = 1mm)
const MIN_HOLE_DIST  = 0.55; // 連続ホール間の最小距離 mm
const DRILL_INTERVAL = 80;   // ms ごとに 1 ホール追加
// WARN_DIST/DANGER_DIST は T7 dangerModel.ts の WARN_DIST_MM/DANGER_DIST_MM を re-export importで使用
const BASE_BONE_COLOR = '#c8b090'; // T7: 色透見ブレンドの基準色（DrillBoneの既定骨色と同値）
const OTIC_WASTE_RADIUS_THRESHOLD_MM = 0.3; // T9: oticCapsuleホールを「誤削開」とみなす最小成長半径

// T10: 荷重・RPM・バー選択はInteractiveDrillScene本体の内部UIで管理する（旧cutterSizeMm橋渡しを廃止）。

// 乳突洞（Mastoid Antrum）推定位置
// 算出根拠: EAC後壁(X≈2)後方5.5mm, 側頭線(Y≈10)下方3mm, 外側皮質(Z≈26)深部13mm
// Bone.glb 解剖学的実測値 2026-06-24
// Bone.glb 実測値に基づく修正済み座標（2026-06-24検証）
// 深さ: 外側皮質(Z≈22)から12mm → Z=10.0
// 前後: EAC後壁(X≈1.8)後方5.3mm → X=-3.5  ✓
// 上下: 側頭線(Y≈9.4)下方2.4mm → Y=7.0  ✓
// Tegmen（上壁）まで2.7mm → 解剖学的に妥当
const ANTRUM_POS          = new THREE.Vector3(-3.5, 7.0, 10.0);
const ANTRUM_RADIUS       = 3.5;   // 乳突洞半径 mm（成人平均）
const ANTRUM_REACHED_DIST = 2.5;   // 到達判定距離 mm

// ── ドリルホールシェーダー注入ユーティリティ ─────────────────────────
function applyDrillShader(
  mat: THREE.MeshStandardMaterial,
  uniforms: {
    drillHoles:     { value: THREE.Vector3[] };
    drillHoleCount: { value: number };
    drillHoleRadii: { value: number[] };
  }
) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // Vertex: vDrillWorldPos varying を追加
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'varying vec3 vDrillWorldPos;\nvoid main() {'
      )
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvDrillWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );

    // Fragment: discard inside drill holes (per-hole radius)
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `varying vec3 vDrillWorldPos;
uniform int  drillHoleCount;
uniform float drillHoleRadii[${MAX_HOLES}];
uniform vec3 drillHoles[${MAX_HOLES}];
void main() {
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    if (i >= drillHoleCount) break;
    if (distance(vDrillWorldPos, drillHoles[i]) < drillHoleRadii[i]) discard;
  }`
    );
  };
  mat.customProgramCacheKey = () => `drill-bone-${MAX_HOLES}`;
  mat.needsUpdate = true;
}

// ── DrillBone ─────────────────────────────────────────────────────────
type VisMode = 'solid' | 'ghost' | 'hidden';

interface DrillBoneProps {
  uniformsRef: React.MutableRefObject<{
    drillHoles:     { value: THREE.Vector3[] };
    drillHoleCount: { value: number };
    drillHoleRadii: { value: number[] };
  } | null>;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp:   (e: ThreeEvent<PointerEvent>) => void;
  boneVis:       VisMode;
}

function DrillBone({ uniformsRef, onPointerMove, onPointerDown, onPointerUp, boneVis }: DrillBoneProps) {
  const { scene } = useGLTF('/models/Bone.glb');
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([]);

  const cloned = useMemo(() => {
    const sentinels = Array.from({ length: MAX_HOLES }, () => new THREE.Vector3(9999, 9999, 9999));
    const uniforms = {
      drillHoles:     { value: sentinels },
      drillHoleCount: { value: 0 },
      drillHoleRadii: { value: new Array(MAX_HOLES).fill(0.0) as number[] },
    };
    uniformsRef.current = uniforms;
    matRefs.current = [];

    const c = scene.clone(true);
    c.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry.clone();
      geo.deleteAttribute('normal');
      geo.computeVertexNormals();
      mesh.geometry = geo;

      const mat = new THREE.MeshStandardMaterial({
        color:       new THREE.Color('#c8b090'),
        roughness:   0.72,
        metalness:   0.03,
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     1.0,
        depthWrite:  true,
      });
      applyDrillShader(mat, uniforms);
      mesh.material = mat;
      matRefs.current.push(mat);
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    const opacity    = boneVis === 'ghost' ? 0.18 : 1.0;
    const depthWrite = boneVis !== 'ghost';
    matRefs.current.forEach(mat => {
      mat.opacity     = opacity;
      mat.transparent = boneVis === 'ghost';
      mat.depthWrite  = depthWrite;
      // キャッシュキーに透明度を含めてシェーダー再コンパイルを強制
      mat.customProgramCacheKey = () => `drill-bone-${MAX_HOLES}-${boneVis}`;
      mat.needsUpdate = true;
    });
    if (cloned) cloned.visible = boneVis !== 'hidden';
  }, [boneVis, cloned]);

  return (
    <primitive
      object={cloned}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );
}

// ── DrillOssicles: 耳小骨（Malleus / Incus / Stapes）────────────────
const OSSICLE_COLORS = ['#e6a93a', '#d9892a', '#f2cb54'] as const;

function DrillOssicles({ mode }: { mode: VisMode }) {
  const { scene: mScene } = useGLTF('/models/Malleus.glb');
  const { scene: iScene } = useGLTF('/models/Incus.glb');
  const { scene: sScene } = useGLTF('/models/Stapes.glb');
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const clones = useMemo(() => {
    matsRef.current = [];
    return [mScene, iScene, sScene].map((scene, idx) => {
      const c = scene.clone(true);
      const mat = new THREE.MeshStandardMaterial({
        color:       OSSICLE_COLORS[idx],
        roughness:   0.32,
        metalness:   0.35,
        transparent: true,
        opacity:     1.0,
        depthWrite:  true,
        side:        THREE.DoubleSide,
      });
      matsRef.current.push(mat);
      c.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const geo = mesh.geometry.clone();
        geo.deleteAttribute('normal');
        geo.computeVertexNormals();
        mesh.geometry = geo;
        mesh.material = mat;
      });
      return c;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mScene, iScene, sScene]);

  useEffect(() => {
    const op = mode === 'ghost' ? 0.32 : 1.0;
    matsRef.current.forEach(mat => {
      mat.opacity    = op;
      mat.transparent = mode === 'ghost';
      mat.depthWrite = mode !== 'ghost';
      mat.needsUpdate = true;
    });
  }, [mode]);

  if (mode === 'hidden') return null;

  return (
    <>
      {clones.map((clone, i) => (
        <primitive key={i} object={clone} />
      ))}
    </>
  );
}

// ── DrillNerves: 神経・頸動脈 GLB ────────────────────────────────────
// 色の根拠: 耳科解剖アトラスの標準配色
//   顔面神経       → 黄色 (#f5d820) ← 最重要危険構造
//   鼓索神経       → オレンジ (#f0b830)
//   内耳神経       → ライムイエロー (#d4e840)
//   内頸動脈       → 赤 (#e84040)
const NERVE_DATA = [
  { url: '/models/Facial_Nerve.glb',            color: '#f5d820', label: '顔面神経' },
  { url: '/models/Chorda_Tympani.glb',          color: '#f0b830', label: '鼓索神経' },
  { url: '/models/Cochleo_Vestibular_Nerve.glb', color: '#d4e840', label: '内耳神経' },
  { url: '/models/Carotis.glb',                 color: '#e84040', label: '内頸動脈' },
] as const;

function DrillNerve({ url, color, mode }: { url: string; color: string; mode: VisMode }) {
  const { scene } = useGLTF(url);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness:   0.58,
      metalness:   0.0,
      transparent: true,
      opacity:     0.88,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    matRef.current = mat;
    c.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry.clone();
      geo.deleteAttribute('normal');
      geo.computeVertexNormals();
      mesh.geometry = geo;
      mesh.material = mat;
      mesh.renderOrder = 1;
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, color]);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const op = mode === 'solid' ? 0.88 : mode === 'ghost' ? 0.28 : 0;
    mat.opacity     = op;
    mat.transparent = true;
    mat.depthWrite  = false;
    mat.needsUpdate = true;
  }, [mode]);

  if (mode === 'hidden') return null;
  return <primitive object={cloned} />;
}

function DrillNerves({ mode }: { mode: VisMode }) {
  if (mode === 'hidden') return null;
  return (
    <>
      {NERVE_DATA.map(({ url, color }) => (
        <DrillNerve key={url} url={url} color={color} mode={mode} />
      ))}
    </>
  );
}

// ── DrillCursor: Round Carbide Bur #8 (8枚刃 球形バー) ───────────────
function DrillCursor({ groupRef, rotation, sizeMm = 3 }: {
  groupRef: React.RefObject<THREE.Group>;
  rotation: 'CW' | 'CCW';
  sizeMm?: 1 | 2 | 3;
}) {
  const burrScaleVal = sizeMm / 3;
  const burrRef = useRef<THREE.Group>(null!);
  const dir = rotation === 'CW' ? 1 : -1;

  // 8枚螺旋フルート: 球面上を120°螺旋するTubeGeometry
  const fluteGeos = useMemo(() => {
    const R = DRILL_RADIUS;
    return Array.from({ length: 8 }, (_, idx) => {
      const baseAngle = (idx / 8) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        // phi: 南極付近(0.12π) → 北極付近(0.88π)
        const phi = Math.PI * (0.12 + 0.76 * t);
        // theta: 1刃あたり120°螺旋
        const theta = baseAngle + t * (2 * Math.PI / 3);
        pts.push(new THREE.Vector3(
          R * Math.sin(phi) * Math.cos(theta),
          R * Math.cos(phi),
          R * Math.sin(phi) * Math.sin(theta),
        ));
      }
      return new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts), 14, 0.075, 4, false
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (burrRef.current) burrRef.current.rotation.y += dir * 60 * delta;
  });

  return (
    <group ref={groupRef} visible={false} scale={[burrScaleVal, burrScaleVal, burrScaleVal]}>
      <group ref={burrRef}>
        {/* タングステンカーバイド球体 */}
        <mesh>
          <sphereGeometry args={[DRILL_RADIUS, 24, 16]} />
          <meshStandardMaterial color="#b0afa0" metalness={0.82} roughness={0.22} />
        </mesh>
        {/* 8枚螺旋フルート（球面上の刃） */}
        {fluteGeos.map((geo, i) => (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial color="#787870" metalness={0.90} roughness={0.12} />
          </mesh>
        ))}
      </group>
      {/* ネック（球→シャフト接続部）*/}
      <mesh position={[0, DRILL_RADIUS + 0.7, 0]}>
        <cylinderGeometry args={[0.18, 0.30, 1.4, 10]} />
        <meshStandardMaterial color="#b8b8a8" metalness={0.88} roughness={0.14} />
      </mesh>
      {/* シャフト */}
      <mesh position={[0, DRILL_RADIUS + 5.0, 0]}>
        <cylinderGeometry args={[0.22, 0.30, 8.0, 12]} />
        <meshStandardMaterial color="#c0c0b0" metalness={0.88} roughness={0.12} />
      </mesh>
      {/* アクティブ時グローリング */}
      <mesh rotation={[Math.PI/2, 0, 0]} renderOrder={2}>
        <torusGeometry args={[DRILL_RADIUS * 1.3, 0.12, 8, 48]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} depthTest={false} />
      </mesh>
    </group>
  );
}

// ── 方向ガイド計算 ────────────────────────────────────────────────────
// ドリル位置から ANTRUM_POS への方向を外科的用語で返す
// 座標軸: X+=前方, Y+=上方, Z+=外耳道方向(外側)
function computeDrillDirection(point: THREE.Vector3): string | null {
  const diff = new THREE.Vector3().subVectors(ANTRUM_POS, point);
  if (diff.length() < ANTRUM_REACHED_DIST) return null;

  // 各成分の解剖学的方向ラベル
  const components = [
    { label: diff.z < 0 ? '深部' : '外側', abs: Math.abs(diff.z) },
    { label: diff.x < 0 ? '後方' : '前方', abs: Math.abs(diff.x) },
    { label: diff.y > 0 ? '上方' : '下方', abs: Math.abs(diff.y) },
  ].sort((a, b) => b.abs - a.abs);

  const primary = components[0];
  const secondary = components[1];

  // 第2成分が第1の50%以上なら両方表示
  let guide = `→ ${primary.label}へ削開`;
  if (secondary.abs > primary.abs * 0.5) {
    guide += ` + ${secondary.label}`;
  }
  return guide;
}

// ══════════════════════════════════════════════════════════════════
// MastoidGuide: 乳突削開 教育ガイドレイヤー
//
// 座標系: アブミ骨底板 = (0,0,0), Y+ = 上方, Z+ = 外耳道方向（外側）
// ⚠ 座標は Bone.glb 推定値。3D ビューで確認後に GUIDE 定数を調整。
// ══════════════════════════════════════════════════════════════════
type V3 = [number, number, number];

const GUIDE = {
  // MacEwen Triangle (Suprameatal Triangle) ── 外側皮質面上の三角
  // ⚠ Z値は Bone.glb 実測値（2026-06-24 pygltflib計測）
  CENTER:    [-2.5,  6,   26] as V3,
  SUPERIOR:  [-2.5, 10,   19] as V3,  // 上角: Temporal Line (Z実測≈19)
  ANTERIOR:  [ 2.0,  3.5, 29] as V3,  // 前角: Posterior EAC Wall (Z実測≈29)
  POSTERIOR: [-7.0,  4,   22] as V3,  // 後角: Predicted sigmoid line (Z実測≈23)

  // Mastoidectomy Start Zone（MacEwen 周囲の安全削開域）
  START_ZONE: [
    [-2.5, 10, 19], [ 4.0, 10, 22], [-11,  9.5, 10],
    [-11,  1, 10],  [ 3,   1, 29],
  ] as V3[],

  // Saucerization Volume（すり鉢状削開ガイド）
  SURFACE_Z:   26,    // 外側皮質面 Z（Bone.glb 実測値）
  DEPTH:       14,    // 削開深度 mm
  OUTER_R:     5.0,   // 外側開口半径
  INNER_R:     1.5,   // 深部半径

  DEPTH_RINGS: [
    { depth: 5,  color: '#4ade80' },
    { depth: 10, color: '#fbbf24' },
    { depth: 14, color: '#f97316' },
  ],
  ANTRUM_DEPTH: 13,
} as const;

// 専門医モード用ランドマーク（Bone.glb 実測値 2026-06-24）
const LANDMARKS = {
  // EAC後壁: 外側面重心
  PCW_CENTER:  [ 1.8,  2.8, 29.0] as V3,
  PCW_WIDTH:   4.0,  // X幅 mm
  PCW_HEIGHT:  6.0,  // Y高さ mm

  // Temporal Line: Y≈9 の稜線（X=-12〜5）
  TL_Y:        9.0,
  TL_Z:        22.0,  // 乳突側 Z
  TL_X_LEFT:  -12.0,
  TL_X_RIGHT:   4.0,

  // S状静脈洞予測: X<-8 の後方皮質中心
  SIG_CENTER:  [-12.0, 4.0, 20.0] as V3,
  SIG_RADIUS:   4.0,
} as const;

function TriMesh({ v0, v1, v2, color, opacity, wire = false }: {
  v0: V3; v1: V3; v2: V3; color: string; opacity: number; wire?: boolean;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      ...v0, ...v1, ...v2, ...v0, ...v2, ...v1,
    ], 3));
    g.computeVertexNormals();
    return g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial color={color} transparent opacity={opacity}
        side={THREE.DoubleSide} wireframe={wire} depthWrite={false} />
    </mesh>
  );
}

function FanMesh({ verts, color, opacity }: { verts: V3[]; color: string; opacity: number }) {
  const geo = useMemo(() => {
    const flat: number[] = [];
    for (let i = 1; i < verts.length - 1; i++) {
      flat.push(...verts[0], ...verts[i], ...verts[i+1]);
      flat.push(...verts[0], ...verts[i+1], ...verts[i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
    g.computeVertexNormals();
    return g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial color={color} transparent opacity={opacity}
        side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function MastoidGuide({ expertMode }: { expertMode: boolean }) {
  const [cx, cy, sz] = GUIDE.CENTER;
  return (
    <group>
      {/* Start Zone: 薄いグリーン */}
      <FanMesh verts={GUIDE.START_ZONE} color="#4ade80" opacity={0.09} />

      {/* MacEwen Triangle: 塗り */}
      <TriMesh v0={GUIDE.SUPERIOR} v1={GUIDE.ANTERIOR} v2={GUIDE.POSTERIOR}
               color="#22c55e" opacity={0.35} />
      {/* MacEwen Triangle: アウトライン */}
      <TriMesh v0={GUIDE.SUPERIOR} v1={GUIDE.ANTERIOR} v2={GUIDE.POSTERIOR}
               color="#86efac" opacity={0.85} wire />

      {/* Center マーカー（Safe Entry ドット）*/}
      <mesh position={GUIDE.CENTER}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>

      {/* Temporal Line（青バー）*/}
      <mesh position={[(-12 + 4) / 2, GUIDE.SUPERIOR[1], GUIDE.SUPERIOR[2] - 0.5]}>
        <boxGeometry args={[16, 0.28, 0.28]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>

      {/* Saucerization Volume（黄色ワイヤーフレーム錐台）*/}
      {/* CylinderGeometry axis = Y → rotate PI/2 around X to align with Z */}
      <mesh
        position={[cx, cy, sz - GUIDE.DEPTH / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <cylinderGeometry args={[GUIDE.INNER_R, GUIDE.OUTER_R, GUIDE.DEPTH, 24, 1, true]} />
        <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* 深度リング（5 / 10 / 15 mm）*/}
      {GUIDE.DEPTH_RINGS.map(({ depth, color }) => {
        const ringZ = sz - depth;
        const t     = depth / GUIDE.DEPTH;
        const ringR = GUIDE.OUTER_R + (GUIDE.INNER_R - GUIDE.OUTER_R) * t;
        return (
          <mesh key={depth} position={[cx, cy, ringZ]}>
            <torusGeometry args={[ringR, 0.2, 8, 36]} />
            <meshBasicMaterial color={color} transparent opacity={0.75} />
          </mesh>
        );
      })}

      {/* Mastoid Antrum: First Surgical Target（専門医モードでは非表示）*/}
      {!expertMode && (
        <>
          <mesh position={[ANTRUM_POS.x, ANTRUM_POS.y, ANTRUM_POS.z]}>
            <sphereGeometry args={[ANTRUM_RADIUS, 20, 14]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.22} />
          </mesh>
          <mesh position={[ANTRUM_POS.x, ANTRUM_POS.y, ANTRUM_POS.z]}>
            <sphereGeometry args={[ANTRUM_RADIUS + 0.1, 20, 14]} />
            <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.70} />
          </mesh>
        </>
      )}

      {/* 専門医モード: 解剖学的ランドマークのみ表示 */}
      {expertMode && (
        <>
          {/* EAC後壁（水色プレーン）*/}
          <mesh position={LANDMARKS.PCW_CENTER} renderOrder={2}>
            <planeGeometry args={[LANDMARKS.PCW_WIDTH, LANDMARKS.PCW_HEIGHT]} />
            <meshBasicMaterial color="#7dd8f0" transparent opacity={0.35}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={LANDMARKS.PCW_CENTER} renderOrder={2}>
            <planeGeometry args={[LANDMARKS.PCW_WIDTH, LANDMARKS.PCW_HEIGHT]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.70}
              side={THREE.DoubleSide} />
          </mesh>

          {/* Temporal Line（濃青バー）*/}
          <mesh
            position={[(LANDMARKS.TL_X_LEFT + LANDMARKS.TL_X_RIGHT) / 2, LANDMARKS.TL_Y, LANDMARKS.TL_Z]}
            renderOrder={2}
          >
            <boxGeometry args={[LANDMARKS.TL_X_RIGHT - LANDMARKS.TL_X_LEFT, 0.35, 0.35]} />
            <meshBasicMaterial color="#1d4ed8" />
          </mesh>
          {/* 側頭線ラベルドット */}
          {[-8, -4, 0, 4].map(x => (
            <mesh key={x} position={[x, LANDMARKS.TL_Y, LANDMARKS.TL_Z + 0.3]} renderOrder={3}>
              <sphereGeometry args={[0.4, 8, 6]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          ))}

          {/* S状静脈洞予測（赤橙 半透明球）*/}
          <mesh position={LANDMARKS.SIG_CENTER}>
            <sphereGeometry args={[LANDMARKS.SIG_RADIUS, 16, 12]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.18} />
          </mesh>
          <mesh position={LANDMARKS.SIG_CENTER}>
            <sphereGeometry args={[LANDMARKS.SIG_RADIUS + 0.1, 16, 12]} />
            <meshBasicMaterial color="#fb923c" wireframe transparent opacity={0.55} />
          </mesh>
        </>
      )}

      {/* 削開方向矢印（黄色、外側→内側）*/}
      <group position={[cx + 4, cy + 2.5, sz + 1.5]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -3.5]}>
          <cylinderGeometry args={[0.22, 0.22, 7, 8]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -7.5]}>
          <coneGeometry args={[0.65, 1.6, 8]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </group>
    </group>
  );
}

// ── DangerSpheres: 危険部位マーカー ───────────────────────────────────
function DangerSpheres() {
  return (
    <>
      {DANGER_ZONES.map((z) => (
        <mesh key={z.id} position={z.position as [number,number,number]}>
          <sphereGeometry args={[z.dangerRadius * 0.6, 12, 8]} />
          <meshStandardMaterial
            color={z.color}
            emissive={z.glowColor}
            emissiveIntensity={0.5}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}
    </>
  );
}

// ── DrillCanvas3D: R3F内部コンポーネント ────────────────────────────
interface DrillCanvas3DProps {
  drillMode:        boolean;
  rotation:         'CW' | 'CCW';
  onAlert:          (msg: string | null) => void;
  onHoleCount:      (n: number) => void;
  onAntrumDist:     (dist: number | null) => void;
  onDrillDirection: (dir: string | null) => void;
  onDangerTint:     (color: string | null) => void;
  onEducationCard:  (card: EducationCardContent | null) => void;
  onScoreReady:     (result: { breakdown: ScoreBreakdown; review: ScoreReviewItem[] }) => void;
  burrId:           string;
  pressure:         number;
  rpmPreset:        RpmPreset;
  showGuide:        boolean;
  expertMode:       boolean;
  boneVis:          VisMode;
  ossicleVis:       VisMode;
  nerveVis:         VisMode;
  viewMode?:        'normal' | 'microscope' | 'endoscope';
  positionMode?:    boolean;
  cutterSizeMm?:    1 | 2 | 3;
}

function DrillCanvas3D({ drillMode, rotation, onAlert, onHoleCount, onAntrumDist, onDrillDirection, onDangerTint, onEducationCard, onScoreReady, burrId, pressure, rpmPreset, showGuide, expertMode, boneVis, ossicleVis, nerveVis, viewMode = 'normal', positionMode = false }: DrillCanvas3DProps) {
  const { camera }      = useThree();
  const uniformsRef    = useRef<{
    drillHoles:     { value: THREE.Vector3[] };
    drillHoleCount: { value: number };
    drillHoleRadii: { value: number[] };
  } | null>(null);
  const holesRef        = useRef<DrillHoleState[]>([]);  // T5: ホール成長状態（uniformsと並行管理）
  const activeIndexRef  = useRef(-1);                     // 現在成長中のホールindex
  const contactAngleRef = useRef(0);                      // 面法線×ドリル軸のなす角（度）
  const lastGrowthRateRef = useRef(0);                    // T6: 直近成長速度 mm/s（音量算出に使用）
  const audioEngineRef  = useRef<DrillAudioEngine | null>(null); // T6: WebAudioエンジン（ノード使い回し）
  // T9: ダメージ記録・採点用ステート
  const damageEventsRef       = useRef<DamageEvent[]>([]);
  const damageTrackerStateRef = useRef(initialDamageTrackerState);
  const minDistToDangerRef    = useRef<number | null>(null);
  const nearDangerDiamondMsRef = useRef(0);
  const nearDangerCuttingMsRef = useRef(0);
  const reachedAntrumRef      = useRef(false);
  const scoreFinalizedRef     = useRef(false);
  const isDrillingRef  = useRef(false);
  const lastHolePosRef = useRef<THREE.Vector3 | null>(null);
  const lastDrillTime  = useRef(0);
  const cursorRef      = useRef<THREE.Group>(null!);
  const orbitRef       = useRef<any>(null);

  // T6: アンマウント時にAudioContextを解放（resetKeyでのremount毎のリーク防止）
  useEffect(() => {
    return () => { audioEngineRef.current?.dispose(); };
  }, []);

  // ドリルホール追加: currentR=0で生成し、以降 growActiveHole() が毎フレーム成長させる
  // （設計書 §4.4: 固定半径discardからホール半径成長方式への改修）
  const addHole = useCallback((point: THREE.Vector3) => {
    const u = uniformsRef.current;
    if (!u || holesRef.current.length >= MAX_HOLES) return;
    const last = lastHolePosRef.current;
    if (last && last.distanceTo(point) < MIN_HOLE_DIST) return;

    const idx = holesRef.current.length;
    const targetR = getBurrById(burrId).diameterMm / 2; // T10: 選択中バーの径から算出
    const hole: DrillHoleState = {
      position: point.clone(),
      currentR: 0,
      targetR,
      regionId: regionAt(point),
    };
    holesRef.current.push(hole);
    activeIndexRef.current = idx;

    u.drillHoles.value[idx].copy(point);
    u.drillHoleRadii.value[idx] = 0;
    u.drillHoleCount.value = idx + 1;
    lastHolePosRef.current = point.clone();
  }, [burrId]);

  // アクティブホールを毎フレーム成長させる（除去モデル §4.4: Bone Material×Burr×RPM×Pressure×Angle）
  const growActiveHole = useCallback((delta: number) => {
    const idx = activeIndexRef.current;
    const holes = holesRef.current;
    const u = uniformsRef.current;
    if (!u || idx < 0 || idx >= holes.length) { lastGrowthRateRef.current = 0; return; }
    const hole = holes[idx];
    if (hole.currentR >= hole.targetR) { lastGrowthRateRef.current = 0; return; }

    const material = BONE_MATERIALS[hole.regionId];
    const burr = getBurrById(burrId);
    const rate = growthRateMmPerSec({
      burr,
      pressure,
      rpmPreset,
      contactAngleDeg: contactAngleRef.current,
      material,
    });
    lastGrowthRateRef.current = rate;

    const grown = advanceHole(hole, rate, delta);
    if (grown !== hole) {
      holes[idx] = grown;
      u.drillHoleRadii.value[idx] = grown.currentR;
    }
  }, [burrId, pressure, rpmPreset]);

  // T6: アクティブホールの材料・残存骨厚・成長速度から音を更新する（設計書 §4.5）
  const updateAudio = useCallback(() => {
    const idx = activeIndexRef.current;
    const holes = holesRef.current;
    const engine = audioEngineRef.current;
    if (!engine || idx < 0 || idx >= holes.length) return;
    const hole = holes[idx];
    const material = BONE_MATERIALS[hole.regionId];
    const remaining = remainingThicknessToDanger(hole.position);
    engine.update(computeAudioState(material, remaining, lastGrowthRateRef.current));
  }, []);

  // T8: 現在の材料・バー・危険状態から教育カードを1つ選び出す
  const updateEducationCard = useCallback(() => {
    const idx = activeIndexRef.current;
    const holes = holesRef.current;
    if (idx < 0 || idx >= holes.length) { onEducationCard(null); return; }
    const hole = holes[idx];
    const material = BONE_MATERIALS[hole.regionId];
    const burr = getBurrById(burrId);
    const dangerState = computeDangerState(remainingThicknessToDanger(hole.position));
    onEducationCard(selectEducationCard({
      material,
      burr,
      dangerState,
      growthRateMmPerSec: lastGrowthRateRef.current,
    }));
  }, [burrId, onEducationCard]);

  // T9: 危険接近時間・最小到達距離・ダメージイベントを毎フレーム追跡する
  const updateScoringTrackers = useCallback((delta: number) => {
    const idx = activeIndexRef.current;
    const holes = holesRef.current;
    if (idx < 0 || idx >= holes.length) return;
    const hole = holes[idx];
    const dangerState = computeDangerState(remainingThicknessToDanger(hole.position));

    if (dangerState.distMm !== null) {
      minDistToDangerRef.current =
        minDistToDangerRef.current === null
          ? dangerState.distMm
          : Math.min(minDistToDangerRef.current, dangerState.distMm);
    }

    if (dangerState.level !== 'safe') {
      const burr = getBurrById(burrId);
      if (burr.type === 'diamond') nearDangerDiamondMsRef.current += delta * 1000;
      else nearDangerCuttingMsRef.current += delta * 1000;
    }

    const isOnOticCapsule = hole.regionId === 'oticCapsule';
    const { events, next } = stepDamageTracker(
      damageTrackerStateRef.current, performance.now(), dangerState, isOnOticCapsule, true
    );
    damageTrackerStateRef.current = next;
    if (events.length > 0) damageEventsRef.current.push(...events);
  }, [burrId]);

  // T9: セッション終了（到達 or アンマウント/リセット）時にスコアを確定・保存する。二重確定はしない。
  const finalizeScore = useCallback(() => {
    if (scoreFinalizedRef.current || holesRef.current.length === 0) return;
    scoreFinalizedRef.current = true;

    const oticCapsuleHolesCount = holesRef.current.filter(
      (h) => h.regionId === 'oticCapsule' && h.currentR > OTIC_WASTE_RADIUS_THRESHOLD_MM
    ).length;

    const inputs = {
      damageEvents: damageEventsRef.current,
      reachedAntrum: reachedAntrumRef.current,
      oticCapsuleHolesCount,
      totalHolesCount: holesRef.current.length,
      minDistToDangerMm: minDistToDangerRef.current,
      nearDangerDiamondMs: nearDangerDiamondMsRef.current,
      nearDangerCuttingMs: nearDangerCuttingMsRef.current,
    };
    const breakdown = computeScoreBreakdown(inputs);
    const review = generateScoreReview(breakdown, inputs);

    appendScoreHistory({
      date: new Date().toISOString(),
      breakdown,
      damageEvents: damageEventsRef.current,
      reachedAntrum: reachedAntrumRef.current,
    });

    onScoreReady({ breakdown, review });
  }, [onScoreReady]);

  // T9: アンマウント時（resetKey変更含む）に未確定スコアを確定・保存する
  useEffect(() => {
    return () => { finalizeScore(); };
  }, [finalizeScore]);

  // 危険部位チェック（T7: remainingThicknessToDanger基準に統一、色透見をUIへ配線）
  const checkDanger = useCallback((point: THREE.Vector3) => {
    const remaining = remainingThicknessToDanger(point);
    const state = computeDangerState(remaining);

    if (state.zone && state.level !== 'safe' && state.distMm !== null) {
      const icon = state.level === 'critical' ? '🔴' : '⚠️';
      onAlert(`${icon} ${state.zone.nameJa} まで ${state.distMm.toFixed(1)} mm`);
    } else {
      onAlert(null);
    }

    const material = BONE_MATERIALS[regionAt(point)];
    const tint = dangerTintColor(BASE_BONE_COLOR, material, state.proximity);
    onDangerTint(state.proximity > 0 ? `#${tint.getHexString()}` : null);
  }, [onAlert, onDangerTint]);

  // useFrame: 新規ホール生成は一定間隔（既存間隔を踏襲）、成長は毎フレーム（positionMode時は中断）
  useFrame((_, delta) => {
    if (!isDrillingRef.current || !cursorRef.current?.visible || !drillMode) return;

    lastDrillTime.current += delta * 1000;
    if (lastDrillTime.current >= DRILL_INTERVAL) {
      lastDrillTime.current = 0;
      addHole(cursorRef.current.position);
    }

    growActiveHole(delta);
    updateAudio();
    updateEducationCard();
    updateScoringTrackers(delta);
    onHoleCount(holesRef.current.length);
  });

  // ── イベントハンドラ ──────────────────────────────────────────────
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (cursorRef.current) {
      cursorRef.current.position.copy(e.point);
      cursorRef.current.visible = true;
    }
    checkDanger(e.point);
    const antrumDistNow = e.point.distanceTo(ANTRUM_POS);
    onAntrumDist(antrumDistNow);
    onDrillDirection(computeDrillDirection(e.point));

    // T9: 目標到達（乳突洞）を検知したらスコアを確定する（初回のみ）
    if (antrumDistNow < ANTRUM_REACHED_DIST && !reachedAntrumRef.current) {
      reachedAntrumRef.current = true;
      finalizeScore();
    }

    // 接触角: 面法線（ワールド空間）とドリル軸（カメラ→接触点方向）のなす角（設計書 §4.4）
    if (e.face) {
      const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize();
      const drillAxis = e.point.clone().sub(camera.position).normalize();
      contactAngleRef.current = computeContactAngleDeg(worldNormal, drillAxis);
    }
  }, [checkDanger, onAntrumDist, onDrillDirection, camera, finalizeScore]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!drillMode || e.button !== 0) return;
    e.stopPropagation();
    isDrillingRef.current = true;
    lastDrillTime.current = DRILL_INTERVAL; // 即座に 1 ホール
    // T6: ユーザー操作起点でAudioContext生成/resume（autoplay制約回避）
    if (!audioEngineRef.current) audioEngineRef.current = new DrillAudioEngine();
    audioEngineRef.current.start();
  }, [drillMode]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    isDrillingRef.current = false;
    audioEngineRef.current?.stop();
    onEducationCard(null);
  }, [onEducationCard]);

  const handlePointerLeave = useCallback(() => {
    isDrillingRef.current = false;
    if (cursorRef.current) cursorRef.current.visible = false;
    onAlert(null);
    onAntrumDist(null);
    onDrillDirection(null);
    onDangerTint(null);
    onEducationCard(null);
    audioEngineRef.current?.stop();
  }, [onAlert, onAntrumDist, onDrillDirection, onDangerTint, onEducationCard]);

  return (
    <>
      {/* ライティング */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 20, 15]} intensity={0.9} />
      <directionalLight position={[-8, -5, -10]} intensity={0.25} />

      {/* 側頭骨（ドリルシェーダー付き） */}
      <DrillBone
        uniformsRef={uniformsRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        boneVis={boneVis}
      />
      {/* 耳小骨 */}
      <DrillOssicles mode={ossicleVis} />
      {/* 神経・頸動脈 */}
      <DrillNerves mode={nerveVis} />
      {/* ポインタリーブ用不可視プレーン */}
      <mesh visible={false} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* 危険部位マーカー */}
      <DangerSpheres />
      {/* Mastoidectomy ガイドレイヤー */}
      {showGuide && <MastoidGuide expertMode={expertMode} />}

      {/* ドリルカーソル */}
      <DrillCursor groupRef={cursorRef} rotation={rotation} sizeMm={getBurrById(burrId).diameterMm as 1 | 2 | 3} />

      {/* FovController: viewMode に応じてカメラFOVを切替 */}
      <FovController viewMode={viewMode} />

      {/* OrbitControls */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        mouseButtons={{
          LEFT:   drillMode ? (THREE.MOUSE as any).NONE : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.ROTATE,
        }}
        enableRotate={viewMode !== 'microscope' || positionMode}
        enablePan={!drillMode && (viewMode !== 'microscope' || positionMode)}
        enableZoom={true}
        target={[0, 0, 2]}
      />
    </>
  );
}

// ── InteractiveDrillScene: 外部コンポーネント ─────────────────────────
export interface InteractiveDrillSceneProps {
  viewMode?:           'normal' | 'microscope' | 'endoscope';
  positionMode?:       boolean;
  drillActive?:        boolean;      // 親が制御するとき
  onDrillToggle?:      () => void;   // 親が制御するとき
  rightOverlayOffset?: number;       // 右オーバーレイを下にずらすpx
}

export function InteractiveDrillScene({
  viewMode = 'normal',
  positionMode = false,
  drillActive,
  onDrillToggle,
  rightOverlayOffset = 0,
}: InteractiveDrillSceneProps = {}) {
  const [internalDrillMode, setInternalDrillMode] = useState(false);
  // 制御モード判定
  const isControlled = onDrillToggle !== undefined;
  const drillMode    = isControlled ? !!drillActive : internalDrillMode;
  // 実効ドリル: 移動中（positionMode=true）は中断
  const effectiveDrill = drillMode && !positionMode;
  const [showGuide,  setShowGuide]  = useState(true);
  const [rotation,  setRotation]  = useState<'CW' | 'CCW'>('CW');
  const [alertMsg,  setAlertMsg]  = useState<string | null>(null);
  const [holeCount,  setHoleCount]  = useState(0);
  const [antrumDist,    setAntrumDist]    = useState<number | null>(null);
  const [drillDirection, setDrillDirection] = useState<string | null>(null);
  const [dangerTint,     setDangerTint]     = useState<string | null>(null); // T7: 色透見
  const [eduCard,        setEduCard]        = useState<EducationCardContent | null>(null); // T8
  const [scoreResult,    setScoreResult]    = useState<{ breakdown: ScoreBreakdown; review: ScoreReviewItem[] } | null>(null); // T9
  const [burrId,         setBurrId]         = useState(DEFAULT_BURR.id);       // T10
  const [pressure,       setPressure]       = useState(0.6);                   // T10: 0.2-1.0既定0.6
  const [rpmPreset,      setRpmPreset]      = useState<RpmPreset>('mid');      // T10
  const [expertMode,     setExpertMode]     = useState(false);
  const [boneVis,        setBoneVis]        = useState<VisMode>('solid');
  const [ossicleVis,     setOssicleVis]     = useState<VisMode>('solid');
  const [nerveVis,       setNerveVis]       = useState<VisMode>('solid');
  const [resetKey,       setResetKey]       = useState(0);

  const handleReset = () => {
    setResetKey(k => k + 1);
    setHoleCount(0);
    setAlertMsg(null);
    setAntrumDist(null);
    setDrillDirection(null);
    setDangerTint(null);
    setEduCard(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        key={resetKey}
        camera={{ position: [10, 8, 52], fov: 38 }}
        style={{ background: '#0a0f1a' }}
        gl={{ antialias: true }}
      >
        <DrillCanvas3D
          drillMode={effectiveDrill}
          rotation={rotation}
          onAlert={setAlertMsg}
          onHoleCount={setHoleCount}
          onAntrumDist={setAntrumDist}
          onDrillDirection={setDrillDirection}
          onDangerTint={setDangerTint}
          onEducationCard={setEduCard}
          onScoreReady={setScoreResult}
          showGuide={showGuide}
          expertMode={expertMode}
          boneVis={boneVis}
          ossicleVis={ossicleVis}
          nerveVis={nerveVis}
          viewMode={viewMode}
          positionMode={positionMode}
          burrId={burrId}
          pressure={pressure}
          rpmPreset={rpmPreset}
        />
      </Canvas>

      {/* 顕微鏡ビネットオーバーレイ */}
      {viewMode === 'microscope' && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
          background: 'radial-gradient(circle at center, transparent 26%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.92) 68%, black 82%)',
        }} />
      )}

      {/* ドリル開始 — スタンドアロン時のみ中央CTAを表示 */}
      {!isControlled && !drillMode && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 15, pointerEvents: 'none',
        }}>
          <button
            onClick={() => setInternalDrillMode(true)}
            style={{
              pointerEvents: 'auto',
              padding: '14px 32px', borderRadius: 12, border: '2px solid rgba(239,68,68,0.7)',
              cursor: 'pointer', fontSize: 15, fontWeight: 800,
              background: 'rgba(239,68,68,0.18)', color: '#f87171',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0 24px rgba(239,68,68,0.3)',
              transition: 'all .15s',
            }}
          >🔴 ドリル開始</button>
        </div>
      )}

      {/* オーバーレイ UI */}
      {/* ドリルモードトグル（スタンドアロン時）+ 回転/リセット */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        display: 'flex', gap: 6, zIndex: 10, alignItems: 'center',
      }}>
        {!isControlled && (
          <button
            onClick={() => setInternalDrillMode(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: drillMode ? '#ef4444' : 'rgba(255,255,255,0.10)',
              color: drillMode ? '#fff' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(4px)',
              transition: 'all .15s',
            }}
          >
            🔴 {drillMode ? '削開中 ─ クリックで停止' : 'ドリル開始'}
          </button>
        )}
        {effectiveDrill && (
          <>
            <button
              onClick={() => setRotation(r => r === 'CW' ? 'CCW' : 'CW')}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#7dd8e8',
                backdropFilter: 'blur(4px)',
              }}
            >
              {rotation === 'CW' ? '↻ 右回転' : '↺ 左回転'}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.4)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#f87171',
                backdropFilter: 'blur(4px)',
              }}
            >
              ↺ リセット
            </button>
          </>
        )}
        {drillMode && !effectiveDrill && positionMode && (
          <span style={{
            padding: '5px 10px', borderRadius: 7,
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.35)',
            color: '#fbbf24', fontSize: 11, fontWeight: 600,
          }}>⏸ 移動中は一時中断</span>
        )}
      </div>

      {/* T10: バー選択トグル + RPMプリセット（左上、既存cutterSizeMm UIを置換） */}
      <div style={{
        position: 'absolute', top: 50, left: 10, zIndex: 10,
        display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 250,
      }}>
        {DRILL_BURRS.map(b => (
          <button
            key={b.id}
            onClick={() => setBurrId(b.id)}
            title={b.labelJa}
            style={{
              padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
              fontSize: 10, fontWeight: burrId === b.id ? 700 : 400,
              border: `1px solid ${burrId === b.id ? '#ffd166' : 'rgba(255,255,255,0.18)'}`,
              background: burrId === b.id ? 'rgba(255,209,102,0.20)' : 'rgba(10,15,26,0.72)',
              color: burrId === b.id ? '#ffd166' : '#7a8898',
              backdropFilter: 'blur(4px)', transition: 'all .15s',
            }}
          >{b.type === 'cutting' ? '🔵' : '💎'} {b.diameterMm}mm</button>
        ))}
        {(['low', 'mid', 'high'] as const).map(p => (
          <button
            key={p}
            onClick={() => setRpmPreset(p)}
            style={{
              padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
              fontSize: 10, fontWeight: rpmPreset === p ? 700 : 400,
              border: `1px solid ${rpmPreset === p ? '#7dd8e8' : 'rgba(255,255,255,0.18)'}`,
              background: rpmPreset === p ? 'rgba(125,216,232,0.20)' : 'rgba(10,15,26,0.72)',
              color: rpmPreset === p ? '#7dd8e8' : '#7a8898',
              backdropFilter: 'blur(4px)', transition: 'all .15s',
            }}
          >RPM:{p === 'low' ? '低' : p === 'mid' ? '中' : '高'}</button>
        ))}
      </div>

      {/* ホール数表示 */}
      {holeCount > 0 && (
        <div style={{
          position: 'absolute', top: 10 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.65)', color: '#7dd8e8',
          fontSize: 11, backdropFilter: 'blur(4px)',
        }}>
          削開: {holeCount} / {MAX_HOLES} ポイント
        </div>
      )}

      {/* Distance to Antrum（専門医モードでは非表示）*/}
      {!expertMode && antrumDist !== null && (
        <div style={{
          position: 'absolute', top: 44 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '6px 12px', borderRadius: 7,
          background: antrumDist < ANTRUM_REACHED_DIST
            ? 'rgba(74,222,128,0.20)'
            : 'rgba(0,0,0,0.65)',
          border: antrumDist < ANTRUM_REACHED_DIST
            ? '1px solid rgba(74,222,128,0.6)'
            : '1px solid rgba(134,239,172,0.25)',
          color: antrumDist < ANTRUM_REACHED_DIST ? '#4ade80' : '#86efac',
          fontSize: 11, fontWeight: 700, backdropFilter: 'blur(4px)',
          transition: 'all .2s',
        }}>
          {antrumDist < ANTRUM_REACHED_DIST
            ? '🟢 Reached Antrum!'
            : `🎯 Antrum: ${antrumDist.toFixed(1)} mm`}
        </div>
      )}

      {/* 削開方向ガイド（専門医モードでは非表示）*/}
      {!expertMode && drillDirection && antrumDist !== null && antrumDist >= ANTRUM_REACHED_DIST && (
        <div style={{
          position: 'absolute', top: 76 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(251,191,36,0.35)',
          color: '#fde68a',
          fontSize: 11, fontWeight: 600, backdropFilter: 'blur(4px)',
          letterSpacing: '0.03em',
        }}>
          {drillDirection}
        </div>
      )}

      {/* T8: 教育カード（なぜ削れた/危険/交換の3種を状況で出し分け、既存アラート帯の拡張） */}
      {eduCard && (
        <div style={{
          position: 'absolute', bottom: alertMsg ? 52 : 10, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 340, padding: '10px 14px', borderRadius: 10, zIndex: 20,
          background: eduCard.kind === 'whyBurrChange' ? 'rgba(251,146,60,0.16)'
                    : eduCard.kind === 'whyDanger'      ? 'rgba(239,68,68,0.14)'
                    :                                     'rgba(56,189,248,0.14)',
          border: eduCard.kind === 'whyBurrChange' ? '1px solid rgba(251,146,60,0.5)'
                : eduCard.kind === 'whyDanger'      ? '1px solid rgba(239,68,68,0.4)'
                :                                      '1px solid rgba(56,189,248,0.4)',
          backdropFilter: 'blur(4px)', transition: 'bottom .2s',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, marginBottom: 3,
            color: eduCard.kind === 'whyBurrChange' ? '#fdba74'
                 : eduCard.kind === 'whyDanger'      ? '#fca5a5'
                 :                                      '#7dd3fc',
          }}>
            {eduCard.kind === 'whyBurrChange' ? '🔁' : eduCard.kind === 'whyDanger' ? '⚠️' : '💡'} {eduCard.titleJa}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
            {eduCard.bodyJa}
          </div>
        </div>
      )}

      {/* 危険部位アラート */}
      {alertMsg && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 9, zIndex: 20,
          background: alertMsg.startsWith('🔴') ? 'rgba(239,68,68,0.18)' : 'rgba(251,191,36,0.15)',
          border: alertMsg.startsWith('🔴') ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(251,191,36,0.4)',
          color: alertMsg.startsWith('🔴') ? '#fca5a5' : '#fde047',
          fontSize: 12, fontWeight: 700, backdropFilter: 'blur(4px)',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {/* T7: 色透見（該当リージョン材料色を接近度でブレンド） */}
          {dangerTint && (
            <span style={{
              display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
              background: dangerTint, boxShadow: `0 0 6px ${dangerTint}`, flexShrink: 0,
            }} />
          )}
          {alertMsg}
        </div>
      )}

      {/* 専門医モードトグル */}
      <button
        onClick={() => setExpertMode(v => !v)}
        style={{
          position: 'absolute', bottom: 76, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          border: expertMode
            ? '1px solid rgba(251,191,36,0.6)'
            : '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: expertMode ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.5)',
          color: expertMode ? '#fde68a' : 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {expertMode ? '🧠 専門医モード' : '🧠 専門医モード OFF'}
      </button>

      {/* ガイドレイヤートグル */}
      <button
        onClick={() => setShowGuide(v => !v)}
        style={{
          position: 'absolute', bottom: 44, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: showGuide ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.5)',
          color: showGuide ? '#4ade80' : 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {showGuide ? '🗺 ガイド ON' : '🗺 ガイド OFF'}
      </button>

      {/* T10: 荷重スライダー（左下、Pressure 0.2-1.0 既定0.6） */}
      <div style={{
        position: 'absolute', bottom: 78, left: 10, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 7,
        background: 'rgba(10,15,26,0.72)', border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{ fontSize: 10, color: '#7a8898', fontWeight: 700 }}>荷重</span>
        <input
          type="range" min={0.2} max={1.0} step={0.05} value={pressure}
          onChange={e => setPressure(parseFloat(e.target.value))}
          style={{ width: 90, accentColor: '#ffd166' }}
        />
        <span style={{ fontSize: 10, color: '#ffd166', fontWeight: 700, minWidth: 26 }}>{pressure.toFixed(2)}</span>
      </div>

      {/* 可視化コントロール */}
      <div style={{
        position: 'absolute', bottom: 44, left: 10, zIndex: 10,
        display: 'flex', gap: 5,
      }}>
        {/* 骨 表示トグル */}
        <button
          onClick={() => setBoneVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: boneVis === 'solid'  ? 'rgba(226,232,240,0.15)'
                      : boneVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: boneVis === 'solid'  ? '#e2e8f0'
                 : boneVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          🦴 骨: {boneVis === 'solid' ? '実体' : boneVis === 'ghost' ? '半透明' : '非表示'}
        </button>
        {/* 耳小骨 表示トグル */}
        <button
          onClick={() => setOssicleVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: ossicleVis === 'solid'  ? 'rgba(230,169,58,0.15)'
                      : ossicleVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: ossicleVis === 'solid'  ? '#e6a93a'
                 : ossicleVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          🔮 耳小骨: {ossicleVis === 'solid' ? '表示' : ossicleVis === 'ghost' ? '半透明' : '非表示'}
        </button>
        {/* 神経 表示トグル */}
        <button
          onClick={() => setNerveVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: nerveVis === 'solid'  ? 'rgba(245,216,32,0.15)'
                      : nerveVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: nerveVis === 'solid'  ? '#f5d820'
                 : nerveVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          ⚡ 神経: {nerveVis === 'solid' ? '表示' : nerveVis === 'ghost' ? '半透明' : '非表示'}
        </button>
      </div>

      {/* 操作ガイド（ドリルOFF時）*/}
      {!effectiveDrill && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.45)',
          fontSize: 10, backdropFilter: 'blur(4px)',
          lineHeight: 1.6,
        }}>
          左ドラッグ: 回転　右ドラッグ: 回転　スクロール: ズーム
        </div>
      )}
      {effectiveDrill && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.45)',
          fontSize: 10, backdropFilter: 'blur(4px)',
          lineHeight: 1.6,
        }}>
          左クリック&ドラッグ: 削開　右ドラッグ: 回転　スクロール: ズーム
        </div>
      )}
      {/* T9: スコアパネル（リセット/到達時に表示、3軸内訳＋「事実→意味→改善策」レビュー） */}
      {scoreResult && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,8,14,0.72)', backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: 'min(92%, 420px)', maxHeight: '82%', overflowY: 'auto',
            padding: '20px 22px', borderRadius: 14,
            background: 'rgba(14,20,32,0.96)', border: '1px solid rgba(125,216,232,0.25)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>削開スコア</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#7dd8e8' }}>{scoreResult.breakdown.total}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}> / 100</span></span>
            </div>

            {/* 3軸内訳 */}
            <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
              {([
                { label: '安全',     value: scoreResult.breakdown.safety,             max: 60, color: '#f87171' },
                { label: '効率',     value: scoreResult.breakdown.efficiency,         max: 25, color: '#fbbf24' },
                { label: '骨質適応', value: scoreResult.breakdown.materialAdaptation, max: 15, color: '#4ade80' },
              ] as const).map(axis => (
                <div key={axis.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{axis.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: axis.color }}>{axis.value}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> /{axis.max}</span></div>
                </div>
              ))}
            </div>

            {/* 事実→意味→改善策レビュー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scoreResult.review.map((item, i) => (
                <div key={i} style={{
                  padding: '9px 11px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, marginBottom: 3 }}>{item.factJa}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 3, lineHeight: 1.5 }}>{item.meaningJa}</div>
                  <div style={{ fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>→ {item.improvementJa}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setScoreResult(null)}
              style={{
                marginTop: 16, width: '100%', padding: '9px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              }}
            >閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload('/models/Malleus.glb');
useGLTF.preload('/models/Incus.glb');
useGLTF.preload('/models/Stapes.glb');
useGLTF.preload('/models/Facial_Nerve.glb');
useGLTF.preload('/models/Chorda_Tympani.glb');
useGLTF.preload('/models/Cochleo_Vestibular_Nerve.glb');
useGLTF.preload('/models/Carotis.glb');
