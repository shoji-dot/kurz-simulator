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
import type { Burr, BoneMaterial, DrillHoleState, GrowthRateInput, HeatGrowthInput, RpmPreset } from './types';

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
  const clog = clogEfficiencyFactor(input.clogLevel);

  return (
    (BASE_GROWTH_RATE_MM_S * input.burr.efficiency * angleFactor * pressure * rpm * clog) /
    input.material.hardness
  );
}

// ══════════════════════════════════════════════════════════════════════
// バー目詰まり（Sprint3追補・clogFactor）
// ══════════════════════════════════════════════════════════════════════
//
// 文献: 持続的な連続削開はバーのフルート（溝）に骨粉・血液・軟部組織を詰まらせ、
// 切削効率を明確に低下させる（"clogging of the flutes...markedly changing the
// cutting characteristics"）。実践的対策として、間欠的な軽圧削開（intermittent
// light pressure）や、目詰まりしたバーの交換が推奨される（Tos, Manual of Middle
// Ear Surgery; StatPearls NBK559153 Mastoidectomy）。
//
// 本モデルでは既存 T2 材料表の particleAmount（骨粉量係数, boneMaterial.ts）を
// そのまま目詰まり蓄積速度の係数として再利用する（骨粉が多い部位ほど目詰まりが早い、
// という文献の定性的記述に対応。新規の未検証パラメータを増やさないための設計判断）。

/**
 * 目詰まり蓄積速度（削開中, /秒）に material.particleAmount を掛けたものが実効速度。
 * 【暫定】文献に定量値の記載はなく、継続削開1〜3秒程度で目詰まりが顕在化するよう
 * 調整した目安値。耳科医較正待ち。
 */
export const CLOG_ACCUMULATE_RATE_PER_SEC = 0.35;
/** 非削開時（間欠停止時）の目詰まり解消速度（/秒）。間欠削開が有利になるよう設定。 */
export const CLOG_CLEAR_RATE_PER_SEC = 0.6;
/** 目詰まりによる効率低下の下限（1.0=無効果、この値まで低下しうる）。 */
export const CLOG_MIN_EFFICIENCY_FACTOR = 0.4;

/** growClogLevel(): 削開中1フレーム分の目詰まり蓄積を適用する純関数。 */
export function growClogLevel(prevLevel: number, material: BoneMaterial, dt: number): number {
  const rate = CLOG_ACCUMULATE_RATE_PER_SEC * material.particleAmount;
  return THREE.MathUtils.clamp(prevLevel + rate * dt, 0, 1);
}

/** clearClogLevel(): 非削開中1フレーム分の目詰まり解消を適用する純関数。 */
export function clearClogLevel(prevLevel: number, dt: number): number {
  return THREE.MathUtils.clamp(prevLevel - CLOG_CLEAR_RATE_PER_SEC * dt, 0, 1);
}

/** clogEfficiencyFactor(): 目詰まり度から成長速度への乗算係数を返す（1.0→下限値へ線形）。 */
export function clogEfficiencyFactor(clogLevel: number): number {
  const level = THREE.MathUtils.clamp(clogLevel, 0, 1);
  return 1 - level * (1 - CLOG_MIN_EFFICIENCY_FACTOR);
}

// ══════════════════════════════════════════════════════════════════════
// 発熱（Sprint6・Heat）
// ══════════════════════════════════════════════════════════════════════
//
// 文献: 骨組織は47℃で60秒、50℃で30秒の熱曝露により熱壊死(thermal osteonecrosis)を
// 起こしうる（Thermal Osteonecrosis Caused by Bone Drilling in Orthopedic Surgery:
// A Literature Review, PMC6759003）。連続削開は間欠削開より有意に高い温度上昇を示し
// （間欠的な休止による放熱が有効）、側頭骨手術でも無注水・高速ダイヤモンドバーの
// 連続照射で顔面神経管内温度が33℃上昇した報告がある（PubMed 11558764、drillModel.ts
// に引用済み）。これは接触なしでも熱伝導により危険構造が損傷しうることを示す重要な知見。
//
// 【設計判断】本シミュレーターには注水（irrigation）の明示的な操作は存在しないため、
// 「常時最低限の注水がある」前提のもとで、①荷重②RPM③バー種(heatCoef)④留まり(dwell)
// ⑤危険構造への近接、から発熱蓄積を算出する。留まり続けること（＝間欠的でない連続照射）が
// 発熱を強く加速させる設計とし、既存のdwell検知の教訓（「動かしながら削る」）を発熱という
// 別の角度からも裏付ける。危険構造近傍では発熱の影響がより深刻（接触なしでも熱損傷しうる）
// であるため、dangerState.proximityで蓄積速度を追加ブーストする。新規の未検証パラメータは
// 極力増やさず、既存のburr.heatCoef（T3で定義済み・これまで未使用だった値）とdwell/danger
// proximityという既存信号をそのまま再利用する。

