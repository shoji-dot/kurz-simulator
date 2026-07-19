/**
 * engine/query/index.ts ─── Query Engine バレル (Phase5.1〜5.6)
 *
 * getEntry/getAdjacentEntries（resolvers.ts）+ findEntries/findProximityAlerts/
 * findAdjacentWithDistance/findNearestByDangerLevel（semantic.ts）を公開する。
 * filterEntries（filters.ts）は内部実装であり、公開APIとしてはexportしない
 * （Phase5設計書のAPI一覧はResolver/Semanticの公開関数のみを列挙しており、Filterはそれらの内部
 * 組み立て部品という位置づけのため）。
 * Phase5.2でSemanticFilterOptions/filterEntriesの絞り込み条件を拡張（shapeType/visibleIds追加）。
 * resolvers.ts/semantic.tsのロジックは無変更のまま拡張できた（設計どおりの「Predicate追加のみ」）。
 * Phase5.3でranking.tsの5関数（compareByDistance/compareByDangerLevel/composeComparators/
 * rankByDistanceAsc/rankByDangerLevel）を追加した。resolvers.ts/semantic.tsは無変更。
 * Phase5.4でfindProximityAlerts()（semantic.ts）+ ProximityAlert型（types.ts）を追加した。
 * Spatial Engineの`queryRegion()`（公開API）とFilter層の`filterEntries()`を組み合わせるのみで、
 * resolvers.ts/filters.ts/ranking.tsは無変更。
 * Phase5.5でfindAdjacentWithDistance()/findNearestByDangerLevel()（複合Query）を追加した。
 * いずれもPhase5.1〜5.4で確定済みの部品（Resolver/Filter/Ranking/Spatial Engine公開API）を
 * 組み合わせるのみで、resolvers.ts/filters.ts/ranking.tsは無変更（新しい距離計算・ソートロジックの
 * 追加なし）。
 * Phase5.6でselfCheck.ts（開発時自己診断、9項目）を追加した。engine/validation/selfCheck.ts
 * （Phase3）・engine/spatial/selfCheck.ts（Phase4.6）と同じ理由でこのバレルからは意図的に
 * exportしない。これでPhase5設計書のSmall Change分割案（5.1〜5.6）の実装がすべて完了した。
 * 本ファイルも他のシーン・App.tsxからは一切importされていない（Phase1〜4.6と同じ方針）。
 */
export type { SemanticFilterOptions, Comparator, ProximityAlert } from './types';
export { getEntry, getAdjacentEntries } from './resolvers';
export {
  findEntries,
  findProximityAlerts,
  findAdjacentWithDistance,
  findNearestByDangerLevel,
} from './semantic';
export {
  compareByDistance,
  compareByDangerLevel,
  composeComparators,
  rankByDistanceAsc,
  rankByDangerLevel,
} from './ranking';
