/**
 * DrillTrainingScene.tsx  ─── 側頭骨削開トレーニング 3Dシーン
 *
 * S1: 解剖探索  — 標準解剖ビュー（RealAnatomy デフォルト表示）
 * S2: 危険部位特定 — 骨をゴースト化、危険部位をグロー球でマーク
 *
 * 座標系: GLB origin = stapes footplate (0,0,0)  Z+ = EAC方向  Y+ = 上方
 */

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  RealTemporalBone,
  RealFacialNerve,
  RealInnerEar,
  RealOssicles,
  RealAnatomy,
  RealChordaTympani,
  RealRoundWindow,
} from './models/RealAnatomyModels';
import { DANGER_ZONES, type DangerZone } from '../data/dangerZones';

// ── Props ─────────────────────────────────────────────────────────
export interface DrillTrainingSceneProps {
  scenario: 's1' | 's2';
  selectedZoneId: string | null;
  onZoneSelect: (id: string | null) => void;
}

// ── 危険部位グロー球 ───────────────────────────────────────────────
function ZoneMarker({
  zone,
  selected,
  onSelect,
}: {
  zone: DangerZone;
  selected: boolean;
  onSelect: () => void;
}) {
  const outerRef = useRef<THREE.MeshStandardMaterial>(null!);
  const innerRef = useRef<THREE.MeshStandardMaterial>(null!);
  const phase    = useRef(Math.random() * Math.PI * 2);

  useFrame(() => {
    const t     = Date.now() / 1000;
    const pulse = 0.35 + 0.30 * Math.sin(t * 2.2 + phase.current);
    if (outerRef.current) outerRef.current.emissiveIntensity = pulse * 0.6;
    if (innerRef.current) innerRef.current.emissiveIntensity = selected ? 2.0 : pulse * 1.1;
  });

  return (
    <group position={zone.position}>
      {/* 外側: warning radius (半透明グロー球) */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[zone.warningRadius, 24, 18]} />
        <meshStandardMaterial
          ref={outerRef}
          color={zone.color}
          emissive={zone.glowColor}
          emissiveIntensity={0.4}
          transparent
          opacity={0.07}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 内側: danger core (クリック可能な核) */}
      <mesh
        renderOrder={3}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerEnter={() => { document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[zone.dangerRadius, 20, 14]} />
        <meshStandardMaterial
          ref={innerRef}
          color={zone.color}
          emissive={zone.glowColor}
          emissiveIntensity={0.9}
          transparent
          opacity={selected ? 0.96 : 0.80}
          depthWrite={false}
        />
      </mesh>

      {/* 選択リング */}
      {selected && (
        <mesh renderOrder={4} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[zone.dangerRadius + 0.7, 0.20, 8, 36]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.88} />
        </mesh>
      )}
    </group>
  );
}

// ── S2シーン内容 ──────────────────────────────────────────────────
function S2Content({
  selectedZoneId,
  onZoneSelect,
}: {
  selectedZoneId: string | null;
  onZoneSelect: (id: string | null) => void;
}) {
  return (
    <group>
      {/* 側頭骨: 非常に薄いゴースト（危険部位が見えるように）*/}
      <RealTemporalBone opacityOverride={0.07} />
      {/* 顔面神経: 通常表示（黄色）*/}
      <RealFacialNerve />
      {/* 鼓索神経: 半透明 */}
      <RealChordaTympani opacityOverride={0.55} />
      {/* 内耳（蝸牛・前庭神経）: 半透明 */}
      <RealInnerEar opacityOverride={0.55} />
      {/* 耳小骨: 半透明 */}
      <RealOssicles opacityOverride={0.38} />
      {/* 正円窓: 半透明 */}
      <RealRoundWindow opacityOverride={0.60} />
      {/* 危険部位マーカー */}
      {DANGER_ZONES.map((zone) => (
        <ZoneMarker
          key={zone.id}
          zone={zone}
          selected={selectedZoneId === zone.id}
          onSelect={() =>
            onZoneSelect(selectedZoneId === zone.id ? null : zone.id)
          }
        />
      ))}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// メインシーン
// ══════════════════════════════════════════════════════════════════
export function DrillTrainingScene({
  scenario,
  selectedZoneId,
  onZoneSelect,
}: DrillTrainingSceneProps) {
  return (
    <Canvas
      camera={{ position: [8, 5, 22], fov: 46 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0f1a']} />

      {/* AnatomySceneと同一ライティング */}
      <directionalLight position={[5, 15, 10]}  intensity={1.8}  color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[2, 3, 18]}   intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[0, -8, 5]}   intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1, 3, 4]}   intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      <Suspense fallback={null}>
        {scenario === 's1' ? (
          /* S1: デフォルト解剖ビュー */
          <RealAnatomy vis={{}} />
        ) : (
          /* S2: 危険部位特定ビュー */
          <S2Content
            selectedZoneId={selectedZoneId}
            onZoneSelect={onZoneSelect}
          />
        )}
      </Suspense>

      <OrbitControls
        target={[0, 0, 0]}
        enablePan
        minDistance={4}
        maxDistance={55}
      />
    </Canvas>
  );
}
