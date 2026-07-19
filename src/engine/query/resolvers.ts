/**
 * engine/query/resolvers.ts ─── Query Engine Resolver層 (Phase5.1)
 *
 * idからEntryを引く・隣接関係を辿る等の「非幾何な解決」のみを行う。Ear Atlas
 * (data/earAtlas/query.ts) への薄いラッパーであり、ロジック・幾何計算は一切持たない
 * （Phase5設計書の依存関係表: 「非幾何のデータ属性取得に限りAtlasへの直接アクセスを許可する」）。
 *
 * getEntry()はAtlas側のgetEarAtlasEntry()が返す`undefined`を`null`へ変換するのみの薄いラッパー。
 * Spatial Engine(Phase1〜4)が一貫して採用しているnullポリシーにQuery Engineも統一する
 * （Phase5.0レビュー指摘4対応）。
 */
import { getAdjacentEarAtlasEntries, getEarAtlasEntry } from '../../data/earAtlas/query';
import type { EarAtlasEntry } from '../../data/earAtlas/types';

/** idからEar Atlasエントリを1件取得する。存在しない場合はnull（例外は投げない）。 */
export function getEntry(id: string): EarAtlasEntry | null {
  return getEarAtlasEntry(id) ?? null;
}

/**
 * idの隣接構造物（Atlas `adjacentStructureIds`）をそのまま返す。
 * getAdjacentEarAtlasEntries()の再export（ロジック追加なし）。該当なし・未知idは空配列。
 */
export function getAdjacentEntries(id: string): readonly EarAtlasEntry[] {
  return getAdjacentEarAtlasEntries(id);
}
