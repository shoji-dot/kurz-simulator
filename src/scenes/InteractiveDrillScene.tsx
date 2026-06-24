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

// ── DrillCursor: ドリルバー 3D モデル ─────────────────────────────────
function DrillCursor({ groupRef, rotation }: {
  groupRef: React.RefObject<THREE.Group>;
  rotation: 'CW' | 'CCW';
}) {
  const burrRef = useRef<THREE.Group>(null!);
  const dir = rotation === 'CW' ? 1 : -1;

  useFrame((_, delta) => {
    // 8万RPM → rad/s ≈ 8378 → in 3D 視覚上は 60 rad/s で十分
    if (burrRef.current) burrRef.current.rotation.y += dir * 60 * delta;
  });

  return (
    <group ref={groupRef} visible={false}>
      <group ref={burrRef}>
        {/* ダイヤモンドバー球 */}
        <mesh>
          <sphereGeometry args={[DRILL_RADIUS, 24, 16]} />
          <meshStandardMaterial color="#d4e4f0" metalness={0.95} roughness={0.04} transparent opacity={0.80} />
        </mesh>
        {/* ダイヤモンド粒子フルート 8 本 */}
        {[0,45,90,135,180,225,270,315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          return (
            <mesh key={deg}
              position={[Math.cos(r)*1.1, 0, Math.sin(r)*1.1]}
              rotation={[0, -r, 0.5]}
            >
              <cylinderGeometry args={[0.04, 0.04, 1.8, 4]} />
              <meshStandardMaterial color="#a8b8c4" metalness={0.9} roughness={0.08} />
            </mesh>
          );
        })}
      </group>
      {/* シャフト */}
      <mesh position={[0, DRILL_RADIUS + 4, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 7, 10]} />
        <meshStandardMaterial color="#b0bcc8" metalness={0.88} roughness={0.12} />
      </mesh>
      {/* アクティブ時グローリング */}
      <mesh rotation={[Math.PI/2, 0, 0]} renderOrder={2}>
        <torusGeometry args={[DRILL_RADIUS * 1.3, 0.12, 8, 48]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} depthTest={false} />
      </mesh>
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
}

function DrillCanvas3D({ drillMode, rotation, onAlert, onHoleCount }: DrillCanvas3DProps) {
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
  }, [checkDanger]);

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
  }, [onAlert]);

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
  const [rotation,  setRotation]  = useState<'CW' | 'CCW'>('CW');
  const [alertMsg,  setAlertMsg]  = useState<string | null>(null);
  const [holeCount, setHoleCount] = useState(0);
  const [resetKey,  setResetKey]  = useState(0);

  const handleReset = () => {
    setResetKey(k => k + 1);
    setHoleCount(0);
    setAlertMsg(null);
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
