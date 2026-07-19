/**
 * engine/adaptiveLearning/plan.ts ─── deriveAdaptiveLearningPlan()本体 (Phase12.4)
 *
 * Phase12_AdaptiveLearning_API設計_v1.0.md（shojiさん承認済み）§7・§10の実装。
 * `deriveAdaptiveLearningPlan()`はAdaptive Learning Layer唯一の公開関数であり、Phase12.2
 * （`aggregate.ts`）・Phase12.3（`caseRecommend.ts`）を組み合わせるオーケストレーションのみを
 * 行う。**新しい判断ロジックはここに追加しない**（`recommendation/recommend.ts`(Phase11.4)と
 * 同じ設計方針。shojiさんPhase12.3レビュー所見「12.4では新しい判断ロジックを追加せず、既存の
 * 純粋関数を組み合わせるだけに留める」）。
 *
 * Compatibility Policy（設計書§4「deriveAdaptiveLearningPlan()は完全に決定論的」）: 本ファイルが
 * 行うのは①`derivePriorityTeachingNoteIds()`への委譲 ②`deriveRepeatPracticeIds()`への委譲
 * ③`deriveRecommendedCaseIds()`への委譲 ④`AdaptiveLearningPlan`オブジェクトの組み立て、の4点
 * のみ。各ヘルパーが返す配列の要素順序はいずれも変更しない。
 */
import type { LearningHistory, AdaptiveLearningPlan } from './types';
import { derivePriorityTeachingNoteIds, deriveRepeatPracticeIds } from './aggregate';
import { deriveRecommendedCaseIds } from './caseRecommend';

/**
 * 複数セッション分の`LearningHistory`を入力として`AdaptiveLearningPlan`を返す
 * （Adaptive Learning Layer唯一の公開関数）。
 *
 * `history`が空の場合は3項目とも空配列（各ヘルパー自身の境界条件処理に委譲、本関数では
 * 追加の分岐を持たない）。完全に決定論的（同一`history`→常に同一`AdaptiveLearningPlan`、
 * 設計書§4）。
 */
export function deriveAdaptiveLearningPlan(history: LearningHistory): AdaptiveLearningPlan {
  return {
    priorityTeachingNoteIds: derivePriorityTeachingNoteIds(history),
    repeatPracticeIds: deriveRepeatPracticeIds(history),
    recommendedCaseIds: deriveRecommendedCaseIds(history),
  };
}
