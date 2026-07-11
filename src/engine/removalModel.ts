/**
 * removalModel.ts ─ 削開モード MVES 除去モデル（T4）── 固定値禁止
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.4
 * 現行ホール半径を毎フレーム成長させる方式（既存discard方式を材料モデルで駆動）。
 * 除去結果は Bone Material × Burr × RPM × Pressure × Angle × Time の関数として決定する。
 *
 * growthRate(mm/s) = k × burr.efficiency × sideCutBoost(contactAngle) × pressure
 *                     × rpmFactor(rpm) ÷ material.hardness
 *
 * 【設計上の留意点】material.hardness は T2 材料表で 0.2(airCells) / 0.5(cortex) / 1.0(oticCapsule)
 * と定義されており、本関数の除算だけでは oticCapsule の成長率は airCells の最大でも 1/5 にしか
 * ならない（設計書の「growthRate≈0＝削れない壁」という記述ほど劇的にはゼロへ近づかない）。
 * これは Burr 選択（diamond効率0.45）・pressure・接触角の複合効果と合わせて「相対的に非常に
 * 削れにくい」を再現する設計であり、literal に0へ収束するものではない。耳科医較正時に
 * BASE_GROWTH_RATE_MM_S ないし hardness 分布の見直しが必要か判断すること（保留事項）。
 */

import * as THREE from 'three';
import type { Burr, DrillHoleState, GrowthRateInput, RpmPreset } from './types';

// ══════════════════════════════════════════════════════════════════════
// 校正用ベース定数（暫定値。耳科医較正待ち）
// ══════════════════════════════════════════════════════════════════════

/**
 * ベース除去速度 mm/s。【暫定】既存の固定ホール即時生成（80ms間隔）と比較して、
 * 最良条件（cutting・側面ヒット・pressure=1.0・rpm高）で目標半径（1.5mm/3mm径）へ
 * 1秒未満、既定条件（cortex・pressure=0.6・rpm中）で1〜2秒程度となるよう調整した目安値。
 */
export const BASE_GROWTH_RATE_MM_S = 1.0;

/** RPMプリセット→正規化係数（設計書 §4.4: 0.5–1.0）。【暫定】低/中/高の等間隔割当。 */
export const RPM_FACTOR: Record<RpmPreset, number> = {
  low: 0.5,
  mid: 0.75,
  high: 1.0,
};

export function rpmFactor(preset: RpmPreset): number {
  return RPM_FACTOR[preset];
}

// ══════════════════════════════════════════════════════════════════════
// 接触角
// ══════════════════════════════════════════════════════════════════════

/**
 * computeContactAngleDeg(): レイキャスト面法線とドリル軸のなす角を度で返す。
 * 先端ヒット（面法線とドリル軸が平行＝直進削開）→ 0°、側面/赤道ヒット（面法線と
 * ドリル軸が直交）→ 90°。法線の向き（表裏）に依存しないよう絶対値を用いる。
 */
export function computeContactAngleDeg(
  faceNormalWorld: THREE.Vector3,
  drillAxisWorld: THREE.Vector3
): number {
  const n = faceNormalWorld.clone().normalize();
  const a = drillAxisWorld.clone().normalize();
  const cos = THREE.MathUtils.clamp(Math.abs(n.dot(a)), 0, 1);
  return THREE.MathUtils.radToDeg(Math.acos(cos));
}

/**
 * sideCutBoostForAngle(): 接触角から側面切削係数を線形補間する。
 * 0°（先端）で1.0、90°（側面/赤道）で burr.sideCutBoost（既定1.3）。
 * 設計書 §4.4・参考文献1（側面が先端より効率的）に対応。
 */
export function sideCutBoostForAngle(contactAngleDeg: number, burrSideCutBoost: number): number {
  const t = THREE.MathUtils.clamp(contactAngleDeg / 90, 0, 1);
  return THREE.MathUtils.lerp(1.0, burrSideCutBoost, t);
}

// ══════════════════════════════════════════════════════════════════════
// 成長率（固定値禁止 ─ Bone Material × Burr × RPM × Pressure × Angle）
// ══════════════════════════════════════════════════════════════════════

/**
 * growthRateMmPerSec(): 現在の削開条件から瞬間成長速度 mm/s を返す純関数。
 * 設計書 §4.4 の式をそのまま実装。pressure は 0–1 にクランプする。
 */
export function growthRateMmPerSec(input: GrowthRateInput): number {
  const angleFactor = sideCutBoostForAngle(input.contactAngleDeg, input.burr.sideCutBoost);
  const rpm = rpmFactor(input.rpmPreset);
  const pressure = THREE.MathUtils.clamp(input.pressure, 0, 1);

  return (
    (BASE_GROWTH_RATE_MM_S * input.burr.efficiency * angleFactor * pressure * rpm) /
    input.material.hardness
  );
}

/** targetRadiusMm(): バー径から目標ホール半径 mm（= diameterMm / 2）を返す。 */
export function targetRadiusMm(burr: Burr): number {
  return burr.diameterMm / 2;
}

/**
 * growHoleRadius(): 1フレーム分の半径成長を適用する純関数。
 * currentR を growthRate·dt だけ増やし、targetR を超えない。
 */
export function growHoleRadius(currentR: number, targetR: number, rate: number, dt: number): number {
  if (rate <= 0) return currentR;
  return Math.min(currentR + rate * dt, targetR);
}

/**
 * advanceHole(): DrillHoleState を1フレーム分進めた新しい状態を返す（イミュータブル）。
 * シーン側（T5）はこの結果でシェーダー uniform（drillHoleRadii）を書き戻す。
 */
export function advanceHole(hole: DrillHoleState, rate: number, dt: number): DrillHoleState {
  const nextR = growHoleRadius(hole.currentR, hole.targetR, rate, dt);
  if (nextR === hole.currentR) return hole;
  return { ...hole, currentR: nextR };
}

// ══════════════════════════════════════════════════════════════════════
// 除去量（効率スコア用、設計書 §4.4「除去量スコア」）
// ══════════════════════════════════════════════════════════════════════

/** sphereVolumeMm3(): 半径 r mm の球体積 mm³（4/3πr³）。 */
export function sphereVolumeMm3(r: number): number {
  return (4 / 3) * Math.PI * Math.pow(r, 3);
}

/** volumeGrowthMm3(): 半径が oldR→newR に成長した際の体積増分 mm³（負値にはならない）。 */
export function volumeGrowthMm3(oldR: number, newR: number): number {
  if (newR <= oldR) return 0;
  return sphereVolumeMm3(newR) - sphereVolumeMm3(oldR);
}
