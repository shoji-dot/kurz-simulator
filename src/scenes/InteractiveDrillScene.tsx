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
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DANGER_ZONES } from '../data/dangerZones';

// ── 定数 ──────────────────────────────────────────────────────────────
const MAX_HOLES      = 200;  // シェーダー配列サイズ（WebGL2上限内で200まで実用的）
const DRILL_RADIUS   = 1.5;  // 3mm 径バーの半径 (scene unit = 1mm)
const MIN_HOLE_DIST  = 0.55; // 連続ホール間の最小距離 mm
const DRILL_INTERVAL = 80;   // ms ごとに 1 ホール追加
const WARN_DIST      = 4.5;  // 黄色警告距離 mm
const DANGER_DIST    = 2.5;  // 赤危険距離 mm

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
    drillRadius:    { value: number };
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

    // Fragment: discard inside drill holes
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `varying vec3 vDrillWorldPos;
uniform int  drillHoleCount;
uniform float drillRadius;
uniform vec3 drillHoles[${MAX_HOLES}];
void main() {
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    if (i >= drillHoleCount) break;
    if (distance(vDrillWorldPos, drillHoles[i]) < drillRadius) discard;
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
    drillRadius:    { value: number };
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
      drillRadius:    { value: DRILL_RADIUS },
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
      mat.opacity    = opacity;
      mat.transparent = boneVis === 'ghost';
      mat.depthWrite = depthWrite;
      mat.needsUpdate = true;
    });
  }, [boneVis]);

  if (boneVis === 'hidden') return null;

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
function DrillCursor({ groupRef, rotation }: {
  groupRef: React.RefObject<THREE.Group>;
  rotation: 'CW' | 'CCW';
}) {
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
    <group ref={groupRef} visible={false}>
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
  showGuide:        boolean;
  expertMode:       boolean;
  boneVis:          VisMode;
  ossicleVis:       VisMode;
  nerveVis:         VisMode;
}

function DrillCanvas3D({ drillMode, rotation, onAlert, onHoleCount, onAntrumDist, onDrillDirection, showGuide, expertMode, boneVis, ossicleVis, nerveVis }: DrillCanvas3DProps) {
  const uniformsRef    = useRef<{
    drillHoles:     { value: THREE.Vector3[] };
    drillHoleCount: { value: number };
    drillRadius:    { value: number };
  } | null>(null);
  const holeCountRef   = useRef(0);
  const isDrillingRef  = useRef(false);
  const lastHolePosRef = useRef<THREE.Vector3 | null>(null);
  const lastDrillTime  = useRef(0);
  const cursorRef      = useRef<THREE.Group>(null!);
  const orbitRef       = useRef<any>(null);

  // ドリルホール追加
  const addHole = useCallback((point: THREE.Vector3) => {
    const u = uniformsRef.current;
    if (!u || holeCountRef.current >= MAX_HOLES) return;
    const last = lastHolePosRef.current;
    if (last && last.distanceTo(point) < MIN_HOLE_DIST) return;
    const idx = holeCountRef.current;
    u.drillHoles.value[idx].copy(point);
    holeCountRef.current = idx + 1;
    u.drillHoleCount.value = idx + 1;
    lastHolePosRef.current = point.clone();
  }, []);

  // 危険部位チェック
  const checkDanger = useCallback((point: THREE.Vector3) => {
    let closest: { name: string; dist: number; level: 'warn' | 'danger' } | null = null;
    for (const z of DANGER_ZONES) {
      const zPos = new THREE.Vector3(...z.position as [number,number,number]);
      const dist = point.distanceTo(zPos);
      if (dist < WARN_DIST) {
        const level = dist < DANGER_DIST ? 'danger' : 'warn';
        if (!closest || dist < closest.dist) {
          closest = { name: z.nameJa, dist, level };
        }
      }
    }
    if (closest) {
      const icon = closest.level === 'danger' ? '🔴' : '⚠️';
      onAlert(`${icon} ${closest.name} まで ${closest.dist.toFixed(1)} mm`);
    } else {
      onAlert(null);
    }
  }, [onAlert]);

  // useFrame: ドリル中は一定間隔でホール追加
  useFrame((_, delta) => {
    if (!isDrillingRef.current || !cursorRef.current?.visible) return;
    lastDrillTime.current += delta * 1000;
    if (lastDrillTime.current >= DRILL_INTERVAL) {
      lastDrillTime.current = 0;
      addHole(cursorRef.current.position);
      onHoleCount(holeCountRef.current);
    }
  });

  // ── イベントハンドラ ──────────────────────────────────────────────
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (cursorRef.current) {
      cursorRef.current.position.copy(e.point);
      cursorRef.current.visible = true;
    }
    checkDanger(e.point);
    onAntrumDist(e.point.distanceTo(ANTRUM_POS));
    onDrillDirection(computeDrillDirection(e.point));
  }, [checkDanger, onAntrumDist, onDrillDirection]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!drillMode || e.button !== 0) return;
    e.stopPropagation();
    isDrillingRef.current = true;
    lastDrillTime.current = DRILL_INTERVAL; // 即座に 1 ホール
  }, [drillMode]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    isDrillingRef.current = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    isDrillingRef.current = false;
    if (cursorRef.current) cursorRef.current.visible = false;
    onAlert(null);
    onAntrumDist(null);
    onDrillDirection(null);
  }, [onAlert, onAntrumDist, onDrillDirection]);

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
      <DrillCursor groupRef={cursorRef} rotation={rotation} />

      {/* OrbitControls */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        mouseButtons={{
          LEFT:   drillMode ? (THREE.MOUSE as any).NONE : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.ROTATE,
        }}
        enablePan={!drillMode}
        target={[0, 0, 2]}
      />
    </>
  );
}

// ── InteractiveDrillScene: 外部コンポーネント ─────────────────────────
export function InteractiveDrillScene() {
  const [drillMode, setDrillMode] = useState(false);
  const [showGuide,  setShowGuide]  = useState(true);
  const [rotation,  setRotation]  = useState<'CW' | 'CCW'>('CW');
  const [alertMsg,  setAlertMsg]  = useState<string | null>(null);
  const [holeCount,  setHoleCount]  = useState(0);
  const [antrumDist,    setAntrumDist]    = useState<number | null>(null);
  const [drillDirection, setDrillDirection] = useState<string | null>(null);
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
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        key={resetKey}
        camera={{ position: [10, 6, 26], fov: 40 }}
        style={{ background: '#0a0f1a' }}
        gl={{ antialias: true }}
      >
        <DrillCanvas3D
          drillMode={drillMode}
          rotation={rotation}
          onAlert={setAlertMsg}
          onHoleCount={setHoleCount}
          onAntrumDist={setAntrumDist}
          onDrillDirection={setDrillDirection}
          showGuide={showGuide}
          expertMode={expertMode}
          boneVis={boneVis}
          ossicleVis={ossicleVis}
          nerveVis={nerveVis}
        />
      </Canvas>

      {/* オーバーレイ UI */}
      {/* ドリルモードトグル */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        display: 'flex', gap: 6, zIndex: 10,
      }}>
        <button
          onClick={() => setDrillMode(v => !v)}
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
        {drillMode && (
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
      </div>

      {/* ホール数表示 */}
      {holeCount > 0 && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
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
          position: 'absolute', top: 44, right: 10, zIndex: 10,
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
          position: 'absolute', top: 76, right: 10, zIndex: 10,
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
        }}>
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
      {!drillMode && (
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
      {drillMode && (
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
