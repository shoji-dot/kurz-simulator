/**
 * engine/education/selfCheck.ts ── 開発時セルフチェック (Phase6.3)
 *
 * Education Layer（Phase6.1〜6.2で確定した全公開API）に対する実行時自己診断。
 * engine/validation/selfCheck.ts（Phase3）・engine/spatial/selfCheck.ts（Phase4.6）・
 * engine/query/selfCheck.ts（Phase5.6）と同じ`if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 【注意・重要】本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体は
 * どのシーン・App.tsxからもimportされていない。`index.ts`からも意図的にexportしない
 * （Phase3/4.6/5.6のselfCheck.tsと同じ理由。公開APIの一部ではなく開発時専用の副作用ファイル）。
 *
 * 【スコープ】Phase5.6と同様「重すぎない自己診断」に留める（網羅的なテストスイートではなく、
 * 各層につき代表的な正常系・境界値ケースを1〜数個ずつ）。
 *
 * 確認する7項目:
 *   1. getTeachingNote()の基本動作（実在id/未知id）
 *   2. findTeachingNotes()のcategory/dangerLevel単体絞り込み
 *   3. findTeachingNotes()のvisibleIds省略/undefined明示/空Setの意味の区別（Phase5.2で確定した仕様の継承）
 *   4. learningPriorityの導出（critical→high, caution→medium, safe→low）
 *   5. commentJaがentry.educationCommentJaと一致する（変換のみで新しい文章を生成していないことの確認）
 *   6. compareByLearningPriority()の基本順序
 *   7. rankByLearningPriority()の非破壊性・単調順序
 */
import { getTeachingNote, findTeachingNotes, compareByLearningPriority, rankByLearningPriority } from './index';
import type { TeachingNote } from './types';

const UNKNOWN_ID = '__selfcheck_unknown_id__';

// Ear Atlas収録エントリ（Phase2.1時点で11件）から、各ケースの代表として使うid。
// いずれも data/earAtlas/entries.ts に実在する（Phase5.6 selfCheck.tsと同じ代表idを踏襲）。
const MALLEUS_ID = 'ossicle.malleus'; // dangerLevel='safe' → learningPriority='low'
const STAPES_ID = 'ossicle.stapes'; // dangerLevel='caution' → learningPriority='medium'
const FACIAL_TYMPANIC_ID = 'nerve.facial.tympanic'; // dangerLevel='critical' → learningPriority='high'

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function isMonotonicByLearningPriority(notes: readonly TeachingNote[]): boolean {
  const weight: Readonly<Record<TeachingNote['learningPriority'], number>> = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < notes.length; i++) {
    if (weight[notes[i - 1].learningPriority] > weight[notes[i].learningPriority]) return false;
  }
  return true;
}

function checkGetTeachingNoteBasics(): CheckResult {
  const known = getTeachingNote(MALLEUS_ID);
  const unknown = getTeachingNote(UNKNOWN_ID);

  const ok = known !== null && known.entry.id === MALLEUS_ID && unknown === null;
  return { name: 'getTeachingNote()の基本動作', ok };
}

function checkFindTeachingNotesSingleFilters(): CheckResult {
  const byCategory = findTeachingNotes({ category: 'ossicle' });
  const byDangerLevel = findTeachingNotes({ dangerLevel: 'caution' });

  const ok =
    byCategory.length > 0 &&
    byCategory.every((n) => n.entry.category === 'ossicle') &&
    byDangerLevel.length === 2 &&
    byDangerLevel.every((n) => n.dangerLevel === 'caution');
  return { name: 'findTeachingNotes()のcategory/dangerLevel単体絞り込み', ok };
}

function checkFindTeachingNotesVisibleIdsSemantics(): CheckResult {
  const omitted = findTeachingNotes({});
  const explicitUndefined = findTeachingNotes({ visibleIds: undefined });
  const emptySet = findTeachingNotes({ visibleIds: new Set() });
  const subset = findTeachingNotes({ visibleIds: new Set([MALLEUS_ID]) });

  const ok =
    omitted.length === explicitUndefined.length &&
    omitted.length > 0 &&
    emptySet.length === 0 &&
    subset.length === 1 &&
    subset[0].entry.id === MALLEUS_ID;
  return { name: 'findTeachingNotes()のvisibleIds意味論（undefined=全件、空Set=0件）', ok };
}

function checkLearningPriorityDerivation(): CheckResult {
  const critical = getTeachingNote(FACIAL_TYMPANIC_ID);
  const caution = getTeachingNote(STAPES_ID);
  const safe = getTeachingNote(MALLEUS_ID);

  const ok =
    critical?.learningPriority === 'high' &&
    caution?.learningPriority === 'medium' &&
    safe?.learningPriority === 'low';
  return { name: 'learningPriorityの導出（critical→high/caution→medium/safe→low）', ok };
}

function checkCommentJaMatchesEntry(): CheckResult {
  const note = getTeachingNote(MALLEUS_ID);
  const ok = note !== null && note.commentJa === (note.entry.educationCommentJa ?? null);
  return { name: 'commentJaがentry.educationCommentJaと一致（新規生成なし）', ok };
}

function checkCompareByLearningPriorityBasicOrder(): CheckResult {
  const high = getTeachingNote(FACIAL_TYMPANIC_ID)!;
  const medium = getTeachingNote(STAPES_ID)!;
  const low = getTeachingNote(MALLEUS_ID)!;

  const ok =
    compareByLearningPriority(high, low) < 0 &&
    compareByLearningPriority(low, high) > 0 &&
    compareByLearningPriority(medium, medium) === 0;
  return { name: 'compareByLearningPriority()の基本順序', ok };
}

function checkRankByLearningPriorityNonMutating(): CheckResult {
  const all = findTeachingNotes({});
  const idsBefore = all.map((n) => n.entry.id).join(',');

  const ranked = rankByLearningPriority(all);

  const inputUnchanged = all.map((n) => n.entry.id).join(',') === idsBefore;
  const rankedOk = ranked.length === all.length && isMonotonicByLearningPriority(ranked);
  const firstIsHigh = ranked[0]?.learningPriority === 'high';
  const lastIsLow = ranked[ranked.length - 1]?.learningPriority === 'low';

  const ok = inputUnchanged && rankedOk && firstIsHigh && lastIsLow;
  return { name: 'rankByLearningPriority()の非破壊性・単調順序', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkGetTeachingNoteBasics(),
    checkFindTeachingNotesSingleFilters(),
    checkFindTeachingNotesVisibleIdsSemantics(),
    checkLearningPriorityDerivation(),
    checkCommentJaMatchesEntry(),
    checkCompareByLearningPriorityBasicOrder(),
    checkRankByLearningPriorityNonMutating(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[education] selfCheck FAIL: ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }

  console.info(`[education] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
