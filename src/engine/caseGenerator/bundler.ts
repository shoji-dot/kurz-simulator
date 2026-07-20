/**
 * engine/caseGenerator/bundler.ts ─── Case Generator Bundler層 (Phase7.2)
 *
 * Education Layer（公開APIのみ、`../education`バレル経由）のTeachingNoteとCase Library
 * （`./library.ts`）のSurgicalCaseを組み合わせてCaseTeachingBundleを構築する純粋関数のみを持つ。
 * 状態・キャッシュ・メモ化は持たない（Phase5・Phase6と同じ状態管理方針）。
 */
import { findTeachingNotes } from '../education';
import { getCase } from './library';
import { OSSICLE_KEY_TO_EAR_ATLAS_ID } from './internal/caseMappings';
import type { CaseTeachingBundle } from './types';

const RELATED_EAR_ATLAS_IDS = new Set<string>(Object.values(OSSICLE_KEY_TO_EAR_ATLAS_ID));

/**
 * caseIdからCaseTeachingBundleを構築する。relatedNotesは`caseMappings.ts`の静的対応表
 * （malleus/incus/stapesの3id固定）を`findTeachingNotes({ visibleIds })`（Education Layer公開API）
 * へそのまま渡した結果のみを使う。危険度判定・関連度の取捨選択はEducation Layer側に委譲し、
 * Case Generatorはここでは組み立て以外のことをしない。caseIdが存在しない場合はnull。
 */
export function buildCaseTeachingBundle(caseId: string): CaseTeachingBundle | null {
  const surgicalCase = getCase(caseId);
  if (!surgicalCase) return null;

  const relatedNotes = findTeachingNotes({ visibleIds: RELATED_EAR_ATLAS_IDS });
  return { surgicalCase, relatedNotes };
}
