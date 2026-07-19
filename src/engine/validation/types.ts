/**
 * engine/validation/types.ts ── Anatomical Validation Foundation 型定義 (Phase3)
 *
 * Coordinate_Validation_Report_設計_v1.0.md（Phase1 Addendumで作成した設計書）の実装。
 * 3種類の検証（座標整合性・期待位置・ランドマーク間距離）＋既存BoundingBox Registry監査
 * (Phase1実装済み)を束ねる。
 *
 * 【重要】本Phaseは「Foundation」（型・検証関数・Ear Atlas由来ルールの導出のみ）であり、
 * Validation Engine本体（UI配線・自動評価・削開評価への接続等）は実装しない。
 * 既存ファイルは一切変更しない（Phase1/Phase2と同じStrangler Pattern）。
 */
import type { CoordinateSystemId, Vec3Tuple } from '../coordinates/types';
import type { BoundingBoxRegistryAuditResult } from '../coordinates/boundingBox';

/** 座標整合性検証の比較対象1つ分（設計書3節の`sourceA`/`sourceB`に対応）。 */
export interface CoordinateConsistencySource {
  readonly system: CoordinateSystemId;
  readonly position: Vec3Tuple;
  readonly label: string;
}

/**
 * 座標整合性検証ルール。同一の解剖構造が複数ファイル・複数座標系で重複定義されている箇所を
 * 突き合わせる（設計書2.1節）。sourceA/sourceBはGLB_LOCALでもWORLDでもよく、比較前に
 * 内部でWORLDへ揃えてから距離を計算する。
 */
export interface CoordinateConsistencyRule {
  readonly id: string;
  readonly sourceA: CoordinateConsistencySource;
  readonly sourceB: CoordinateConsistencySource;
  readonly toleranceMm: number;
}

/**
 * 期待位置検証ルール（設計書2.2節）。`data/earAtlas/bridge.ts` の `ExpectedPositionRuleDraft` と
 * フィールド名・型を完全に一致させてある（構造的に相互互換）。
 */
export interface ExpectedPositionRule {
  readonly targetId: string;
  readonly expectedPositionWorld: Vec3Tuple;
  readonly toleranceMm: number;
}

/** ランドマーク間距離検証ルール（設計書2.3節）。 */
export interface LandmarkDistanceRule {
  readonly id: string;
  readonly fromTargetId: string;
  readonly toTargetId: string;
  readonly expectedRangeMm: readonly [number, number];
}

export interface CoordinateConsistencyResult {
  readonly rule: CoordinateConsistencyRule;
  readonly ok: boolean;
  readonly deviationMm: number;
}
export interface ExpectedPositionResult {
  readonly rule: ExpectedPositionRule;
  readonly ok: boolean;
  readonly deviationMm: number;
}
export interface LandmarkDistanceResult {
  readonly rule: LandmarkDistanceRule;
  readonly ok: boolean;
  readonly actualMm: number;
}

/** 設計書3節の`CoordinateValidationReport`。 */
export interface CoordinateValidationReport {
  readonly generatedAt: string;
  readonly consistency: readonly CoordinateConsistencyResult[];
  readonly expectedPosition: readonly ExpectedPositionResult[];
  readonly landmarkDistance: readonly LandmarkDistanceResult[];
  readonly boundingBox: readonly BoundingBoxRegistryAuditResult[];
}
