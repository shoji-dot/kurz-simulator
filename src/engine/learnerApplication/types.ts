/**
 * engine/learnerApplication/types.ts ─── Learner Application Layer 型定義 (Phase13.1)
 *
 * Phase13_LearnerApplicationLayer_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）§6の
 * 実装。Adaptive Learning Layer（Phase12凍結済み）が返した`AdaptiveLearningPlan`のidを、
 * Education Layer（Phase6凍結済み）/Case Generator（Phase7凍結済み）で実体解決した結果を
 * 保持するための型のみを定義する。ロジックは持たない（型定義のみ、Phase13.1のスコープ）。
 *
 * 【表示用データのみ、操作導線は持たない（設計書§5-3・§3で確定）】`onStartCase()`のような
 * コールバック契約はこの型には含めない。ナビゲーション・画面遷移はReact側（`useSimStore`・
 * 各Scene）の責務として明確に残す。
 */
import type { EarAtlasCategory, EarAtlasDangerLevel } from '../../data/earAtlas/types';
import type { SurgicalCase } from '../../data/cases';

/**
 * 提示可能な教材のView Model。`TeachingNote`（Education Layer公開型）の転記+表示用整形のみ
 * （新しい教育コンテンツは捏造しない、Phase6の設計方針と同じ考え方）。
 */
export interface TeachingNoteActionView {
  readonly type: 'teachingNote';
  /** EarAtlasEntry.id（= 元のteachingNoteId）。 */
  readonly id: string;
  /** entry.nameJaの転記。 */
  readonly titleJa: string;
  /** commentJaの転記。entry.educationCommentJa未設定の場合はnull（Phase6のnullポリシーを継承）。 */
  readonly descriptionJa: string | null;
  readonly category: EarAtlasCategory;
  readonly dangerLevel: EarAtlasDangerLevel;
}

/**
 * 提示可能な症例のView Model。`SurgicalCase`（Case Generator/`data/cases.ts`由来）の転記+
 * 表示用整形のみ。
 */
export interface CaseActionView {
  readonly type: 'case';
  /** SurgicalCase.id。 */
  readonly id: string;
  /** surgicalCase.titleの転記。 */
  readonly titleJa: string;
  /** surgicalCase.descriptionの転記。 */
  readonly descriptionJa: string;
  readonly difficulty: SurgicalCase['difficulty'];
}

/**
 * `deriveLearnerApplicationView()`（Phase13.4予定）の戻り値。Learner Application Layer唯一の
 * 公開関数の戻り値であり、`AdaptiveLearningPlan`の3項目（`priorityTeachingNoteIds`/
 * `repeatPracticeIds`/`recommendedCaseIds`）に1:1で対応する。
 *
 * 【重要】新しい推薦判断・優先順位付け・症例ランキングは行わない（設計書§5-1・§11 Non-goals）。
 * `AdaptiveLearningPlan`が持つ順序・分類をそのまま引き継ぎ、idを実体解決するのみ。
 */
export interface LearnerApplicationView {
  readonly priorityTeachingNotes: readonly TeachingNoteActionView[];
  readonly repeatPracticeNotes: readonly TeachingNoteActionView[];
  readonly recommendedCases: readonly CaseActionView[];
}
