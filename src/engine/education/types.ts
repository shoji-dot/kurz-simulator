/**
 * engine/education/types.ts ─── Education Layer 型定義 (Phase6.1)
 *
 * Phase6_EducationLayer_API設計_v1.0.md（shojiさん承認済み 2026-07-17、評価A）の実装。
 * Query Engine（Phase5凍結済み）を唯一の入力とし、Ear Atlas・Spatial Engineへは直接依存しない。
 * 既存ファイルは一切変更しない（Phase1〜5と同じStrangler Pattern）。
 */
import type {
  EarAtlasEntry,
  EarAtlasDangerLevel,
  EarAtlasSourceTag,
  EarAtlasVerificationMethod,
} from '../../data/earAtlas/types';

/**
 * 教育情報の最小単位。EarAtlasEntryが持つ非幾何の教育関連フィールドをそのまま転記するのみで、
 * Education Layer独自の新しい教育コンテンツは捏造しない（Phase5設計書「推測値・独自ランキングを
 * 捏造しない」方針と同じ考え方）。
 *
 * 【entryを丸ごと保持する設計について】Phase7で`CaseTeachingNote`等が増えた場合にflatten化
 * （id/category等を個別フィールドへ展開）する余地はあるが、Phase6は「Query Engineのラッパ」
 * であり、無理にflattenするとフィールドコピーの分だけ責務が増える。現時点では現状維持とする
 * （Phase6.1レビュー所見、2026-07-17）。
 */
export interface TeachingNote {
  readonly entry: EarAtlasEntry;
  /** entry.educationCommentJaが未設定の場合はnull（Phase1〜5と統一したnullポリシー）。 */
  readonly commentJa: string | null;
  readonly sourceTag: EarAtlasSourceTag;
  readonly lastVerifiedMethod: EarAtlasVerificationMethod;
  readonly dangerLevel: EarAtlasDangerLevel;
  /** dangerLevelから機械的に導出する学習優先度。詳細は`LearningPriority`のコメント参照。 */
  readonly learningPriority: LearningPriority;
}

/**
 * 学習優先度。
 *
 * 暫定値。
 * Ear Atlasが教育的重要度を保持していないため、
 * dangerLevelをそのまま代理指標として利用する
 * （critical→high, caution→medium, safe→low の機械的な変換のみ）。
 *
 * 教育的重要度そのものではない。医学的重要度でもない。
 *
 * 将来Atlas側に真の教育的重要度フィールドが追加された場合は、その時点で本値の導出方法を
 * 見直す（Breaking Changeとして扱い、Phase6凍結文書で正式化する）。
 */
export type LearningPriority = 'high' | 'medium' | 'low';
