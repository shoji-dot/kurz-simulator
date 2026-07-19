/**
 * engine/assessment/index.ts ─── Assessment Layer バレル (Phase10.1〜10.4)
 *
 * `MasteryLevel`/`AssessmentResult`型（types.ts）+ `assessSession`（assess.ts）を公開する。
 * `mastery.ts`の`deriveMasteryLevel`・`compare.ts`の`compareTeachingNotes`/
 * `TeachingNoteComparison`は`assess.ts`内部でのみ使用する組み立て部品であり、このバレルからは
 * 意図的にexportしない（公開APIは`assessSession`1関数のみ、設計書§8で確定・
 * shojiさんPhase10.3レビュー所見どおり）。`selfCheck.ts`（Phase10.5予定）も
 * `engine/learningSession/index.ts`（Phase9）等と同じ理由で意図的に未export。
 *
 * 本ファイルも他のシーン・App.tsx・storeからは一切importされていない（Phase1〜9と同じ方針、
 * Strangler Pattern継続）。
 */
export type { MasteryLevel, AssessmentResult } from './types';
export { assessSession } from './assess';
