/**
 * SurgicalScene.tsx  ── 手術シミュレーション 3D シーン
 *
 * 経外耳道アプローチ（Phase 1）のステップ別アニメーション
 *
 * 手術ステップ:
 *   0: 外耳道入口確認（解剖確認・ドリル準備）
 *   1: 外耳道前壁削合（視野確保ドリリング）
 *   2: 鼓膜輪・線維輪露出
 *   3: 鼓膜拳上（外耳道皮弁形成）
 *   4: 耳小骨連鎖確認・計測
 *   5: KURZ プロテーゼ設置準備完了
 *
 * Phase 2（乳突削開）は別ステップとして今後拡張予定
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { DrillModel } from './models/DrillModel';
import { OssicleChain, TympanicMembrane, STAPES_HEAD } from './models/OssicleModels';
import { ProsthesisModel } from './models/ProsthesisModels';
import type { KurzProduct } from '../data/products';

// ══════════════════════════════════════════════════════════════════
// ステップ定義データ
// ══════════════════════════════════════════════════════════════════
export interface DrillStep {
  id:           number;
  phase:        'transcanal' | 'mastoid';
  title:        string;
  description:  string;
  eduNote:      string;
  anatomy?:     string;   // 解剖学的ポイント
  /** 骨レイヤーの不透明度 0〜1 */
  bone: {
    outerShell:  number;   // 側頭骨外面
    eacWall:     number;   // 外耳道壁
    innerLayer:  number;   // 鼓室内側壁
  };
  /** ドリルの位置（モデル空間） */
  drillPos:       [number, number, number];
  drillRot:       [number, number, number];  // degrees
  drillVisible:   boolean;
  drillSpinning:  boolean;
  /** カメラ TARGET ヒント */
  cameraHint:     [number, number, number];
  /** 鼓膜の状態 */
  tmVisible:      boolean;
  tmOpacity:      number;
  tmElevated:     boolean;  // 鼓膜拳上済み
  /** 耳小骨 */
  showOssicles:   boolean;
  /** プロテーゼ表示 */
  showProsthesis: boolean;
}

