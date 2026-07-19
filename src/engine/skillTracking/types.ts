/**
 * engine/skillTracking/types.ts ── Skill Tracking Layer 型定義（Phase18.1）
 *
 * 設計書: Phase18_SkillTracking_API設計_v1.0.md（shojiさん承認済み）。
 * Skill Trackingは「既存3系統（Assessment/ScoreResult/将来のDrill）が個別に保持する評価結果を、
 * 学習者のスキル軸別の集計へ変換する読み取り専用の集約層」であり、新しい採点ロジックは持たない
 * （Phase5 Query Engine/Phase6 Education Layerと同じ「計算は委譲、意味づけのみ担当」思想）。
 *
 * Adapter（系統ごとのデータ変換、Phase18.2/18.3）→ Aggregator（SkillProfile生成、Phase18.4）の
 * 責務分離を型レベルで固定する。本ファイルは型定義のみで実装ロジックは持たない（Phase9.1と同じ
 * 運用）。
 */

/**
 * スキル軸のカテゴリ。size/position/angleは「操作能力」（Technical）、
 * anatomyRecognitionは「知識理解」（Knowledge）で性質が異なるため分離する
 * （shojiさんPhase18設計確定事項④）。将来Decision Making/Planning等を追加する際の
 * 拡張点でもある。
 */
export type SkillCategory = 'technical' | 'knowledge';

/** Technicalカテゴリのスキル軸（Simulation Mode ScoreResultの3軸に対応、系統2由来）。 */
export type TechnicalSkillId = 'sizeAccuracy' | 'positionAccuracy' | 'angleAccuracy';

/** Knowledgeカテゴリのスキル軸（Assessment strengths/weaknessesに対応、系統1由来）。 */
export type KnowledgeSkillId = 'anatomyRecognition';

/**
 * Skill Trackingが扱う全スキル軸のid。Drill/Instrument Handling（系統3）はPhase18の対象外
 * （Drill機能が現状`?admin=1`限定のため、Drill一般公開後にPhase18.5またはPhase19で追加検討）。
 */
export type SkillId = TechnicalSkillId | KnowledgeSkillId;

/** スキル軸のメタ情報（カテゴリ・表示ラベル）。固定の参照テーブル用の型。 */
export interface SkillDefinition {
  readonly id: SkillId;
  readonly category: SkillCategory;
  readonly labelJa: string;
}

/**
 * SkillObservationの出所。Adapterが増えてもAggregator側が系統を区別できるようにするための
 * タグ（Phase18.2レビュー指摘、shojiさん提案）。値自体はSkillObservationの意味を変えない
 * 付帯情報であり、Aggregatorの集計ロジックがsourceで分岐することは想定しない。
 */
export type SkillObservationSource = 'scoreHistory' | 'assessment' | 'drill';

/**
 * Adapter層の出力（Aggregator層への入力）。ScoreHistory Adapter（18.2）/Assessment
 * Adapter（18.3）が、各データ系統固有の形式差異（`HistoryEntry`のsizeScore等 vs
 * `AssessmentResult`のteachingNoteId集合）を吸収し、この共通中間形式へ変換する。
 * 1件 = 1回のセッション/症例完了から得られた、該当スキル軸への単一の観測値。
 */
export interface SkillObservation {
  readonly skillId: SkillId;
  /** 0-100に正規化した値（各系統の元スケールから変換する。変換方法はAdapter側の責務）。 */
  readonly value: number;
  /**
   * 元データ（HistoryEntry.date等）のISO日時文字列。
   *
   * 【API契約・重要】source系統によって意味が異なる。source='scoreHistory'はHistoryEntry.dateを
   * 転記した実際のセッション完了時刻だが、source='assessment'は変換実行時刻（取得時刻）であり、
   * 学習イベントの発生時刻ではない（assessmentAdapter.ts参照）。Assessment由来のobservedAtを
   * 並び替え・時系列解析・経時変化の根拠として利用してはならない。
   */
  readonly observedAt: string;
  /** このObservationがどのAdapter系統由来かを示すタグ。 */
  readonly source: SkillObservationSource;
}

/**
 * 1つのスキル軸の集約結果。`sampleSize`は集計に使われた`SkillObservation`件数で、
 * 値の信頼度の目安として持たせる（`SCORE_HISTORY_MAX`等により元データが最大10件で
 * トリムされる制約を、Skill Tracking側でも透明に示すため）。
 */
export interface SkillScore {
  readonly id: SkillId;
  readonly category: SkillCategory;
  readonly value: number;
  readonly sampleSize: number;
}

/** Skill Tracking層の最終出力（Skill Aggregator、Phase18.4が生成する）。 */
export interface SkillProfile {
  readonly technical: readonly SkillScore[];
  readonly knowledge: readonly SkillScore[];
}
