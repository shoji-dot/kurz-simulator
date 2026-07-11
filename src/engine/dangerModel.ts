/**
 * dangerModel.ts ─ 削開モード MVES 危険検知拡張（T7）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.6
 * 既存の距離ベース閾値（4.5mm黄警告／2.5mm赤危険）の数値は維持しつつ、判定基準を
 * remainingThicknessToDanger（距離−dangerRadius、T2 boneMaterial.ts）に統一する。
 *
 * 多感覚出力（設計書「多感覚出力」節）:
 *   (a) テキスト   ─ 既存UIが本モジュールの computeDangerState() を用いて表示（シーン側）
 *   (b) 音程上昇   ─ T6 audioEngine.computeAudioState() が remainingThicknessToDanger を
 *                    直接参照済みのため、本タスクでの追加配線は不要
 *   (c) 色透見     ─ dangerTintColor()。tegmen(#e8d0c0=薄いピンク寄り)/sinusPlate(#b8c0d8=
 *                    青み)はT2材料表で既に「透見色」として定義済みのため新規色は定義しない
 *
 * 方向ペナルティ（垂直ストローク時の追加減点）はMonth2本実装のため、MVESでは対象外
 * （設計書: 「MVES: 方向ペナルティ（垂直ストローク）は任意」）。
 */

import * as THREE from 'three';
import type { BoneMaterial, DangerLevel, DangerState, RemainingThicknessResult } from './types';

/** 黄色警告の閾値 mm（remainingThickness基準）。既存 InteractiveDrillScene.tsx の値を踏襲。 */
export const WARN_DIST_MM = 4.5;
/** 赤危険の閾値 mm（remainingThickness基準）。既存 InteractiveDrillScene.tsx の値を踏襲。 */
export const DANGER_DIST_MM = 2.5;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * computeDangerState(): remainingThicknessToDanger() の結果から統合危険状態を算出する純関数。
 * - level: dist < DANGER_DIST_MM → critical／ < WARN_DIST_MM → warn／それ以外 → safe。
 * - proximity: WARN_DIST_MM を基準にした接近度 0-1（危険なほど1に近づく）。色透見の入力。
 *   negative dist（dangerRadius内への侵入）でも 1 に飽和させる。
 */
export function computeDangerState(remaining: RemainingThicknessResult | null): DangerState {
  if (!remaining) {
    return { level: 'safe', zone: null, distMm: null, proximity: 0 };
  }
  const { dist, zone } = remaining;
  const level: DangerLevel =
    dist < DANGER_DIST_MM ? 'critical' : dist < WARN_DIST_MM ? 'warn' : 'safe';
  const proximity = clamp01(1 - dist / WARN_DIST_MM);
  return { level, zone, distMm: dist, proximity };
}

/**
 * dangerTintColor(): 通常の骨表面色を、接近度に応じて該当リージョンの材料色へブレンドする
 * （色透見）。baseColor→material.color を proximity で線形補間するだけの汎用関数であり、
 * tegmen/sinusPlate 以外の材料に対しても同じ式を適用する（他材料は自身の通常色へ収束する
 * だけなので視覚的な副作用はない）。
 */
export function dangerTintColor(
  baseColor: THREE.ColorRepresentation,
  material: BoneMaterial,
  proximity: number
): THREE.Color {
  const base = new THREE.Color(baseColor);
  const tint = new THREE.Color(material.color);
  return base.clone().lerp(tint, clamp01(proximity));
}
