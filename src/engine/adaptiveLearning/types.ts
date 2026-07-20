/**
 * engine/adaptiveLearning/types.ts ─── Adaptive Learning Layer 型定義 (Phase12.1)
 *
 * Phase12_AdaptiveLearning_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）§6の実装。
 * Assessment Layer（Phase10凍結済み）・Recommendation Layer（Phase11凍結済み）が返した
 * 複数セッション分の結果を入力として評価するための型のみを定義する。ロジックは持たない
 * （型定義のみ、Phase12.1のスコープ）。
 *
 * 【状態を持つのはデータであって、レイヤではない（設計書§3・§5-1、shojiさんレビューで確定）】
 * Adaptive Learning Layer自身は状態を保持しない純粋関数として設計する。`LearningHistory`
 * （複数セッション分の履歴）は呼び出し側が保持・収集し、都度引数として渡す。Phase12がRepository/
 * Cache/DB等を内部に抱える層になることは意図的に避ける。
 */
import type { AssessmentResult } from '../assessment';
import type { RecommendationResult } from '../recommendation';

/**
 * 過去の学習履歴の1エントリ。1セッション分のAssessment/Recommendation結果を保持する。
 *
 * データの生成元はPhase10（`assessSession`）/Phase11（`recommend`）の公開APIであり、
 * Adaptive Learning Layerは新たな評価・推奨ロジックを持たない（設計書§3-1・§3-2）。
 */
export interface LearningHistoryEntry {
  readonly assessment: AssessmentResult;
  readonly recommendation: RecommendationResult;
}

/**
 * 学習者ごとの複数セッション分の履歴（時系列、古い順を想定）。
 *
 * 【`learnerId`はPhase12では持たない（設計書§5-2で確定）】「ある学習者の履歴であること」の
 * 保証は呼び出し側の責務とし、Adaptive Learning Layerは認証・ユーザー管理・マルチユーザーを
 * 一切知らない設計とする。
 */
export type LearningHistory = readonly LearningHistoryEntry[];

/**
 * `deriveAdaptiveLearningPlan()`（Phase12.4予定）の戻り値。複数セッションの履歴から導出される
 * 中長期の学習計画。
 *
 * 【重要】本型は履歴から導出された現時点の推奨学習計画であり、将来にわたる固定計画ではない
 * （設計書§5-6）。`deriveAdaptiveLearningPlan()`を呼ぶたびに、渡す`LearningHistory`の内容に
 * 応じて変化しうる（＝「Plan」というより「Snapshot」に近い）。名前から連想される「一度立てたら
 * 変わらない計画」という印象とのギャップに注意すること。
 *
 * `AdaptiveLearningPlan`は`LearningHistory`から導出される派生データであり、永続化・更新の責務を
 * 持たない（Phase12.1レビュー所見。「Planを更新する」のではなく「毎回Historyから導出する」）。
 *
 * 【v1は最小構成の3項目のみ（設計書§5-3で確定）】`focusThemes`（重点テーマ）・`goalsJa`
 * （学習目標テキスト）はドラフト段階で検討されたが、現時点で生成根拠・SSoTが無いため今回は
 * 不採用とした。将来必要になればPhase13以降で非破壊的に追加できる。
 */
export interface AdaptiveLearningPlan {
  /** 優先教材のid。 */
  readonly priorityTeachingNoteIds: readonly string[];
  /** 反復練習が必要な部位のid。 */
  readonly repeatPracticeIds: readonly string[];
  /** 推奨症例セットのid。 */
  readonly recommendedCaseIds: readonly string[];
}
