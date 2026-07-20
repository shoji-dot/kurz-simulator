/**
 * engine/caseGenerator/library.ts ─── Case Generator Library層 (Phase7.1)
 *
 * data/cases.ts（`surgicalCases`、既存・稼働中の本番データ）への薄い読み取りラッパーのみを持つ。
 * 新しい症例データを生成・変更しない（読み取り専用。Phase7設計書「data/cases.tsを一切変更しない」
 * 方針、Strangler Pattern継続）。
 */
import { surgicalCases } from '../../data/cases';
import type { SurgicalCase } from '../../data/cases';

/** idからSurgicalCaseを1件取得する。存在しない場合はnull。 */
export function getCase(id: string): SurgicalCase | null {
  return surgicalCases.find((c) => c.id === id) ?? null;
}

/**
 * difficultyでSurgicalCaseを検索する。difficulty未指定の場合は全件を返す（Phase5の
 * SemanticFilterOptionsと同じ「条件省略時は絞り込まない」方針）。
 * tagsでの絞り込みは今回見送る（shojiさんのPhase7要確認事項2レビュー所見。必要性確認後に
 * 独立Issueとして追加）。
 */
export function findCases(opts: { difficulty?: SurgicalCase['difficulty'] }): readonly SurgicalCase[] {
  if (!opts.difficulty) return surgicalCases;
  return surgicalCases.filter((c) => c.difficulty === opts.difficulty);
}
