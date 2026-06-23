/**
 * AnatomyScene.tsx  ── 解剖学的中耳シーン（実モデル版）
 *
 * ▼ 座標系（GLB基準）
 *   アブミ骨底板 = 原点 (0,0,0)
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 *
 * ▼ viewMode
 *   'normal'     : 通常ビュー（FOV 46°）
 *   'microscope' : 手術顕微鏡ビュー（狭FOV 12°, CSSビネット）
 *   'endoscope'  : 硬性内視鏡ビュー（広角FOV 110°, 円形クリップ）
 */

import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels'; // CasePreviewSceneで使用
import { RealAnatomy, type VisibilityMap, type AuricleTransform, type StructureKey } from './models/RealAnatomyModels';

// ── 硬性内視鏡アラートゾーン定義 ────────────────────────────────────
// 座標系: 世界空間（GLB Y-down を scale=[1,-1,1] で反転後）
// GLB[x, y, z] → world[x, -y, z]
export interface EndoscopeAlert {
  id:       string;
  nameJa:   string;
  severity: 'warning' | 'danger';
}

const ENDO_ZONES: Array<{
  id:        string;
  nameJa:    string;
  severity:  'warning' | 'danger';
  visKey?:   string;            // vis が hidden なら skip
  center:    [number,number,number]; // world space
  radius:    number;            // mm
}> = [
  // 耳小骨クラスター（world: GLB stapes head Y-flip）
  { id: 'ossicles',        nameJa: '耳小骨',          severity: 'warning', visKey: 'malleus',      center: [0.84,  2.65, 4.86], radius: 5.5 },
  // 鼓膜・臍（umbo）
  { id: 'tympanic',        nameJa: '鼓膜',             severity: 'warning', visKey: 'tympanic',     center: [0.0,   0.0,  5.5],  radius: 4.5 },
  // 顔面神経 鼓室部（world: GLB[0, 2.8, -1.5] → [0, -2.8, -1.5]）
  { id: 'facial-tympanic', nameJa: '顔面神経（鼓室部）', severity: 'danger', visKey: 'facialNerve',  center: [0.0,  -2.8, -1.5], radius: 5.5 },
  // 顔面神経 第2膝部（world: GLB[-4, 1.5, -3] → [-4, -1.5, -3]）
  { id: 'facial-genu',     nameJa: '顔面神経（第2膝部）', severity: 'danger', visKey: 'facialNerve', center: [-4.0, -1.5, -3.0], radius: 5.0 },
  // 鼓索神経（ossicle間を走行、大まかな推定位置）
  { id: 'chorda',          nameJa: '鼓索神経',          severity: 'danger', visKey: 'chordaTympani', center: [0.5,  2.0,  4.0],  radius: 4.5 },
];

// ── 硬性内視鏡近接モニター（Canvas内コンポーネント）─────────────────
function EndoscopeMonitor({
  enabled,
  vis,
  onAlert,
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
      // 対応する構造が hidden なら skip
      if (z.visKey && vis) {
        const mode = (vis as Record<string, string>)[z.visKey];
        if (mode === 'hidden') continue;
      }
      const c = new THREE.Vector3(...z.center);
      if (pos.distanceTo(c) < z.radius) {
        active.push({ id: z.id, nameJa: z.nameJa, severity: z.severity });
      }
    }

    const key = active.map(a => a.id).join(',');
    if (key !== lastKey.current) {
      lastKey.current = key;
      onAlertRef.current(active);
    }
  });

  return null;
}
import { TympanoCavityEdu } from './models/TympanoCavityModel';
import type { OssicleStatus, StapesStatus } from '../data/cases';

export type ViewMode = 'normal' | 'microscope' | 'endoscope';

// ── 距離ベースのズームハンドラ（OrbitControlsのdollyと統一）─────
function ZoomHandler({ level }: { level: number }) {
  const { controls } = useThree();
  const prevLevel = useRef(0);

  useEffect(() => {
    if (!controls) return;
    const diff = level - prevLevel.current;
    if (diff === 0) return;
    const oc = controls as any;
    for (let i = 0; i < Math.abs(diff); i++) {
      if (diff > 0) oc.dollyOut?.(1.35);
      else oc.dollyIn?.(1.35);
    }
    oc.update?.();
    prevLevel.current = level;
  }, [level, controls]);

  return null;
}

