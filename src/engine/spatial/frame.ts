/**
 * engine/spatial/frame.ts ─── Spatial Anatomy Engine フレーム/経路/レイAPI (Phase4.3〜4.5)
 *
 * project()/interpolate()は薄いラッパー。offset()はローカル→ワールドのオフセット加算のみ。
 *
 * trace()は「線(レイ)と構造物」の評価であり、query.tsの`evaluateEntryAgainstPoint`
 * （「点と構造物」の評価）とは意図的に別ファミリーとして分離する
 * （Phase4.4レビュー指摘: 無理に共通化せず、将来Meshベースの厳密判定へ発展させる際にも
 * 拡張しやすい形にする）。核となる幾何計算は「2線分間の最近接点」で、Atlasのpoint entryは
 * 長さ0の線分として、path entryは各区間を線分として扱うことで両方に対応する
 * （Ericson "Real-Time Collision Detection" 5.1.9 ClosestPtSegmentSegment のTS移植。
 * ブルートフォース数値検証済み、レビュー資料参照）。
 *
 * 既存ファイルは一切変更しない。
 */
import { getEarAtlasEntry, listAllEarAtlasEntries } from '../../data/earAtlas/query';
import type { EarAtlasCategory, EarAtlasEntry, EarAtlasPathPoint } from '../../data/earAtlas/types';
import { lengthVec3, normalizeVec3, subtractVec3 } from '../coordinates/vectorMath';
import type { Vec3Tuple } from '../coordinates/types';
import { clamp01, computePolylineMetrics, dotVec3, evaluateEntryAgainstPoint, resolve, resolvePathFrame } from './query';
import type { SpatialQueryResult, SpatialReferenceFrame } from './types';

const EPSILON = 1e-9;
/** maxDistanceMm省略時の実質「無制限」扱い(Atlasのスケールはmm〜cm、100mは十分大きい)。 */
const UNBOUNDED_RAY_LENGTH_MM = 1e5;

/**
 * 任意の点をAtlasエントリ(point/path)へ投影し、最近傍点までの距離・位置・フレームを返す。
 * `evaluateEntryAgainstPoint`（findNearestの候補評価と同一ロジック）の薄いラッパー。
 * 対象idが存在しない場合はnull。
 */
export function project(point: Vec3Tuple, targetId: string): SpatialQueryResult | null {
  const entry = getEarAtlasEntry(targetId);
  if (!entry) return null;
  return evaluateEntryAgainstPoint(entry, point);
}

/**
 * 経路(shapeType==='path')上のパラメータt(0..1)におけるフレームを返す。
 * `resolve({kind:'entry', id, pathParam: t})`の薄いラッパー（resolve()は1回のみ呼ぶ）。
 * shapeType==='point'のエントリ、および未登録idはnull（t自体には意味を持たせない設計のため）。
 */
export function interpolate(targetId: string, t: number): SpatialReferenceFrame | null {
  const entry = getEarAtlasEntry(targetId);
  if (!entry || entry.shapeType !== 'path') return null;
  return resolve({ kind: 'entry', id: targetId, pathParam: t });
}

function isZeroVec3(v: Vec3Tuple): boolean {
  return v[0] === 0 && v[1] === 0 && v[2] === 0;
}

/** frameのtangent/normal/binormalを軸としたローカルオフセットをWORLD座標へ加算するだけの純粋計算。 */
function applyLocalOffset(frame: SpatialReferenceFrame, offsetMm: Vec3Tuple): Vec3Tuple {
  const [alongTangent, alongNormal, alongBinormal] = offsetMm;
  const { originWorld, tangent, normal, binormal } = frame;
  return [
    originWorld[0] + alongTangent * tangent[0] + alongNormal * normal[0] + alongBinormal * binormal[0],
    originWorld[1] + alongTangent * tangent[1] + alongNormal * normal[1] + alongBinormal * binormal[1],
    originWorld[2] + alongTangent * tangent[2] + alongNormal * normal[2] + alongBinormal * binormal[2],
  ];
}

/**
 * targetId上（pathの場合はt、省略時t=0）のローカル座標系(tangent/normal/binormal)を基準に、
 * offsetMm=[tangent軸, normal軸, binormal軸]だけずらしたWORLD座標を返す。
 * 例:「顔面神経鼓室部の2mm前方」= offset('nerve.facial.tympanic', [0, 0, 2])
 *
 * 【安全策】resolve()が返すフレームのtangent/normal/binormalが すべて[0,0,0]（向き不定。現状の
 * Atlasではorientation未設定のpoint entryが該当）の場合、非ゼロのoffsetMmを安全に適用できないため
 * nullを返す（無向きのフレームに対して「動いていないのに動いたかのような」誤った座標を返さない
 * ため。Phase4 API設計書 改訂履歴7として正式仕様化済み）。offsetMmが[0,0,0]（実質オフセット無し）
 * の場合はフレームの向きを問わずoriginWorldを返す。
 */
export function offset(targetId: string, offsetMm: Vec3Tuple, t?: number): Vec3Tuple | null {
  const frame = resolve({ kind: 'entry', id: targetId, pathParam: t });
  if (!frame) return null;

  const wantsOffset = !isZeroVec3(offsetMm);
  const hasOrientation = !isZeroVec3(frame.tangent) || !isZeroVec3(frame.normal) || !isZeroVec3(frame.binormal);
  if (wantsOffset && !hasOrientation) return null;

  return applyLocalOffset(frame, offsetMm);
}

