/**
 * engine/spatial/types.ts ─── Spatial Anatomy Engine 型定義 (Phase4.1)
 *
 * Phase4_SpatialAnatomyEngine_API設計_v1.0.md（改訂版、shojiさん承認済み 2026-07-17）の実装。
 * Ear Atlas (data/earAtlas) を唯一の入力とし、独自のデータを持たない幾何クエリ層。
 * 既存ファイルは一切変更しない（Phase1〜3.1と同じStrangler Pattern）。
 */
import type { Vec3Tuple } from '../coordinates/types';
import type { EarAtlasEntry } from '../../data/earAtlas/types';

/**
 * クエリ対象の指定方法。
 * 'entry'ではpathParamを併記することで、経路構造の途中位置（例: 顔面神経鼓室部の70%地点）も
 * 直接指定できる。pathParam省略時、shapeType==='path'のentryはt=0（始点）を指すものとする。
 * shapeType==='point'のentryではpathParamは無視される。
 */
export type SpatialTarget =
  | { readonly kind: 'entry'; readonly id: string; readonly pathParam?: number }
  | { readonly kind: 'point'; readonly positionWorld: Vec3Tuple };

/**
 * 構造物1点における局所座標系。Phase2.1で追加した
 * EarAtlasLocalFrame（point用）/ EarAtlasPathPoint（path用）を統一的に扱うための派生型。
 * Atlas側のスキーマ変更は不要（resolve()が都度計算して返す）。
 * kind==='point'のSpatialTarget、および orientation 未設定の point entry では、
 * tangent/normal/binormalはいずれも向き不定を表す[0,0,0]になる。
 */
export interface SpatialReferenceFrame {
  readonly originWorld: Vec3Tuple;
  readonly tangent: Vec3Tuple;
  readonly normal: Vec3Tuple;
  readonly binormal: Vec3Tuple;
}

/** findNearest/queryRegion/project/trace（Phase4.2以降）が返すクエリ結果。 */
export interface SpatialQueryResult {
  readonly entry: EarAtlasEntry;
  readonly distanceMm: number;
  /** shapeType==='path'の場合の最近傍点の経路パラメータ(0=始点〜1=終点)。pointではundefined。 */
  readonly pathParam?: number;
  readonly nearestPointWorld: Vec3Tuple;
  /** 呼び出し側がoffset()等を続けて呼べるよう、最近傍点のフレームを併せて返す（再計算不要）。 */
  readonly referenceFrame?: SpatialReferenceFrame;
}
