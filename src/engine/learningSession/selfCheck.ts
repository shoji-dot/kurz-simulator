/**
 * engine/learningSession/selfCheck.ts ── 開発時セルフチェック (Phase9.4)
 *
 * Learning Session Layer（Phase9.1〜9.3で確定した公開API）に対する実行時自己診断。
 * `engine/aiTutor/selfCheck.ts`（Phase8.4）等と同じ`if (import.meta.env.DEV)`パターンを踏襲する。
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜8と同じ理由）。
 *
 * 確認する7項目（shojiさんのPhase9.3レビュー所見どおり、Phase8 selfCheck(7項目)と粒度を揃えた）:
 *   1. createSession()の生成内容が設計どおり
 *   2. appendMessage()のイミュータブル性
 *   3. appendTeachingNoteId()の重複排除・順序維持
 *   4. summarizeSession()が件数集計のみを行う
 *   5. 決定論性（同一入力→同一出力）
 *   6. 空セッションでも正常動作する
 *   7. Negative Control（壊れた実装との差異を検証）
 */
import { createSession, appendMessage, appendTeachingNoteId } from './session';
import { summarizeSession } from './summary';
import type { LearningSession, SessionSummary } from './types';
import type { TutorMessage } from '../aiTutor';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function checkCreateSessionBasics(): CheckResult {
  const withCaseId = createSession({ id: 'sc-1', startedAt: 'T0', caseId: 'case-selfcheck' });
  const withoutCaseId = createSession({ id: 'sc-2', startedAt: 'T0' });
  const ok =
    withCaseId.id === 'sc-1' &&
    withCaseId.startedAt === 'T0' &&
    withCaseId.caseId === 'case-selfcheck' &&
    withCaseId.messages.length === 0 &&
    withCaseId.teachingNoteIds.length === 0 &&
    withoutCaseId.caseId === null;
  return { name: 'createSession()の生成内容が設計どおり（caseId省略時はnull）', ok };
}

function checkAppendMessageImmutable(): CheckResult {
  const s0 = createSession({ id: 'sc-3', startedAt: 'T0' });
  const msg: TutorMessage = { role: 'learner', textJa: 'selfCheck用の発言' };
  const s1 = appendMessage(s0, msg);
  const ok = s0.messages.length === 0 && s1.messages.length === 1 && s1.messages[0].textJa === msg.textJa && s1 !== s0;
  return { name: 'appendMessage()がイミュータブル（元のsessionは不変・新オブジェクトを返す）', ok };
}

function checkAppendTeachingNoteIdDedup(): CheckResult {
  const s0 = createSession({ id: 'sc-4', startedAt: 'T0' });
  const s1 = appendTeachingNoteId(s0, 'stapes');
  const s2 = appendTeachingNoteId(s1, 'facial-tympanic');
  const s3 = appendTeachingNoteId(s2, 'stapes'); // 既存id
  const ok =
    s1.teachingNoteIds.join(',') === 'stapes' &&
    s2.teachingNoteIds.join(',') === 'stapes,facial-tympanic' &&
    s3 === s2 && // 重複時は同一参照
    s3.teachingNoteIds.length === 2;
  return { name: 'appendTeachingNoteId()が重複排除・挿入順を維持する', ok };
}

function checkSummarizeSessionIsAggregationOnly(): CheckResult {
  let session = createSession({ id: 'sc-5', startedAt: 'T0', caseId: 'case-x' });
  session = appendMessage(session, { role: 'learner', textJa: 'Q' });
  session = appendMessage(session, { role: 'tutor', textJa: 'A' });
  session = appendTeachingNoteId(session, 'chorda-tympani');
  const summary: SessionSummary = summarizeSession(session);
  const ok =
    summary.sessionId === session.id &&
    summary.caseId === session.caseId &&
    summary.startedAt === session.startedAt &&
    summary.messageCount === session.messages.length &&
    summary.teachingNoteCount === session.teachingNoteIds.length;
  return { name: 'summarizeSession()が件数集計のみを行う（session各フィールドの単純転記と一致）', ok };
}

function checkDeterminism(): CheckResult {
  const input = { id: 'sc-6', startedAt: 'T0', caseId: 'case-y' } as const;
  const a = createSession(input);
  const b = createSession(input);
  const ok = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(summarizeSession(a)) === JSON.stringify(summarizeSession(b));
  return { name: '決定論性（同一入力→同一出力、createSession/summarizeSessionとも）', ok };
}

function checkEmptySessionWorks(): CheckResult {
  const empty = createSession({ id: 'sc-7', startedAt: 'T0' });
  const summary = summarizeSession(empty);
  const ok =
    empty.messages.length === 0 &&
    empty.teachingNoteIds.length === 0 &&
    summary.messageCount === 0 &&
    summary.teachingNoteCount === 0;
  return { name: '空セッションでも正常動作する', ok };
}

function checkNegativeControl(): CheckResult {
  // 意図的に重複排除を行わない「壊れた実装」を手動構築し、本実装との差異を検証する。
  function brokenAppendTeachingNoteId(session: LearningSession, id: string): LearningSession {
    return { ...session, teachingNoteIds: [...session.teachingNoteIds, id] }; // 重複チェックなし
  }
  const s0 = createSession({ id: 'sc-8', startedAt: 'T0' });
  const s1 = appendTeachingNoteId(s0, 'malleus');
  const correct = appendTeachingNoteId(s1, 'malleus'); // 本実装: 重複排除
  const broken = brokenAppendTeachingNoteId(s1, 'malleus'); // 壊れた実装: 重複排除なし
  const ok = correct.teachingNoteIds.length === 1 && broken.teachingNoteIds.length === 2;
  return { name: 'Negative Control（重複排除なしの壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkCreateSessionBasics(),
    checkAppendMessageImmutable(),
    checkAppendTeachingNoteIdDedup(),
    checkSummarizeSessionIsAggregationOnly(),
    checkDeterminism(),
    checkEmptySessionWorks(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[learningSession] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[learningSession] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
