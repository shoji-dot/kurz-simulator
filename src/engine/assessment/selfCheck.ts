/**
 * engine/assessment/selfCheck.ts ── 開発時セルフチェック (Phase10.5)
 *
 * Assessment Layer（Phase10.1〜10.4で確定した公開API`assessSession`、および内部組み立て部品
 * `deriveMasteryLevel`/`compareTeachingNotes`）に対する実行時自己診断。
 * `engine/learningSession/selfCheck.ts`（Phase9.4）等と同じ`if (import.meta.env.DEV)`パターンを
 * 踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜9と同じ理由。公開APIの一部ではなく
 * 開発時専用の副作用ファイル）。
 *
 * 確認する7項目（shojiさんのPhase10.4レビュー所見どおり）:
 *   1. Activity Score境界（BEGINNER_THRESHOLD/PROFICIENT_THRESHOLDちょうどの判定）
 *   2. caseId=null（単発質問セッション）でstrengths/weaknessesともに空配列
 *   3. Unknown case（buildCaseTeachingBundle失敗）でもcaseIdは保持されstrengths/weaknessesは空配列
 *   4. strengths∪weaknesses=relatedNotes
 *   5. strengths∩weaknesses=∅
 *   6. 決定論性（同一sessionに対しassessSession()を複数回呼んでも同一出力）
 *   7. Negative Control（参照判定を行わない壊れた実装との差異を検出できる）
 */
import { createSession, appendMessage, appendTeachingNoteId } from '../learningSession';
import type { SessionSummary } from '../learningSession';
import { buildCaseTeachingBundle } from '../caseGenerator';
import { assessSession } from './assess';
import { deriveMasteryLevel, BEGINNER_THRESHOLD, PROFICIENT_THRESHOLD } from './mastery';
import { compareTeachingNotes } from './compare';
import type { AssessmentResult } from './types';

// data/cases.tsに実在するid（Case Generator/AI Tutor selfCheck.ts・実装レビューでも使用実績あり）。
const KNOWN_CASE_ID = 'case-001';
const UNKNOWN_CASE_ID = '__selfcheck_unknown_case_id__';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function makeFakeSummary(messageCount: number, teachingNoteCount: number): SessionSummary {
  return { sessionId: 'sc-fake', caseId: null, messageCount, teachingNoteCount, startedAt: 'T0' };
}

function checkActivityScoreBoundary(): CheckResult {
  const belowBeginner = deriveMasteryLevel(makeFakeSummary(BEGINNER_THRESHOLD - 1, 0));
  const atBeginnerThreshold = deriveMasteryLevel(makeFakeSummary(BEGINNER_THRESHOLD, 0));
  const belowProficient = deriveMasteryLevel(makeFakeSummary(PROFICIENT_THRESHOLD - 1, 0));
  const atProficientThreshold = deriveMasteryLevel(makeFakeSummary(PROFICIENT_THRESHOLD, 0));
  const ok =
    belowBeginner === 'beginner' &&
    atBeginnerThreshold === 'developing' &&
    belowProficient === 'developing' &&
    atProficientThreshold === 'proficient';
  return { name: 'Activity Score境界（BEGINNER_THRESHOLD/PROFICIENT_THRESHOLDちょうどの判定）', ok };
}

function checkCaseIdNullYieldsEmptyStrengthsWeaknesses(): CheckResult {
  let session = createSession({ id: 'sc-assess-1', startedAt: 'T0' }); // caseId省略→null
  session = appendTeachingNoteId(session, 'ossicle.malleus');
  const result = assessSession(session);
  const ok =
    result.caseId === null &&
    result.strengths.length === 0 &&
    result.weaknesses.length === 0 &&
    result.assessedTeachingNoteIds.join(',') === 'ossicle.malleus';
  return { name: 'caseId=null（単発質問セッション）でstrengths/weaknessesともに空配列', ok };
}

