/**
 * engine/query/selfCheck.ts ── 開発時セルフチェック (Phase5.6)
 *
 * Query Engine（Phase5.1〜5.5で確定した全公開API）に対する実行時自己診断。
 * engine/validation/selfCheck.ts（Phase3）・engine/spatial/selfCheck.ts（Phase4.6）と同じ
 * `if (import.meta.env.DEV)` パターンを踏襲する。
 *
 * 【注意・重要】本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体は
 * どのシーン・App.tsxからもimportされていない。`index.ts`からも意図的にexportしない
 * （Phase3/4.6のselfCheck.tsと同じ理由。公開APIの一部ではなく開発時専用の副作用ファイル）。
 *
 * 【スコープ】shojiさんのPhase5.5レビュー所見「これまで各フェーズで追加した代表的なAPIについて、
 * 回帰防止を目的とした最小限の検証をまとめる」を踏襲し、Phase4.6と同様「重すぎない自己診断」に
 * 留める（網羅的なテストスイートではなく、各層につき代表的な正常系・境界値ケースを1〜数個ずつ）。
 *
 * 確認する9項目:
 *   1. getEntry()・getAdjacentEntries()の基本動作（実在id/未知id）
 *   2. findEntries()のcategory/dangerLevel/shapeType単体絞り込み
 *   3. findEntries()のvisibleIds省略/undefined明示/空Setの意味の区別（Phase5.2で確定した仕様）
 *   4. compareByDistance()・compareByDangerLevel()の基本順序
 *   5. composeComparators()の優先順位合成 + rankByDistanceAsc()/rankByDangerLevel()の非破壊性
 *   6. findProximityAlerts()の半径制約 + alert.dangerLevelとentry.dangerLevelの整合性
 *   7. findProximityAlerts()のvisibleIds空Set(0件)ケース
 *   8. findAdjacentWithDistance()がAtlasの隣接定義と一致・距離昇順・自己除外
 *   9. findNearestByDangerLevel()の自己除外 + caution(Atlas上2件のみ)を使った決定論的ケース
 */
import { getEntry, getAdjacentEntries } from './resolvers';
import { findEntries, findProximityAlerts, findAdjacentWithDistance, findNearestByDangerLevel } from './semantic';
import {
  compareByDistance,
  compareByDangerLevel,
  composeComparators,
  rankByDistanceAsc,
  rankByDangerLevel,
} from './ranking';
import type { SpatialQueryResult } from '../spatial/types';
import { getAdjacentEarAtlasEntries } from '../../data/earAtlas/query';

const UNKNOWN_ID = '__selfcheck_unknown_id__';

// Ear Atlas収録エントリ（Phase2.1時点で11件）から、各ケースの代表として使うid。
// いずれも data/earAtlas/entries.ts に実在する。
const MALLEUS_ID = 'ossicle.malleus'; // shapeType='point'、隣接2件（incus/tympanic membrane）
const STAPES_ID = 'ossicle.stapes'; // dangerLevel='caution'（Atlas上cautionは2件のみ）
const CHORDA_ID = 'nerve.chorda'; // dangerLevel='caution'（stapesと合わせて2件）
const FACIAL_TYMPANIC_ID = 'nerve.facial.tympanic'; // dangerLevel='critical'、shapeType='path'

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function isSortedAscendingByDistance(results: readonly SpatialQueryResult[]): boolean {
  for (let i = 1; i < results.length; i++) {
    if (results[i - 1].distanceMm > results[i].distanceMm) return false;
  }
  return true;
}

function checkResolverBasics(): CheckResult {
  const known = getEntry(MALLEUS_ID);
  const unknown = getEntry(UNKNOWN_ID);
  const adjacent = getAdjacentEntries(MALLEUS_ID);
  const adjacentUnknown = getAdjacentEntries(UNKNOWN_ID);

  const ok = known !== null && unknown === null && adjacent.length > 0 && adjacentUnknown.length === 0;
  return { name: 'getEntry()・getAdjacentEntries()の基本動作', ok };
}

function checkFindEntriesSingleFilters(): CheckResult {
  const byCategory = findEntries({ category: 'ossicle' });
  const byDangerLevel = findEntries({ dangerLevel: 'caution' });
  const byShapeType = findEntries({ shapeType: 'path' });

  const ok =
    byCategory.length > 0 &&
    byCategory.every((e) => e.category === 'ossicle') &&
    byDangerLevel.length === 2 &&
    byDangerLevel.every((e) => e.dangerLevel === 'caution') &&
    byShapeType.length > 0 &&
    byShapeType.every((e) => e.shapeType === 'path');
  return { name: 'findEntries()のcategory/dangerLevel/shapeType単体絞り込み', ok };
}

function checkFindEntriesVisibleIdsSemantics(): CheckResult {
  const omitted = findEntries({});
  const explicitUndefined = findEntries({ visibleIds: undefined });
  const emptySet = findEntries({ visibleIds: new Set() });
  const subset = findEntries({ visibleIds: new Set([MALLEUS_ID]) });

  const ok =
    omitted.length === explicitUndefined.length &&
    omitted.length > 0 &&
    emptySet.length === 0 &&
    subset.length === 1 &&
    subset[0].id === MALLEUS_ID;
  return { name: 'findEntries()のvisibleIds意味論（undefined=全件、空Set=0件）', ok };
}

