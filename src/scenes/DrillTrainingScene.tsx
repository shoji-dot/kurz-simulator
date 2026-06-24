/**
 * DrillTrainingScene.tsx  ─── 側頭骨削開トレーニング 3Dシーン
 *
 * S1: 解剖探索  — 標準解剖ビュー
 * S2: 危険部位特定 — 骨をゴースト化、危険部位グロー球マーク
 * S3: 削開アニメーション — 5ステップ手術シーケンス
 *
 * 座標系: GLB origin = stapes footplate (0,0,0)  Z+ = EAC方向  Y+ = 上方
 */

import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
  RealStapes,
  RealTympanicMembrane,
} from './models/RealAnatomyModels';
import { DANGER_ZONES, type DangerZone } from '../data/dangerZones';
import { ProsthesisModel } from './models/ProsthesisModels';
import { kurzProducts } from '../data/products';

// ── Props ─────────────────────────────────────────────────────────
export interface DrillTrainingSceneProps {
  scenario: 's1' | 's2' | 's3' | 's4' | 's5';
  selectedZoneId: string | null;
  onZoneSelect: (id: string | null) => void;
  // S3 animation control
  s3StepIndex: number;
  s3IsPlaying: boolean;
  onS3StepComplete: () => void;
  /** 側頭骨表示モード S1〜S5 共通（デフォルト: solid） */
  boneVis?: 'solid' | 'ghost' | 'hidden';
  /** ghost 時の側頭骨不透明度（0–1） */
  boneGhostOpacity?: number;
}

// ══════════════════════════════════════════════════════════════════
// S3 データ定義
// ══════════════════════════════════════════════════════════════════

export interface DrillStep {
  id:           string;
  title:        string;
  subtitle:     string;
  clinicalNote: string;
  cameraPos:    [number, number, number];
  cameraTarget: [number, number, number];
  boneOpacity:  number;
  showDrill:    boolean;
  drillPos?:    [number, number, number];
  drillDir?:    [number, number, number]; // tip → handle 方向（local +Y）
  showProsthesis: boolean;
  ossicleOpacity: number;
}

export const DRILL_STEPS: DrillStep[] = [
  {
    id: 's3-1',
    title: '① 全体像・アクセスルート確認',
    subtitle: '外耳道経由の手術アプローチを確認。側頭骨と外耳道の位置関係を把握する',
    clinicalNote: '経外耳道アプローチでは耳道後上壁の削開が術野確保の鍵となる',
    cameraPos:    [10, 6, 26],
    cameraTarget: [0, 0, 2],
    boneOpacity:  1.0,
    showDrill: false,
    showProsthesis: false,
    ossicleOpacity: 0.7,
  },
  {
    id: 's3-2',
    title: '② 外耳道後壁削開（Canalplasty）',
    subtitle: '外耳道後上壁を鑿（のみ）またはドリルで削開。手術視野を上鼓室まで拡大する',
    clinicalNote: '削開は外耳道皮膚フラップ挙上後に実施。顔面神経水平部に注意',
    cameraPos:    [6, 4, 20],
    cameraTarget: [0, 0, 0],
    boneOpacity:  0.52,
    showDrill: true,
    drillPos:     [-2.0, 3.5, 13],
    drillDir:     [0.6, 0.7, 1.0],
    showProsthesis: false,
    ossicleOpacity: 0.65,
  },
  {
    id: 's3-3',
    title: '③ 上鼓室削開（Atticotomy）',
    subtitle: 'スクタム（盾状板）を削開し上鼓室を開放。ツチ骨頭・キヌタ骨体を露出させる',
    clinicalNote: '上鼓室の術野確保で耳小骨連鎖全体が確認可能になる',
    cameraPos:    [4, 2, 16],
    cameraTarget: [0, 0, 0],
    boneOpacity:  0.24,
    showDrill: true,
    drillPos:     [0.5, 6.5, 6.5],
    drillDir:     [0.1, 1.0, 0.2],
    showProsthesis: false,
    ossicleOpacity: 0.9,
  },
  {
    id: 's3-4',
    title: '④ 病変耳小骨の除去',
    subtitle: '壊死したキヌタ骨長突起・ツチ骨柄を慎重に除去。アブミ骨上部構造を露出する',
    clinicalNote: 'キヌタ骨長突起は慢性炎症で最初に壊死する。鼓索神経に注意して操作',
    cameraPos:    [3.5, 1, 14],
    cameraTarget: [0, -1, 2],
    boneOpacity:  0.12,
    showDrill: false,
    showProsthesis: false,
    ossicleOpacity: 0.18,
  },
  {
    id: 's3-5',
    title: '⑤ PORP 設置・鼓膜閉鎖',
    subtitle: 'ベル型PORPのベル部をアブミ骨頭部に設置。頭板を鼓膜フラップ直下に配置し閉鎖する',
    clinicalNote: 'シャフト長はサイザーで再確認。軟骨片を頭板上に置いて鼓膜穿孔を防ぐ',
    cameraPos:    [3.0, -0.5, 12],
    cameraTarget: [0, -1.5, 2],
    boneOpacity:  0.08,
    showDrill: false,
    showProsthesis: true,
    ossicleOpacity: 0.0,
  },
];

