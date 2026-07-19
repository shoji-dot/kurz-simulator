/**
 * engine/recommendation/types.ts ─── Recommendation Layer 型定義 (Phase11.1)
 *
 * Phase11_RecommendationLayer_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）§6の実装。
 * Assessment Layer（Phase10凍結済み）が返した`AssessmentResult`を入力として評価するための
 * 型のみを定義する。ロジックは持たない（型定義のみ、Phase11.1のスコープ）。
 *
 * 【Compatibility Policy（設計書§4・shojiさんレビューで確定）】Recommendation Layerはルール
 * ベースの集合演算・優先順位付けのみを行い、AIによる推薦文生成・LLM呼び出し・確率的判断は行わない。
 * 核心は「AIを使わない」という手段の制約ではなく、`recommend()`（Phase11.4予定）が**完全に
 * 決定論的**であること（同一の`AssessmentResult`→常に同一の`RecommendationResult`）。
 */

/**
 * `RecommendationResult.reasons`の1要素。推奨理由の根拠を表す。
 *
 * 【本質はkind+対象idであり、messageJaはUI表示用の補助情報（設計書§5-3・§6）】将来の
 * 多言語化・音声読み上げ等ではkind+対象idから表示文言を再構築する設計とする。messageJa自体を
 * Single Source of Truthにしない。
 */
export interface RecommendationReason {
  /**
   * 推奨理由の種別。'weakness'=Assessment Layerのweaknesses由来、'relatedCase'=症例由来。
   *
   * 【将来の非破壊的拡張を前提とする（shojiさんPhase11.1レビュー所見）】'mastery'/'review'/
   * 'prerequisite'等のkindが将来非破壊的に追加される可能性がある。利用側は未知のkindを
   * エラーとせず無視可能であることを前提とする。
   */
  readonly kind: 'weakness' | 'relatedCase';
  /** kind='weaknessの場合に対応するTeachingNoteのid。 */
  readonly teachingNoteId?: string;
  /** kind='relatedCaseの場合に対応するSurgicalCaseのid。 */
  readonly caseId?: string;
  /**
   * UI表示用の補助情報（定型文言）。本質はkind+対象idであり、messageJaはあくまで表示用の
   * テンプレート文言（設計書§5-3・§6参照、messageJa自体をSSoTにしない）。
   */
  readonly messageJa: string;
}

/**
 * `recommend()`（Phase11.4予定）の戻り値。単一の`AssessmentResult`に対する推奨結果。
 *
 * 【責務の境界（設計書§1・§2）】RecommendationResultは「次はこちらです」という提案のみを返す。
 * 「あなたは今ここです」という現状の評価（masteryLevel・strengths・weaknesses自体の算出）は
 * Assessment Layer（Phase10凍結済み）の責務であり、この型には含めない。
 */
export interface RecommendationResult {
  /** AssessmentResult.sessionIdの転記。 */
  readonly sessionId: string;
  /** AssessmentResult.caseIdの転記。 */
  readonly caseId: string | null;
  /**
   * 推奨教材のid。= assessment.weaknessesの単純転記（設計書§5-1で確定、Recommendationは
   * 新たな絞り込みを行わない）。
   */
  readonly recommendedTeachingNoteIds: readonly string[];
  /**
   * 推奨症例のid。Case Generator公開APIを利用して抽出する（設計書§5-2で確定、具体的な
   * アルゴリズムは非仕様。`caseId`に紐づく症例に関連する教材のうちweaknessesと重なるものを
   * 持つ、他の症例のidを想定）。
   */
  readonly recommendedCaseIds: readonly string[];
  /** 推奨理由の一覧。 */
  readonly reasons: readonly RecommendationReason[];
}
