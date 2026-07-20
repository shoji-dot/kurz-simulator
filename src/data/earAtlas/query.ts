/**
 * data/earAtlas/query.ts ── Ear Atlas クエリ (Phase2)
 *
 * 既存コードからは呼ばれていない（Phase2はAtlas単体の構築のみ、配線はPhase3以降）。
 */
import { EAR_ATLAS_ENTRIES } from './entries';
import type { EarAtlasCategory, EarAtlasDangerLevel, EarAtlasEntry } from './types';

/** idからAtlasエントリを1件取得する。 */
export function getEarAtlasEntry(id: string): EarAtlasEntry | undefined {
  return EAR_ATLAS_ENTRIES.find((e) => e.id === id);
}

/** カテゴリでAtlasエントリを絞り込む。 */
export function listEarAtlasByCategory(category: EarAtlasCategory): readonly EarAtlasEntry[] {
  return EAR_ATLAS_ENTRIES.filter((e) => e.category === category);
}

/** 危険度でAtlasエントリを絞り込む。 */
export function listEarAtlasByDangerLevel(level: EarAtlasDangerLevel): readonly EarAtlasEntry[] {
  return EAR_ATLAS_ENTRIES.filter((e) => e.dangerLevel === level);
}

/** defaultVisible=true のエントリのみ返す。 */
export function listVisibleEarAtlasEntries(): readonly EarAtlasEntry[] {
  return EAR_ATLAS_ENTRIES.filter((e) => e.defaultVisible);
}

/** 指定idの隣接構造物エントリを解決して返す。 */
export function getAdjacentEarAtlasEntries(id: string): readonly EarAtlasEntry[] {
  const entry = getEarAtlasEntry(id);
  if (!entry?.adjacentStructureIds) return [];
  const resolved: EarAtlasEntry[] = [];
  for (const adjId of entry.adjacentStructureIds) {
    const adjEntry = getEarAtlasEntry(adjId);
    if (adjEntry) resolved.push(adjEntry);
  }
  return resolved;
}

/**
 * 既存の StructureKey（RealAnatomyModels.tsx）からAtlasエントリを検索する。
 * StructureKeyは1対多になりうる（例: 'facialNerve' は顔面神経3区間すべてに対応）。
 */
export function getEarAtlasEntriesByStructureKey(structureKey: string): readonly EarAtlasEntry[] {
  return EAR_ATLAS_ENTRIES.filter((e) => e.legacyIds?.structureKey === structureKey);
}

/** 既存の DangerZone.id（data/dangerZones.ts）からAtlasエントリを検索する。 */
export function getEarAtlasEntryByDangerZoneId(dangerZoneId: string): EarAtlasEntry | undefined {
  return EAR_ATLAS_ENTRIES.find((e) => e.legacyIds?.dangerZoneId === dangerZoneId);
}
/**
 * 全Atlasエントリをそのまま返す(Phase4.1 engine/spatial から呼ばれる想定)。
 * カテゴリ等での絞り込みを行わない生のリストが必要な呼び出し側向け。
 */
export function listAllEarAtlasEntries(): readonly EarAtlasEntry[] {
  return EAR_ATLAS_ENTRIES;
}
