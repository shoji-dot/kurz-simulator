/**
 * engine/spatial/query.ts ─── Spatial Anatomy Engine 基盤クエリ (Phase4.1〜4.5)
 *
 * resolve()がSpatialTargetをSpatialReferenceFrameへ解決する唯一の入口。
 * queryPoint/queryPathはresolve()経由の薄いラッパーとし、座標計算を重複実装しない。
 * distance/findNearest/queryRegionは内部でresolve()を対象ごとに1回だけ呼ぶ設計を維持する
 * （Phase4.1レビュー指摘: 「resolve()は1回だけ呼ぶ」をルール化）。
 *
 * queryRegion/findNearestは「点と構造物」の評価（evaluateEntryAgainstPoint）を共有する。
 * 「線(レイ)と構造物」の評価はこのファイルの責務ではなく、frame.tsのtrace()が独自に持つ
 * （Phase4.4レビュー指摘: 点評価とレイ評価は無理に共通化せず別ファミリーとして分離する）。
 *
 * 既存ファイルは一切変更しない。Ear Atlas (data/earAtlas/query.ts) をSingle Source of Truthとして
 * 都度クエリし、独自のデータは保持しない。ベクトル演算は engine/coordinates/vectorMath.ts を
 * 再利用する。
 */
import { getEarAtlasEntry, listAllEarAtlasEntries } from '../../data/earAtlas/query';
import type { EarAtlasCategory, EarAtlasDangerLevel, EarAtlasEntry, EarAtlasPathPoint } from '../../data/earAtlas/types';
import { crossVec3, lengthVec3, normalizeVec3, subtractVec3 } from '../coordinates/vectorMath';
import type { Vec3Tuple } from '../coordinates/types';
import type { SpatialQueryResult, SpatialReferenceFrame, SpatialTarget } from './types';

const ZERO_VEC3: Vec3Tuple = [0, 0, 0];
const EPSILON = 1e-9;

/** frame.ts(trace()の2線分間最近接点計算)からも使うためexport。 */
export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerpVec3(a: Vec3Tuple, b: Vec3Tuple, f: number): Vec3Tuple {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** vectorMath.ts に無いため、投影計算用にここでのみ定義する内積(dot product)。frame.tsからも使うためexport。 */
export function dotVec3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function frameFromPathPoint(p: EarAtlasPathPoint): SpatialReferenceFrame {
  return {
    originWorld: p.positionWorld,
    tangent: p.tangent,
    normal: p.normal,
    binormal: normalizeVec3(crossVec3(p.tangent, p.normal)),
  };
}

export interface PolylineMetrics {
  readonly segLengths: readonly number[];
  readonly totalLengthMm: number;
}

/**
 * 経路(Polyline)の各区間長・全長(mm)を計算する。resolvePathFrame/closestPointOnPathの共通ヘルパー。
 * frame.ts の trace() も経路の弧長パラメータ化に使うためexport。
 */
export function computePolylineMetrics(points: readonly EarAtlasPathPoint[]): PolylineMetrics {
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = lengthVec3(subtractVec3(points[i + 1].positionWorld, points[i].positionWorld));
    segLengths.push(len);
    total += len;
  }
  return { segLengths, totalLengthMm: total };
}

/**
 * 経路(Polyline)上のパラメータt(0..1、弧長基準)からフレームを補間する。
 * tangent/normalは線形補間後に再正規化する近似（区間が短いnerve経路データを前提とした
 * 簡易版。真の球面線形補間(slerp)ではない）。frame.ts の trace() からも使うためexport。
 */
export function resolvePathFrame(points: readonly EarAtlasPathPoint[], t: number): SpatialReferenceFrame {
  if (points.length === 1) return frameFromPathPoint(points[0]);

  const { segLengths, totalLengthMm } = computePolylineMetrics(points);
  const targetDist = clamp01(t) * totalLengthMm;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;
    if (targetDist <= acc + segLen || isLastSegment) {
      const f = segLen < EPSILON ? 0 : clamp01((targetDist - acc) / segLen);
      const a = points[i];
      const b = points[i + 1];
      const tangent = normalizeVec3(lerpVec3(a.tangent, b.tangent, f));
      const normal = normalizeVec3(lerpVec3(a.normal, b.normal, f));
      return {
        originWorld: lerpVec3(a.positionWorld, b.positionWorld, f),
        tangent,
        normal,
        binormal: normalizeVec3(crossVec3(tangent, normal)),
      };
    }
    acc += segLen;
  }

  // 到達しない防御的フォールバック(TS制御フロー上の網羅性のため)。
  return frameFromPathPoint(points[points.length - 1]);
}

