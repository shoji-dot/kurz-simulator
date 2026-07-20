/**
 * engine/aiTutor/context.ts ─── AI Tutor Context層 (Phase8.1)
 *
 * Case Generator（`buildCaseTeachingBundle`）+ Education Layer（`findTeachingNotes`）の
 * 公開APIのみを組み合わせて`TutorContext`を組み立てる純粋関数のみを持つ。LLM呼び出し・
 * プロンプト生成・状態保持は一切行わない（Phase8設計書の3層分割どおり、本ファイルは
 * 完全に決定論的）。
 */
import { buildCaseTeachingBundle } from '../caseGenerator';
import { findTeachingNotes } from '../education';
import type { TeachingNote } from '../education';
import type { TutorContext } from './types';

export interface BuildTutorContextInput {
  /** 指定した場合、Case Generator経由でCaseTeachingBundleを取得しbundle/focusedNotesの基礎とする。 */
  readonly caseId?: string;
  /** 指定した場合、Education Layer経由で該当構造物のTeachingNoteをfocusedNotesへ追加する。 */
  readonly structureIds?: readonly string[];
}

/**
 * caseId/structureIdsからTutorContextを組み立てる。
 * - caseId未指定または未知caseIdの場合、bundleはnull（例外を投げない、Phase1〜7と同じnullポリシー）。
 * - focusedNotesはbundle.relatedNotes（あれば）とstructureIds指定分をidで重複除去した上で結合する
 *   （同一idが両方から得られた場合は1件のみ）。
 * - caseId/structureIdsのいずれも未指定の場合、bundle:null・focusedNotes:[]を返す。
 */
export function buildTutorContext(input: BuildTutorContextInput): TutorContext {
  const bundle = input.caseId ? buildCaseTeachingBundle(input.caseId) : null;

  const notesById = new Map<string, TeachingNote>();
  for (const note of bundle?.relatedNotes ?? []) {
    notesById.set(note.entry.id, note);
  }
  if (input.structureIds && input.structureIds.length > 0) {
    const structureNotes = findTeachingNotes({ visibleIds: new Set(input.structureIds) });
    for (const note of structureNotes) {
      notesById.set(note.entry.id, note);
    }
  }

  return { bundle, focusedNotes: Array.from(notesById.values()) };
}