// ══════════════════════════════════════════════════════════════════
// Virtual Drill（ダイヤモンドバーシミュレーター）
// ══════════════════════════════════════════════════════════════════
interface VirtualDrillProps {
  position: [number, number, number];
  direction: [number, number, number]; // tip → handle 方向（local +Y）
  isAnimating?: boolean;
}

function VirtualDrill({ position, direction, isAnimating = false }: VirtualDrillProps) {
  const burrRef  = useRef<THREE.Group>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const baseY    = useRef(position[1]);

  // Compute orientation: local +Y → direction
  const dir  = new THREE.Vector3(...direction).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // バー回転
    if (burrRef.current) {
      burrRef.current.rotation.y = t * 30;
    }
    // 削開時の微細振動
    if (groupRef.current && isAnimating) {
      const osc = Math.sin(t * 14) * 0.06 + Math.cos(t * 9) * 0.03;
      groupRef.current.position.y = baseY.current + osc;
    }
  });

  useEffect(() => {
    baseY.current = position[1];
  }, [position]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[euler.x, euler.y, euler.z]}
    >
      {/* ── ダイヤモンドバー（スピンする）── */}
      <group ref={burrRef}>
        {/* 主球 */}
        <mesh>
          <sphereGeometry args={[1.1, 22, 16]} />
          <meshStandardMaterial color="#d8e0ea" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* ダイヤモンド粒子を模したフルート（8本）*/}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          return (
            <mesh
              key={deg}
              position={[Math.cos(r) * 0.82, Math.sin(deg < 180 ? r * 0.3 : -r * 0.3) * 0.4, Math.sin(r) * 0.82]}
              rotation={[0, -r, 0.45]}
            >
              <cylinderGeometry args={[0.04, 0.04, 1.6, 4]} />
              <meshStandardMaterial color="#a0a8b2" metalness={0.9} roughness={0.08} />
            </mesh>
          );
        })}
      </group>

      {/* ── シャフト（回転しない）── */}
      <mesh position={[0, 3.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 6, 12]} />
        <meshStandardMaterial color="#b8c4cc" metalness={0.88} roughness={0.12} />
      </mesh>

      {/* ── ハンドピース（根元部分）── */}
      <mesh position={[0, 8.2, 0]}>
        <cylinderGeometry args={[0.72, 0.80, 4.5, 18]} />
        <meshStandardMaterial color="#586075" metalness={0.70} roughness={0.28} />
      </mesh>
      {/* グリップリング */}
      {[-0.8, 0, 0.8].map((offset, i) => (
        <mesh key={i} position={[0, 8.2 + offset, 0]}>
          <torusGeometry args={[0.82, 0.08, 6, 20]} />
          <meshStandardMaterial color="#3a4055" metalness={0.75} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// S3 カメラアニメーター（Canvas内コンポーネント）
// ══════════════════════════════════════════════════════════════════
interface S3CameraControllerProps {
  stepIndex:   number;
  controlsRef: React.RefObject<any>;
}

function S3CameraController({ stepIndex, controlsRef }: S3CameraControllerProps) {
  const { camera } = useThree();
  const targetPos  = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useEffect(() => {
    const step = DRILL_STEPS[stepIndex];
    targetPos.current.set(...step.cameraPos);
    targetLook.current.set(...step.cameraTarget);
  }, [stepIndex]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.035);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.035);
      controlsRef.current.update();
    }
  });

  return null;
}

// ══════════════════════════════════════════════════════════════════
// S3 シーンコンテンツ
// ══════════════════════════════════════════════════════════════════
interface S3AnimationSceneProps {
  stepIndex:        number;
  isPlaying:        boolean;
  controlsRef:      React.RefObject<any>;
  boneVis?:         'solid' | 'ghost' | 'hidden';
  boneGhostOpacity?: number;
}

