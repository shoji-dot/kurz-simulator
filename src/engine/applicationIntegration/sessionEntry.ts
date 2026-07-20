/**
 * engine/applicationIntegration/sessionEntry.ts ─── Learning Flow入口 (Phase14.1、Phase15.5でBreaking Change)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§3・§4の実装。
 * 既存SimulationModeの症例完了イベントを起点に、Learning Session Layer（Phase9凍結）の
 * `createSession()`で`LearningSession`を組み立てる。
 *
 * 【Phase15.5 Breaking Change（shojiさん承認済み、2026-07-18、Issue-022最終解決）】
 * Phase14.1時点では`buildCaseTeachingBundle(caseId).relatedNotes`を全件`appendTeachingNoteId()`
 * していたが、これが原因で`teachingNoteIds`＝`relatedNotes`が常に恒等的に成立してしまい、
 * `engine/assessment`の`weaknesses`（=`relatedNotes − teachingNoteIds`）が数学的に常に空集合に
 * なる構造的な問題があった（`Issue-022_LearningSession_TeachingNoteIds_Semantics.md`参照）。
 * Phase15（Interaction Logging/Learning Evidence Layer）でInteraction Evidenceを追加しても、
 * `teachingNoteIds`は「全件＋α」の一方向にしか変化しないため、この問題はPhase15.1〜15.4の
 * 範囲では解決できないことが判明した（`Phase15.5_...実装レビュー_2026-07-18.md`参照）。
 *
 * **Issue-022候補1「実際に学習者が確認・操作した教材のみを記録する」を正式採用**し、本関数からは
 * `relatedNotes`の自動全件追加を廃止した。`teachingNoteIds`は空のまま返し、実際の中身は
 * 呼び出し側（`SimulationMode.tsx`）が`appendLearningEvidenceToSession()`（Phase15.3）で
 * Interaction Evidence（Phase15.2 `useLearningEvidenceStore`）のみを追加する。
 *
 * `engine/assessment/assess.ts`（Phase10.4、無変更）は`session.caseId`から`relatedNoteIds`を
 * 独自に`buildCaseTeachingBundle()`で取得しており、本関数の`teachingNoteIds`とは独立して
 * `relatedNoteIds`を得る設計だったため、Assessment Layer側は一切変更不要だった
 * （Phase10.4実装時点で既にこの設計になっていたことをPhase15.5調査で確認済み）。
 *
 * AI Tutor（Phase8）には依存しない（`appendMessage()`は今回使わない。`LearningSession.messages`
 * は空配列のままでもPhase9/Phase10の公開API上は有効な入力である、設計書§0-3/§0-4で確認済み）。
 */
import { createSession } from '../learningSession';
import type { LearningSession } from '../learningSession';
import type { CaseCompletionInput } from './types';

/**
 * 症例完了イベントの入力から`LearningSession`を組み立てる。`teachingNoteIds`は空のまま返す
 * （Phase15.5より。Case Generator由来の教材自動追加は廃止、実際の中身は呼び出し側が
 * `appendLearningEvidenceToSession()`でInteraction Evidenceのみを追加する）。
 */
export function createSessionFromCaseCompletion(input: CaseCompletionInput): LearningSession {
  return createSession({
    id: input.sessionId,
    startedAt: input.startedAt,
    caseId: input.caseId,
  });
}
