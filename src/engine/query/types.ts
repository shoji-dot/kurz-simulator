/**
 * engine/query/types.ts ─── Query Engine 型定義 (Phase5.1〜5.4)
 *
 * Phase5_QueryEngine_API設計_v1.0.md（shojiさん承認済み 2026-07-17）の実装。
 * Ear Atlas (data/earAtlas) と Spatial Anatomy Engine (engine/spatial、Phase4凍結済み) を
 * 唯一の入力とし、幾何計算・独自データを一切持たない意味づけ(Semantic)専用レイヤー。
 * 既存ファイルは一切変更しない（Phase1〜4と同じStrangler Pattern）。
 *
 * Phase5.2でshapeType/visibleIdsを追加し、設計書のSemanticFilterOptionsが完全形になった。
 * Phase5.3でComparator型を追加した（ranking.tsが比較関数の型として使用）。
 * Phase5.4でProximityAlert型を追加した（findProximityAlerts()の戻り値要素）。
 */
import type { EarAtlasCategory, EarAtlasDangerLevel, EarAtlasEntry, EarAtlasShapeType } from '../../data/earAtlas/types';

/**
 * 非幾何のデータ属性による絞り込み条件。filterEntries()が消費する。
 * いずれも省略時はその条件を適用しない（フィールドを1つも指定しなければ絞り込みなし）。
 */
export interface SemanticFilterOptions {
  readonly category?: EarAtlasCategory;
  readonly dangerLevel?: EarAtlasDangerLevel;
  readonly shapeType?: EarAtlasShapeType;
  /**
   * 呼び出し側が管理する「現在表示中」のEar Atlas id集合（Phase5.2追加）。
   * 【意味に注意】このフィールド自体が省略された場合（`undefined`）は可視状態でフィルタしない
   * （全件を対象にする）。一方、`visibleIds`に**空集合**が渡された場合は「表示中のものが1つもない」
   * という意味であり、結果は0件になる（`undefined`と空`Set`は意味が異なる。動作確認で区別して検証）。
   */
  readonly visibleIds?: ReadonlySet<string>;
}

/**
 * SpatialQueryResult等の配列を比較・並べ替えるための比較関数。Array.prototype.sortへ
 * そのまま渡せる形（負値=aが先、正値=bが先、0=順序維持）。ranking.tsが提供・合成する。
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * 近接アラート1件。findProximityAlerts()が返す。EndoscopeMonitor(AnatomyScene.tsx)の
 * ENDO_ZONES手動実装（カメラ位置↔中心の距離判定）を正式化した形（Phase5設計書参照）。
 * distanceMm/dangerLevelはSpatial Engine(queryRegion)/Atlasの値をそのまま転記するのみで、
 * Query Engine独自の閾値判定・幾何計算は持たない。
 */
export interface ProximityAlert {
  readonly entry: EarAtlasEntry;
  readonly distanceMm: number;
  readonly dangerLevel: EarAtlasDangerLevel;
}