/** 発熱の基礎蓄積速度（/秒）。【暫定】3〜5秒程度の連続留まりでHEAT_OVERHEAT_THRESHOLDへ到達する目安。 */
export const HEAT_ACCUMULATE_RATE_PER_SEC = 0.25;
/** 非削開時の放熱速度（/秒）。【暫定】clogより緩やかな放熱を想定。 */
export const HEAT_COOL_RATE_PER_SEC = 0.35;
/** 留まっている(dwell)間は発熱速度をこの倍率まで加速する（文献: 連続照射は間欠照射より有意に高温）。 */
export const HEAT_DWELL_MULTIPLIER = 2.2;
/** 危険構造への近接(proximity 0-1)による発熱ブースト係数（0=無影響、1=最大2倍加速）。 */
export const HEAT_DANGER_PROXIMITY_BOOST = 1.0;

/** growHeatLevel(): 削開中1フレーム分の発熱蓄積を適用する純関数。 */
export function growHeatLevel(prevLevel: number, input: HeatGrowthInput, dt: number): number {
  const dwellFactor = input.isDwelling ? HEAT_DWELL_MULTIPLIER : 1.0;
  const proximityFactor =
    1 + THREE.MathUtils.clamp(input.dangerProximity, 0, 1) * HEAT_DANGER_PROXIMITY_BOOST;
  const rate =
    HEAT_ACCUMULATE_RATE_PER_SEC *
    input.burr.heatCoef *
    THREE.MathUtils.clamp(input.pressure, 0, 1) *
    rpmFactor(input.rpmPreset) *
    dwellFactor *
    proximityFactor;
  return THREE.MathUtils.clamp(prevLevel + rate * dt, 0, 1);
}

/** coolHeatLevel(): 非削開中1フレーム分の放熱を適用する純関数。 */
export function coolHeatLevel(prevLevel: number, dt: number): number {
  return THREE.MathUtils.clamp(prevLevel - HEAT_COOL_RATE_PER_SEC * dt, 0, 1);
}

// ══════════════════════════════════════════════════════════════════════
// Tool Pose・dwell検知（Sprint3追補・Feed Rateの第一段階）
// ══════════════════════════════════════════════════════════════════════
//
// 文献: 実際の側頭骨手術では「バーを同じ点に留めず、動かしながら削る」ことが標準技術
// （saucerization=表層から均等に、縁を丸く削り進める／drtbalu's tips: "接線方向に、
// バー側面を使う"／危険構造近傍では"バーを構造に沿って動かす（sweep）、垂直に押し込まない"）。
// 留まり続ける（dwelling）ことは局所的な深追い・予期せぬjumpのリスクを高めるとされる。
// 【設計判断】既存の球ブラシ＋毎フレーム除去方式は、留まれば同一ボクセルへ繰り返し作用し
// 深く削れ、動けば作用点が分散し浅く広がるという性質を幾何学的に既に部分体現している。
// そのため今回は growthRateMmPerSec の式自体は変更せず（数値の二重補正・未検証の速度→
// 除去量カーブを推測で導入するリスクを避けるため）、まずTool Pose速度とdwell時間を
// 一級の信号として計測し、教育カードで明示的に説明することに留める（次段階でのFeed Rateの
// 除去量への正式な数値結合は、ローカル実機での体感確認後に判断する）。

/** この速度未満は「ほぼ静止＝留まっている」とみなす（暫定閾値、mm/s） */
export const DWELL_VELOCITY_THRESHOLD_MM_S = 0.5;

/**
 * advanceDwellMs(): 削開中の連続「留まり」時間(ms)を1フレーム分進める純関数。
 * 速度が閾値未満かつ削開中なら加算、それ以外（動いている／削開していない）は即0へリセット。
 */
export function advanceDwellMs(
  prevMs: number,
  velocityMmPerSec: number,
  isDrilling: boolean,
  dt: number
): number {
  if (isDrilling && velocityMmPerSec < DWELL_VELOCITY_THRESHOLD_MM_S) {
    return prevMs + dt * 1000;
  }
  return 0;
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
