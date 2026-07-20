/**
 * engine/education/notes.ts ─── Education Layer Notes層 (Phase6.1)
 *
 * Query Engine（公開APIのみ、`../query`バレル経由）のEntryを`TeachingNote`へ変換する薄い
 * ラッパーのみを持つ。新しい教育コンテンツ・幾何計算・状態は一切持たない
 * （Phase6設計書の役割分割: Notes = 「Query EngineのEntryをTeachingNoteへ変換する」）。
 */
import { getEntry, findEntries } from '../query';
import type { SemanticFilterOptions } from '../query';
import type { EarAtlasEntry, EarAtlasDangerLevel } from '../../data/earAtlas/types';
import type { TeachingNote, LearningPriority } from './types';

/**
 * dangerLevelからLearningPriorityへの機械的変換のみ。暫定的な代理指標であることは
 * `LearningPriority`型コメント参照。新しい判断基準はここに追加しない。
 */
function deriveLearningPriority(dangerLevel: EarAtlasDangerLevel): LearningPriority {
  switch (dangerLevel) {
    case 'critical':
      return 'high';
    case 'caution':
      return 'medium';
    case 'safe':
      return 'low';
  }
}

/** EarAtlasEntryをTeachingNoteへ変換する。フィールドの転記+learningPriorityの導出のみ。 */
function toTeachingNote(entry: EarAtlasEntry): TeachingNote {
  return {
    entry,
    commentJa: entry.educationCommentJa ?? null,
    sourceTag: entry.sourceTag,
    lastVerifiedMethod: entry.lastVerifiedMethod,
    dangerLevel: entry.dangerLevel,
    learningPriority: deriveLearningPriority(entry.dangerLevel),
  };
}

/** idからTeachingNoteを1件取得する。`getEntry()`の変換ラッパー。存在しない場合はnull。 */
export function getTeachingNote(id: string): TeachingNote | null {
  const entry = getEntry(id);
  return entry ? toTeachingNote(entry) : null;
}

/**
 * category・dangerLevel・shapeType・visibleIdsでTeachingNoteを検索する。`findEntries()`の
 * 変換ラッパー（絞り込みロジックはQuery Engine側のまま、ここでは追加しない）。該当なしは空配列。
 */
export function findTeachingNotes(opts: SemanticFilterOptions): readonly TeachingNote[] {
  return findEntries(opts).map(toTeachingNote);
}
