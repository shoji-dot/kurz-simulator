/**
 * engine/learnerApplication/noteResolve.ts ─── 教材id→実体解決 (Phase13.2)
 *
 * Phase13_LearnerApplicationLayer_API設計_v1.0.md（shojiさん承認済み）§5-1・§7・§8の実装。
 * Education Layer（`engine/education`、Phase6凍結済み）の**公開API（`getTeachingNote`）のみ**
 * を利用し、教材idを`TeachingNoteActionView`へ解決する。`data/earAtlas`等の内部実装へは
 * 依存しない。
 *
 * 【責務の境界（shojiさんPhase13.1レビュー所見への対応）】本ファイルが行うのは
 * 「TeachingNote ID → TeachingNote実体 → 表示用整形」のみ。教材優先順位の変更・コメント生成・
 * AI説明生成・TeachingNoteへの加工ロジック追加は一切行わない（`entry.nameJa`/`commentJa`等の
 * 単純転記のみ）。
 */
import { getTeachingNote } from '../education';
import type { TeachingNote } from '../education';
import type { TeachingNoteActionView } from './types';

/** TeachingNote（Education Layer公開型）をTeachingNoteActionViewへ変換する。転記のみ。 */
function toTeachingNoteActionView(note: TeachingNote): TeachingNoteActionView {
  return {
    type: 'teachingNote',
    id: note.entry.id,
    titleJa: note.entry.nameJa,
    descriptionJa: note.commentJa,
    category: note.entry.category,
    dangerLevel: note.dangerLevel,
  };
}

/**
 * 教材idの配列を`TeachingNoteActionView`の配列へ解決する。`ids`の順序をそのまま維持する
 * （ソート・並べ替えは行わない、設計書§5-1「新しい優先順位付けは行わない」）。
 *
 * `getTeachingNote(id)`が`null`を返すid（Education Layerで解決できないid）は結果から除外する
 * （設計書§8 nullポリシー、例外を投げない）。
 */
export function deriveTeachingNoteActionViews(ids: readonly string[]): readonly TeachingNoteActionView[] {
  const views: TeachingNoteActionView[] = [];
  for (const id of ids) {
    const note = getTeachingNote(id);
    if (note === null) continue; // 解決不能idは除外
    views.push(toTeachingNoteActionView(note));
  }
  return views;
}
