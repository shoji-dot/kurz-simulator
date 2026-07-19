/**
 * engine/learningSession/index.ts ─── Learning Session Layer バレル (Phase9.1〜9.3)
 *
 * LearningSession/SessionSummary型（types.ts）+ createSession/appendMessage/appendTeachingNoteId
 * （session.ts）+ summarizeSession（summary.ts）を公開する。
 * Phase9.1のレビュー時点で「公開APIが出揃うタイミング（9.3完了後）で作成予定」としていたバレルを
 * 本Phaseで新設した。
 * `engine/aiTutor/index.ts`（Phase8）等と同じ理由でselfCheck.ts（Phase9.4予定）はこのバレルからは
 * 意図的にexportしない。
 * 本ファイルも他のシーン・App.tsx・storeからは一切importされていない（Phase1〜8と同じ方針、
 * Strangler Pattern継続）。
 */
export type { LearningSession, SessionSummary } from './types';
export { createSession, appendMessage, appendTeachingNoteId } from './session';
export type { CreateSessionInput } from './session';
export { summarizeSession } from './summary';
