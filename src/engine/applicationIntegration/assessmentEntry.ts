/**
 * engine/applicationIntegration/assessmentEntry.ts ─── Assessment接続 (Phase14.2)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§4の実装。
 * `sessionEntry.ts`（Phase14.1）が組み立てた`LearningSession`を、Assessment Layer
 * （Phase10凍結）の`assessSession()`へそのまま渡し`AssessmentResult`を得るだけの橋渡し。
 *
 * 【本ファイルが追加しないもの（shojiさんPhase14.1レビュー所見「Phase14.2確認ポイント」への
 * 対応）】`assessSession()`の戻り値をそのまま返すのみで、`masteryLevel`の再計算・スコアからの
 * 変換ロジック・`strengths`/`weaknesses`への追加判断は一切行わない。Assessment Layerの内部実装
 * （`mastery.ts`/`compare.ts`）へは依存しない（`../assessment`公開バレル経由の`assessSession`
 * のみを利用）。
 */
import { assessSession } from '../assessment';
import type { AssessmentResult } from '../assessment';
import type { LearningSession } from '../learningSession';

/**
 * `LearningSession`を評価し`AssessmentResult`を返す。`assessSession()`（Phase10公開API）への
 * 橋渡しのみ（オーケストレーションですらない、1関数呼び出しの転送）。
 */
export function assessLearningSession(session: LearningSession): AssessmentResult {
  return assessSession(session);
}