interface SegmentSegmentResult {
  readonly s: number;
  readonly t: number;
  readonly c1: Vec3Tuple;
  readonly c2: Vec3Tuple;
  readonly distanceMm: number;
}

/**
 * 2線分(p1-q1, p2-q2)間の最近接点対を求める。
 * Ericson "Real-Time Collision Detection" 5.1.9 ClosestPtSegmentSegment のTS移植
 * （長さ0の線分=点として扱うケースも含め、degenerateケースに対応した標準アルゴリズム）。
 * trace()では、レイ(原点→終点にクランプした線分)をp1-q1、Atlasのpoint/path区間をp2-q2として使う。
 */
function closestPointsBetweenSegments(p1: Vec3Tuple, q1: Vec3Tuple, p2: Vec3Tuple, q2: Vec3Tuple): SegmentSegmentResult {
  const d1 = subtractVec3(q1, p1);
  const d2 = subtractVec3(q2, p2);
  const r = subtractVec3(p1, p2);
  const a = dotVec3(d1, d1);
  const e = dotVec3(d2, d2);
  const f = dotVec3(d2, r);

  let s: number;
  let t: number;

  if (a <= EPSILON && e <= EPSILON) {
    s = 0;
    t = 0;
  } else if (a <= EPSILON) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dotVec3(d1, r);
    if (e <= EPSILON) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dotVec3(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const c1: Vec3Tuple = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2: Vec3Tuple = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return { s, t, c1, c2, distanceMm: lengthVec3(subtractVec3(c1, c2)) };
}

/** entry1件分をレイ(rayStart→rayEndにクランプ済みの線分)に対して評価する（trace()の内部ヘルパー）。 */
function evaluateEntryAgainstRay(entry: EarAtlasEntry, rayStart: Vec3Tuple, rayEnd: Vec3Tuple): SpatialQueryResult | null {
  if (entry.shapeType === 'point') {
    if (!entry.positionWorld) return null;
    const result = closestPointsBetweenSegments(rayStart, rayEnd, entry.positionWorld, entry.positionWorld);
    return {
      entry,
      distanceMm: result.distanceMm,
      nearestPointWorld: result.c2,
      referenceFrame: resolve({ kind: 'entry', id: entry.id }) ?? undefined,
    };
  }

  if (!entry.path || entry.path.points.length === 0) return null;
  const points: readonly EarAtlasPathPoint[] = entry.path.points;

  if (points.length === 1) {
    const p = points[0].positionWorld;
    const result = closestPointsBetweenSegments(rayStart, rayEnd, p, p);
    return {
      entry,
      distanceMm: result.distanceMm,
      pathParam: 0,
      nearestPointWorld: result.c2,
      referenceFrame: resolvePathFrame(points, 0),
    };
  }

  const { segLengths, totalLengthMm } = computePolylineMetrics(points);
  let best: SegmentSegmentResult | null = null;
  let bestGlobalT = 0;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segStart = points[i].positionWorld;
    const segEnd = points[i + 1].positionWorld;
    const result = closestPointsBetweenSegments(rayStart, rayEnd, segStart, segEnd);
    if (!best || result.distanceMm < best.distanceMm) {
      best = result;
      const segLen = segLengths[i];
      bestGlobalT = totalLengthMm < EPSILON ? 0 : clamp01((acc + result.t * segLen) / totalLengthMm);
    }
    acc += segLengths[i];
  }
  if (!best) return null;
  return {
    entry,
    distanceMm: best.distanceMm,
    pathParam: bestGlobalT,
    nearestPointWorld: best.c2,
    referenceFrame: resolvePathFrame(points, bestGlobalT),
  };
}

/**
 * origin から direction 方向へ伸ばしたレイ（maxDistanceMmでクランプ、省略時は実質無制限）に対し、
 * 近いAtlasエントリを近い順にすべて返す。Atlasのpoint/path区間との「垂線距離」による近似判定であり、
 * Three.jsのRaycasterのようなMeshとの厳密交差判定ではない（意図的にtraceと命名。設計書参照）。
 * directionが実質ゼロベクトルの場合は空配列を返す（レイが定義できないため）。
 */
export function trace(
  origin: Vec3Tuple,
  direction: Vec3Tuple,
  opts?: { readonly maxDistanceMm?: number; readonly category?: EarAtlasCategory },
): readonly SpatialQueryResult[] {
  const dir = normalizeVec3(direction);
  if (isZeroVec3(dir)) return [];

  const maxLength = opts?.maxDistanceMm ?? UNBOUNDED_RAY_LENGTH_MM;
  const rayEnd: Vec3Tuple = [
    origin[0] + dir[0] * maxLength,
    origin[1] + dir[1] * maxLength,
    origin[2] + dir[2] * maxLength,
  ];

  const results: SpatialQueryResult[] = [];
  for (const entry of listAllEarAtlasEntries()) {
    if (opts?.category && entry.category !== opts.category) continue;
    const result = evaluateEntryAgainstRay(entry, origin, rayEnd);
    if (result) results.push(result);
  }
  return [...results].sort((a, b) => a.distanceMm - b.distanceMm);
}
