import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { OssicleStatus, StapesStatus } from '../../data/cases';

// ── 色定数 ─────────────────────────────────────────────
const BONE      = '#d4b896';
const BONE_DARK = '#b8956a';
const MEM_COLOR = '#e8d5a8';

// ── 座標系 ───────────────────────────────────────────
// Y = 上方（上鼓室方向）
// Z = 術者側（外耳道方向）← カメラはここ
// X = 前方
// 鼓膜: Z=0 の XY 平面（カメラを向く）
// 耳小骨連鎖: Z=-方向（内耳側）へ延びる

interface LabelProps { position: [number,number,number]; text: string; }
function Label({ position, text }: LabelProps) {
  return (
    <Html position={position} center distanceFactor={18} zIndexRange={[0,10]}>
      <div style={{
        background: 'rgba(0,20,40,.82)', border: '1px solid #00b4d8',
        borderRadius: 5, padding: '3px 9px', fontSize: 11, color: '#e0eeff',
        whiteSpace: 'nowrap', backdropFilter: 'blur(4px)', pointerEvents: 'none',
        fontFamily: 'sans-serif',
      }}>{text}</div>
    </Html>
  );
}

// ── 鼓膜 ────────────────────────────────────────────
export function TympanicMembrane({ opacity = 0.55 }: { opacity?: number }) {
  return (
    <group>
      {/* 鼓膜本体 */}
      <mesh>
        <circleGeometry args={[4.5, 48]} />
        <meshStandardMaterial color={MEM_COLOR} transparent opacity={opacity}
          side={THREE.DoubleSide} />
      </mesh>
      {/* 線維輪（鼓膜縁の軟骨輪） */}
      <mesh>
        <ringGeometry args={[4.1, 4.5, 48]} />
        <meshStandardMaterial color="#b8905a" />
      </mesh>
      {/* 臍部（ツチ骨が付く中心点） */}
      <mesh position={[0, -1, 0.01]}>
        <circleGeometry args={[0.3, 16]} />
        <meshStandardMaterial color="#c09060" />
      </mesh>
    </group>
  );
}

// ── ツチ骨 (Malleus) ─────────────────────────────────
export function Malleus({ status, highlight }: { status: OssicleStatus; highlight?: string | null }) {
  if (status === 'absent') return null;
  const col = highlight === 'malleus' ? '#00b4d8' : BONE;
  const mat = <meshStandardMaterial color={col} roughness={0.4} metalness={0.05} />;

  return (
    <group>
      {/* 柄（マニュブリウム）: 鼓膜内を臍部〜前上方へ走る */}
      <mesh position={[0.3, 0.2, 0]} rotation={[0, 0, -Math.PI / 6]}>
        <cylinderGeometry args={[0.22, 0.15, 4.2, 12]} />
        {mat}
      </mesh>
      {/* 短突起 */}
      <mesh position={[0.85, 1.1, -0.1]}>
        <sphereGeometry args={[0.28, 10, 10]} />{mat}
      </mesh>
      {/* 頸部 */}
      <mesh position={[0.2, 2.3, -0.8]} rotation={[0.45, 0, 0.15]}>
        <cylinderGeometry args={[0.18, 0.22, 1.4, 10]} />{mat}
      </mesh>
      {/* 頭部（上鼓室内） */}
      {status !== 'partial' && (
        <>
          <mesh position={[0.1, 3.1, -1.8]}>
            <sphereGeometry args={[0.65, 16, 16]} />{mat}
          </mesh>
          <Label position={[0.1, 4.4, -1.8]} text="ツチ骨頭" />
        </>
      )}
      <Label position={[-0.5, -2.5, 0.5]} text="ツチ骨柄（鼓膜内）" />
    </group>
  );
}

// ── キヌタ骨 (Incus) ─────────────────────────────────
export function Incus({ status, highlight }: { status: OssicleStatus; highlight?: string | null }) {
  if (status === 'absent') return null;
  const col = highlight === 'incus' ? '#00b4d8' : BONE_DARK;
  const mat = <meshStandardMaterial color={col} roughness={0.45} />;

  return (
    <group>
      {/* 体部（ツチ骨頭と鞍関節） */}
      <mesh position={[-0.6, 3.0, -2.8]}>
        <sphereGeometry args={[0.52, 14, 14]} />{mat}
      </mesh>
      <Label position={[-0.6, 4.3, -2.8]} text="キヌタ骨体部" />

      {/* 短脚（後方鼓室蓋へ） */}
      <mesh position={[-0.6, 2.8, -4.0]} rotation={[1.57, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.11, 2.3, 10]} />{mat}
      </mesh>

      {/* 長脚（下方へ走り、豆状突起でアブミ骨と関節） */}
      <mesh position={[-0.55, 1.0, -3.0]} rotation={[0.08, 0, 0.04]}>
        <cylinderGeometry args={[0.13, 0.1, 4.2, 10]} />{mat}
      </mesh>
      <Label position={[-1.8, 1.0, -3.0]} text="キヌタ骨長脚" />

      {/* 豆状突起（長脚先端の小球） */}
      <mesh position={[-0.5, -1.2, -3.2]}>
        <sphereGeometry args={[0.18, 10, 10]} />{mat}
      </mesh>
    </group>
  );
}

// ── アブミ骨 (Stapes) ─────────────────────────────────
export function Stapes({ status, highlight }: { status: StapesStatus; highlight?: string | null }) {
  if (status === 'absent') return null;
  const col = highlight === 'stapes' ? '#00b4d8' : BONE;
  const mat = <meshStandardMaterial color={col} roughness={0.3} metalness={0.05} />;
  const hasSuprastructure = status === 'intact' || status === 'suprastructure';

  return (
    <group position={[-0.6, -1.6, -4.3]}>
      {/* 底板（卵円窓を塞ぐ楕円形プレート） */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <capsuleGeometry args={[0.45, 1.2, 4, 16]} />
        <meshStandardMaterial color={col} roughness={0.25} />
      </mesh>

      {hasSuprastructure && (
        <>
          {/* 頭部（キヌタ骨豆状突起と関節） */}
          <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.24, 12, 12]} />{mat}
          </mesh>
          {/* 前弓（anterior crus）— 弓状にカーブ */}
          <mesh position={[0.3, 0.85, 0]} rotation={[0, 0, 0.28]}>
            <cylinderGeometry args={[0.09, 0.09, 1.95, 8]} />{mat}
          </mesh>
          {/* 後弓（posterior crus）— 弓状にカーブ */}
          <mesh position={[-0.3, 0.85, 0]} rotation={[0, 0, -0.28]}>
            <cylinderGeometry args={[0.09, 0.09, 1.95, 8]} />{mat}
          </mesh>
        </>
      )}
      <Label position={[0, -1.5, 0]} text="アブミ骨（底板→卵円窓）" />
    </group>
  );
}

// ── 組み合わせ ─────────────────────────────────────────
interface ChainProps {
  malleus: OssicleStatus;
  incus: OssicleStatus;
  stapes: StapesStatus;
  highlight?: string | null;
  showLabels?: boolean;
}
export function OssicleChain({ malleus, incus, stapes, highlight, showLabels = true }: ChainProps) {
  return (
    <group>
      <TympanicMembrane />
      <Malleus status={malleus} highlight={highlight} />
      <Incus status={incus} highlight={highlight} />
      <Stapes status={stapes} highlight={highlight} />
      {showLabels && (
        <Label position={[0, -5.5, 1]} text="鼓膜（Tympanic Membrane）" />
      )}
    </group>
  );
}
