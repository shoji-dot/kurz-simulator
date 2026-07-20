/**
 * engine/recommendation/index.ts ─── Recommendation Layer バレル (Phase11.1〜11.4)
 *
 * `RecommendationReason`/`RecommendationResult`型（types.ts）+ `recommend`（recommend.ts）を
 * 公開する。`weaknessRecommend.ts`の`deriveWeaknessRecommendations`・`caseRecommend.ts`の
 * `deriveCaseRecommendations`/`WeaknessRecommendation`/`CaseRecommendation`は`recommend.ts`
 * 内部でのみ使用する組み立て部品であり、このバレルからは意図的にexportしない（公開APIは
 * `recommend`1関数のみ、設計書§7で確定・`engine/assessment/index.ts`(Phase10)と同じ方針）。
 * `selfCheck.ts`（Phase11.5予定）も`engine/assessment/index.ts`(Phase10)等と同じ理由で
 * 意図的に未export。
 *
 * 本ファイルも他のシーン・App.tsx・storeからは一切importされていない（Phase1〜10と同じ方針、
 * Strangler Pattern継続）。
 */
export type { RecommendationReason, RecommendationResult } from './types';
export { recommend } from './recommend';
