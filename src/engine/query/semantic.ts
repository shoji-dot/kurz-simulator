/**
 * engine/query/semantic.ts ─── Query Engine Semantic Query層 (Phase5.1〜5.5)
 *
 * Resolver・Filter・Ranking・Spatial Engineを組み合わせるFacade。それ自体は新しい
 * ロジックを持たない（Phase5設計書: 「Semantic Query層はResolver・Filter・Ranking・Spatial Engine
 * を組み合わせるFacadeである」）。
 *
 * Phase5.2でfilterEntries()にshapeType/visibleIdsが追加されたが、本ファイルのコードは無変更
 * （filterEntries()へ絞り込み条件をそのまま渡しているだけのため、Filter層の拡張がそのままfindEntries()
 * にも反映される構造になっている）。
 *
 * Phase5.4でfindProximityAlerts()を追加した。Spatial Engine(queryRegion、公開APIのみ)の
 * ラッパー+Filter層(filterEntries)での絞り込み+ProximityAlertへの整形のみを行い、新規の
 * 幾何計算・閾値判定ロジックは一切持たない（Spatial Engine側への逆流防止。shojiさんのPhase5.3
 * レビュー所見「Semantic層は数値を教育上の意味へ変換するだけ」を遵守）。
 *
 * Phase5.5でfindAdjacentWithDistance()/findNearestByDangerLevel()（複合Query）を追加した。
 * いずれもPhase5.1〜5.4で確定済みの部品（Resolver/Filter/Ranking/Spatial Engine公開API）を
 * 組み合わせるのみで、新しい距離計算・ソートアルゴリズムは実装しない
 * （shojiさんのPhase5.4レビュー所見「Composite Queryは既存APIを組み合わせるだけ」を遵守）。
 */
import { listAllEarAtlasEntries } from '../../data/earAtlas/query';
import type { EarAtlasEntry, EarAtlasDangerLevel } from '../../data/earAtlas/types';
import { resolve, queryRegion } from '../spatial';
import type { SpatialQueryResult, SpatialTarget } from '../spatial/types';
import type { Vec3Tuple } from '../coordinates/types';
import { filterEntries } from './filters';
import { rankByDistanceAsc } from './ranking';
import { getAdjacentEntries } from './resolvers';
import type { ProximityAlert, SemanticFilterOptions } from './types';

/**
 * category・dangerLevel・shapeType・visibleIdsでAtlasエントリを検索する（純粋なデータ属性検索、
 * 幾何なし）。Atlas全件(`listAllEarAtlasEntries`、Phase4.2で追加済み)を`filterEntries()`で絞り込む
 * だけの組み合わせであり、Resolver/Filter以外の新しいロジックを持たない。
 */
export function findEntries(opts: SemanticFilterOptions): readonly EarAtlasEntry[] {
  return filterEntries(listAllEarAtlasEntries(), opts);
}

/**
 * pointから半径radiusMm以内にある構造物を、危険度付きのアラートとして返す（近い順）。
 * 実装フローは2ステップのみ:
 *   1. `queryRegion()`（Spatial Engine公開API）でpoint/radiusMm内の候補を距離順に取得する
 *      （幾何計算・半径判定・ソートはすべてSpatial Engine側の責務のまま）
 *   2. 候補のentryを`filterEntries()`（Filter層、無変更）でopts（category/dangerLevel/
 *      shapeType/visibleIds）により絞り込み、ProximityAlertへ整形するのみ
 * category/dangerLevelはqueryRegion()にも渡せるが、ここでは絞り込みをFilter層のみに一本化する
 * （同じ絞り込みロジックを2箇所に重複実装しないため）。可視状態(visibleIds)は呼び出し側が
 * optsで渡す（Query Engineは表示状態を保持しない）。
 */
export function findProximityAlerts(
  point: Vec3Tuple,
  radiusMm: number,
  opts?: SemanticFilterOptions,
): readonly ProximityAlert[] {
  const candidates = queryRegion(point, radiusMm);
  const allowedIds = new Set(filterEntries(candidates.map((c) => c.entry), opts ?? {}).map((e) => e.id));
  return candidates
    .filter((c) => allowedIds.has(c.entry.id))
    .map((c) => ({ entry: c.entry, distanceMm: c.distanceMm, dangerLevel: c.entry.dangerLevel }));
}

/**
 * idの隣接構造物（Atlas `adjacentStructureIds`）を、idからの距離付きで返す（近い順）。
 * 実装フローは既存部品の組み合わせのみ:
 *   1. `getAdjacentEntries(id)`（Resolver、無変更）で隣接id集合を取得
 *   2. `resolve({kind:'entry', id})`（Spatial Engine公開API）でidの原点座標を取得
 *   3. `queryRegion()`（Spatial Engine公開API、半径は無制限扱い）で全構造物の距離を取得
 *   4. `filterEntries()`（Filter層、`visibleIds`に隣接id集合を渡すことで「この集合だけに絞る」
 *      用途として再利用、無変更）で隣接構造物のみに絞り込む
 *   5. `rankByDistanceAsc()`（Ranking層、無変更）で近い順に整列
 * idが未知・座標未解決、または隣接構造物が0件の場合は空配列を返す（他のAPIと同じnull/空配列
 * ポリシー）。新しい距離計算・ソートアルゴリズムはここでは実装しない。
 */
export function findAdjacentWithDistance(id: string): readonly SpatialQueryResult[] {
  const adjacent = getAdjacentEntries(id);
  if (adjacent.length === 0) return [];

  const fromFrame = resolve({ kind: 'entry', id });
  if (!fromFrame) return [];

  const adjacentIds = new Set(adjacent.map((e) => e.id));
  const candidates = queryRegion(fromFrame.originWorld, Number.POSITIVE_INFINITY);
  const allowedIds = new Set(filterEntries(candidates.map((c) => c.entry), { visibleIds: adjacentIds }).map((e) => e.id));
  const matched = candidates.filter((c) => allowedIds.has(c.entry.id));
  return rankByDistanceAsc(matched);
}

/**
 * fromに最も近い、指定した危険度の構造物を1件返す（fromがEntry指定の場合、自分自身は除外する。
 * `findNearest()`(Phase4.2)と同じ自己除外方針に合わせた。理由: fromと同じdangerLevelの構造物を
 * 探索した場合、自己除外がないと常に距離0の自分自身が返り無意味な結果になるため）。
 * 実装フローは設計書どおりの複合クエリ:
 *   1. `resolve(from)`（Spatial Engine公開API）でfromの原点座標を取得
 *   2. `queryRegion()`（Spatial Engine公開API、`opts.dangerLevel`で候補取得と絞り込みを同時に行う。
 *      Filter層を経由しない設計だが、`queryRegion()`自身が持つ既存のdangerLevel絞り込み機能を
 *      再利用するのみで新しい絞り込みロジックの実装ではない）
 *   3. 自分自身（fromがkind:'entry'の場合のそのid）を除外
 *   4. `rankByDistanceAsc()`（Ranking層、無変更）で近い順に整列し、先頭要素を返す（0件ならnull）
 */
export function findNearestByDangerLevel(from: SpatialTarget, dangerLevel: EarAtlasDangerLevel): SpatialQueryResult | null {
  const fromFrame = resolve(from);
  if (!fromFrame) return null;

  const selfId = from.kind === 'entry' ? from.id : undefined;
  const candidates = queryRegion(fromFrame.originWorld, Number.POSITIVE_INFINITY, { dangerLevel }).filter(
    (c) => c.entry.id !== selfId,
  );
  const ranked = rankByDistanceAsc(candidates);
  return ranked[0] ?? null;
}
