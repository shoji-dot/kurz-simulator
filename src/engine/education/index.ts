/**
 * engine/education/index.ts ─── Education Layer バレル (Phase6.1〜6.3)
 *
 * getTeachingNote/findTeachingNotes（notes.ts）+ TeachingNote/LearningPriority型（types.ts）+
 * compareByLearningPriority/rankByLearningPriority（priority.ts）を公開する。
 * Phase6.3でselfCheck.ts（開発時自己診断、7項目）を追加した。engine/validation/selfCheck.ts
 * （Phase3）・engine/spatial/selfCheck.ts（Phase4.6）・engine/query/selfCheck.ts（Phase5.6）と
 * 同じ理由でこのバレルからは意図的にexportしない。
 * これでPhase6設計書のSmall Change分割案（6.1〜6.3）の実装がすべて完了した。
 * 本ファイルも他のシーン・App.tsxからは一切importされていない（Phase1〜5と同じ方針）。
 */
export type { TeachingNote, LearningPriority } from './types';
export { getTeachingNote, findTeachingNotes } from './notes';
export { compareByLearningPriority, rankByLearningPriority } from './priority';
