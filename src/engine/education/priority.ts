/**
 * engine/education/priority.ts ─── Education Layer Priority層 (Phase6.2)
 *
 * Phase6_EducationLayer_API設計_v1.0.mdの実装。TeachingNote.learningPriority
 * （Phase6.1で確定、dangerLevelからの機械的代理指標）を比較・並べ替える層。
 * Query Engine Ranking層（engine/query/ranking.ts、Phase5.3）と同じ設計思想を踏襲する:
 * 自ら優先度を計算・判定しない（Phase6.1で確定済みのlearningPriority値を読むのみ）、
 * Comparatorとして提供・合成可能な形にする、sortは非破壊（新しい配列を返す）。
 *
 * 現時点では比較軸がlearningPriorityの1つのみのためcomposeComparators()は使わないが、
 * `Comparator<TeachingNote>`型（engine/query/types.ts、Phase5.3追加）をそのまま再利用できる
 * 設計にしてある（将来compareByDifficulty()等が増えた場合に備える、Phase6設計書レビュー所見）。
 */
import type { TeachingNote, LearningPriority } from './types';

/** high→medium→lowの順で並べるための重み。値が小さいほど優先度が高い（先頭に来る）。 */
const LEARNING_PRIORITY_ORDER: Readonly<Record<LearningPriority, number>> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * learningPriority順（high→medium→low）で比較する。Array.prototype.sortへそのまま渡せる。
 * learningPriority自体の計算はしない（Phase6.1のtoTeachingNote()が確定済みの値を読むのみ）。
 */
export function compareByLearningPriority(a: TeachingNote, b: TeachingNote): number {
  return LEARNING_PRIORITY_ORDER[a.learningPriority] - LEARNING_PRIORITY_ORDER[b.learningPriority];
}

/** compareByLearningPriorityで並べ替えた新しい配列を返す（引数の配列は変更しない）。 */
export function rankByLearningPriority(notes: readonly TeachingNote[]): readonly TeachingNote[] {
  return [...notes].sort(compareByLearningPriority);
}
