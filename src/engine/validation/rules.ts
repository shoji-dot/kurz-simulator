/**
 * engine/validation/rules.ts ── Ear Atlas由来の検証ルール導出 (Phase3)
 *
 * Ear Atlas（data/earAtlas）から検証ルールを機械的に導出する。手入力のルールは
 * KNOWN_COORDINATE_CONSISTENCY_RULES（Phase2で発見済みの既存ファイル間の食い違いを
 * 追跡するためのもの）のみで、それ以外はすべてAtlasデータからの導出であり、
 * Atlas側の値を変更すれば自動的に追従する（重複データを持たない）。
 */
import { EAR_ATLAS_ENTRIES, toExpectedPositionRuleDraft } from '../../data/earAtlas';
import type { Vec3Tuple } from '../coordinates/types';
import type {
  CoordinateConsistencyRule,
  ExpectedPositionRule,
  LandmarkDistanceRule,
} from './types';

/** 許容誤差比率。Phase1 BoundingBox Utilityの既定値(0.15 = ±15%)と揃える。 */
export const DISTANCE_TOLERANCE_RATIO = 0.15;

/** Ear Atlas全11件のうちpositionWorldを持つエントリから導出した期待位置ルール。 */
export const EAR_ATLAS_EXPECTED_POSITION_RULES: readonly ExpectedPositionRule[] =
  EAR_ATLAS_ENTRIES.map((entry) => toExpectedPositionRuleDraft(entry)).filter(
    (rule): rule is ExpectedPositionRule => rule !== null,
  );

/**
 * relativePosition.distanceMm（文献等で裏付けのある距離のみ）を持つエントリから導出した
 * ランドマーク間距離ルール。Phase2時点では ossicle.malleus / ossicle.stapes の2件
 * （いずれも membrane.tympanic 基準）のみが対象。
 */
export const EAR_ATLAS_LANDMARK_DISTANCE_RULES: readonly LandmarkDistanceRule[] = EAR_ATLAS_ENTRIES.filter(
  (entry) => entry.relativePosition?.distanceMm !== undefined,
).map((entry) => {
  const distanceMm = entry.relativePosition!.distanceMm!;
  return {
    id: `${entry.id}:distanceFrom:${entry.relativePosition!.referenceId}`,
    fromTargetId: entry.id,
    toTargetId: entry.relativePosition!.referenceId,
    expectedRangeMm: [
      distanceMm * (1 - DISTANCE_TOLERANCE_RATIO),
      distanceMm * (1 + DISTANCE_TOLERANCE_RATIO),
    ] as const,
  };
});

/** Ear Atlas全エントリのid→positionWorldマップ（positionWorld未設定のエントリは含まない）。 */
export const EAR_ATLAS_POSITIONS: ReadonlyMap<string, Vec3Tuple> = new Map(
  EAR_ATLAS_ENTRIES.filter((entry) => entry.positionWorld !== undefined).map((entry) => [
    entry.id,
    entry.positionWorld!,
  ]),
);

/**
 * 既知の座標整合性ルール（手入力）。「同一構造物が複数ファイルで異なる座標として
 * 定義されている」問題を継続的に検知するためのもの。
 *
 * 1・3件目: dangerZones.ts の facial-tympanic / facial-genu と AnatomyScene.tsx ENDO_ZONES の
 *        同名エントリ。Phase3実装中の実行検証で、ENDO_ZONES側が誤った手計算式
 *        world[z,-y,x]（正しくはworld[-z,-y,-x]）で書かれていたことが判明した（FAILだった）。
 *        Phase3.1でAnatomyScene.tsxのENDO_ZONESをEar Atlas経由の正しい値に修正済みのため、
 *        現在は両ルールともPASSする。修正の回帰防止テストとして残し、sourceBの値は
 *        Phase3.1修正後のENDO_ZONESの実際の値に更新した。
 * 2件目: dangerZones.ts の facial-tympanic と TympanoCavityModel.tsx の顔面神経水平部(起点)は
 *        Phase2で発見した食い違い → FAIL(要検討フラグ)想定。Phase3.1のスコープ外のため未修正。
 *
 * いずれも本ファイルは検出のみを行う（validate.tsに自動修正の責務は無い）。
 */
export const KNOWN_COORDINATE_CONSISTENCY_RULES: readonly CoordinateConsistencyRule[] = [
  {
    id: 'facial-tympanic:dangerZones-vs-ENDO_ZONES',
    sourceA: { system: 'GLB_LOCAL', position: [0, 2.8, -1.5], label: 'dangerZones.ts DANGER_ZONES.facial-tympanic' },
    sourceB: { system: 'WORLD', position: [1.5, -2.8, 0.0], label: 'AnatomyScene.tsx ENDO_ZONES.facial-tympanic (Phase3.1修正後)' },
    toleranceMm: 1e-6,
  },
  {
    id: 'facial-tympanic:dangerZones-vs-TympanoCavityModel',
    sourceA: { system: 'GLB_LOCAL', position: [0, 2.8, -1.5], label: 'dangerZones.ts DANGER_ZONES.facial-tympanic' },
    sourceB: { system: 'GLB_LOCAL', position: [-0.5, -0.5, 1.5], label: 'TympanoCavityModel.tsx 顔面神経水平部(起点)' },
    toleranceMm: 1.0,
  },
  {
    id: 'facial-genu:dangerZones-vs-ENDO_ZONES',
    sourceA: { system: 'GLB_LOCAL', position: [-4, 1.5, -3.0], label: 'dangerZones.ts DANGER_ZONES.facial-genu' },
    sourceB: { system: 'WORLD', position: [3.0, -1.5, 4.0], label: 'AnatomyScene.tsx ENDO_ZONES.facial-genu (Phase3.1修正後)' },
    toleranceMm: 1e-6,
  },
];
