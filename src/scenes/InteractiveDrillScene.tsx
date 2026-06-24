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
const MAX_HOLES      = 80;   // シェーダー配列サイズ
const DRILL_RADIUS   = 1.5;  // 3mm 径バーの半径 (scene unit = 1mm)
const MIN_HOLE_DIST  = 0.55; // 連続ホール間の最小距離 mm
const DRILL_INTERVAL = 80;   // ms ごとに 1 ホール追加
const WARN_DIST      = 4.5;  // 黄色警告距離 mm
const DANGER_DIST    = 2.5;  // 赤危険距離 mm

// 乳突洞（Mastoid Antrum）推定位置
// 算出根拠: EAC後壁(X≈2)後方5.5mm, 側頭線(Y≈10)下方3mm, 外側皮質(Z≈26)深部13mm
// Bone.glb 解剖学的実測値 2026-06-24
const ANTRUM_POS          = new THREE.Vector3(-3.5, 7.0, 13.0);
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
interface DrillBoneProps {
  uniformsRef: React.MutableRefObject<{
    drillHoles:     { value: THREE.Vector3[] };
    drillHoleCount: { value: number };
    drillRadius:    { value: number };
  } | null>;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp:   (e: ThreeEvent<PointerEvent>) => void;
}

function DrillBone({ uniformsRef, onPointerMove, onPointerDown, onPointerUp }: DrillBoneProps) {
  const { scene } = useGLTF('/models/Bone.glb');

  const cloned = useMemo(() => {
    const sentinels = Array.from({ length: MAX_HOLES }, () => new THREE.Vector3(9999, 9999, 9999));
    const uniforms = {
      drillHoles:     { value: sentinels },
      drillHoleCount: { value: 0 },
      drillRadius:    { value: DRILL_RADIUS },
    };
    uniformsRef.current = uniforms;

    const c = scene.clone(true);
    c.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry.clone();
      geo.deleteAttribute('normal');
      geo.computeVertexNormals();
      mesh.geometry = geo;

      const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color('#c8b090'),
        roughness: 0.72,
        metalness: 0.03,
        side:      THREE.DoubleSide,
      });
      applyDrillShader(mat, uniforms);
      mesh.material = mat;
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return (
    <primitive
      object={cloned}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
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

function MastoidGuide() {
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

      {/* Mastoid Antrum: First Surgical Target */}
      <mesh position={[ANTRUM_POS.x, ANTRUM_POS.y, ANTRUM_POS.z]}>
        <sphereGeometry args={[ANTRUM_RADIUS, 20, 14]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.22} />
      </mesh>
      <mesh position={[ANTRUM_POS.x, ANTRUM_POS.y, ANTRUM_POS.z]}>
        <sphereGeometry args={[ANTRUM_RADIUS + 0.1, 20, 14]} />
        <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.70} />
      </mesh>

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
  drillMode:    boolean;
  rotation:     'CW' | 'CCW';
  onAlert:      (msg: string | null) => void;
  onHoleCount:  (n: number) => void;
  onAntrumDist: (dist: number | null) => void;
  showGuide:    boolean;
}

function DrillCanvas3D({ drillMode, rotation, onAlert, onHoleCount, onAntrumDist, showGuide }: DrillCanvas3DProps) {
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
  }, [checkDanger, onAntrumDist]);

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
  }, [onAlert, onAntrumDist]);

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
      />
      {/* ポインタリーブ用不可視プレーン */}
      <mesh visible={false} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* 危険部位マーカー */}
      <DangerSpheres />
      {/* Mastoidectomy ガイドレイヤー */}
      {showGuide && <MastoidGuide />}

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
  const [antrumDist, setAntrumDist] = useState<number | null>(null);
  const [resetKey,   setResetKey]   = useState(0);

  const handleReset = () => {
    setResetKey(k => k + 1);
    setHoleCount(0);
    setAlertMsg(null);
    setAntrumDist(null);
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
          showGuide={showGuide}
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

      {/* Distance to Antrum */}
      {antrumDist !== null && (
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
