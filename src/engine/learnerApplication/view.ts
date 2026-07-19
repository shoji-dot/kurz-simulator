/**
 * engine/learnerApplication/view.ts ─── deriveLearnerApplicationView()本体 (Phase13.4)
 *
 * Phase13_LearnerApplicationLayer_API設計_v1.0.md（shojiさん承認済み）§7・§13の実装。
 * `deriveLearnerApplicationView()`はLearner Application Layer唯一の公開関数であり、Phase13.2
 * （`noteResolve.ts`）・Phase13.3（`caseResolve.ts`）を組み合わせるオーケストレーションのみを
 * 行う。**新しい判断ロジックはここに追加しない**（`adaptiveLearning/plan.ts`(Phase12.4)と
 * 同じ設計方針。shojiさんPhase13.3レビュー所見「Phase13.4はオーケストレーションのみ」に対応）。
 *
 * 【追加していないもの（shojiさんPhase13.3レビュー所見どおり）】新しい推薦判断・priority再計算・
 * repeat判定・case探索・ソート・filterルール変更・UI callback・navigation・store導入は一切
 * 行わない。`AdaptiveLearningPlan`（Phase12公開型）の3項目をそれぞれ対応するresolve関数へ
 * 委譲し、結果を`LearnerApplicationView`として組み立てるだけの3行の変換に徹する。
 *
 * Compatibility Policy（設計書§4「deriveLearnerApplicationView()は完全に決定論的」）: 本ファイル
 * が行うのは①`deriveTeachingNoteActionViews(plan.priorityTeachingNoteIds)`への委譲
 * ②`deriveTeachingNoteActionViews(plan.repeatPracticeIds)`への委譲
 * ③`deriveCaseActionViews(plan.recommendedCaseIds)`への委譲 ④`LearnerApplicationView`
 * オブジェクトの組み立て、の4点のみ。各resolve関数が返す配列の要素順序はいずれも変更しない。
 */
import type { AdaptiveLearningPlan } from '../adaptiveLearning';
import type { LearnerApplicationView } from './types';
import { deriveTeachingNoteActionViews } from './noteResolve';
import { deriveCaseActionViews } from './caseResolve';

/**
 * `AdaptiveLearningPlan`（Adaptive Learning Layer公開型、Phase12）を入力として
 * `LearnerApplicationView`を返す（Learner Application Layer唯一の公開関数）。
 *
 * `plan`の3項目がすべて空配列の場合は、`LearnerApplicationView`の3項目も空配列（各resolve
 * 関数自身の境界条件処理に委譲、本関数では追加の分岐を持たない）。完全に決定論的（同一`plan`→
 * 常に同一`LearnerApplicationView`、設計書§4）。
 */
export function deriveLearnerApplicationView(plan: AdaptiveLearningPlan): LearnerApplicationView {
  return {
    priorityTeachingNotes: deriveTeachingNoteActionViews(plan.priorityTeachingNoteIds),
    repeatPracticeNotes: deriveTeachingNoteActionViews(plan.repeatPracticeIds),
    recommendedCases: deriveCaseActionViews(plan.recommendedCaseIds),
  };
}
