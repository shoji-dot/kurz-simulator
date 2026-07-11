/**
 * drillModel.ts ─ 削開モード MVES ドリル・バー定義（T3）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.3、KURZ_削開モード進化_設計計画書_v1.0.md §4.2
 * MVES同梱バー: Cutting 3mm / Diamond 3mm / Diamond 2mm の3本。
 * 既存 InteractiveDrillScene.tsx の cutterSizeMm（1|2|3の径のみ）をここで Burr 型へ発展させる。
 *
 * 【保留事項】recommendedRpm（推奨RPM数値帯）は KURZ 実機ハンドピース仕様が未確認のため、
 * 設計計画書 参考文献4 で明示的に「機種依存・要確認」と記録された未確定項目である。
 * 本実装では文献上の一般的なオトロジックドリル稼働域（下記コメント内引用）を「暫定の目安表示」
 * として割り当てるが、KURZ実機仕様確認後に必ず較正すること。growthRate() 等の削開ロジックは
 * この数値帯そのものではなく rpmFactor（低/中/高プリセットの正規化係数、T4で定義）を用いるため、
 * ここでの数値精度は削開の物理挙動には影響しない（UI表示専用）。
 */

import type { Burr, BurrType } from './types';

// ══════════════════════════════════════════════════════════════════════
// バー定義（暫定値, 設計書 §4.3）
// ══════════════════════════════════════════════════════════════════════
//
// efficiency / heatCoef は設計書表の記載値をそのまま採用:
//   cutting: efficiency 1.0, heatCoef 0.6
//   diamond: efficiency 0.45, heatCoef 0.9（圧力比例のためMonth2で pressure と乗算する係数）
// sideCutBoost = 1.3（側面＝赤道ヒットが先端より効率的、参考文献1: Eur Arch Otorhinolaryngol 2025）
//
// recommendedRpm【暫定・要KURZ実機確認】:
//   - Cutting 3mm: 現代オトロジック高速ドリルの一般稼働上限帯 60,000–80,000rpm を粗削り用途に割当
//     （文献: 高速外科ドリルは80,000–90,000rpm域で稼働）。
//   - Diamond 3mm（顔面神経近傍・止血用途）: 40,000rpm連続照射で顔面神経管内温度33℃上昇の報告
//     （参考文献3: PubMed 11558764）があり、危険構造近傍では大幅な減速が必要という定性的根拠のみ
//     存在。数値帯 15,000–30,000rpm は文献の上限(40k)と下記の最繊細用途アンカーの中間として
//     暫定的に補間した値であり、直接の実証データではない。
//   - Diamond 2mm（頸動脈・頸静脈球近傍、最繊細用途）: 上半規管裂隙近傍等の最繊細作業で
//     6,000rpm＋1.5mmダイヤモンドバーという実例が報告されており、これを最繊細アンカーとして採用。

export const DRILL_BURRS: Burr[] = [
  {
    id: 'cutting-3',
    type: 'cutting',
    diameterMm: 3,
    efficiency: 1.0,
    heatCoef: 0.6,
    sideCutBoost: 1.3,
    recommendedRpm: [60000, 80000],
    labelJa: 'カッティングバー 3mm（粗削り）',
  },
  {
    id: 'diamond-3',
    type: 'diamond',
    diameterMm: 3,
    efficiency: 0.45,
    heatCoef: 0.9,
    sideCutBoost: 1.3,
    recommendedRpm: [15000, 30000],
    labelJa: 'ダイヤモンドバー 3mm（顔面神経近傍・止血）',
  },
  {
    id: 'diamond-2',
    type: 'diamond',
    diameterMm: 2,
    efficiency: 0.45,
    heatCoef: 0.9,
    sideCutBoost: 1.3,
    recommendedRpm: [6000, 12000],
    labelJa: 'ダイヤモンドバー 2mm（頸動脈・頸静脈球近傍）',
  },
];

/** id → Burr の高速参照表 */
export const BURRS_BY_ID: Record<string, Burr> = Object.fromEntries(
  DRILL_BURRS.map((b) => [b.id, b])
);

/** MVES既定バー（起動時の選択状態） */
export const DEFAULT_BURR: Burr = DRILL_BURRS[0];

/** getBurrById(): 見つからない場合は既定バーへフォールバック（UI側の安全策） */
export function getBurrById(id: string): Burr {
  return BURRS_BY_ID[id] ?? DEFAULT_BURR;
}

/** getBurrsByType(): タイプ別（cutting/diamond）にバー一覧を取得 */
export function getBurrsByType(type: BurrType): Burr[] {
  return DRILL_BURRS.filter((b) => b.type === type);
}