/**
 * 経路(Polyline)上でqueryPointに最も近い点を、区間ごとの垂線投影(クランプ付き)で求める。
 * 頂点だけでなく線分上の任意点も候補にする（危険構造物である神経経路は現状すべて2点=直線
 * 構成のため、頂点最近傍のみでは臨床的に不正確な距離になりうると判断し、Phase4.2の時点で
 * 前倒しで実装した。project()はこの関数をベースにしたevaluateEntryAgainstPointを再利用する）。
 */
function closestPointOnPath(
  points: readonly EarAtlasPathPoint[],
  queryPoint: Vec3Tuple,
): { readonly nearestPointWorld: Vec3Tuple; readonly distanceMm: number; readonly pathParam: number } {
  if (points.length === 1) {
    const p = points[0].positionWorld;
    return { nearestPointWorld: p, distanceMm: lengthVec3(subtractVec3(queryPoint, p)), pathParam: 0 };
  }

  const { segLengths, totalLengthMm } = computePolylineMetrics(points);

  let bestDistanceMm = Infinity;
  let bestPoint: Vec3Tuple = points[0].positionWorld;
  let bestGlobalT = 0;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segStart = points[i].positionWorld;
    const segEnd = points[i + 1].positionWorld;
    const segLen = segLengths[i];
    const segVec = subtractVec3(segEnd, segStart);
    const toPoint = subtractVec3(queryPoint, segStart);
    const f = segLen < EPSILON ? 0 : clamp01(dotVec3(toPoint, segVec) / (segLen * segLen));
    const candidate = lerpVec3(segStart, segEnd, f);
    const dist = lengthVec3(subtractVec3(queryPoint, candidate));
    if (dist < bestDistanceMm) {
      bestDistanceMm = dist;
      bestPoint = candidate;
      bestGlobalT = totalLengthMm < EPSILON ? 0 : clamp01((acc + f * segLen) / totalLengthMm);
    }
    acc += segLen;
  }
  return { nearestPointWorld: bestPoint, distanceMm: bestDistanceMm, pathParam: bestGlobalT };
}

/**
 * 基盤API。SpatialTargetをSpatialReferenceFrameへ解決する唯一の入口。
 * distance/findNearest/queryRegion（および frame.tsのproject/interpolate/offset）はすべて
 * 内部的にresolve()経由でSpatialTargetを解決してから計算する
 * （target種別ごとの分岐をここに閉じ込める）。
 * 存在しないid・座標未設定のentryなど、解決不能な場合は必ずnullを返す（例外は投げない）。
 */
export function resolve(target: SpatialTarget): SpatialReferenceFrame | null {
  if (target.kind === 'point') {
    return { originWorld: target.positionWorld, tangent: ZERO_VEC3, normal: ZERO_VEC3, binormal: ZERO_VEC3 };
  }

  const entry = getEarAtlasEntry(target.id);
  if (!entry) return null;

  if (entry.shapeType === 'point') {
    if (!entry.positionWorld) return null;
    const orientation = entry.orientation;
    return {
      originWorld: entry.positionWorld,
      tangent: orientation?.forward ?? ZERO_VEC3,
      normal: orientation?.up ?? ZERO_VEC3,
      binormal: orientation?.right ?? ZERO_VEC3,
    };
  }

  // shapeType === 'path'
  if (!entry.path || entry.path.points.length === 0) return null;
  return resolvePathFrame(entry.path.points, target.pathParam ?? 0);
}

/** resolve({kind:'entry', id})の薄いラッパー。 */
export function queryPoint(id: string): SpatialReferenceFrame | null {
  return resolve({ kind: 'entry', id });
}

/** 経路構造(shapeType==='path')の全点列と全長(mm)を返す。point entryや未登録idはnullを返す。 */
export function queryPath(
  id: string,
): { readonly points: readonly SpatialReferenceFrame[]; readonly lengthMm: number } | null {
  const entry = getEarAtlasEntry(id);
  if (!entry || entry.shapeType !== 'path' || !entry.path || entry.path.points.length === 0) return null;

  const points = entry.path.points.map(frameFromPathPoint);
  let lengthMm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    lengthMm += lengthVec3(subtractVec3(points[i + 1].originWorld, points[i].originWorld));
  }
  return { points, lengthMm };
}

