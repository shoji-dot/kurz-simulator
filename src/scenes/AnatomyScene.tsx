/**
 * AnatomyScene.tsx  ── 解剖学的中耳シーン（実モデル版）
 *
 * ▼ 座標系 v2（world空間）
 *   GLB[x, y, z] → world[z, -y, x]
 *   X+ = 患者右側 / 外側 (Lateral)
 *   Y+ = 頭頂側   (Superior)
 *   Z+ = 顔面側   (Anterior)
 *
 * ▼ モデル変換
 *   <group rotation={[Math.PI, -Math.PI/2, 0]}>
 *   = Ry(-90°) * Rx(180°) → GLB[x,y,z] → world[z,-y,x]
 *
 * ▼ 主要ランドマーク (world v2)
 *   アブミ骨底板 : [0, 0, 0]
 *   アブミ骨頭   : [4.86, 2.65, 0.84]
 *   鼓膜中心     : [5.5, 0, 0]
 *   側頭骨中心   : [0, 12, -3]
 *
 * ▼ viewMode
 *   'normal'     : 通常ビュー（FOV 46°）
 *   'microscope' : 手術顕微鏡ビュー（狭FOV 12°, CSSビネット）
 *   'endoscope'  : 硬性内視鏡ビュー（広角FOV 110°, 円形クリップ）
 */

import { Suspense, useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels'; // CasePreviewSceneで使用
import { RealAnatomy, type VisibilityMap, type AuricleTransform, type StructureKey } from './models/RealAnatomyModels';

// ── 硬性内視鏡アラートゾーン定義 ────────────────────────────────────
// 座標系 v2: world[z,-y,x] (X+=Lateral, Y+=Superior, Z+=Anterior)
export interface EndoscopeAlert {
  id:       string;
  nameJa:   string;
  severity: 'warning' | 'danger';
}

const ENDO_ZONES: Array<{
  id:        string;
  nameJa:    string;
  severity:  'warning' | 'danger';
  visKey?:   string;
  center:    [number,number,number]; // world v2 space
  radius:    number;
}> = [
  { id: 'ossicles',        nameJa: '耳小骨',           severity: 'warning', visKey: 'malleus',      center: [4.86,  2.65,  0.84], radius: 5.5 },
  { id: 'tympanic',        nameJa: '鼓膜',              severity: 'warning', visKey: 'tympanic',     center: [5.5,   0.0,   0.0 ], radius: 4.5 },
  { id: 'facial-tympanic', nameJa: '顔面神経（鼓室部）',  severity: 'danger', visKey: 'facialNerve',  center: [-1.5, -2.8,   0.0 ], radius: 5.5 },
  { id: 'facial-genu',     nameJa: '顔面神経（第2膝部）', severity: 'danger', visKey: 'facialNerve', center: [-3.0, -1.5,  -4.0 ], radius: 5.0 },
  { id: 'chorda',          nameJa: '鼓索神経',           severity: 'danger', visKey: 'chordaTympani', center: [4.0,   2.0,   0.5 ], radius: 4.5 },
];

// ── 硬性内視鏡近接モニター ─────────────────────────────────────────
function EndoscopeMonitor({
  enabled, vis, onAlert,
}: {
  enabled: boolean;
  vis?: VisibilityMap;
  onAlert: (alerts: EndoscopeAlert[]) => void;
}) {
  const { camera } = useThree();
  const onAlertRef = useRef(onAlert);
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);
  const lastKey = useRef('');

  useFrame(() => {
    if (!enabled) return;
    const pos = camera.position;
    const active: EndoscopeAlert[] = [];
    for (const z of ENDO_ZONES) {
      if (z.visKey && vis) {
        const mode = (vis as Record<string, string>)[z.visKey];
        if (mode === 'hidden') continue;
      }
      if (pos.distanceTo(new THREE.Vector3(...z.center)) < z.radius) {
        active.push({ id: z.id, nameJa: z.nameJa, severity: z.severity });
      }
    }
    const key = active.map(a => a.id).join(',');
    if (key !== lastKey.current) { lastKey.current = key; onAlertRef.current(active); }
  });
  return null;
}