// ── ビューモードコントローラー（Canvas内に置く）─────────────────
const VIEW_FOV: Record<ViewMode, number> = {
  normal:     46,
  microscope: 11,
  endoscope:  112,
};

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
// メイン解剖シーン（AnatomyScene）
// ══════════════════════════════════════════════════════════════════
interface AnatomySceneProps {
  vis?:               VisibilityMap;
  zoomLevel?:         number;
  showTympanoCavity?: boolean;
  showPinna?:         boolean;
  /** showPinna=true のとき ghost(半透明) or solid で不透明度が変わる */
  pinnaMode?:         'solid' | 'ghost';
  patientId?:         string;
  /** 手術用ビューモード（CSS オーバーレイは LearningMode 側で描画） */
  viewMode?:          ViewMode;
  /** 耳介の位置・回転・反転をデバッグ調整するトランスフォーム */
  auricleTransform?:  AuricleTransform;
  /** ハイライトする構造キー */
  highlightedKey?:    string | null;
  /** 側頭骨ghost時不透明度（0–1） */
  boneGhostOpacity?:  number;
  /** OrbitControls最小距離（内視鏡貫通防止に使用） */
  minDistance?:       number;
  /** 内視鏡近接アラートコールバック */
  onEndoscopeAlert?:  (alerts: EndoscopeAlert[]) => void;
  /** ダブルクリックで構造の表示モードを切替するコールバック */
  onStructureClick?:  (key: StructureKey) => void;
}

export function AnatomyScene({
  vis,
  zoomLevel = 0,
  showTympanoCavity = false,
  showPinna = false,
  pinnaMode = 'solid',
  patientId = 'T',
  viewMode = 'normal',
  auricleTransform,
  highlightedKey,
  boneGhostOpacity,
  minDistance = 4,
  onEndoscopeAlert,
  onStructureClick,
}: AnatomySceneProps) {
  // 耳介（Auricle.glb）を vis に統合
  // Auricle.glb は Bone.glb と同一CT由来で位置合わせ済み。
  // solid=0.55 / ghost=0.12（GHOST_OPACITY準拠）
  const auricleMode = showPinna
    ? (pinnaMode === 'ghost' ? 'ghost' : 'solid')
    : (vis?.auricle ?? 'hidden');
  const mergedVis: VisibilityMap = { ...vis, auricle: auricleMode };
  return (
    <Canvas
      camera={{ position: [2, 4, 65], fov: 42 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0f1a']} />

      {/* ── ズームハンドラ（OrbitControls距離ベース） ── */}
      <ZoomHandler level={zoomLevel} />

      {/* ── ビューモードコントローラー ── */}
      <ViewModeController mode={viewMode} />

      {/* ── 硬性内視鏡近接モニター ── */}
      {viewMode === 'endoscope' && onEndoscopeAlert && (
        <EndoscopeMonitor
          enabled={true}
          vis={vis}
          onAlert={onEndoscopeAlert}
        />
      )}

      {/* ── ライティング ── */}
      <directionalLight position={[5, 15, 10]}  intensity={1.8}  color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[2, 3, 18]}   intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[0, -8, 5]}   intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1,  3,  4]} intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      <Suspense fallback={null}>
        {/* Y軸反転グループ（GLBがY-down座標系のため） */}
        <group scale={[1, -1, 1]}>
          {/* 耳介は mergedVis.auricle で制御（実スキャンGLB: ears/Auricle_${patientId}.glb） */}
          <RealAnatomy vis={mergedVis} auricleTransform={auricleTransform} highlightedKey={highlightedKey} patientId={patientId} boneGhostOpacity={boneGhostOpacity} onStructureClick={onStructureClick} />
          {/* 鼓室解剖モデル（学習モード: 鼓室タブで表示） */}
          {showTympanoCavity && <TympanoCavityEdu />}
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, 0, 4]}
        enablePan={true}
        minDistance={minDistance}
        maxDistance={90}
        autoRotate={false}
      />
    </Canvas>
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
      camera={{ position: [4, 6, 24], fov: 44 }}
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