function checkUnknownCaseYieldsEmptyStrengthsWeaknesses(): CheckResult {
  const session = createSession({ id: 'sc-assess-2', startedAt: 'T0', caseId: UNKNOWN_CASE_ID });
  const result = assessSession(session);
  const ok = result.caseId === UNKNOWN_CASE_ID && result.strengths.length === 0 && result.weaknesses.length === 0;
  return { name: '未知のcaseId（buildCaseTeachingBundle失敗）でもcaseIdは保持されstrengths/weaknessesは空配列', ok };
}

/** #4/#5共通のセットアップ。既知症例(case-001)の一部教材のみを参照したsessionを評価する。 */
function buildKnownCasePartitionFixture(): { result: AssessmentResult; expectedRelated: readonly string[] } {
  let session = createSession({ id: 'sc-assess-3', startedAt: 'T0', caseId: KNOWN_CASE_ID });
  session = appendTeachingNoteId(session, 'ossicle.malleus'); // relatedNotesの一部のみ参照
  const result = assessSession(session);
  const bundle = buildCaseTeachingBundle(KNOWN_CASE_ID);
  const expectedRelated = (bundle?.relatedNotes ?? []).map((n) => n.entry.id);
  return { result, expectedRelated };
}

function checkStrengthsUnionWeaknessesEqualsRelatedNotes(): CheckResult {
  const { result, expectedRelated } = buildKnownCasePartitionFixture();
  const union = [...result.strengths, ...result.weaknesses].sort();
  const expectedSorted = [...expectedRelated].sort();
  const ok = expectedRelated.length > 0 && union.length === expectedSorted.length && union.every((id, i) => id === expectedSorted[i]);
  return { name: 'strengths∪weaknesses=relatedNotes（症例に関連する教材を過不足なく分類）', ok };
}

function checkStrengthsIntersectionWeaknessesIsEmpty(): CheckResult {
  const { result } = buildKnownCasePartitionFixture();
  const ok = result.strengths.every((id) => !result.weaknesses.includes(id));
  return { name: 'strengths∩weaknesses=∅（同一idが両方に現れない）', ok };
}

function checkDeterminism(): CheckResult {
  let session = createSession({ id: 'sc-assess-4', startedAt: 'T0', caseId: KNOWN_CASE_ID });
  session = appendTeachingNoteId(session, 'ossicle.stapes');
  session = appendMessage(session, { role: 'learner', textJa: '質問' });
  const a = assessSession(session);
  const b = assessSession(session);
  const ok = JSON.stringify(a) === JSON.stringify(b);
  return { name: '決定論性（同一sessionに対しassessSession()を複数回呼んでも同一出力）', ok };
}

function checkNegativeControl(): CheckResult {
  // 意図的に参照判定を行わない「壊れた実装」を手動構築し、本実装との差異を検証する。
  function brokenCompareTeachingNotes(
    relatedNoteIds: readonly string[],
    referencedTeachingNoteIds: readonly string[],
  ): { strengths: readonly string[]; weaknesses: readonly string[] } {
    void referencedTeachingNoteIds; // 参照済みかどうかを一切見ない壊れた実装
    return { strengths: [], weaknesses: [...relatedNoteIds] };
  }
  const related = ['ossicle.malleus', 'ossicle.incus', 'ossicle.stapes'];
  const referenced = ['ossicle.malleus'];
  const correct = compareTeachingNotes(related, referenced);
  const broken = brokenCompareTeachingNotes(related, referenced);
  const ok =
    correct.strengths.length === 1 &&
    correct.strengths[0] === 'ossicle.malleus' &&
    broken.strengths.length === 0 &&
    broken.weaknesses.length === 3;
  return { name: 'Negative Control（参照判定を行わない壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkActivityScoreBoundary(),
    checkCaseIdNullYieldsEmptyStrengthsWeaknesses(),
    checkUnknownCaseYieldsEmptyStrengthsWeaknesses(),
    checkStrengthsUnionWeaknessesEqualsRelatedNotes(),
    checkStrengthsIntersectionWeaknessesIsEmpty(),
    checkDeterminism(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[assessment] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[assessment] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
