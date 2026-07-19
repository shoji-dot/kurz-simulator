/**
 * engine/applicationIntegration/recommendationEntry.ts ─── Recommendation接続 (Phase14.3)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§4の実装。
 * `assessmentEntry.ts`（Phase14.2）が得た`AssessmentResult`を、Recommendation Layer
 * （Phase11凍結）の`recommend()`へそのまま渡し`RecommendationResult`を得るだけの橋渡し。
 *
 * 【本ファイルが追加しないもの（shojiさんPhase14.2レビュー所見と同じ方針を継続）】
 * `recommend()`の戻り値をそのまま返すのみで、推薦理由の生成・症例候補の再選定・優先順位の
 * 再計算は一切行わない。Recommendation Layerの内部実装
 * （`weaknessRecommend.ts`/`caseRecommend.ts`）へは依存しない（`../recommendation`公開バレル
 * 経由の`recommend`のみを利用）。
 */
import { recommend } from '../recommendation';
import type { RecommendationResult } from '../recommendation';
import type { AssessmentResult } from '../assessment';

/**
 * `AssessmentResult`から`RecommendationResult`を得る。`recommend()`（Phase11公開API）への
 * 橋渡しのみ。
 */
export function recommendFromAssessment(assessment: AssessmentResult): RecommendationResult {
  return recommend(assessment);
}
