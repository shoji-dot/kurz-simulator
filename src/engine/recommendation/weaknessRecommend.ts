/**
 * engine/recommendation/weaknessRecommend.ts ─── weaknesses由来の推奨算出 (Phase11.2)
 *
 * Phase11_RecommendationLayer_API設計_v1.0.md（shojiさん承認済み）§5-1・§10の実装。
 * `AssessmentResult.weaknesses`（Phase10公開API由来の事実）を推奨教材としてそのまま転記し、
 * 対応する推奨理由（`RecommendationReason[]`）を同じ順序で生成する。
 *
 * 【決定論性の維持（設計書§4 Compatibility Policy・shojiさんPhase11.1レビュー所見）】
 * `recommend()`（Phase11.4予定）が完全に決定論的であるためには、本関数もソート・`Set`等による
 * 順序変更を一切行わず、`assessment.weaknesses`の順序をそのまま`recommendedTeachingNoteIds`/
 * `reasons`へ引き継ぐ必要がある。
 */
import type { AssessmentResult } from '../assessment';
import type { RecommendationReason } from './types';

export interface WeaknessRecommendation {
  readonly recommendedTeachingNoteIds: readonly string[];
  readonly reasons: readonly RecommendationReason[];
}

/**
 * `assessment.weaknesses`をそのまま推奨教材として転記し（設計書§5-1で確定、新たな絞り込みは
 * 行わない）、各idに対応する`kind: 'weakness'`の推奨理由を同じ順序で生成する。
 *
 * 【戻り値の`recommendedTeachingNoteIds`は`assessment.weaknesses`と同一参照であり、コピーでは
 * ない】新しい配列を作らずそのまま返す（`readonly`のため安全、Phase9の`appendTeachingNoteId()`
 * 重複時と同じ考え方）。将来「親切だから」とコピーへ変更しないこと（shojiさんPhase11.2レビュー
 * 所見）。
 */
export function deriveWeaknessRecommendations(assessment: AssessmentResult): WeaknessRecommendation {
  const recommendedTeachingNoteIds = assessment.weaknesses;
  const reasons: readonly RecommendationReason[] = assessment.weaknesses.map((teachingNoteId) => ({
    kind: 'weakness',
    teachingNoteId,
    messageJa: '症例に関連する教材のうち、まだ参照していないものがあります。',
  }));
  return { recommendedTeachingNoteIds, reasons };
}
