/**
 * engine/learnerApplication/index.ts ─── Learner Application Layer バレル (Phase13.1〜13.5)
 *
 * `TeachingNoteActionView`/`CaseActionView`/`LearnerApplicationView`型（types.ts）+
 * `deriveLearnerApplicationView`（view.ts）を公開する。`noteResolve.ts`の
 * `deriveTeachingNoteActionViews`・`caseResolve.ts`の`deriveCaseActionViews`は`view.ts`内部
 * でのみ使用する組み立て部品であり、このバレルからは意図的にexportしない（公開APIは
 * `deriveLearnerApplicationView`1関数のみ、設計書§7で確定・
 * `engine/adaptiveLearning/index.ts`(Phase12)と同じ方針）。
 * Phase13.5で`selfCheck.ts`（開発時自己診断、7項目）を追加した。`engine/education/selfCheck.ts`
 * （Phase6.3）等と同じ理由でこのバレルからは意図的にexportしない（公開APIの一部ではなく
 * 開発時専用の副作用ファイル）。これでPhase13設計書のSmall Change分割案（13.1〜13.5）の実装が
 * すべて完了した。
 *
 * 本ファイルも他のシーン・App.tsx・storeからは一切importされていない（Phase1〜12と同じ方針、
 * Strangler Pattern継続）。
 */
export type { TeachingNoteActionView, CaseActionView, LearnerApplicationView } from './types';
export { deriveLearnerApplicationView } from './view';
