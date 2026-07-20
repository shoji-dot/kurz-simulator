/**
 * engine/assessment/assess.ts ─── assessSession()本体 (Phase10.4)
 *
 * Phase10_AssessmentLayer_API設計_v1.0.md（shojiさん承認済み）§8の実装。
 * `assessSession()`は唯一の公開関数であり、Phase10.2（`mastery.ts`）・Phase10.3
 * （`compare.ts`）・Learning Session Layer（Phase9公開API）・Case Generator（Phase7公開API）
 * を組み合わせるオーケストレーションのみを行う。**新しい判断ロジックはここに追加しない**
 * （shojiさんPhase10.3レビュー所見: 「assessSessionはオーケストレーターに徹する」）。
 *
 * Compatibility Policy（設計書§4「解釈するが新たな事実を生成しない」）: 本ファイルが行うのは
 * ①`summarizeSession()`/`deriveMasteryLevel()`への委譲 ②`caseId === null`の場合に
 * `buildCaseTeachingBundle()`を呼ばない分岐 ③`compareTeachingNotes()`への委譲
 * ④`AssessmentResult`オブジェクトの組み立て、の4点のみ。`weaknesses`の件数による分岐等、
 * Recommendation Layer（Phase11）に属する判断は一切含めない。
 */
import { summarizeSession } from '../learningSession';
import type { LearningSession } from '../learningSession';
import { buildCaseTeachingBundle } from '../caseGenerator';
import { deriveMasteryLevel } from './mastery';
import { compareTeachingNotes } from './compare';
import type { AssessmentResult } from './types';

/**
 * 単一の`LearningSession`を評価し、`AssessmentResult`を返す（Assessment Layer唯一の公開関数）。
 *
 * `session.caseId === null`（単発質問セッション）の場合、`buildCaseTeachingBundle()`
 * （Case Generator）を**呼び出さない**（shojiさんPhase10.3レビュー所見:
 * 「nullケースで無駄にBundle生成しない」）。この場合`relatedNoteIds`は空配列となり、
 * `compareTeachingNotes()`は`strengths`/`weaknesses`ともに空配列を返す（設計書§6-3の
 * nullポリシーと一致）。
 */
export function assessSession(session: LearningSession): AssessmentResult {
  const summary = summarizeSession(session);
  const masteryLevel = deriveMasteryLevel(summary);

  const bundle = session.caseId === null ? null : buildCaseTeachingBundle(session.caseId);
  const relatedNoteIds = bundle === null ? [] : bundle.relatedNotes.map((note) => note.entry.id);
  const { strengths, weaknesses } = compareTeachingNotes(relatedNoteIds, session.teachingNoteIds);

  return {
    sessionId: session.id,
    caseId: session.caseId,
    masteryLevel,
    assessedTeachingNoteIds: session.teachingNoteIds,
    strengths,
    weaknesses,
  };
}
