/**
 * engine/caseGenerator/index.ts ─── Case Generator バレル (Phase7.1〜7.3)
 *
 * getCase/findCases（library.ts）+ buildCaseTeachingBundle（bundler.ts）+ CaseTeachingBundle型
 * （types.ts）を公開する。internal/caseMappings.tsは非公開実装のためexportしない。
 * Phase7.3でselfCheck.ts（開発時自己診断、7項目）を追加した。engine/education/selfCheck.ts
 * （Phase6.3）等と同じ理由でこのバレルからは意図的にexportしない。
 * これでPhase7設計書のSmall Change分割案（7.1〜7.3）の実装がすべて完了した。
 * 本ファイルも他のシーン・App.tsxからは一切importされていない（Phase1〜6と同じ方針。
 * 既存シーン・症例UIとの配線は本Phaseの対象外、Strangler Pattern継続）。
 */
export type { CaseTeachingBundle } from './types';
export { getCase, findCases } from './library';
export { buildCaseTeachingBundle } from './bundler';
