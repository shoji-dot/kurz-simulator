/**
 * engine/applicationIntegration/adaptivePlanEntry.ts ─── Adaptive Plan接続 (Phase14.3)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§4の実装。
 * 蓄積された`LearningHistory`（呼び出し側=Application側のstoreが保持、本ファイルは知らない）を
 * Adaptive Learning Layer（Phase12凍結）の`deriveAdaptiveLearningPlan()`へそのまま渡し
 * `AdaptiveLearningPlan`を得るだけの橋渡し。
 *
 * 【本ファイルが追加しないもの】新しい優先順位付け・学習計画の独自生成ロジックは一切行わない。
 * Adaptive Learning Layerの内部実装（`aggregate.ts`/`caseRecommend.ts`/`plan.ts`）へは依存せず、
 * `../adaptiveLearning`公開バレル経由の`deriveAdaptiveLearningPlan`のみを利用する。
 */
import { deriveAdaptiveLearningPlan } from '../adaptiveLearning';
import type { AdaptiveLearningPlan, LearningHistory } from '../adaptiveLearning';

/**
 * `LearningHistory`から`AdaptiveLearningPlan`を得る。`deriveAdaptiveLearningPlan()`
 * （Phase12公開API）への橋渡しのみ。
 */
export function deriveAdaptivePlan(history: LearningHistory): AdaptiveLearningPlan {
  return deriveAdaptiveLearningPlan(history);
}
