/**
 * engine/aiTutor/index.ts ─── AI Tutor バレル (Phase8.1〜8.4)
 *
 * TutorContext等の型（types.ts）+ buildTutorContext（context.ts）+ buildTutorPrompt（prompt.ts）+
 * generateTutorReply（generator.ts）を公開する。
 * Phase8.4でselfCheck.ts（開発時自己診断、Fake Client限定の7項目）を追加した。
 * engine/caseGenerator/selfCheck.ts（Phase7.3）等と同じ理由でこのバレルからは意図的にexportしない。
 * これでPhase8設計書のSmall Change分割案（8.1〜8.4）の実装がすべて完了した。
 * `TutorModelClient`の具体実装（実際のLLM API呼び出し）はPhase8のスコープ外であり、
 * このバレルにも含まれない（呼び出し側がインターフェースを満たす実装を注入する）。
 * 本ファイルも他のシーン・App.tsxからは一切importされていない（Phase1〜7と同じ方針、
 * Strangler Pattern継続）。
 */
export type { TutorRole, TutorMessage, TutorContext, TutorReply, TutorModelClient } from './types';
export { buildTutorContext } from './context';
export type { BuildTutorContextInput } from './context';
export { buildTutorPrompt } from './prompt';
export { generateTutorReply } from './generator';
