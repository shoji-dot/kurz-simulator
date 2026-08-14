/**
 * scenes/debug/SceneDumpOverlay.tsx ── Scene Traverse Diagnostic Overlay（一時計装）
 *
 * [Claude Code 実装依頼] Prosthesis–Anatomy Occlusion 原因診断（Runtime Instrumentation）対応。
 * 目的: Bone/Prosthesisのruntime material値（transparent/opacity/depthTest/depthWrite/
 * renderOrder等）とWorld Transform・Camera/Renderer構成を実機から直接取得し、Static Code
 * Reviewでは説明できない「なぜdepth occlusionが成立しないのか」というEvidence Gapを埋める。
 *
 * 既存のCoordinateDebugOverlay.tsxと同じ設計方針を踏襲する:
 *   - Canvas内部（SceneDumpTracker）ではReact stateを毎フレーム更新せず、キャプチャ要求時
 *     （captureRequestIdの変化）にのみ scene.traverse() を実行する（常時console spam禁止）。
 *   - HTMLパネル本体（SceneDumpPanel）はCanvasの外側（sibling div）に配置する。
 *   - 呼び出し元（SimScene.tsx）は ?debug=scenedump 時のみ本コンポーネントをマウントする。
 *   - 診断専用: このファイルはAnatomy/Prosthesisの描画・Material設定には一切触れない
 *     （読み取り専用のtraverse、副作用なし）。
 */
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ── ダンプ用の型 ─────────────────────────────────────────────────────
interface Vec3Dump { x: number; y: number; z: number }

interface GeometryDump {
  uuid: string;
  type: string;
  vertexCount: number;
  hasBoundingBox: boolean;
  boundingBox: { min: Vec3Dump; max: Vec3Dump } | null;
  hasBoundingSphere: boolean;
  boundingSphere: { center: Vec3Dump; radius: number } | null;
}

interface MaterialDump {
  type: string;
  uuid: string;
  transparent: boolean;
  opacity: number;
  depthTest: boolean;
  depthWrite: boolean;
  colorWrite: boolean;
  blending: number;
  side: number;
  alphaTest: number;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  color: string | null;
  emissive: string | null;
  materialArrayCount: number;
}

export interface MeshDumpEntry {
  name: string;
  type: string;
  visible: boolean;
  renderOrder: number;
  parentName: string;
  parentType: string;
  ancestorPath: string;
  worldPosition: Vec3Dump;
  subtreeTag: 'anatomy-subtree' | 'prosthesis-subtree' | 'other';
  geometry: GeometryDump | null;
  material: MaterialDump | null;
}

interface CameraDump {
  type: string;
  position: Vec3Dump;
  rotation: Vec3Dump;
  quaternion: { x: number; y: number; z: number; w: number };
  fov: number | null;
  near: number;
  far: number;
  layersMask: number;
}

interface RendererDump {
  contextAttributes: WebGLContextAttributes | null;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  toneMapping: number;
  toneMappingExposure: number;
  outputColorSpace: string;
}

interface GroupTransformDump {
  found: boolean;
  worldPosition: Vec3Dump | null;
  worldQuaternion: { x: number; y: number; z: number; w: number } | null;
  worldScale: Vec3Dump | null;
}

export interface SceneDumpResult {
  capturedAtIso: string;
  captureLabel: string;
  meshCount: number;
  meshes: MeshDumpEntry[];
  camera: CameraDump;
  renderer: RendererDump;
  anatomyRoot: GroupTransformDump;
  prosthesisRoot: GroupTransformDump;
  context: {
    activeRepresentation: string;
    manipulationCommitted: boolean;
    directDragActive: boolean;
  };
}

function vec3(v: THREE.Vector3): Vec3Dump {
  return { x: v.x, y: v.y, z: v.z };
}

function colorToHex(c: THREE.Color | undefined | null): string | null {
  if (!c) return null;
  return `#${c.getHexString()}`;
}

