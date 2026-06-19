/**
 * ProsthesisModels.tsx  ── KURZ 人工耳小骨 3D モデル
 *
 * ▼ 座標系（1 unit = 1 mm、OssicleModels に準拠）
 *
 * ▼ プロテーゼの軸方向
 *   ・シャフトは「アブミ骨頭/底板」→「鼓膜（臍部）」方向に置かれる
 *   ・この方向ベクトル = (UMBO_POS − base) を正規化したもの
 *   ・シャフト長 selectedLength [mm] は Y 軸成分が臨床サイズに一致する
 *
 * ▼ 参考: OssicleModels 定数（インポート利用）
 *   STAPES_HEAD      = [-0.4, -2.5, -3.5]  ← PORP シャフト下端
 *   STAPES_FOOTPLATE = [-0.4, -5.0, -5.0]  ← TORP シャフト下端
 *   UMBO_POS         = [ 0.0,  0.0,  5.0]  ← プロテーゼ上端基準
 */

import * as THREE from 'three';
import type { KurzProduct } from '../../data/products';
import { STAPES_HEAD, STAPES_FOOTPLATE, UMBO_POS } from './OssicleModels';

// ── チタン素材 ───────────────────────────────────────────────────
const TITANIUM = '#c0cdd6';

function TitaniumMat({ ghost }: { ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={TITANIUM}
      metalness={0.82}
      roughness={0.18}
      transparent={ghost}
      opacity={ghost ? 0.32 : 1}
    />
  );
}

// ── ヘッドプレート（全型共通 3 mm ディスク） ────────────────────
function HeadPlate({ ghost }: { ghost?: boolean }) {
  return (
    <mesh>
      <cylinderGeometry args={[1.5, 1.5, 0.25, 32]} />
      <TitaniumMat ghost={ghost} />
    </mesh>
  );
}

// ── PORP ベル型フット ────────────────────────────────────────────
function BellFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[1.25, 0.8, 0.4, 20]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <torusGeometry args={[1.1, 0.15, 8, 24]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ── TORP フラット型フット（3 脚付き） ────────────────────────────
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[2.25, 2.25, 0.25, 32]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.cos(rad) * 1.5, -0.3, Math.sin(rad) * 1.5]}>
            <cylinderGeometry args={[0.12, 0.12, 0.3, 8]} />
            <TitaniumMat ghost={ghost} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── ドレスデンクリップ型フット ────────────────────────────────
function ClipFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[0.15, 0.8, 0.6]} />
          <TitaniumMat ghost={ghost} />
        </mesh>
      ))}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[1.4, 0.15, 0.6]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// ProsthesisModel
//
// シャフトは base → top の方向ベクトルに沿って配置される。
// top = base + direction * selectedLength
//
// ▼ 引数
//   product        : 製品種別（footType で足部を切り替え）
//   shaftLength    : 選択シャフト長 [mm]（UI の選択値）
//   basePos        : シャフト下端（アブミ骨頭 or 底板）の世界座標
//   direction      : シャフト方向（正規化ベクトル、指定なければ臍部方向を自動計算）
//   lateralOffset  : X 方向の位置調整 [mm]
//   anteriorOffset : Z 方向の位置調整 [mm]（+Z = 術者側）
//   angleTilt      : 傾き [degrees]
//   ghost          : 半透明（理想位置表示用）
// ══════════════════════════════════════════════════════════════════
interface ProsthesisProps {
  product: KurzProduct;
  shaftLength: number;
  basePos?:        THREE.Vector3;
  direction?:      THREE.Vector3;
  lateralOffset?:  number;
  anteriorOffset?: number;
  angleTilt?:      number;
  ghost?:          boolean;
}

export function ProsthesisModel({
  product,
  shaftLength,
  basePos,
  direction,
  lateralOffset  = 0,
  anteriorOffset = 0,
  angleTilt      = 0,
  ghost          = false,
}: ProsthesisProps) {

  // デフォルト下端: PORP は STAPES_HEAD、TORP は STAPES_FOOTPLATE
  const base = (basePos ?? (product.footType === 'FLAT' ? STAPES_FOOTPLATE : STAPES_HEAD)).clone();
  base.x += lateralOffset;
  base.z += anteriorOffset;

  // シャフト方向: 指定がなければ臍部に向かうベクトル
  const dir = direction
    ? direction.clone().normalize()
    : new THREE.Vector3().subVectors(UMBO_POS, base).normalize();

  // シャフト上端
  const top = base.clone().addScaledVector(dir, shaftLength);

  // シャフト中点・長さ
  const mid = base.clone().add(top).multiplyScalar(0.5);
  const len = shaftLength; // == dir × selectedLength

  // Y 軸 → dir への回転
  const quat  = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir,
  );
  const euler = new THREE.Euler().setFromQuaternion(quat);

  // 傾き調整（angleTilt は X 軸回転）
  const tiltRad = (angleTilt * Math.PI) / 180;

  // ヘッドプレートオフセット
  const headOffset = len / 2 + 0.15;
  const footOffset = -(len / 2) - 0.25;

  return (
    <group
      position={[mid.x, mid.y, mid.z]}
      rotation={[euler.x + tiltRad, euler.y, euler.z]}
    >
      {/* ヘッドプレート */}
      <group position={[0, headOffset, 0]}>
        <HeadPlate ghost={ghost} />
      </group>

      {/* シャフト */}
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, len, 16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>

      {/* フット */}
      <group position={[0, footOffset, 0]}>
        {product.footType === 'BELL' && <BellFoot ghost={ghost} />}
        {product.footType === 'FLAT' && <FlatFoot ghost={ghost} />}
        {product.footType === 'CLIP' && <ClipFoot ghost={ghost} />}
      </group>
    </group>
  );
}

// ── 理想配置ゴースト ─────────────────────────────────────────────
export function IdealGhostProsthesis({
  product,
  length,
}: {
  product: KurzProduct;
  length: number;
}) {
  return (
    <ProsthesisModel
      product={product}
      shaftLength={length}
      ghost={true}
    />
  );
}
