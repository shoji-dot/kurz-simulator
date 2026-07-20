/**
 * DrillModel.tsx  ── NAKANISHI PRIMADO 2 近似モデル
 *
 * 実際のCADデータが入手できるまで、製品画像・カタログ寸法から
 * 手続き的ジオメトリで再現したシルエット近似モデル。
 *
 * PRIMADO 2 主要スペック:
 *   全長:   約 165 mm
 *   本体径: 約 22 mm
 *   カラー: ネイビーブルー (#1a2464)
 *   モーター: マイクロモーター（最大 40,000 rpm）
 *   バー先端: ラウンドバー / フィッシャーバー 等
 *
 * 座標系: バー先端を原点 [0,0,0] とし、本体は +Y 方向に延びる
 * （シーン配置時に回転・移動して使用）
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── 色定数 ──────────────────────────────────────────────────────
const NAVY       = '#1a2464';   // 本体ネイビーブルー
const NAVY_DARK  = '#121d4a';   // グリップ部（暗め）
const SILVER     = '#b0b8c0';   // チャック・金属部
const STEEL      = '#98a8b0';   // バー（ステンレス）
const CHROME     = '#d0d8e0';   // ハイライト部

interface DrillModelProps {
  /** バーが回転するか（ドリリング中） */
  spinning?: boolean;
  /** ドリル全体の不透明度（フェードアウト用） */
  opacity?: number;
}

export function DrillModel({ spinning = false, opacity = 1 }: DrillModelProps) {
  const burRef = useRef<THREE.Group>(null!);

  // バー回転アニメーション
  useFrame((_, delta) => {
    if (spinning && burRef.current) {
      // 実際は 40,000 rpm だが視覚的に分かる速度で
      burRef.current.rotation.y += delta * 30;
    }
  });

  const transparent = opacity < 1;

  // メッシュ素材ショートカット
  const mat = (color: string, metalness = 0.2, roughness = 0.55) => (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      transparent={transparent}
      opacity={opacity}
    />
  );

  return (
    <group>
      {/* ── バー（ラウンドバー） ──────────────────────────────
          先端を原点 [0,0,0] としてシャフトを +Y 方向へ */}
      <group ref={burRef}>
        {/* ラウンドバー先端（丸型切削刃） */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.2, 10, 10]} />
          <meshStandardMaterial
            color={CHROME} metalness={0.85} roughness={0.08}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
        {/* バーシャフト */}
        <mesh position={[0, 17, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 34, 10]} />
          {mat(STEEL, 0.82, 0.12)}
        </mesh>
        {/* シャフト上部（チャック側・やや太め） */}
        <mesh position={[0, 37, 0]}>
          <cylinderGeometry args={[0.7, 0.55, 4, 10]} />
          {mat(STEEL, 0.8, 0.15)}
        </mesh>
      </group>

      {/* ── チャック（バー保持部） ────────────────────────────── */}
      <mesh position={[0, 44, 0]}>
        <cylinderGeometry args={[3.0, 2.8, 8, 16]} />
        {mat(SILVER, 0.68, 0.22)}
      </mesh>

      {/* チャックロックリング */}
      <mesh position={[0, 41, 0]}>
        <torusGeometry args={[3.1, 0.8, 6, 20]} />
        {mat(SILVER, 0.6, 0.3)}
      </mesh>

      {/* ── コントラアングルヘッド ────────────────────────────
          ヘッドは本体に対して約 10-15° 屈曲している */}
      <group position={[0, 60, 0]} rotation={[0.18, 0, 0]}>
        {/* ヘッド本体 */}
        <mesh position={[0, 10, 0]}>
          <cylinderGeometry args={[5.0, 4.8, 20, 16]} />
          {mat(NAVY, 0.25, 0.5)}
        </mesh>
        {/* ヘッドキャップ */}
        <mesh position={[0, 21, 0]}>
          <cylinderGeometry args={[4.8, 4.5, 3, 16]} />
          {mat(NAVY_DARK, 0.22, 0.55)}
        </mesh>

        {/* ── ネック（ヘッドと本体の接続部） */}
        <mesh position={[0, -6, -2]} rotation={[-0.22, 0, 0]}>
          <cylinderGeometry args={[5.5, 6.5, 16, 14]} />
          {mat(NAVY_DARK, 0.22, 0.55)}
        </mesh>
      </group>

      {/* ── 本体グリップ部 ────────────────────────────────────── */}
      <mesh position={[0, 110, 0]}>
        <cylinderGeometry args={[11, 10.5, 85, 20]} />
        {mat(NAVY, 0.18, 0.62)}
      </mesh>

      {/* グリップリブ（滑り止め凹凸） */}
      {[78, 93, 108, 123, 138].map((yPos, i) => (
        <mesh key={i} position={[0, yPos, 0]}>
          <torusGeometry args={[11.2, 1.0, 5, 22]} />
          {mat(NAVY_DARK, 0.18, 0.65)}
        </mesh>
      ))}

      {/* ── 後端キャップ ─────────────────────────────────────── */}
      <mesh position={[0, 156, 0]}>
        <cylinderGeometry args={[10.5, 9.0, 8, 16]} />
        {mat(SILVER, 0.5, 0.3)}
      </mesh>
      <mesh position={[0, 161, 0]}>
        <sphereGeometry args={[9.0, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat(NAVY_DARK, 0.2, 0.6)}
      </mesh>

      {/* ── 電源ケーブルコネクタ（後端） ─────────────────────── */}
      <mesh position={[0, 167, 0]}>
        <cylinderGeometry args={[4.0, 4.0, 6, 12]} />
        {mat(SILVER, 0.6, 0.25)}
      </mesh>

      {/* NAKANISHI ロゴプレート（概略表現） */}
      <mesh position={[10.8, 110, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[30, 6]} />
        <meshStandardMaterial
          color="#ffffff" metalness={0.1} roughness={0.8}
          transparent={transparent} opacity={opacity * 0.9}
        />
      </mesh>
    </group>
  );
}