// ── カメラデバッグトラッカー ───────────────────────────────────────
function CameraDebugTracker({ divRef }: { divRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera, controls } = useThree();
  const _tmp = useRef(new THREE.Vector3());
  useFrame(() => {
    const el = divRef.current;
    if (!el) return;
    const oc = controls as any;
    const t  = oc?.target ?? new THREE.Vector3();
    const p  = camera.position;
    const q  = camera.quaternion;
    const e  = camera.rotation;
    camera.getWorldDirection(_tmp.current);
    const f = _tmp.current;
    const u = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const deg = (rad: number) => (rad * 180 / Math.PI).toFixed(1);
    const v3  = (v: THREE.Vector3, dp = 1) => `[${v.x.toFixed(dp)}, ${v.y.toFixed(dp)}, ${v.z.toFixed(dp)}]`;
    el.textContent =
      `Pos   : ${v3(p)}\nTarget: ${v3(t)}\nDist  : ${p.distanceTo(t).toFixed(1)} mm\n` +
      `Fwd   : ${v3(f, 2)}\nUp    : ${v3(u, 2)}\nRight : ${v3(r, 2)}\n` +
      `Euler : [${deg(e.x)}°, ${deg(e.y)}°, ${deg(e.z)}°]\n` +
      `Quat  : [${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)}]`;
  });
  return null;
}

// ── カメラ up ベクトル初期化（scene remount 時に localStorage の up を復元）────
function CameraUpSetter({ up }: { up: [number, number, number] }) {
  const { camera, controls } = useThree();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    camera.up.set(up[0], up[1], up[2]);
    (controls as any)?.update?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

import { TympanoCavityEdu } from './models/TympanoCavityModel';

// ── カメラ視点 保存/復元 ────────────────────────────────────────────
// v2: 座標系変更・up vector 保存対応
const _ANAT_KEY     = 'kurz_cam_anatomy';
const _ANAT_VERSION = 4;
const _ANAT_DEFAULT = {
  pos:    [-40, -25, 45] as [number, number, number],
  target: [0,  12, -3] as [number, number, number],
  up:     [0,  1,  0 ] as [number, number, number],
};

function _loadAnatCam() {
  try {
    const raw = localStorage.getItem(_ANAT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === _ANAT_VERSION &&
          Array.isArray(d.pos)    && d.pos.length    === 3 &&
          Array.isArray(d.target) && d.target.length === 3) {
        return {
          pos:    d.pos    as [number, number, number],
          target: d.target as [number, number, number],
          up:     (Array.isArray(d.up) && d.up.length === 3
            ? d.up
            : [0, 1, 0]) as [number, number, number],
        };
      }
    }
  } catch { /* */ }
  return { ..._ANAT_DEFAULT };
}

let _anatCam: { pos: [number,number,number]; target: [number,number,number]; up: [number,number,number] } = { ..._ANAT_DEFAULT };
let _anatOrbit: any = null;

export function saveAnatomyCam(): void {
  // pos/target/up を含む完全な状態を保存
  localStorage.setItem(_ANAT_KEY, JSON.stringify({ ..._anatCam, version: _ANAT_VERSION }));
}
/** 現在のカメラ視点を返す（ViewPresetPanel カスタム保存用） */
export function getAnatomyCam(): import('./ViewPresets').CameraView {
  return { pos: [..._anatCam.pos] as [number,number,number], target: [..._anatCam.target] as [number,number,number], up: [..._anatCam.up] as [number,number,number] };
}
export function resetAnatomyCam(): void {
  localStorage.removeItem(_ANAT_KEY);
  _anatCam = { ..._ANAT_DEFAULT };
  if (_anatOrbit) {
    const [px, py, pz] = _ANAT_DEFAULT.pos;
    const [tx, ty, tz] = _ANAT_DEFAULT.target;
    _anatOrbit.object.up.set(0, 1, 0);
    _anatOrbit.object.position.set(px, py, pz);
    _anatOrbit.target.set(tx, ty, tz);
    _anatOrbit.update();
  }
}
export function setAnatomyCameraView(view: import('./ViewPresets').CameraView): void {
  if (!_anatOrbit) return;
  const [px, py, pz] = view.pos;
  const [tx, ty, tz] = view.target;
  const up = (view.up ?? [0, 1, 0]) as [number, number, number];
  _anatOrbit.object.up.set(up[0], up[1], up[2]);
  _anatOrbit.object.position.set(px, py, pz);
  _anatOrbit.target.set(tx, ty, tz);
  _anatOrbit.update();
  _anatCam = { pos: [px, py, pz], target: [tx, ty, tz], up };
}

