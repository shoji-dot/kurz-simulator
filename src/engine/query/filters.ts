/**
 * engine/query/filters.ts ─── Query Engine Filter層 (Phase5.1〜5.2)
 *
 * Entry配列をSemanticFilterOptionsで絞り込む純粋関数のみを持つ。幾何計算・状態・Atlasへの
 * アクセスは一切行わない（受け取ったEntry配列のみを見て判定する）。
 *
 * Phase5.2でshapeType/visibleIdsの判定を追加した（Predicateを1つ増やすだけの変更、
 * Resolver/Semantic側の変更は不要だった。設計書で見込んでいたとおりの「最も美しい」変更形になった）。
 */
import type { EarAtlasEntry } from '../../data/earAtlas/types';
import type { SemanticFilterOptions } from './types';

/**
 * entriesをoptsの条件（category/dangerLevel/shapeType/visibleIds、いずれも省略時はその条件を
 * 適用しない）で絞り込む。条件を1つも指定しない場合はentriesをそのまま返す（副作用なし、
 * 新しい配列を返す）。
 *
 * 【visibleIdsの意味】フィールド自体が未指定（`undefined`）の場合は可視状態でフィルタしない。
 * `visibleIds`に空の`Set`が渡された場合は「表示中のものが1つもない」ため結果は0件になる
 * （`undefined`と空`Set`を区別する。types.tsのJSDoc・動作確認参照）。
 */
export function filterEntries(
  entries: readonly EarAtlasEntry[],
  opts: SemanticFilterOptions,
): readonly EarAtlasEntry[] {
  return entries.filter((entry) => {
    if (opts.category && entry.category !== opts.category) return false;
    if (opts.dangerLevel && entry.dangerLevel !== opts.dangerLevel) return false;
    if (opts.shapeType && entry.shapeType !== opts.shapeType) return false;
    if (opts.visibleIds && !opts.visibleIds.has(entry.id)) return false;
    return true;
  });
}
