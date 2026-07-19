/**
 * engine/interactionLogging/resolve.ts ─── StructureKey→teachingNoteId逆引き (Phase15.1)
 *
 * `Phase15_InteractionLoggingLayer_API設計_v1.0.md`（shojiさん確認中）§1・§2.1の実装。
 * `AnatomyScene`/`LearningMode`（既存UI）が3D構造物クリック時に渡す`StructureKey`
 * （文字列として受け取る。`scenes/models/RealAnatomyModels.tsx`の型はengine層からは
 * importしない、既存の層分離方針を継続）を、Ear Atlas（Phase2凍結）の公開API
 * `getEarAtlasEntriesByStructureKey()`でそのままEar Atlas id（teachingNoteId）へ変換する
 * だけの薄い橋渡し。新しい逆引きロジックは実装しない（Ear Atlas側に既存の対応表
 * `EarAtlasEntry.legacyIds.structureKey`が既にあるため）。
 *
 * 1つの`structureKey`が複数のEar Atlasエントリに対応しうる（例:`'facialNerve'`→顔面神経
 * 3区間）ため、戻り値は配列。対応するエントリが1件も無い場合は空配列を返す（例外を投げない、
 * Phase1〜14と統一したnullポリシー）。
 */
import { getEarAtlasEntriesByStructureKey } from '../../data/earAtlas/query';

/**
 * `structureKey`に対応するEar Atlas id（teachingNoteId）の配列を返す。
 * `getEarAtlasEntriesByStructureKey()`（Ear Atlas公開API）への1行の橋渡しのみ。
 */
export function resolveTeachingNoteIdsByStructureKey(structureKey: string): readonly string[] {
  return getEarAtlasEntriesByStructureKey(structureKey).map((entry) => entry.id);
}