function dumpGeometry(geo: THREE.BufferGeometry | undefined): GeometryDump | null {
  if (!geo) return null;
  // boundingBox/boundingSphereは既存挙動に影響しない読み取り専用計算
  // （未計算の場合のみcomputeし、「実機で本当にnullのままか」を区別するため
  //  hasBoundingBox/hasBoundingSphereを計算前の状態で記録する）。
  const hadBoundingBox = geo.boundingBox !== null;
  const hadBoundingSphere = geo.boundingSphere !== null;
  if (!hadBoundingBox) geo.computeBoundingBox();
  if (!hadBoundingSphere) geo.computeBoundingSphere();
  return {
    uuid: geo.uuid,
    type: geo.type,
    vertexCount: geo.attributes.position ? geo.attributes.position.count : 0,
    hasBoundingBox: hadBoundingBox,
    boundingBox: geo.boundingBox
      ? { min: vec3(geo.boundingBox.min), max: vec3(geo.boundingBox.max) }
      : null,
    hasBoundingSphere: hadBoundingSphere,
    boundingSphere: geo.boundingSphere
      ? { center: vec3(geo.boundingSphere.center), radius: geo.boundingSphere.radius }
      : null,
  };
}

function dumpMaterial(mat: THREE.Material | THREE.Material[] | undefined): MaterialDump | null {
  if (!mat) return null;
  const arr = Array.isArray(mat) ? mat : [mat];
  const m = arr[0] as THREE.MeshStandardMaterial & { alphaTest?: number };
  if (!m) return null;
  return {
    type: m.type,
    uuid: m.uuid,
    transparent: m.transparent,
    opacity: m.opacity,
    depthTest: m.depthTest,
    depthWrite: m.depthWrite,
    colorWrite: m.colorWrite,
    blending: m.blending,
    side: m.side,
    alphaTest: m.alphaTest ?? 0,
    polygonOffset: m.polygonOffset,
    polygonOffsetFactor: m.polygonOffsetFactor,
    polygonOffsetUnits: m.polygonOffsetUnits,
    color: colorToHex((m as THREE.MeshStandardMaterial).color),
    emissive: colorToHex((m as THREE.MeshStandardMaterial).emissive),
    materialArrayCount: arr.length,
  };
}

function ancestorPath(obj: THREE.Object3D): string {
  const names: string[] = [];
  let p: THREE.Object3D | null = obj.parent;
  let depth = 0;
  while (p && depth < 20) {
    names.unshift(p.name || `(unnamed:${p.type})`);
    p = p.parent;
    depth += 1;
  }
  return names.join(' / ');
}

function subtreeTagOf(
  obj: THREE.Object3D,
  anatomyRoot: THREE.Object3D | null,
  prosthesisRoot: THREE.Object3D | null,
): MeshDumpEntry['subtreeTag'] {
  let p: THREE.Object3D | null = obj;
  while (p) {
    if (anatomyRoot && p === anatomyRoot) return 'anatomy-subtree';
    if (prosthesisRoot && p === prosthesisRoot) return 'prosthesis-subtree';
    p = p.parent;
  }
  return 'other';
}

function dumpGroupTransform(obj: THREE.Object3D | null): GroupTransformDump {
  if (!obj) return { found: false, worldPosition: null, worldQuaternion: null, worldScale: null };
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  obj.updateWorldMatrix(true, false);
  obj.matrixWorld.decompose(pos, quat, scale);
  return {
    found: true,
    worldPosition: vec3(pos),
    worldQuaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
    worldScale: vec3(scale),
  };
}

/** scene.traverse()本体。読み取り専用（副作用はboundingBox/boundingSphereの遅延computeのみ、
 *  これは既存挙動・見た目に一切影響しない）。SceneDumpTracker内部からのみ呼ぶ
 *  （fast refresh制約: コンポーネントを含むファイルの他のvalue exportを避けるため非export）。 */
