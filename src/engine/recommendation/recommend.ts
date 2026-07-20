/**
 * engine/recommendation/recommend.ts ─── recommend()本体 (Phase11.4)
 *
 * Phase11_RecommendationLayer_API設計_v1.0.md（shojiさん承認済み）§7の実装。
 * `recommend()`は唯一の公開関数であり、Phase11.2（`weaknessRecommend.ts`）・Phase11.3
 * （`caseRecommend.ts`）を組み合わせるオーケストレーションのみを行う。**新しい判断ロジックは
 * ここに追加しない**（shojiさんPhase11.3レビュー所見:
 * 「recommend()が11.2と11.3の純粋なオーケストレーションに徹していること」）。
 *
 * Compatibility Policy（設計書§4「recommend()は完全に決定論的」）: 本ファイルが行うのは
 * ①`deriveWeaknessRecommendations()`への委譲 ②`deriveCaseRecommendations()`への委譲
 * ③`RecommendationResult`オブジェクトの組み立て（`reasons`は`weakness`由来を先、`relatedCase`
 * 由来を後という固定順で連結）、の3点のみ。両ヘルパーが返す配列の要素順序をいずれも変更しない
 * （ソート・`Set`による再整列は行わない）。
 */
import type { AssessmentResult } from '../assessment';
import type { RecommendationResult } from './types';
import { deriveWeaknessRecommendations } from './weaknessRecommend';
import { deriveCaseRecommendations } from './caseRecommend';

/**
 * 単一の`AssessmentResult`を入力として`RecommendationResult`を返す
 * （Recommendation Layer唯一の公開関数）。
 *
 * `sessionId`/`caseId`は`assessment`からの単純転記（新たな判断を加えない）。
 * `reasons`は`weaknessRecommend`由来（`kind:'weakness'`）を先、`caseRecommend`由来
 * （`kind:'relatedCase'`）を後という固定順で連結する（決定論性を保つため、この連結順序自体も
 * 観測可能な振る舞いとして扱う）。
 */
export function recommend(assessment: AssessmentResult): RecommendationResult {
  const weakness = deriveWeaknessRecommendations(assessment);
  const relatedCase = deriveCaseRecommendations(assessment);

  return {
    sessionId: assessment.sessionId,
    caseId: assessment.caseId,
    recommendedTeachingNoteIds: weakness.recommendedTeachingNoteIds,
    recommendedCaseIds: relatedCase.recommendedCaseIds,
    reasons: [...weakness.reasons, ...relatedCase.reasons],
  };
}
