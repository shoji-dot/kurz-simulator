/**
 * AnatomyScene.tsx  ── 解剖学的中耳シーン（実モデル版）
 *
 * ALPHA データセット（側頭骨CBCT）由来のGLBモデルを使用。
 * 手続き的ジオメトリから実解剖学的3Dモデルに移行。
 *
 * ▼ 座標系
 *   Z+ = 外耳道方向（カメラ側）
 *   Y+ = 上方
 *   アブミ骨底板(卵円窓基準): STAPES_FOOTPLATE = [0.84, -2.65, 2.12]
 *   GLBモデルはアブミ骨を原点として配置済み → groupでオフセット適用
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OssicleChain } from './models/OssicleModels'; // CasePreviewSceneで使用
import { RealAnatomy } from './models/RealAnatomyModels';
import type { OssicleStatus, StapesStatus } from '../data/cases';
// GLBモデル群をシーン座標系に配置するオフセット
// 全GLBはアブミ骨底板を(0,0,0)として生成されているため、
// このオフセットでシーン内の卵円窓位置に一致させる
const STAPES_FOOTPLATE: [number, number, number] = [0.84, -2.65, 2.12];

// ── 骨色定数 ─────────────────────────────────────────────────────────
const BONE_WALL  = '#e4d8c0';
const BONE_INNER = '#d0c4aa';
const PROM_COLOR = '#c8bc9c';

// ══════════════════════════════════════════════════════════════════
// 側頭骨骨壁（鼓室を囲む壁）
// ══════════════════════════════════════════════════════════════════
function TemporalBoneWalls() {
  return (
    <group>
      {/* 鼓室蓋 (Tegmen tympani) — 上壁 */}
      <mesh position={[0, 7.2, -0.5]}>
        <boxGeometry args={[13, 1.8, 15]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.60} />
      </mesh>
      {/* 鼓室床 — 下壁 */}
      <mesh position={[0, -6.8, -0.5]}>
        <boxGeometry args={[13, 1.8, 15]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.60} />
      </mesh>
      {/* 後壁（乳突洞入口方向）*/}
      <mesh position={[0, 0, -7.2]}>
        <boxGeometry args={[13, 17, 2.0]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.60} />
      </mesh>
      {/* 前壁（耳管開口方向）*/}
      <mesh position={[5.2, -0.5, -0.5]}>
        <boxGeometry args={[2.8, 12, 15]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.60} />
      </mesh>
      {/* 上鼓室（Attic）側壁 */}
      <mesh position={[-3.5, 5.8, 1.8]}>
        <boxGeometry args={[6.5, 3.0, 9]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.60} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 内耳壁（迷路壁 / Labyrinthine Wall）