function buildSceneDump(params: {
  scene: THREE.Scene;
  camera: THREE.Camera;
  gl: THREE.WebGLRenderer;
  anatomyRoot: THREE.Object3D | null;
  prosthesisRoot: THREE.Object3D | null;
  captureLabel: string;
  activeRepresentation: string;
  manipulationCommitted: boolean;
  directDragActive: boolean;
}): SceneDumpResult {
  const { scene, camera, gl, anatomyRoot, prosthesisRoot, captureLabel, activeRepresentation, manipulationCommitted, directDragActive } = params;

  const meshes: MeshDumpEntry[] = [];
  const worldPos = new THREE.Vector3();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    mesh.getWorldPosition(worldPos);
    meshes.push({
      name: mesh.name,
      type: mesh.type,
      visible: mesh.visible,
      renderOrder: mesh.renderOrder,
      parentName: mesh.parent?.name ?? '',
      parentType: mesh.parent?.type ?? '',
      ancestorPath: ancestorPath(mesh),
      worldPosition: vec3(worldPos),
      subtreeTag: subtreeTagOf(mesh, anatomyRoot, prosthesisRoot),
      geometry: dumpGeometry(mesh.geometry),
      material: dumpMaterial(mesh.material),
    });
  });

  const persp = camera as THREE.PerspectiveCamera;
  const camEuler = new THREE.Euler().setFromQuaternion(camera.quaternion);

  const contextAttributes: WebGLContextAttributes | null = (() => {
    try {
      return gl.getContext().getContextAttributes();
    } catch {
      return null;
    }
  })();

  return {
    capturedAtIso: new Date().toISOString(),
    captureLabel,
    meshCount: meshes.length,
    meshes,
    camera: {
      type: camera.type,
      position: vec3(camera.position),
      rotation: { x: camEuler.x, y: camEuler.y, z: camEuler.z },
      quaternion: { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w },
      fov: typeof persp.fov === 'number' ? persp.fov : null,
      near: (camera as THREE.PerspectiveCamera).near,
      far: (camera as THREE.PerspectiveCamera).far,
      layersMask: camera.layers.mask,
    },
    renderer: {
      contextAttributes,
      drawingBufferWidth: gl.domElement.width,
      drawingBufferHeight: gl.domElement.height,
      toneMapping: gl.toneMapping,
      toneMappingExposure: gl.toneMappingExposure,
      outputColorSpace: gl.outputColorSpace,
    },
    anatomyRoot: dumpGroupTransform(anatomyRoot),
    prosthesisRoot: dumpGroupTransform(prosthesisRoot),
    context: { activeRepresentation, manipulationCommitted, directDragActive },
  };
}

// ── Canvas内部: キャプチャ要求（captureRequestIdの変化）を検知してtraverseを実行 ──────
interface SceneDumpTrackerProps {
  captureRequestId: number;
  captureLabel: string;
  anatomyRootRef: RefObject<THREE.Object3D | null>;
  prosthesisRootRef: RefObject<THREE.Object3D | null>;
  activeRepresentation: string;
  manipulationCommitted: boolean;
  directDragActive: boolean;
  onCaptured: (result: SceneDumpResult) => void;
  /** true時、directDragActiveの間 intervalMs 間隔で自動キャプチャする（既定OFF、常時spam防止）。 */
  autoCaptureWhileDragging?: boolean;
  autoCaptureIntervalMs?: number;
}

