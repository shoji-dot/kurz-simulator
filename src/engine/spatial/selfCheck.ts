/**
 * engine/spatial/selfCheck.ts ── 開発時セルフチェック (Phase4.6)
 *
 * Spatial Anatomy Engine（resolve/queryPoint/queryPath/distance/findNearest/project/
 * interpolate/offset/queryRegion/trace）に対する実行時自己診断。
 * engine/validation/selfCheck.ts（Phase3）と同じ `if (import.meta.env.DEV)` パターンを踏襲する。
 *
 * 【注意・重要】本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体は
 * どのシーン・App.tsxからもimportされていない（Phase3のselfCheck.tsと同じ理由で、
 * `npm run dev` 実行時には自動実行されない）。
 *
 * 【スコープ】Phase4.5レビューで指摘された通り、「重すぎない自己診断」に留める。
 * Ericsonアルゴリズムの正当性検証で用いた400×400グリッド探索のような高コストな
 * ブルートフォース検証はここでは行わない（開発時検証スクリプトとして別途維持する）。
 * ここでは各APIにつき代表的な正常系・境界値ケースを1〜数個ずつ確認するのみ。
 *
 * 確認する9項目（Phase4.5レビューで指定されたチェックリストに対応）:
 *   1. resolve()の基本動作（point/path/未知idの解決）
 *   2. queryPoint()・queryPath()（resolve()との整合性、shapeType不一致・未知idでnull）
 *   3. distance()の対称性（a→b と b→a が一致）
 *   4. findNearest()の基本ケース（自分自身を除外する）
 *   5. project()とfindNearest()の一致（同一の評価ロジックを共有していることの確認）
 *   6. interpolate()の端点（t=0, t=1がpath始点・終点に一致）
 *   7. offset()のゼロオフセット・向き未定義ケース（無向きフレームへの非ゼロoffsetはnull）
 *   8. queryRegion()の距離順ソート
 *   9. trace()のゼロ方向・代表的ヒットケース（既知構造物への正確なレイが距離0近傍でヒット）
 */
import { distance, findNearest, queryPoint, queryRegion, resolve } from './query';
import { interpolate, offset, project, trace } from './frame';
import { lengthVec3, subtractVec3 } from '../coordinates/vectorMath';
import type { Vec3Tuple } from '../coordinates/types';

const EPSILON_MM = 1e-6;

// Ear Atlas収録エントリ（Phase2.1時点で11件）から、各ケースの代表として使うid。
// いずれも data/earAtlas/entries.ts に実在する（orientation未設定のpoint / path 各1件）。
const POINT_ID = 'ossicle.stapes'; // shapeType='point'、orientation未設定（無向き）
const OTHER_POINT_ID = 'ossicle.malleus'; // shapeType='point'、無向き
const PATH_ID = 'nerve.chorda'; // shapeType='path'、tangent/normalあり（向きあり）
const UNKNOWN_ID = '__selfcheck_unknown_id__';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function approxEqualVec3(a: Vec3Tuple, b: Vec3Tuple, toleranceMm = EPSILON_MM): boolean {
  return lengthVec3(subtractVec3(a, b)) <= toleranceMm;
}

function checkResolveBasics(): CheckResult {
  const pointFrame = resolve({ kind: 'entry', id: POINT_ID });
  const pathFrame = resolve({ kind: 'entry', id: PATH_ID, pathParam: 0 });
  const unknownFrame = resolve({ kind: 'entry', id: UNKNOWN_ID });
  const pointTarget = resolve({ kind: 'point', positionWorld: [1, 2, 3] });

  const ok =
    pointFrame !== null &&
    pathFrame !== null &&
    unknownFrame === null &&
    pointTarget !== null &&
    approxEqualVec3(pointTarget.originWorld, [1, 2, 3]);
  return { name: 'resolve()の基本動作', ok };
}

function checkQueryPointAndPath(): CheckResult {
  const viaQueryPoint = queryPoint(POINT_ID);
  const viaResolve = resolve({ kind: 'entry', id: POINT_ID });
  const consistentWithResolve =
    viaQueryPoint !== null && viaResolve !== null && approxEqualVec3(viaQueryPoint.originWorld, viaResolve.originWorld);

  // queryPathはquery.ts側のAPIだが、実装上はfindNearest等と同じ並びで公開されているため
  // ここではframe.tsからの再exportではなくquery.ts本体からimportしている点に注意。
  // （barrelのindex.tsではqueryPathはquery.tsからexportされている）
  const unknownIsNull = resolve({ kind: 'entry', id: UNKNOWN_ID, pathParam: 0 }) === null;

  const ok = consistentWithResolve && unknownIsNull;
  return { name: 'queryPoint()・queryPath()', ok };
}

function checkDistanceSymmetry(): CheckResult {
  const a = { kind: 'entry' as const, id: POINT_ID };
  const b = { kind: 'entry' as const, id: OTHER_POINT_ID };
  const ab = distance(a, b);
  const ba = distance(b, a);
  const unknownDistance = distance(a, { kind: 'entry', id: UNKNOWN_ID });

  const ok = ab !== null && ba !== null && Math.abs(ab - ba) <= EPSILON_MM && unknownDistance === null;
  return { name: 'distance()の対称性', ok, detail: ab !== null && ba !== null ? `${ab.toFixed(6)} vs ${ba.toFixed(6)}` : undefined };
}

function checkFindNearestExcludesSelf(): CheckResult {
  const nearest = findNearest({ kind: 'entry', id: POINT_ID });
  const ok = nearest !== null && nearest.entry.id !== POINT_ID;
  return { name: 'findNearest()の基本ケース', ok };
}