export const DRILL_STEPS: DrillStep[] = [
  {
    id: 0,
    phase: 'transcanal',
    title: '外耳道入口確認',
    description: '経外耳道法の術野を確認する。患者は側臥位（患耳上）。外耳道口の解剖学的ランドマークを同定する。',
    eduNote: '外耳道（EAC）の長さは約 25 mm。前壁は顎関節に近接。後壁は乳突洞に接する。',
    anatomy: '外耳道口 → 外耳道峡部（最狭部）→ 鼓膜輪',
    bone: { outerShell: 0.92, eacWall: 0.85, innerLayer: 0.95 },
    drillPos: [18, 2, 12],
    drillRot: [0, -30, -80],
    drillVisible: true,
    drillSpinning: false,
    cameraHint: [0, 2, 0],
    tmVisible: false,
    tmOpacity: 0,
    tmElevated: false,
    showOssicles: false,
    showProsthesis: false,
  },
  {
    id: 1,
    phase: 'transcanal',
    title: '外耳道前壁削合（視野確保）',
    description: 'ハイスピードドリル（ラウンドバー）で外耳道前壁を削合し術野を拡大する。鼓膜輪が視野に入るまで削合を続ける。',
    eduNote: '過剰な削合は顎関節穿破の危険。切削時の骨煙（bone dust）で視野が低下するため、吸引と洗浄を並行。',
    anatomy: '前壁削合のランドマーク: 鼓膜輪（annulus）前方',
    bone: { outerShell: 0.7, eacWall: 0.45, innerLayer: 0.92 },
    drillPos: [4, 1, 8],
    drillRot: [0, -20, -82],
    drillVisible: true,
    drillSpinning: true,
    cameraHint: [0, 1, 0],
    tmVisible: false,
    tmOpacity: 0,
    tmElevated: false,
    showOssicles: false,
    showProsthesis: false,
  },
  {
    id: 2,
    phase: 'transcanal',
    title: '鼓膜輪・線維輪の露出',
    description: '外耳道皮膚切開を行い（外耳道輪状切開）、鼓膜輪を全周露出させる。鼓膜はこの時点でまだ intact。',
    eduNote: '線維輪（fibrous annulus）は鼓膜の外周をなす軟骨輪。ここから外耳道皮弁を持ち上げ、鼓室へアクセスする。',
    anatomy: '鼓膜輪 → 線維輪（鼓膜外周） → 外耳道骨輪（tympanic ring）',
    bone: { outerShell: 0.45, eacWall: 0.12, innerLayer: 0.85 },
    drillPos: [14, 1, 9],
    drillRot: [0, -25, -78],
    drillVisible: true,
    drillSpinning: false,
    cameraHint: [0, 0.5, 0],
    tmVisible: true,
    tmOpacity: 0.85,
    tmElevated: false,
    showOssicles: false,
    showProsthesis: false,
  },
  {
    id: 3,
    phase: 'transcanal',
    title: '鼓膜拳上（外耳道皮弁形成）',
    description: 'シックルナイフで鼓膜輪を剥離し、鼓膜を後上方へ折り返す（外耳道皮弁）。鼓室内が露出される。',
    eduNote: '鼓索神経（chorda tympani）はこの操作で最も損傷リスクが高い。前下方走行に注意。',
    anatomy: '鼓膜拳上後: ツチ骨柄・キヌタ骨・アブミ骨が露出する',
    bone: { outerShell: 0.2, eacWall: 0.05, innerLayer: 0.7 },
    drillPos: [22, 2, 10],
    drillRot: [0, -35, -75],
    drillVisible: false,
    drillSpinning: false,
    cameraHint: [0, 0, 0],
    tmVisible: true,
    tmOpacity: 0.4,
    tmElevated: true,
    showOssicles: true,
    showProsthesis: false,
  },
  {
    id: 4,
    phase: 'transcanal',
    title: '耳小骨連鎖確認・計測',
    description: '病変耳小骨を同定する。キヌタ骨長脚の欠損・アブミ骨頭の状態を確認。専用メジャーでプロテーゼ長を計測する。',
    eduNote: 'PORP 適応: ツチ骨柄残存・アブミ骨頭残存の場合。シャフト長 = 臍部〜アブミ骨頭までの距離（通常 2〜4 mm）',
    anatomy: '計測点: アブミ骨頭（capitulum）〜鼓膜臍部（umbo）',
    bone: { outerShell: 0.0, eacWall: 0.0, innerLayer: 0.5 },
    drillPos: [28, 3, 10],
    drillRot: [0, -40, -70],
    drillVisible: false,
    drillSpinning: false,
    cameraHint: [0, 0, 0],
    tmVisible: true,
    tmOpacity: 0.3,
    tmElevated: true,
    showOssicles: true,
    showProsthesis: false,
  },
  {
    id: 5,
    phase: 'transcanal',
    title: 'KURZ プロテーゼ設置準備完了',
    description: '選択したプロテーゼをアブミ骨頭に設置する。ヘッドプレートが鼓膜下面に接触するように位置調整。安定性を確認後、鼓膜を戻す。',
    eduNote: 'KURZ チタンプロテーゼの特長: 軽量（約 2 mg）・生体適合性・形状記憶効果なし。設置後に軽く指で押さえ安定性を確認する。',
    anatomy: '理想配置: プロテーゼ軸が垂直・ヘッドプレート中心が臍部直下',
    bone: { outerShell: 0.0, eacWall: 0.0, innerLayer: 0.3 },
    drillPos: [30, 4, 10],
    drillRot: [0, -45, -65],
    drillVisible: false,
    drillSpinning: false,
    cameraHint: [0, 0, 0],
    tmVisible: true,
    tmOpacity: 0.28,
    tmElevated: true,
    showOssicles: true,
    showProsthesis: true,
  },
];

