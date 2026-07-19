/**
 * data/earAtlas/bridge.ts ── 接続準備 (Phase2)
 *
 * BoundingBox Registry（engine/coordinates/boundingBox.ts、Phase1実装）と
 * Coordinate Validation Report（Coordinate_Validation_Report_設計_v1.0.md、設計のみ・
 * Phase3実装予定）へEar Atlasのデータを供給するための変換関数。
 * 本Phaseでは変換ロジックのみを用意し、既存コードへの配線・Validation Engine本体の
 * 実装は行わない。
 *
 * また「既存の静的データ（LANDMARKS/DANGER_ZONES/ENDO_ZONES等）は将来Ear Atlasから
 * 生成される構造を目標とする」という方針の実証として toLegacyDangerZoneShape() も
 * 用意する。既存 dangerZones.ts は変更しておらず、生成結果は現状どこからも呼ばれない。
 */
import { worldToGlbLocal } from '../../engine/coordinates/transforms';
import type { BoundingBoxRegistryEntry } from '../../engine/coordinates/boundingBox';
import type { Vec3Tuple } from '../../engine/coordinates/types';
import { getEarAtlasEntryByDangerZoneId } from './query';
import type { EarAtlasEntry } from './types';

/**
 * EarAtlasEntry → BoundingBoxRegistryEntry。
 * `normalSizeMm.measureType === 'boundingBox'` の場合のみ変換できる（それ以外はnull）。
 * Phase2時点ではnormalSizeMmを未投入のため、現状呼び出しても常にnullを返す
 * （スキーマと変換経路だけを用意した状態）。
 */
export function toBoundingBoxRegistryEntry(entry: EarAtlasEntry): BoundingBoxRegistryEntry | null {
  const size = entry.normalSizeMm;
  if (!size || size.measureType !== 'boundingBox' || !size.boundingBoxMm) return null;
  const source: BoundingBoxRegistryEntry['source'] =
    size.sourceTag === 'KURZ固有情報' ? 'measured' : size.sourceTag === '一般耳科知識' ? 'literature' : 'provisional';
  return {
    targetId: entry.id,
    labelJa: entry.nameJa,
    expectedSizeMm: size.boundingBoxMm,
    toleranceRatio: 0.15,
    source,
  };
}

/**
 * Coordinate_Validation_Report_設計_v1.0.md の ExpectedPositionRule 相当。
 * Validation Report本体は未実装のため、フィールド名を設計書と一致させた軽量な型を
 * ここに複製している（本実装時にそのまま置き換えられるようにするため）。
 */
export interface ExpectedPositionRuleDraft {
  readonly targetId: string;
  readonly expectedPositionWorld: Vec3Tuple;
  readonly toleranceMm: number;
}

/** EarAtlasEntry → ExpectedPositionRuleDraft。positionWorld未設定のエントリはnullを返す。 */
export function toExpectedPositionRuleDraft(
  entry: EarAtlasEntry,
  toleranceMm = 1.5,
): ExpectedPositionRuleDraft | null {
  if (!entry.positionWorld) return null;
  return { targetId: entry.id, expectedPositionWorld: entry.positionWorld, toleranceMm };
}

// ── 既存データ生成デモ（dangerZones.ts 互換、未配線） ──────────────────
export interface LegacyDangerZoneShape {
  readonly id: string;
  readonly nameJa: string;
  readonly nameEn: string;
  readonly category: 'facial' | 'vascular';
  readonly position: Vec3Tuple;
  readonly color: string;
}

/**
 * Atlasエントリから data/dangerZones.ts 互換の形状を生成する（実証用、未配線）。
 * category が nerve/vascular かつ dangerLevel==='critical' かつ legacyIds.dangerZoneId を
 * 持つエントリのみ対象。将来的に dangerZones.ts をAtlas由来の生成データへ置き換える際の
 * 足がかりとして用意した（本Phaseでは dangerZones.ts 自体は変更しない）。
 */
export function toLegacyDangerZoneShape(entry: EarAtlasEntry): LegacyDangerZoneShape | null {
  if (entry.dangerLevel !== 'critical') return null;
  if (entry.category !== 'nerve' && entry.category !== 'vascular') return null;
  if (!entry.legacyIds?.dangerZoneId || !entry.positionWorld) return null;
  return {
    id: entry.legacyIds.dangerZoneId,
    nameJa: entry.nameJa,
    nameEn: entry.nameEn,
    category: entry.category === 'nerve' ? 'facial' : 'vascular',
    position: worldToGlbLocal(entry.positionWorld),
    color: entry.color,
  };
}

/**
 * dangerZones.ts の DangerZone.id から、Atlas由来の正しいWORLD座標を取得する（Phase3.1）。
 *
 * Phase3のValidation Foundationで、AnatomyScene.tsx の ENDO_ZONES（内視鏡接近アラート判定座標）
 * の一部が手計算ミスで誤ったWORLD座標を持っていることが判明した（真の変換は
 * `engine/coordinates/transforms.ts` の `glbLocalToWorld()` が正しく、ENDO_ZONES側が誤り）。
 * 本関数はAtlas（Single Source of Truth）→ 正しい変換 で得られる座標を提供し、
 * 手計算による座標入力を置き換えるための橋渡し。対応するAtlasエントリが無い、または
 * positionWorld未設定の場合はnullを返す（呼び出し側は必ずnullチェックし、フォールバックとして
 * 誤った旧ハードコード値を使わないこと）。
 */
export function getEndoZoneCenterWorld(dangerZoneId: string): Vec3Tuple | null {
  const entry = getEarAtlasEntryByDangerZoneId(dangerZoneId);
  return entry?.positionWorld ?? null;
}