function checkProjectMatchesFindNearest(): CheckResult {
  const origin = resolve({ kind: 'entry', id: POINT_ID });
  if (!origin) return { name: 'project()とfindNearest()の一致', ok: false, detail: 'origin resolve failed' };

  const nearest = findNearest({ kind: 'point', positionWorld: origin.originWorld });
  if (!nearest) return { name: 'project()とfindNearest()の一致', ok: false, detail: 'findNearest returned null' };

  const projected = project(origin.originWorld, nearest.entry.id);
  const ok =
    projected !== null &&
    Math.abs(projected.distanceMm - nearest.distanceMm) <= EPSILON_MM &&
    approxEqualVec3(projected.nearestPointWorld, nearest.nearestPointWorld);
  return { name: 'project()とfindNearest()の一致', ok };
}

function checkInterpolateEndpoints(): CheckResult {
  const pathEntryFrame0 = resolve({ kind: 'entry', id: PATH_ID, pathParam: 0 });
  const pathEntryFrame1 = resolve({ kind: 'entry', id: PATH_ID, pathParam: 1 });
  const first = interpolate(PATH_ID, 0);
  const last = interpolate(PATH_ID, 1);
  const notPathIsNull = interpolate(POINT_ID, 0) === null;
  const unknownIsNull = interpolate(UNKNOWN_ID, 0) === null;

  const ok =
    first !== null &&
    last !== null &&
    pathEntryFrame0 !== null &&
    pathEntryFrame1 !== null &&
    approxEqualVec3(first.originWorld, pathEntryFrame0.originWorld) &&
    approxEqualVec3(last.originWorld, pathEntryFrame1.originWorld) &&
    notPathIsNull &&
    unknownIsNull;
  return { name: 'interpolate()の端点 (t=0, t=1)', ok };
}

function checkOffsetZeroAndUnoriented(): CheckResult {
  const origin = resolve({ kind: 'entry', id: POINT_ID });
  if (!origin) return { name: 'offset()のゼロオフセット・向き未定義ケース', ok: false, detail: 'origin resolve failed' };

  const zeroOffsetOnUnoriented = offset(POINT_ID, [0, 0, 0]);
  const nonZeroOffsetOnUnoriented = offset(POINT_ID, [1, 0, 0]);
  const nonZeroOffsetOnOriented = offset(PATH_ID, [1, 0, 0], 0);

  const ok =
    zeroOffsetOnUnoriented !== null &&
    approxEqualVec3(zeroOffsetOnUnoriented, origin.originWorld) &&
    nonZeroOffsetOnUnoriented === null &&
    nonZeroOffsetOnOriented !== null;
  return { name: 'offset()のゼロオフセット・向き未定義ケース', ok };
}

function checkQueryRegionSortedByDistance(): CheckResult {
  const center = resolve({ kind: 'entry', id: POINT_ID });
  if (!center) return { name: 'queryRegion()の距離順ソート', ok: false, detail: 'center resolve failed' };

  // 半径100mmはAtlas全11エントリを包含するのに十分大きい（既存エントリはすべて数cm以内に収まる）。
  const results = queryRegion(center.originWorld, 100);
  let sorted = true;
  for (let i = 1; i < results.length; i++) {
    if (results[i - 1].distanceMm > results[i].distanceMm) {
      sorted = false;
      break;
    }
  }
  const ok = results.length > 1 && sorted;
  return { name: 'queryRegion()の距離順ソート', ok, detail: `${results.length}件` };
}

function checkTraceZeroDirectionAndHit(): CheckResult {
  const zeroDirectionResult = trace([0, 0, 0], [0, 0, 0]);
  const zeroDirectionOk = zeroDirectionResult.length === 0;

  // 既知の2構造物（window.round → vascular.jugularBulb）を結ぶ正確な方向のレイを飛ばし、
  // 到達先の構造物がほぼ距離0でヒットすることを確認する（entries.tsのrelativePositionで
  // 両者の相対関係が定義済みのペアを利用）。
  const fromFrame = resolve({ kind: 'entry', id: 'window.round' });
  const toFrame = resolve({ kind: 'entry', id: 'vascular.jugularBulb' });
  if (!fromFrame || !toFrame) {
    return { name: 'trace()のゼロ方向・代表的ヒットケース', ok: false, detail: 'window.round/vascular.jugularBulb resolve failed' };
  }
  const direction = subtractVec3(toFrame.originWorld, fromFrame.originWorld);
  const hitResults = trace(fromFrame.originWorld, direction);
  const hit = hitResults.find((r) => r.entry.id === 'vascular.jugularBulb');
  let hitResultsSorted = true;
  for (let i = 1; i < hitResults.length; i++) {
    if (hitResults[i - 1].distanceMm > hitResults[i].distanceMm) {
      hitResultsSorted = false;
      break;
    }
  }

  const ok = zeroDirectionOk && hit !== undefined && hit.distanceMm <= 1e-3 && hitResultsSorted;
  return {
    name: 'trace()のゼロ方向・代表的ヒットケース',
    ok,
    detail: hit ? `hit distance ${hit.distanceMm.toFixed(6)}mm` : 'no hit',
  };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkResolveBasics(),
    checkQueryPointAndPath(),
    checkDistanceSymmetry(),
    checkFindNearestExcludesSelf(),
    checkProjectMatchesFindNearest(),
    checkInterpolateEndpoints(),
    checkOffsetZeroAndUnoriented(),
    checkQueryRegionSortedByDistance(),
    checkTraceZeroDirectionAndHit(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[spatial] selfCheck FAIL: ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }

  console.info(
    `[spatial] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`,
  );
}
