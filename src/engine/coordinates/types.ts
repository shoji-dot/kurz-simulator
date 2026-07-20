/**
 * coordinates/types.ts ── 座標系Phase1基盤: 共有型定義
 *
 * 座標系統合_解剖エンジン設計書_v1.0（3.2節）のレイヤー構成に対応する型のみを持つ。
 * 既存コード（dangerZones.ts 等）の型は変更しない（互換レイヤーとして追加するのみ）。
 */

/** 3次元座標を表すタプル。1 unit = 1mm（プロジェクト全体の既存規約）。 */
export type Vec3Tuple = readonly [number, number, number];

/**
 * 座標系レイヤーの識別子。
 * - GLB_LOCAL: 各GLBファイルが持つ生の座標系
 * - WORLD: Three.jsシーングラフ上の正準座標系（=既存 World v2）
 * - ANATOMICAL: 医学的方向の意味付け（WORLDのエイリアス、数値は同一）
 * - TEMPORAL_BONE: 耳科手術用語での意味付け（ANATOMICALのエイリアス、数値は同一）
 */
export type CoordinateSystemId = 'GLB_LOCAL' | 'WORLD' | 'ANATOMICAL' | 'TEMPORAL_BONE';

/** BoundingBox監査結果（mm単位、WORLD座標）。 */
export interface BoundingBoxInfoMm {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
  /** max - min（各軸の実寸mm） */
  readonly sizeMm: Vec3Tuple;
  readonly center: Vec3Tuple;
}

export type EarSide = 'right' | 'left';
export type ViewerRole = 'surgeon' | 'patient';

/** Orientation Manager土台（Phase1）が保持する状態。 */
export interface OrientationState {
  readonly earSide: EarSide;
  readonly viewerRole: ViewerRole;
}
