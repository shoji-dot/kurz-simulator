/**
 * scenes/debug/CoordinateDebugOverlay.tsx ── Debug Overlay (Phase1)
 *
 * 座標系統合_解剖エンジン設計書_v1.0 3.7節、および実装指示⑤に対応。
 * 表示項目: World Position / GLB Position / Anatomical Direction / BoundingBox /
 *          Current View / Camera Position / Camera Target / Current Coordinate System
 *
 * CoordinateDebugScene3D（Phase1追加）は同じデータを3D空間にも描画する「3D Debug Overlay」の
 * 土台。HTML版と独立にON/OFF可能。
 *
 * 既存の CameraDebugTracker（AnatomyScene.tsx内）と同じ設計方針を踏襲する:
 *   - Canvas内部（useFrame）ではReact stateを更新せず、DOM refに直接書き込む（再レンダー回避）
 *   - HTMLパネル自体はCanvasの外側（sibling div）に配置する
 *
 * 呼び出し元（AnatomyScene.tsx / SimScene.tsx）は ?debug=coords 時のみ本コンポーネントを
 * マウントする。既存の showCameraDebug とは完全に独立しており、既存の動作を変更しない。
 */
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CameraView, ViewPreset } from '../ViewPresets';
import { computeBoundingBoxMm } from '../../engine/coordinates/boundingBox';
import { describeAnatomicalDirection, worldToGlbLocal } from '../../engine/coordinates/transforms';
import type { Vec3Tuple } from '../../engine/coordinates/types';

const VIEW_MATCH_EPSILON_MM = 0.5;

function fmt(v: Vec3Tuple, dp = 2): string {
  return `[${v[0].toFixed(dp)}, ${v[1].toFixed(dp)}, ${v[2].toFixed(dp)}]`;
}

function findMatchingView(pos: Vec3Tuple, target: Vec3Tuple, presets: ViewPreset[]): string | null {
  for (const preset of presets) {
    const dPos = Math.hypot(
      pos[0] - preset.view.pos[0],
      pos[1] - preset.view.pos[1],
      pos[2] - preset.view.pos[2],
    );
    const dTarget = Math.hypot(
      target[0] - preset.view.target[0],
      target[1] - preset.view.target[1],
      target[2] - preset.view.target[2],
    );
    if (dPos < VIEW_MATCH_EPSILON_MM && dTarget < VIEW_MATCH_EPSILON_MM) return preset.label;
  }
  return null;
}

interface CoordinateDebugPanelProps {
  sceneLabel: string;
  panelRef: RefObject<HTMLDivElement | null>;
  /** KURZ Design System v1 の Z_INDEX トークンを渡すこと（任意数値の直書き禁止規約に準拠）。 */
  zIndex: number;
}

/** Canvas外側に置くHTMLパネル。中身は CoordinateDebugTracker が useFrame で直接書き込む。 */
export function CoordinateDebugPanel({ sceneLabel, panelRef, zIndex }: CoordinateDebugPanelProps) {
  return (
    <div
      style={{
        position: 'absolute', top: 8, right: 8, zIndex,
        background: 'rgba(0,0,0,0.78)', color: '#7fd3ff',
        fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
        borderRadius: 4, pointerEvents: 'none', whiteSpace: 'pre',
        lineHeight: 1.6, userSelect: 'none', minWidth: 230,
      }}
    >
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 3 }}>
        Coord Debug — {sceneLabel}
      </div>
      <div ref={panelRef} />
    </div>
  );
}

interface CoordinateDebugTrackerProps {
  panelRef: RefObject<HTMLDivElement | null>;
  /** BoundingBoxを計算する対象（通常はWORLD変換groupのref）。未指定ならBoundingBox欄は「未計測」表示。 */
  anatomyRootRef?: RefObject<THREE.Object3D | null>;
  /** 現在のカメラpos/targetを返す既存のgetter（getAnatomyCam / getSimCam 等）を渡す。 */
  getCameraView: () => CameraView;
  viewPresets: ViewPreset[];
  /** BoundingBox再計算の間隔（フレーム数）。負荷軽減のため既定30フレームに1回。 */
  boundingBoxIntervalFrames?: number;
}