import type { OssicleStatus, StapesStatus } from '../data/cases';

export type ViewMode = 'normal' | 'microscope' | 'endoscope';

// ── 距離ベースズームハンドラ ──────────────────────────────────────
function ZoomHandler({ level }: { level: number }) {
  const { controls } = useThree();
  const prevLevel = useRef(0);
  useEffect(() => {
    if (!controls) return;
    const diff = level - prevLevel.current;
    if (diff === 0) return;
    const oc = controls as any;
    for (let i = 0; i < Math.abs(diff); i++) {
      if (diff > 0) oc.dollyOut?.(1.35); else oc.dollyIn?.(1.35);
    }
    oc.update?.();
    prevLevel.current = level;
  }, [level, controls]);
  return null;
}

// ── ビューモードコントローラー ────────────────────────────────────
const VIEW_FOV: Record<ViewMode, number> = { normal: 46, microscope: 11, endoscope: 112 };
function ViewModeController({ mode }: { mode: ViewMode }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = VIEW_FOV[mode];
    cam.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

// ══════════════════════════════════════════════════════════════════
// メイン解剖シーン
// ══════════════════════════════════════════════════════════════════
interface AnatomySceneProps {
  vis?:               VisibilityMap;
  zoomLevel?:         number;
  showTympanoCavity?: boolean;
  viewMode?:          ViewMode;
  highlightedKey?:    string | null;
  boneGhostOpacity?:  number;
  minDistance?:       number;
  onEndoscopeAlert?:  (alerts: EndoscopeAlert[]) => void;
  onStructureClick?:  (key: StructureKey) => void;
  panMode?:           boolean;
  showCameraDebug?:   boolean;
  /** 顕微鏡モード: true=移動可, false=固定（OrbitControls無効） */
  positionMode?:      boolean;
}

export function AnatomyScene({
  vis,
  zoomLevel = 0,
  showTympanoCavity = false,
  viewMode = 'normal',
  highlightedKey,
  boneGhostOpacity,
  minDistance = 4,
  onEndoscopeAlert,
  onStructureClick,
  panMode = false,
  showCameraDebug = false,
  positionMode = false,
}: AnatomySceneProps) {
  const [initCam] = useState(() => _loadAnatCam());
  const mergedVis: VisibilityMap = { ...vis, auricle: 'hidden' };
  const debugDivRef = useRef<HTMLDivElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const _pointerMoved = useRef(false);
  const _pStart = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dn = (e: PointerEvent) => { _pStart.current = { x: e.clientX, y: e.clientY }; _pointerMoved.current = false; };
    const mv = (e: PointerEvent) => { const dx = e.clientX - _pStart.current.x, dy = e.clientY - _pStart.current.y; if (dx*dx+dy*dy > 25) _pointerMoved.current = true; };
    el.addEventListener('pointerdown', dn);
    el.addEventListener('pointermove', mv);
    return () => { el.removeEventListener('pointerdown', dn); el.removeEventListener('pointermove', mv); };
  }, []);
  const handleStructureClick = useCallback((key: import('./models/RealAnatomyModels').StructureKey) => {
    if (!_pointerMoved.current) onStructureClick?.(key);
  }, [onStructureClick]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
    {showCameraDebug && (
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 100,
        background: 'rgba(0,0,0,0.72)', color: '#7fffb2',
        fontFamily: 'monospace', fontSize: 10, padding: '6px 8px',
        borderRadius: 4, pointerEvents: 'none', whiteSpace: 'pre',
        lineHeight: 1.55, userSelect: 'none',
      }}>
        <div style={{ color: '#aaa', marginBottom: 2, fontSize: 9 }}>
          COORD v2: X+=右(Lateral) Y+=上(Sup) Z+=前(Ant)
        </div>
        <div ref={debugDivRef as any} />
      </div>
    )}
    <Canvas
      camera={{ position: initCam.pos, fov: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0f1a']} />

      {/* ── localStorage の up ベクトルをカメラに適用 ── */}
      <CameraUpSetter up={initCam.up} />

      <ZoomHandler level={zoomLevel} />
      <ViewModeController mode={viewMode} />

      {viewMode === 'endoscope' && onEndoscopeAlert && (
        <EndoscopeMonitor enabled={true} vis={vis} onAlert={onEndoscopeAlert} />
      )}
      {showCameraDebug && <CameraDebugTracker divRef={debugDivRef} />}

      {/* ── ライティング ── */}
      <directionalLight position={[10, 15, 5]}  intensity={1.8}  color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[18, 3, 2]}   intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-12, 2, -4]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[5, -8, 0]}   intensity={0.25} color="#d0e4ff" />
      <pointLight position={[-8, -2, 0]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[4,   3, 1]} intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      <Suspense fallback={null}>
        {/*
          座標系 v2: rotation=[π, -π/2, 0]
          GLB[x,y,z] → world[z,-y,x]: X+=Lateral, Y+=Superior, Z+=Anterior
        */}
        <group rotation={[Math.PI, -Math.PI / 2, 0]}>
          <RealAnatomy vis={mergedVis} highlightedKey={highlightedKey} boneGhostOpacity={boneGhostOpacity} onStructureClick={handleStructureClick} />
          {showTympanoCavity && <TympanoCavityEdu />}
        </group>
      </Suspense>

      {/* ギズモ v2: X=右(Lateral), Y=上(Superior), Z=前(Anterior) */}
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport
          axisColors={['#ff6655', '#88ee88', '#5599ff']}
          labelColor="#ffffff"
          labels={['右', '上', '前']}
        />
      </GizmoHelper>

      <OrbitControls
        makeDefault
        ref={(r: any) => { _anatOrbit = r; }}
        target={initCam.target}
        enablePan={panMode}
        enableRotate={!panMode && (viewMode !== 'microscope' || positionMode)}
        enableZoom={true}
        minDistance={minDistance}
        maxDistance={90}
        autoRotate={false}
        mouseButtons={{
          LEFT:   panMode ? THREE.MOUSE.PAN    : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        }}
        onChange={() => {
          if (!_anatOrbit) return;
          const p = _anatOrbit.object.position;
          const t = _anatOrbit.target;
          const u = _anatOrbit.object.up;
          // up を含めて追跡（保存時に up も含まれる）
          _anatCam = {
            pos:    [p.x, p.y, p.z],
            target: [t.x, t.y, t.z],
            up:     [u.x, u.y, u.z],
          };
        }}
      />
    </Canvas>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 症例プレビュー（シミュレーション選択画面用）
