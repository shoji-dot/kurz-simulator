/**
 * engine/assessment/types.ts ─── Assessment Layer 型定義 (Phase10.1)
 *
 * Phase10_AssessmentLayer_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）§7の実装。
 * Learning Session Layer（Phase9凍結済み）が記録した単一セッションを入力として評価するための
 * 型のみを定義する。ロジックは持たない（型定義のみ、Phase10.1のスコープ）。
 *
 * 【Compatibility Policy（設計書§4・shojiさんPhase10.1レビューで追加確定）】Assessment Layerは
 * 入力データを解釈するが、新たな事実を生成しない。許可されるもの: 集計・分類・閾値判定・集合演算。
 * 禁止されるもの: AIによる推論・確率的判断・将来予測・「理解している」と断定する評価。
 */

/**
 * 学習活動量ベースの代理指標（Learning Activity Proxy）。
 *
 * 【重要】この値は`SessionSummary`（Phase9公開API）の量的指標（messageCount/teachingNoteCount）
 * からの機械的な代理指標であり、学習者が実際に理解しているかどうかを測るものではない
 * （例: messageCountが多い学習者が必ずしも理解しているとは限らない）。「理解度」ではなく
 * 「活動量」の代理指標として扱うこと（設計書§6-2、shojiさんレビュー所見: Phase6の
 * `LearningPriority`よりも重要な注記）。
 */
export type MasteryLevel = 'beginner' | 'developing' | 'proficient';

/**
 * `assessSession()`（Phase10.4予定）の戻り値。単一の`LearningSession`に対する評価結果。
 *
 * 【責務の境界（設計書§6-3・§1）】AssessmentResultは「あなたは今ここです」という現状の可視化の
 * みを返す。「次はこちらです」という推奨（次に学ぶべき教材・症例の提示、優先順位付け、理由付け）
 * はPhase11 Recommendation Layerの責務であり、この型には含めない。
 */
export interface AssessmentResult {
  readonly sessionId: string;
  readonly caseId: string | null;
  readonly masteryLevel: MasteryLevel;
  /** session.teachingNoteIdsの転記（このセッションで参照した教材id、Phase9公開データの単純転記）。 */
  readonly assessedTeachingNoteIds: readonly string[];
  /**
   * 症例に関連する教材（Case GeneratorのCaseTeachingBundle.relatedNotes）のうち、参照済みの
   * id集合（= relatedNotes ∩ teachingNoteIds）。caseIdがnull（単発質問セッション）の場合は
   * 比較対象のrelatedNotesが存在しないため空配列。
   */
  readonly strengths: readonly string[];
  /**
   * 症例に関連する教材のうち、未参照のid集合（= relatedNotes − teachingNoteIds）。
   * caseIdがnullの場合は空配列（strengthsと同じnullポリシー）。
   */
  readonly weaknesses: readonly string[];
}
