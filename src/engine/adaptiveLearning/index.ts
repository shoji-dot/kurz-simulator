/**
 * engine/adaptiveLearning/index.ts ─── Adaptive Learning Layer バレル (Phase12.1〜12.4)
 *
 * `LearningHistoryEntry`/`LearningHistory`/`AdaptiveLearningPlan`型（types.ts）+
 * `deriveAdaptiveLearningPlan`（plan.ts）を公開する。`aggregate.ts`の
 * `derivePriorityTeachingNoteIds`/`deriveRepeatPracticeIds`・`caseRecommend.ts`の
 * `deriveRecommendedCaseIds`は`plan.ts`内部でのみ使用する組み立て部品であり、このバレルからは
 * 意図的にexportしない（公開APIは`deriveAdaptiveLearningPlan`1関数のみ、設計書§7で確定・
 * `engine/recommendation/index.ts`(Phase11)と同じ方針）。`selfCheck.ts`（Phase12.5予定）も
 * 同じ理由で意図的に未export予定。
 *
 * 本ファイルも他のシーン・App.tsx・storeからは一切importされていない（Phase1〜11と同じ方針、
 * Strangler Pattern継続）。
 */
export type { LearningHistoryEntry, LearningHistory, AdaptiveLearningPlan } from './types';
export { deriveAdaptiveLearningPlan } from './plan';
