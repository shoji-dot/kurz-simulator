/**
 * engine/query/ranking.ts ─── Query Engine Ranking層 (Phase5.3)
 *
 * Phase5_QueryEngine_API設計_v1.0.md（shojiさん承認済み 2026-07-17）の実装。
 * SpatialQueryResultの配列を比較・並べ替えるための比較関数(Comparator)を提供・合成する層。
 * 自ら距離計算は行わない（Spatial Engineが既に計算済みのSpatialQueryResult.distanceMmを読むのみ）。
 * Phase6での複合順位付け（距離→危険度→カテゴリ→AI Score）への拡張を見据え、
 * 「比較関数(Comparator)を合成する」方式を採用する（設計書 改訂履歴1参照）。
 */
import type { SpatialQueryResult } from '../spatial/types';
import type { EarAtlasDangerLevel } from '../../data/earAtlas/types';
import type { Comparator } from './types';

/** critical→caution→safeの順で並べるための重み。値が小さいほど優先度が高い（先頭に来る）。 */
const DANGER_LEVEL_ORDER: Readonly<Record<EarAtlasDangerLevel, number>> = {
  critical: 0,
  caution: 1,
  safe: 2,
};

/** 距離昇順（近い順）で比較する。Array.prototype.sortへそのまま渡せる。 */
export function compareByDistance(a: SpatialQueryResult, b: SpatialQueryResult): number {
  return a.distanceMm - b.distanceMm;
}

/** 危険度順（critical→caution→safe）で比較する。Array.prototype.sortへそのまま渡せる。 */
export function compareByDangerLevel(a: SpatialQueryResult, b: SpatialQueryResult): number {
  return DANGER_LEVEL_ORDER[a.entry.dangerLevel] - DANGER_LEVEL_ORDER[b.entry.dangerLevel];
}

/**
 * 複数のComparatorを優先順位付きで合成する。先頭から順に評価し、非ゼロを返した
 * Comparatorの結果を採用する（すべて0ならば0＝順序維持）。Phase6での複合順位付け
 * （例: 危険度→距離→カテゴリ）を見据えた合成関数。
 */
export function composeComparators<T>(...comparators: readonly Comparator<T>[]): Comparator<T> {
  return (a: T, b: T): number => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/** compareByDistanceで並べ替えた新しい配列を返す（引数の配列は変更しない）。 */
export function rankByDistanceAsc(results: readonly SpatialQueryResult[]): readonly SpatialQueryResult[] {
  return [...results].sort(compareByDistance);
}

/** compareByDangerLevelで並べ替えた新しい配列を返す（引数の配列は変更しない）。 */
export function rankByDangerLevel(results: readonly SpatialQueryResult[]): readonly SpatialQueryResult[] {
  return [...results].sort(compareByDangerLevel);
}