/**
 * 2つのSpatialTarget間のWORLD距離(mm)。resolve()をa/bそれぞれ1回だけ呼ぶ
 * （Phase4.1レビュー指摘の「resolve()は1回だけ呼ぶ」ルールに対応）。
 * どちらかが解決不能な場合はnull（他のAPIと同じnullポリシー。Phase4 API設計書改訂履歴5参照）。
 */
export function distance(a: SpatialTarget, b: SpatialTarget): number | null {
  const frameA = resolve(a);
  const frameB = resolve(b);
  if (!frameA || !frameB) return null;
  return lengthVec3(subtractVec3(frameB.originWorld, frameA.originWorld));
}

/**
 * entry1件分をqueryPointに対して評価する。
 * findNearest/queryRegionの内部ヘルパーであり、frame.tsのproject()も同じロジックをそのまま
 * 再利用する（project()は本関数の薄いラッパーとして実装されている）。
 */
export function evaluateEntryAgainstPoint(entry: EarAtlasEntry, queryPoint: Vec3Tuple): SpatialQueryResult | null {
  if (entry.shapeType === 'point') {
    if (!entry.positionWorld) return null;
    const referenceFrame = resolve({ kind: 'entry', id: entry.id }) ?? undefined;
    return {
      entry,
      distanceMm: lengthVec3(subtractVec3(queryPoint, entry.positionWorld)),
      nearestPointWorld: entry.positionWorld,
      referenceFrame,
    };
  }

  if (!entry.path || entry.path.points.length === 0) return null;
  const { nearestPointWorld, distanceMm, pathParam } = closestPointOnPath(entry.path.points, queryPoint);
  return {
    entry,
    distanceMm,
    pathParam,
    nearestPointWorld,
    referenceFrame: resolvePathFrame(entry.path.points, pathParam),
  };
}

/**
 * fromに最も近いAtlasエントリを1件返す（自分自身は除外する）。
 * shapeType==='path'のエントリに対しては頂点だけでなく線分上への投影も考慮する
 * （closestPointOnPath参照）。候補が無い場合はnull。
 */
export function findNearest(
  from: SpatialTarget,
  opts?: { readonly category?: EarAtlasCategory; readonly excludeIds?: readonly string[] },
): SpatialQueryResult | null {
  const fromFrame = resolve(from);
  if (!fromFrame) return null;

  const excludeIds = new Set(opts?.excludeIds ?? []);
  const selfId = from.kind === 'entry' ? from.id : undefined;

  let best: SpatialQueryResult | null = null;
  for (const entry of listAllEarAtlasEntries()) {
    if (entry.id === selfId) continue;
    if (excludeIds.has(entry.id)) continue;
    if (opts?.category && entry.category !== opts.category) continue;

    const result = evaluateEntryAgainstPoint(entry, fromFrame.originWorld);
    if (!result) continue;
    if (!best || result.distanceMm < best.distanceMm) best = result;
  }
  return best;
}

/**
 * centerからradiusMm以内にあるAtlasエントリをすべて返す（距離の近い順にソート）。
 * `evaluateEntryAgainstPoint`（findNearestと同じ「点と構造物」の評価）を再利用する。
 * 該当なしの場合は空配列（他のAPIと異なりnullではない。「0件ヒット」は正常な結果であり
 * 解決不能とは意味が異なるため）。
 */
export function queryRegion(
  center: Vec3Tuple,
  radiusMm: number,
  opts?: { readonly category?: EarAtlasCategory; readonly dangerLevel?: EarAtlasDangerLevel },
): readonly SpatialQueryResult[] {
  const results: SpatialQueryResult[] = [];
  for (const entry of listAllEarAtlasEntries()) {
    if (opts?.category && entry.category !== opts.category) continue;
    if (opts?.dangerLevel && entry.dangerLevel !== opts.dangerLevel) continue;

    const result = evaluateEntryAgainstPoint(entry, center);
    if (result && result.distanceMm <= radiusMm) results.push(result);
  }
  return [...results].sort((a, b) => a.distanceMm - b.distanceMm);
}
