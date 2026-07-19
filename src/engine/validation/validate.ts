/**
 * engine/validation/validate.ts ── 検証関数本体 (Phase3)
 *
 * Coordinate_Validation_Report_設計_v1.0.md の3種検証（座標整合性・期待位置・
 * ランドマーク間距離）＋Phase1 BoundingBox Registry監査を実行する純粋関数群。
 * 【重要】本Phaseは検証関数の提供のみ。UIへの配線・自動評価・削開評価への接続は
 * 行わない（Validation Engine本体はPhase4以降）。既存ファイルへの変更もなし。
 */
import { glbLocalToWorld } from '../coordinates/transforms';
import { lengthVec3, subtractVec3 } from '../coordinates/vectorMath';
import { auditBoundingBoxRegistry } from '../coordinates/boundingBox';
import type { BoundingBoxInfoMm } from '../coordinates/types';
import type { BoundingBoxRegistry } from '../coordinates/boundingBox';
import type { Vec3Tuple } from '../coordinates/types';
import type {
  CoordinateConsistencyResult,
  CoordinateConsistencyRule,
  CoordinateConsistencySource,
  CoordinateValidationReport,
  ExpectedPositionResult,
  ExpectedPositionRule,
  LandmarkDistanceResult,
  LandmarkDistanceRule,
} from './types';

/** 座標系を問わずWORLD座標へ解決する。GLB_LOCALのみ変換し、それ以外はそのまま扱う
 * （ANATOMICAL/TEMPORAL_BONEはWORLDのエイリアスであるため、Phase1 transforms.tsの設計どおり）。 */
function resolveToWorld(source: CoordinateConsistencySource): Vec3Tuple {
  return source.system === 'GLB_LOCAL' ? glbLocalToWorld(source.position) : source.position;
}

/** 座標整合性検証: 複数ファイル・複数座標系で重複定義された同一構造物の位置が一致するか。 */
export function validateCoordinateConsistency(
  rules: readonly CoordinateConsistencyRule[],
): readonly CoordinateConsistencyResult[] {
  return rules.map((rule) => {
    const worldA = resolveToWorld(rule.sourceA);
    const worldB = resolveToWorld(rule.sourceB);
    const deviationMm = lengthVec3(subtractVec3(worldA, worldB));
    return { rule, ok: deviationMm <= rule.toleranceMm, deviationMm };
  });
}

/** 期待位置検証: 実際に計測・配置された位置がAtlas上の期待位置と一致するか。 */
export function validateExpectedPositions(
  actualByTargetId: ReadonlyMap<string, Vec3Tuple>,
  rules: readonly ExpectedPositionRule[],
): readonly ExpectedPositionResult[] {
  const results: ExpectedPositionResult[] = [];
  for (const rule of rules) {
    const actual = actualByTargetId.get(rule.targetId);
    if (!actual) continue;
    const deviationMm = lengthVec3(subtractVec3(actual, rule.expectedPositionWorld));
    results.push({ rule, ok: deviationMm <= rule.toleranceMm, deviationMm });
  }
  return results;
}

/** ランドマーク間距離検証: 2構造物間の実際の距離が既知の期待範囲(mm)に収まっているか。 */
export function validateLandmarkDistances(
  positionByTargetId: ReadonlyMap<string, Vec3Tuple>,
  rules: readonly LandmarkDistanceRule[],
): readonly LandmarkDistanceResult[] {
  const results: LandmarkDistanceResult[] = [];
  for (const rule of rules) {
    const from = positionByTargetId.get(rule.fromTargetId);
    const to = positionByTargetId.get(rule.toTargetId);
    if (!from || !to) continue;
    const actualMm = lengthVec3(subtractVec3(from, to));
    const [min, max] = rule.expectedRangeMm;
    results.push({ rule, ok: actualMm >= min && actualMm <= max, actualMm });
  }
  return results;
}

export interface GenerateCoordinateValidationReportInput {
  readonly consistencyRules: readonly CoordinateConsistencyRule[];
  readonly expectedPositionRules: readonly ExpectedPositionRule[];
  readonly expectedPositionActuals: ReadonlyMap<string, Vec3Tuple>;
  readonly landmarkDistanceRules: readonly LandmarkDistanceRule[];
  readonly landmarkPositions: ReadonlyMap<string, Vec3Tuple>;
  readonly boundingBoxRegistry: BoundingBoxRegistry;
  readonly boundingBoxActuals: ReadonlyMap<string, BoundingBoxInfoMm>;
}

/** 4種の検証をすべて実行し、単一のCoordinateValidationReportへ束ねる。 */
export function generateCoordinateValidationReport(
  input: GenerateCoordinateValidationReportInput,
): CoordinateValidationReport {
  return {
    generatedAt: new Date().toISOString(),
    consistency: validateCoordinateConsistency(input.consistencyRules),
    expectedPosition: validateExpectedPositions(input.expectedPositionActuals, input.expectedPositionRules),
    landmarkDistance: validateLandmarkDistances(input.landmarkPositions, input.landmarkDistanceRules),
    boundingBox: auditBoundingBoxRegistry(input.boundingBoxActuals, input.boundingBoxRegistry),
  };
}
