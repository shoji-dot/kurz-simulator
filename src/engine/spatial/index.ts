/**
 * engine/spatial/index.ts ─── Spatial Anatomy Engine バレル (Phase4.1〜4.6)
 *
 * resolve/queryPoint/queryPath/distance/findNearest/queryRegion（query.ts）+
 * project/interpolate/offset/trace（frame.ts）を公開する。
 * selfCheck.ts（Phase4.6、開発時自己診断）はengine/validation/selfCheck.tsと同じ理由で
 * 意図的にこのバレルからはexportしない（`if (import.meta.env.DEV)`ガード付きの副作用専用
 * ファイルであり、公開APIの一部ではないため）。
 * 本ファイルも他のシーン・App.tsxからは一切importされていない（Phase1〜3.1と同じ方針）。
 */
export type { SpatialTarget, SpatialReferenceFrame, SpatialQueryResult } from './types';
export { resolve, queryPoint, queryPath, distance, findNearest, queryRegion } from './query';
export { project, interpolate, offset, trace } from './frame';