/** Canvas内部で毎フレーム座標情報を計算し、panelRefへ直接書き込む（React再レンダーなし）。 */
export function CoordinateDebugTracker({
  panelRef,
  anatomyRootRef,
  getCameraView,
  viewPresets,
  boundingBoxIntervalFrames = 30,
}: CoordinateDebugTrackerProps) {
  const { camera } = useThree();
  const frameCount = useRef(0);
  const lastBoundingBoxText = useRef('（未計測）');

  useFrame(() => {
    const el = panelRef.current;
    if (!el) return;

    const worldPos: Vec3Tuple = [camera.position.x, camera.position.y, camera.position.z];
    const glbPos = worldToGlbLocal(worldPos);
    const direction = describeAnatomicalDirection(worldPos);
    const view = getCameraView();
    const matchedView = findMatchingView(view.pos, view.target, viewPresets);

    frameCount.current += 1;
    if (anatomyRootRef?.current && frameCount.current % boundingBoxIntervalFrames === 0) {
      const box = computeBoundingBoxMm(anatomyRootRef.current);
      lastBoundingBoxText.current = box
        ? `size=${fmt(box.sizeMm, 1)}mm center=${fmt(box.center, 1)}`
        : '（空）';
    }

    el.textContent =
      `World Pos    : ${fmt(worldPos)}\n` +
      `GLB Pos      : ${fmt(glbPos)}\n` +
      `Anatomical   : ${direction}\n` +
      `BoundingBox  : ${lastBoundingBoxText.current}\n` +
      `Current View : ${matchedView ?? '(custom)'}\n` +
      `Camera Pos   : ${fmt(view.pos)}\n` +
      `Camera Target: ${fmt(view.target)}\n` +
      `Coord System : WORLD v2 (X+=Lateral Y+=Superior Z+=Anterior)`;
  });

  return null;
}

// ── 3D Debug Overlay（Phase1: BoundingBoxワイヤーフレーム＋将来マーカー拡張点） ──
export interface CoordinateDebugMarker {
  readonly id: string;
  readonly position: Vec3Tuple;
  readonly color?: string;
  readonly labelJa?: string;
}

interface CoordinateDebugScene3DProps {
  /** BoundingBoxを可視化する対象。未指定ならワイヤーフレームは描画しない。 */
  anatomyRootRef?: RefObject<THREE.Object3D | null>;
  /**
   * 将来のランドマーク/危険部位マーカー表示用の拡張点。
   * Phase1ではEar Atlas/DANGER_ZONES等を配線しておらず、常に空配列で使う想定。
   * Phase2でEar Atlas接続時にここへ供給する（Coordinate Validation Reportの可視化先も想定）。
   */
  markers?: readonly CoordinateDebugMarker[];
  /** BoundingBox再計算の間隔（フレーム数）。既定30フレームに1回。 */
  intervalFrames?: number;
}

/**
 * 3D Debug Overlay（Phase1版）。Canvas内部に直接マウントし、BoundingBoxのワイヤーフレームと
 *（将来の）ランドマーク/危険部位マーカーを3D空間に重ねて表示する。
 * HTML版（CoordinateDebugPanel/Tracker）とは独立してON/OFFできる設計。
 */
export function CoordinateDebugScene3D({
  anatomyRootRef,
  markers = [],
  intervalFrames = 30,
}: CoordinateDebugScene3DProps) {
  const frame = useRef(0);
  const [box, setBox] = useState<{ readonly center: Vec3Tuple; readonly sizeMm: Vec3Tuple } | null>(null);

  useFrame(() => {
    frame.current += 1;
    if (!anatomyRootRef?.current) return;
    if (frame.current % intervalFrames !== 0) return;
    const computed = computeBoundingBoxMm(anatomyRootRef.current);
    setBox(computed ? { center: computed.center, sizeMm: computed.sizeMm } : null);
  });

  return (
    <group>
      {box && (
        <mesh position={[box.center[0], box.center[1], box.center[2]]}>
          <boxGeometry args={[box.sizeMm[0], box.sizeMm[1], box.sizeMm[2]]} />
          <meshBasicMaterial color="#00ffaa" wireframe transparent opacity={0.6} depthTest={false} />
        </mesh>
      )}
      {markers.map((m) => (
        <mesh key={m.id} position={[m.position[0], m.position[1], m.position[2]]}>
          <sphereGeometry args={[0.6, 10, 10]} />
          <meshBasicMaterial color={m.color ?? '#ff00ff'} wireframe depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