function checkComparatorBasicOrder(): CheckResult {
  const near: SpatialQueryResult = {
    entry: getEntry(MALLEUS_ID)!,
    distanceMm: 1,
    nearestPointWorld: [0, 0, 0],
  };
  const far: SpatialQueryResult = {
    entry: getEntry(STAPES_ID)!,
    distanceMm: 5,
    nearestPointWorld: [0, 0, 0],
  };
  const critical: SpatialQueryResult = {
    entry: getEntry(FACIAL_TYMPANIC_ID)!,
    distanceMm: 10,
    nearestPointWorld: [0, 0, 0],
  };

  const ok =
    compareByDistance(near, far) < 0 &&
    compareByDistance(far, near) > 0 &&
    compareByDangerLevel(critical, far) < 0; // critical(facial-tympanic) before caution/safe
  return { name: 'compareByDistance()・compareByDangerLevel()の基本順序', ok };
}

function checkComposeAndRankNonMutating(): CheckResult {
  const a: SpatialQueryResult = { entry: getEntry(MALLEUS_ID)!, distanceMm: 9, nearestPointWorld: [0, 0, 0] };
  const b: SpatialQueryResult = { entry: getEntry(FACIAL_TYMPANIC_ID)!, distanceMm: 2, nearestPointWorld: [0, 0, 0] };
  const c: SpatialQueryResult = { entry: getEntry(STAPES_ID)!, distanceMm: 5, nearestPointWorld: [0, 0, 0] };
  const input = [a, b, c];
  const inputIdsBefore = input.map((r) => r.entry.id);

  const byDangerThenDistance = composeComparators<SpatialQueryResult>(compareByDangerLevel, compareByDistance);
  const composedRanked = [...input].sort(byDangerThenDistance);
  const rankedByDistance = rankByDistanceAsc(input);
  const rankedByDanger = rankByDangerLevel(input);

  const inputUnchanged = input.map((r) => r.entry.id).join(',') === inputIdsBefore.join(',');
  const composedOk = composedRanked[0].entry.id === FACIAL_TYMPANIC_ID; // critical wins regardless of distance
  const distanceOrderOk = rankedByDistance.map((r) => r.entry.id).join(',') === [b, c, a].map((r) => r.entry.id).join(',');
  const dangerOrderOk = rankedByDanger[0].entry.id === FACIAL_TYMPANIC_ID;

  const ok = inputUnchanged && composedOk && distanceOrderOk && dangerOrderOk;
  return { name: 'composeComparators() + rankBy...()の非破壊性・順序', ok };
}

function checkFindProximityAlertsRadiusAndConsistency(): CheckResult {
  const center = getEntry(MALLEUS_ID)?.positionWorld;
  if (!center) return { name: 'findProximityAlerts()の半径制約・整合性', ok: false, detail: 'malleus positionWorld missing' };

  const huge = findProximityAlerts(center, 999999);
  const tiny = findProximityAlerts(center, 0);

  const ok =
    huge.length > tiny.length &&
    tiny.length === 1 &&
    tiny[0].entry.id === MALLEUS_ID &&
    huge.every((a) => a.dangerLevel === a.entry.dangerLevel);
  return { name: 'findProximityAlerts()の半径制約・整合性', ok, detail: `huge=${huge.length} tiny=${tiny.length}` };
}

function checkFindProximityAlertsEmptyVisibleIds(): CheckResult {
  const center = getEntry(MALLEUS_ID)?.positionWorld;
  if (!center) return { name: 'findProximityAlerts()のvisibleIds空Setケース', ok: false, detail: 'malleus positionWorld missing' };

  const emptyVisible = findProximityAlerts(center, 999999, { visibleIds: new Set() });
  const ok = emptyVisible.length === 0;
  return { name: 'findProximityAlerts()のvisibleIds空Setケース', ok };
}

function checkFindAdjacentWithDistance(): CheckResult {
  const results = findAdjacentWithDistance(MALLEUS_ID);
  const expectedIds = new Set(getAdjacentEarAtlasEntries(MALLEUS_ID).map((e) => e.id));
  const unknownResults = findAdjacentWithDistance(UNKNOWN_ID);

  const ok =
    results.length === expectedIds.size &&
    results.every((r) => expectedIds.has(r.entry.id)) &&
    !results.some((r) => r.entry.id === MALLEUS_ID) &&
    isSortedAscendingByDistance(results) &&
    unknownResults.length === 0;
  return { name: 'findAdjacentWithDistance()のAtlas一致・距離昇順・自己除外', ok };
}

function checkFindNearestByDangerLevel(): CheckResult {
  const selfExcluded = findNearestByDangerLevel({ kind: 'entry', id: FACIAL_TYMPANIC_ID }, 'critical');
  const deterministic = findNearestByDangerLevel({ kind: 'entry', id: STAPES_ID }, 'caution');

  const ok =
    selfExcluded !== null &&
    selfExcluded.entry.id !== FACIAL_TYMPANIC_ID &&
    deterministic !== null &&
    deterministic.entry.id === CHORDA_ID;
  return { name: 'findNearestByDangerLevel()の自己除外・決定論的ケース', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkResolverBasics(),
    checkFindEntriesSingleFilters(),
    checkFindEntriesVisibleIdsSemantics(),
    checkComparatorBasicOrder(),
    checkComposeAndRankNonMutating(),
    checkFindProximityAlertsRadiusAndConsistency(),
    checkFindProximityAlertsEmptyVisibleIds(),
    checkFindAdjacentWithDistance(),
    checkFindNearestByDangerLevel(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[query] selfCheck FAIL: ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }

  console.info(`[query] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
