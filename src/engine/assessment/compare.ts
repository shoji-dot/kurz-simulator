/**
 * engine/assessment/compare.ts ─── strengths/weaknesses算出 (Phase10.3)
 *
 * Phase10_AssessmentLayer_API設計_v1.0.md（shojiさん承認済み）§6-3・§10の実装。
 * 症例に関連する教材（母集合）とセッションで参照済みの教材idを比較し、`strengths`（積集合）/
 * `weaknesses`（差集合）を算出する。
 *
 * 【なぜrelatedNoteIdsを母集合とするか】strengthsは「ケースに関連するTeachingNoteのうち
 * 学習済みであるもの」、weaknessesは「ケースに関連するTeachingNoteのうち未学習であるもの」を
 * 意味する（設計書§6-3）。関連性の判定基準（母集合）はCase Generator由来の
 * `CaseTeachingBundle.relatedNotes`に委ねる。セッションで参照した教材が母集合に含まれない場合
 * （症例と無関係な質問等）は、strengths/weaknessesいずれにも現れない（母集合外のため評価対象外）。
 *
 * 【責務の境界（shojiさんPhase10.2レビュー所見への回答）】`caseId === null`（単発質問セッション）
 * の判定・空配列へのフォールバックは、この関数の責務ではなく**呼び出し側（Phase10.4の
 * `assess.ts`）の責務**とする。本関数は`relatedNoteIds`/`referencedTeachingNoteIds`という
 * 2つのid配列のみを受け取る、`caseId`やセッション自体を一切知らない純粋な集合演算に徹する
 * （`caseId === null`の場合、assess.ts側が`relatedNoteIds = []`を渡すか、本関数の呼び出し自体を
 * 省略していずれもstrengths/weaknesses空配列を直接返す設計とする）。
 *
 * Compatibility Policy（設計書§4「解釈するが新たな事実を生成しない」）: 集合演算
 * （intersection/difference）のみを行う。新たな判断ロジック・優先順位付け・推奨は持たない。
 */

export interface TeachingNoteComparison {
  /** 母集合(relatedNoteIds)のうち参照済み(referencedTeachingNoteIdsに含まれる)のid（積集合）。 */
  readonly strengths: readonly string[];
  /** 母集合(relatedNoteIds)のうち未参照のid（差集合）。 */
  readonly weaknesses: readonly string[];
}

/**
 * `relatedNoteIds`（症例に関連する教材id、母集合）と`referencedTeachingNoteIds`（セッションで
 * 参照済みの教材id）を比較し、`strengths`（積集合）/`weaknesses`（差集合）を算出する。
 *
 * - 入力配列は変更しない（非破壊、`readonly`）。
 * - `Set`によるmembership判定でO(n)。
 * - `relatedNoteIds`に重複idが含まれていても、結果は母集合内での初出順を維持した一意な配列になる
 *   （`referencedTeachingNoteIds`側の重複は`Set`化によりmembership判定にのみ使われるため、結果に
 *   重複が現れることはない）。
 */
export function compareTeachingNotes(
  relatedNoteIds: readonly string[],
  referencedTeachingNoteIds: readonly string[],
): TeachingNoteComparison {
  const referencedSet = new Set(referencedTeachingNoteIds);
  const seen = new Set<string>();
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const id of relatedNoteIds) {
    if (seen.has(id)) continue; // 母集合側の重複を除去（初出順を維持）
    seen.add(id);
    if (referencedSet.has(id)) {
      strengths.push(id);
    } else {
      weaknesses.push(id);
    }
  }

  return { strengths, weaknesses };
}