// ══════════════════════════════════════════════════════════════════
// 側頭骨外殻（外耳道を含む）
// ══════════════════════════════════════════════════════════════════
function TemporalBoneShell({
  outerOpacity,
  eacOpacity,
  innerOpacity,
}: {
  outerOpacity: number;
  eacOpacity: number;
  innerOpacity: number;
}) {
  const BONE = '#d8c8a8';
  const BONE_D = '#c4b090';

  return (
    <group>
      {/* ── 側頭骨外面（皮質骨 cortical bone） ── */}
      {outerOpacity > 0.01 && (
        <mesh position={[0, 1, -1]}>
          <sphereGeometry args={[13, 28, 20]} />
          <meshStandardMaterial
            color={BONE} roughness={0.65} metalness={0.02}
            transparent opacity={outerOpacity}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* ── 外耳道壁（皮質骨・内側） ── */}
      {eacOpacity > 0.01 && (
        <>
          {/* EAC トンネル */}
          <mesh position={[0, 2, 2.5]} rotation={[0.05, 0, 0]}>
            <cylinderGeometry args={[4.8, 4.2, 8, 20, 1, true]} />
            <meshStandardMaterial
              color={BONE_D} roughness={0.6}
              transparent opacity={eacOpacity}
              side={THREE.BackSide}
            />
          </mesh>
          {/* 前壁（顎関節側） */}
          <mesh position={[3.5, 0, 4]}>
            <boxGeometry args={[3.5, 8, 5]} />
            <meshStandardMaterial
              color={BONE} roughness={0.65}
              transparent opacity={eacOpacity}
            />
          </mesh>
          {/* 後壁（乳突側） */}
          <mesh position={[-3.5, 0, 4]}>
            <boxGeometry args={[3.5, 8, 5]} />
            <meshStandardMaterial
              color={BONE} roughness={0.65}
              transparent opacity={eacOpacity}
            />
          </mesh>
        </>
      )}

      {/* ── 内層（鼓室直前の骨） ── */}
      {innerOpacity > 0.01 && (
        <mesh position={[0, 2, 1]}>
          <sphereGeometry args={[9, 24, 18]} />
          <meshStandardMaterial
            color='#c8b898' roughness={0.55}
            transparent opacity={innerOpacity * 0.6}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* ── 外耳道骨輪（削合後も残る） ── */}
      <mesh position={[0, 2, 5.2]}>
        <ringGeometry args={[4.2, 5.5, 36]} />
        <meshStandardMaterial
          color={BONE} roughness={0.55}
          transparent opacity={Math.max(0.3, eacOpacity)}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 切削時の骨煙パーティクル
// ══════════════════════════════════════════════════════════════════
function BoneParticles({ active, origin }: { active: boolean; origin: THREE.Vector3 }) {
  const pts = useMemo(() => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return positions;
  }, []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, [pts]);

  if (!active) return null;

  return (
    <points geometry={geom} position={[origin.x, origin.y, origin.z]}>
      <pointsMaterial color="#e8e0d0" size={0.25} transparent opacity={0.55} />
    </points>
  );
}

// ══════════════════════════════════════════════════════════════════
// ドリルアセンブリ（位置・回転をアニメーションで補間）
// ══════════════════════════════════════════════════════════════════
function AnimatedDrill({
  targetPos,
  targetRot,
  visible,
  spinning,
}: {
  targetPos:   [number, number, number];
  targetRot:   [number, number, number];
  visible:     boolean;
  spinning:    boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const currentPos = useRef(new THREE.Vector3(...targetPos));
  const currentRot = useRef(new THREE.Euler(
    targetRot[0] * Math.PI / 180,
    targetRot[1] * Math.PI / 180,
    targetRot[2] * Math.PI / 180,
  ));

  const tPos = new THREE.Vector3(...targetPos);
  const tEuler = new THREE.Euler(
    targetRot[0] * Math.PI / 180,
    targetRot[1] * Math.PI / 180,
    targetRot[2] * Math.PI / 180,
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // スムーズに目標位置へ補間
    const speed = 2.5;
    currentPos.current.lerp(tPos, Math.min(1, delta * speed));
    currentRot.current.x += (tEuler.x - currentRot.current.x) * Math.min(1, delta * speed);
    currentRot.current.y += (tEuler.y - currentRot.current.y) * Math.min(1, delta * speed);
    currentRot.current.z += (tEuler.z - currentRot.current.z) * Math.min(1, delta * speed);

    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.copy(currentRot.current);
  });

  if (!visible) return null;

  // ドリルは「バー先端が下」になるようスケーリング（mm→シーン単位変換: /20）
  return (
    <group ref={groupRef} scale={[0.05, 0.05, 0.05]}>
      <DrillModel spinning={spinning} />
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 計測オーバーレイ（Step 4: プロテーゼ長の計測表示）
// ══════════════════════════════════════════════════════════════════
function MeasurementOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  const stapesHead = STAPES_HEAD;
  const umboY = 0.0;

  return (
    <group>
      {/* 計測ライン（アブミ骨頭〜臍部） */}
      <mesh position={[stapesHead.x, (stapesHead.y + umboY) / 2, stapesHead.z - 1]}>
        <boxGeometry args={[0.08, Math.abs(umboY - stapesHead.y), 0.08]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.8} />
      </mesh>
      {/* ↑ 端点 */}
      <mesh position={[stapesHead.x, umboY, stapesHead.z - 1]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1.0} />
      </mesh>
      {/* ↓ 端点 */}
      <mesh position={[stapesHead.x, stapesHead.y, stapesHead.z - 1]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1.0} />
      </mesh>
      {/* ラベル */}
      <Html position={[stapesHead.x + 2, (stapesHead.y + umboY) / 2, stapesHead.z - 1]}
        center distanceFactor={18}
      >
        <div style={{
          background: 'rgba(0,40,20,.9)', border: '1px solid #00ff88',
          borderRadius: 4, padding: '2px 8px', fontSize: 10,
          color: '#00ff88', whiteSpace: 'nowrap', fontFamily: 'monospace',
        }}>
          ≈ 2.5 mm → PORP選択
        </div>
      </Html>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// メイン SurgicalScene（Canvas 内に配置するコンテンツ）
// ══════════════════════════════════════════════════════════════════
interface SurgicalSceneContentProps {
  step:    DrillStep;
  product?: KurzProduct;
}

export function SurgicalSceneContent({ step, product }: SurgicalSceneContentProps) {
  const drillOrigin = new THREE.Vector3(...step.drillPos);

  return (
    <>
      {/* ライティング */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 8, 14]} intensity={1.2} color="#fffaf0" />
      <directionalLight position={[-8, 2, 6]}  intensity={0.35} color="#d8e8ff" />
      <pointLight       position={[0, 0, -8]}  intensity={0.5}  color="#8899bb" />
      {/* 術野照明（手術灯イメージ） */}
      <pointLight position={[0, 8, 12]} intensity={0.9} color="#fffff8" />

      {/* ── 側頭骨骨壁 ── */}
      <TemporalBoneShell
        outerOpacity={step.bone.outerShell}
        eacOpacity={step.bone.eacWall}
        innerOpacity={step.bone.innerLayer}
      />

      {/* ── 切削骨煙パーティクル ── */}
      <BoneParticles active={step.drillSpinning} origin={drillOrigin} />

      {/* ── 鼓膜 ── */}
      {step.tmVisible && (
        <group
          position={step.tmElevated ? [-1, 3, 3] : [0, 0, 0]}
          rotation={step.tmElevated ? [0, 0, -0.6] : [0, 0, 0]}
        >
          <TympanicMembrane opacity={step.tmOpacity} />
        </group>
      )}

      {/* ── 耳小骨連鎖（症例: incus absent = PORP 適応） ── */}
      {step.showOssicles && (
        <OssicleChain
          malleus="intact"
          incus="absent"
          stapes="suprastructure"
          showLabels={step.id >= 4}
        />
      )}

      {/* ── 内耳壁・岬角（深部構造） ── */}
      <group position={[0, 1, -6.0]}>
        <mesh>
          <planeGeometry args={[14, 17]} />
          <meshStandardMaterial
            color="#c8bca8" roughness={0.55}
            transparent opacity={Math.min(1, 0.4 + (1 - step.bone.innerLayer) * 0.8)}
          />
        </mesh>
        <mesh position={[0.5, -1.5, 0.5]}>
          <sphereGeometry args={[2.2, 20, 20]} />
          <meshStandardMaterial
            color="#bdb09a" roughness={0.5}
            transparent opacity={Math.min(1, 0.35 + (1 - step.bone.innerLayer) * 0.75)}
          />
        </mesh>
        {/* 卵円窓 */}
        <mesh position={[-0.4, 0.8, 0.8]} rotation={[0, 0, 0.3]} scale={[1, 0.55, 1]}>
          <circleGeometry args={[1.0, 24]} />
          <meshStandardMaterial color="#607090" roughness={0.3} transparent opacity={0.7} />
        </mesh>
      </group>

      {/* ── 計測オーバーレイ ── */}
      <MeasurementOverlay visible={step.id === 4} />

      {/* ── KURZ プロテーゼ（最終ステップ） ── */}
      {step.showProsthesis && product && (
        <ProsthesisModel
          product={product}
          shaftLength={2.5}
          basePos={STAPES_HEAD.clone()}
        />
      )}

      {/* ── プリマド2 ドリル ── */}
      <AnimatedDrill
        targetPos={step.drillPos}
        targetRot={step.drillRot}
        visible={step.drillVisible}
        spinning={step.drillSpinning}
      />
    </>
  );
}