export function SceneDumpTracker({
  captureRequestId,
  captureLabel,
  anatomyRootRef,
  prosthesisRootRef,
  activeRepresentation,
  manipulationCommitted,
  directDragActive,
  onCaptured,
  autoCaptureWhileDragging = false,
  autoCaptureIntervalMs = 500,
}: SceneDumpTrackerProps) {
  const { scene, camera, gl } = useThree();
  const lastRequestId = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const capture = (label: string) => {
    const result = buildSceneDump({
      scene, camera, gl,
      anatomyRoot: anatomyRootRef.current,
      prosthesisRoot: prosthesisRootRef.current,
      captureLabel: label,
      activeRepresentation,
      manipulationCommitted,
      directDragActive,
    });
    // 常時spamしない: ボタン押下時 or 一定間隔のみ出力（ここでのみconsole出力する）。
    console.groupCollapsed(`[SceneDump] ${label} @ ${result.capturedAtIso} (meshes=${result.meshCount})`);
    console.table(result.meshes.map((m) => ({
      name: m.name || '(no name)',
      subtree: m.subtreeTag,
      visible: m.visible,
      renderOrder: m.renderOrder,
      transparent: m.material?.transparent,
      opacity: m.material?.opacity,
      depthTest: m.material?.depthTest,
      depthWrite: m.material?.depthWrite,
      worldPos: `${m.worldPosition.x.toFixed(2)},${m.worldPosition.y.toFixed(2)},${m.worldPosition.z.toFixed(2)}`,
    })));
    console.log(result);
    console.groupEnd();
    onCaptured(result);
  };

  useEffect(() => {
    if (captureRequestId === lastRequestId.current) return;
    lastRequestId.current = captureRequestId;
    capture(captureLabel);
    // captureLabel/各種contextはcapture()内クロージャで都度最新値を参照するため依存配列には
    // captureRequestIdのみで十分（他は最新のrenderで再生成されるcapture関数が参照する）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureRequestId]);

  useEffect(() => {
    if (!autoCaptureWhileDragging || !directDragActive) {
      if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
      return;
    }
    autoTimerRef.current = setInterval(() => capture('auto(dragging)'), autoCaptureIntervalMs);
    return () => {
      if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCaptureWhileDragging, directDragActive, autoCaptureIntervalMs]);

  return null;
}

// ── Canvas外側: HTMLパネル（ボタン + 結果表示） ──────────────────────────────
interface SceneDumpPanelProps {
  zIndex: number;
  onRequestCapture: (label: string) => void;
  lastResult: SceneDumpResult | null;
  history: readonly { label: string; at: string }[];
  autoCaptureWhileDragging: boolean;
  onToggleAutoCapture: (v: boolean) => void;
}

export function SceneDumpPanel({
  zIndex, onRequestCapture, lastResult, history, autoCaptureWhileDragging, onToggleAutoCapture,
}: SceneDumpPanelProps) {
  const json = lastResult ? JSON.stringify(lastResult, null, 2) : null;
  return (
    <div
      style={{
        position: 'absolute', bottom: 8, left: 8, zIndex,
        background: 'rgba(0,0,0,0.82)', color: '#c8f0c8',
        fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
        borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5,
        userSelect: 'text', width: 340, maxHeight: '55vh', overflow: 'auto',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
        Scene Dump — Occlusion原因診断（一時計装）
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => onRequestCapture('manual')}
          style={{
            fontFamily: 'monospace', fontSize: 10, padding: '2px 8px',
            cursor: 'pointer', background: '#2a2a2a', color: '#7fd3ff',
            border: '1px solid #555', borderRadius: 3,
          }}
        >
          Capture Now
        </button>
        {json && (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(json).catch(() => {}); }}
            style={{
              fontFamily: 'monospace', fontSize: 10, padding: '2px 8px',
              cursor: 'pointer', background: '#2a2a2a', color: '#ffd27f',
              border: '1px solid #555', borderRadius: 3,
            }}
          >
            Copy JSON
          </button>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={autoCaptureWhileDragging}
          onChange={(e) => onToggleAutoCapture(e.target.checked)}
        />
        <span>Drag中に自動キャプチャ (500ms間隔、directDragActive中のみ)</span>
      </label>
      {history.length > 0 && (
        <div style={{ marginBottom: 6, color: '#999' }}>
          History: {history.map((h) => `${h.label}`).join(' → ')}
        </div>
      )}
      {lastResult ? (
        <div>
          <div style={{ color: '#ffd27f' }}>
            Last: {lastResult.captureLabel} / meshes={lastResult.meshCount} / representation={lastResult.context.activeRepresentation}
          </div>
          <pre style={{ marginTop: 4, fontSize: 9, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {json}
          </pre>
        </div>
      ) : (
        <div style={{ color: '#888' }}>未キャプチャ（Capture Nowを押してください）</div>
      )}
    </div>
  );
}