//
// 半透明にして背後の蝸牛・三半規管を透視可能にする。
// ══════════════════════════════════════════════════════════════════
function MedialWall() {
  // グループ基準: Z=1.0（OpenEar実測に合わせた鼓室深度）
  // 卵円窓はSTAPES_FOOTPLATE [0.84, -2.65, 2.12] ≈ group Z=1.0 + local Z=1.12
  return (
    <group position={[0, 0, 1.0]}>
      {/* 壁面本体（半透明）*/}
      <mesh>
        <planeGeometry args={[14, 17]} />
        <meshStandardMaterial
          color={BONE_INNER} roughness={0.55}
          transparent opacity={0.50}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 岬角（Promontory）— 蝸牛底回転が作る大きな隆起
          位置: 卵円窓の前下方（解剖学的） */}
      <mesh position={[2.84, -4.15, 0.9]}>
        <sphereGeometry args={[2.5, 22, 18]} />
        <meshStandardMaterial color={PROM_COLOR} roughness={0.48} />
      </mesh>

      {/* 卵円窓龕（Oval Window / Fenestra Vestibuli）
          STAPES_FOOTPLATE [0.84, -2.65, 2.12] に対応: local [0.84, -2.65, 1.12]
          size: 2.74×2.43mm（OpenEar実測）→ scale で楕円化 */}
      <mesh position={[0.84, -2.65, 1.12]} rotation={[0, 0, 0.28]} scale={[1, 0.88, 1]}>
        <circleGeometry args={[1.37, 28]} />
        <meshStandardMaterial color="#4a6880" roughness={0.22} />
      </mesh>
      {/* 卵円窓縁（骨性縁）*/}
      <mesh position={[0.84, -2.65, 1.05]} rotation={[0, 0, 0.28]} scale={[1, 0.88, 1]}>
        <ringGeometry args={[1.27, 1.72, 28]} />
        <meshStandardMaterial color={PROM_COLOR} roughness={0.50} />
      </mesh>

      {/* 正円窓龕（Round Window / Fenestra Cochleae）
          岬角の後下方（卵円窓より 3.3 mm 下方） */}
      <mesh position={[2.64, -5.95, 1.12]}>
        <circleGeometry args={[0.78, 20]} />
        <meshStandardMaterial color="#30485c" roughness={0.22} />
      </mesh>
      <mesh position={[2.64, -5.95, 1.05]}>
        <ringGeometry args={[0.68, 1.08, 20]} />
        <meshStandardMaterial color={PROM_COLOR} roughness={0.50} />
      </mesh>

      {/* アブミ骨筋腱錐隆起（Pyramidal Eminence）
          卵円窓の後方 */}
      <mesh position={[-0.16, -2.15, 0.6]}>
        <cylinderGeometry args={[0.25, 0.38, 1.4, 8]} />
        <meshStandardMaterial color={BONE_INNER} roughness={0.50} />
      </mesh>

      {/* 顔面神経管（水平部 / Tympanic Segment of Facial Nerve）
          卵円窓の直上 2 mm を後方に走る */}
      <mesh position={[-0.16, -0.65, 0.7]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 8, 10]} />
        <meshStandardMaterial color={BONE_WALL} roughness={0.55} transparent opacity={0.75} />
      </mesh>

      {/* 外耳道骨輪（Tympanic Annulus）
          group Z=1.0 + local Z=4.0 = world Z=5.0 （鼓膜面）*/}
      <mesh position={[0, 2.0, 4.0]}>
        <ringGeometry args={[4.4, 5.0, 44]} />
        <meshStandardMaterial color={BONE_INNER} roughness={0.50} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// メイン解剖シーン（AnatomyScene）
// ══════════════════════════════════════════════════════════════════
export function AnatomyScene() {
  return (
    <Canvas
      camera={{ position: [8, 10, 28], fov: 44 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050b16']} />

      {/* ── ライティング ── */}
      <ambientLight intensity={0.40} />
      {/* 外耳道方向からのメイン光 */}
      <directionalLight position={[ 4,  8, 22]} intensity={1.20} color="#fffaf0" />
      {/* 内耳壁側からの補助光（内部構造を照らす）*/}
      <directionalLight position={[-6,  2, -4]} intensity={0.55} color="#b8d4ff" />
      {/* 上方からの柔らかい補助光 */}
      <directionalLight position={[ 0, 12,  5]} intensity={0.28} color="#fff8e8" />
      {/* 内耳を照らすポイントライト（内耳壁後方）*/}
      <pointLight position={[ 2, -4, -5]} intensity={2.0} color="#c0e0ff" distance={18} />

      <Suspense fallback={null}>
        {/* ── 実解剖学的GLBモデル（ALPHA CBCTデータ由来）
            アブミ骨底板を原点として変換済み → STAPES_FOOTPLATEでオフセット */}
        <group position={STAPES_FOOTPLATE}>
          <RealAnatomy
            showNerves={true}
            showInnerEar={true}
            showEAC={true}
          />
        </group>

        {/* 鼓室骨壁（外部コンテキスト用・手続き的）*/}
        <TemporalBoneWalls />

        {/* 内側壁（卵円窓・正円窓マーカー）*/}
        <MedialWall />
      </Suspense>

      <OrbitControls
        target={[0, 0, 2]}
        enablePan={true}
        minDistance={8}
        maxDistance={52}
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
        {/* 簡易内側壁（プレビュー用）*/}
        <mesh position={[0, 0.5, 1.0]}>
          <planeGeometry args={[14, 17]} />
          <meshStandardMaterial color="#d0c4aa" roughness={0.55} />
        </mesh>
        {/* 岬角（プレビュー用）*/}
        <mesh position={[2.84, -4.15, 1.9]}>
          <sphereGeometry args={[2.2, 16, 12]} />
          <meshStandardMaterial color="#c4b890" roughness={0.48} />
        </mesh>
        {/* 外耳道骨輪（プレビュー用）*/}
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