function S3AnimationScene({ stepIndex, isPlaying, controlsRef, boneVis = 'solid', boneGhostOpacity = 0.18 }: S3AnimationSceneProps) {
  const step = DRILL_STEPS[stepIndex];
  // PORP (BELLフット)を使用
  const porpProduct = kurzProducts.find((p) => p.footType === 'BELL') ?? kurzProducts[0];

  // 削開アニメーション boneOpacity にユーザー選択を重ねる
  const boneOpacity = boneVis === 'hidden' ? 0
    : boneVis === 'ghost' ? boneGhostOpacity
    : 1.0;  // solid = 常に実体表示（削開ステップに依存しない）

  return (
    <group>
      {/* S3CameraController は削除 — ユーザーの現在視野を維持 */}

      {/* 側頭骨: 削開ステップごとに透明化（boneVis で上書き可） */}
      <RealTemporalBone opacityOverride={boneOpacity} />

      {/* 顔面神経: 常時警告表示 */}
      <RealFacialNerve opacityOverride={0.85} />
      <RealChordaTympani opacityOverride={0.55} />

      {/* 内耳 */}
      <RealInnerEar opacityOverride={0.50} />

      {/* 正円窓 */}
      <RealRoundWindow opacityOverride={0.65} />

      {/* 鼓膜: ステップ4以降は非表示（除去後） */}
      {stepIndex < 3 && (
        <RealTympanicMembrane opacityOverride={stepIndex === 2 ? 0.35 : 0.65} />
      )}

      {/* 耳小骨: 除去ステップ前まで表示 */}
      {step.ossicleOpacity > 0 && (
        <RealOssicles opacityOverride={step.ossicleOpacity} />
      )}

      {/* ステップ5: アブミ骨のみ残す（他は除去済み）*/}
      {stepIndex === 4 && (
        <RealStapes opacityOverride={0.85} />
      )}

      {/* Virtual Drill */}
      {step.showDrill && step.drillPos && step.drillDir && (
        <VirtualDrill
          position={step.drillPos}
          direction={step.drillDir}
          isAnimating={isPlaying}
        />
      )}

      {/* PORP 設置（ステップ5）*/}
      {step.showProsthesis && (
        <ProsthesisModel
          product={porpProduct}
          shaftLength={2.5}
        />
      )}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// S2: 危険部位グロー球
// ══════════════════════════════════════════════════════════════════
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

      {selected && (
        <mesh renderOrder={4} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[zone.dangerRadius + 0.7, 0.20, 8, 36]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.88} />
        </mesh>
      )}
    </group>
  );
}

// ── S2 シーン ──────────────────────────────────────────────────────
function S2Content({
  selectedZoneId,
  onZoneSelect,
  boneVis = 'ghost',
  boneGhostOpacity = 0.18,
}: {
  selectedZoneId: string | null;
  onZoneSelect: (id: string | null) => void;
  boneVis?: 'solid' | 'ghost' | 'hidden';
  boneGhostOpacity?: number;
}) {
  const boneOpacity = boneVis === 'hidden' ? 0 : boneVis === 'solid' ? 1.0 : boneGhostOpacity;
  return (
    <group>
      <RealTemporalBone opacityOverride={boneOpacity} />
      <RealFacialNerve />
      <RealChordaTympani opacityOverride={0.55} />
      <RealInnerEar opacityOverride={0.55} />
      <RealOssicles opacityOverride={0.38} />
      <RealRoundWindow opacityOverride={0.60} />
      {DANGER_ZONES.map((zone) => (
        <ZoneMarker
          key={zone.id}
          zone={zone}
          selected={selectedZoneId === zone.id}
          onSelect={() => onZoneSelect(selectedZoneId === zone.id ? null : zone.id)}
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
  s3StepIndex,
  s3IsPlaying,
  boneVis = 'solid',
  boneGhostOpacity = 0.18,
}: DrillTrainingSceneProps) {
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      camera={{ position: [6, 8, 45], fov: 42 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0f1a']} />

      <directionalLight position={[5, 15, 10]}  intensity={1.8}  color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[2, 3, 18]}   intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-4, 2, -12]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[0, -8, 5]}   intensity={0.25} color="#d0e4ff" />
      <pointLight position={[0, -2, -8]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[1, 3, 4]}   intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      <Suspense fallback={null}>
        {/* Y軸反転グループ（GLBがY-down座標系のため） */}
        <group scale={[1, -1, 1]}>
          {scenario === 's1' && <RealAnatomy vis={{ bone: boneVis }} boneGhostOpacity={boneGhostOpacity} />}

          {scenario === 's2' && (
            <S2Content
              selectedZoneId={selectedZoneId}
              onZoneSelect={onZoneSelect}
              boneVis={boneVis}
              boneGhostOpacity={boneGhostOpacity}
            />
          )}

          {scenario === 's3' && (
            <S3AnimationScene
              stepIndex={s3StepIndex}
              isPlaying={s3IsPlaying}
              controlsRef={controlsRef}
              boneVis={boneVis}
              boneGhostOpacity={boneGhostOpacity}
            />
          )}

          {/* S4: 推奨削開範囲 */}
          {scenario === 's4' && (
            <>
              <RealAnatomy vis={{ bone: boneVis, eac: 'ghost', tympanic: 'ghost',
                malleus: 'ghost', incus: 'ghost', stapes: 'ghost',
                facialNerve: 'solid', chordaTympani: 'hidden',
                innerEar: 'hidden', roundWindow: 'hidden', auricle: 'hidden' }}
                boneGhostOpacity={boneGhostOpacity} />
              <S2Content selectedZoneId={null} onZoneSelect={() => {}} boneVis="hidden" />
            </>
          )}

          {/* S5: 削開完了後ビュー */}
          {scenario === 's5' && (
            <RealAnatomy vis={{
              bone:          boneVis,
              eac:           'ghost',
              auricle:       'hidden',
              tympanic:      'ghost',
              malleus:       'solid',
              incus:         'solid',
              stapes:        'solid',
              facialNerve:   'solid',
              chordaTympani: 'solid',
              innerEar:      'solid',
              roundWindow:   'solid',
            }} boneGhostOpacity={boneGhostOpacity} />
          )}
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan
        minDistance={3}
        maxDistance={90}
      />
    </Canvas>
  );
}