// ══════════════════════════════════════════════════════════════════
interface CaseSceneProps {
  malleus: string;
  incus:   string;
  stapes:  string;
}
export function CasePreviewScene({ malleus, incus, stapes }: CaseSceneProps) {
  return (
    <Canvas
      camera={{ position: [4, 8, 40], fov: 42 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060c18']} />
      <ambientLight intensity={0.50} />
      <directionalLight position={[4, 8, 14]} intensity={1.1} color="#fffaf0" />
      <directionalLight position={[-6, 2, 6]} intensity={0.30} color="#d8e8ff" />

      <Suspense fallback={null}>
        <OssicleChain
          malleus={malleus as OssicleStatus}
          incus={incus   as OssicleStatus}
          stapes={stapes as StapesStatus}
          showLabels={false}
        />
        <mesh position={[0, 0.5, 1.0]}>
          <planeGeometry args={[14, 17]} />
          <meshStandardMaterial color="#d0c4aa" roughness={0.55} />
        </mesh>
        <mesh position={[2.84, -4.15, 1.9]}>
          <sphereGeometry args={[2.2, 16, 12]} />
          <meshStandardMaterial color="#c4b890" roughness={0.48} />
        </mesh>
        <mesh position={[0, 2.0, 5.5]}>
          <ringGeometry args={[4.4, 5.0, 44]} />
          <meshStandardMaterial color="#d0c4aa" roughness={0.50} side={THREE.DoubleSide} />
        </mesh>
      </Suspense>

      <OrbitControls
        target={[0, 1, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
