/**
 * engine/applicationIntegration/evidenceEntry.ts ─── Learning Evidence 反映入口 (Phase15.3)
 *
 * `Phase15_InteractionLoggingLayer_API設計_v1.0.md` + Phase15.2レビュー（shojiさん承認済み、
 * 2026-07-18）で指定された方針の実装。`useLearningEvidenceStore`（Phase15.2、`store`層）が
 * 一時保持したクリック済みteachingNoteId集合を、症例完了時に組み立てた`LearningSession`へ
 * 反映する。
 *
 * 【既存`createSessionFromCaseCompletion()`（Phase14.1）は変更禁止（shojiさんPhase15.2レビュー
 * 指定）】Case Generator由来の`relatedNotes`を反映する既存関数の内部には一切手を入れず、本関数を
 * 呼び出し側（Phase15.4予定）が`createSessionFromCaseCompletion()`の戻り値に対して追加で適用する
 * 独立APIとして新設する。
 * 【Phase9公開API（`appendTeachingNoteId`）のみを利用（新規の重複排除ロジックを持たない）】
 * `teachingNoteIds`の重複排除・挿入順維持・no-op時の参照同一性は、既存のLearning Session Layer
 * （Phase9凍結）の重複ポリシーへそのまま委譲する。Case Generator由来のid・Interaction Evidence
 * 由来のidを区別せず同じ集合として扱う（設計書どおり「利用した教材の集合」という単一のセマン
 * ティクスを維持するため）。
 * 【本ファイルはstore（`useLearningEvidenceStore`）に依存しない】呼び出し側がstoreから読み取った
 * `clickedTeachingNoteIds`をプレーンな`readonly string[]`として渡す設計とし、Application
 * Integration Layer自体はzustandを一切importしない（既存`sessionEntry.ts`等と同じ、engine層は
 * 特定の状態管理ライブラリを知らない方針を継続）。
 */
import { appendTeachingNoteId } from '../learningSession';
import type { LearningSession } from '../learningSession';

/**
 * `clickedTeachingNoteIds`を`session.teachingNoteIds`へ追加した新しい`LearningSession`を返す
 * （イミュータブル、`session`自体は変更しない）。`appendTeachingNoteId()`を1件ずつ順に適用する
 * だけで、新しい判断ロジックは追加しない。
 *
 * `clickedTeachingNoteIds`が空配列、または全件が既に`session.teachingNoteIds`に含まれる場合は、
 * `appendTeachingNoteId()`のno-op同一参照ポリシーがそのまま連鎖するため、新しいオブジェクトを
 * 作らず`session`をそのまま返す。
 */
export function appendLearningEvidenceToSession(
  session: LearningSession,
  clickedTeachingNoteIds: readonly string[],
): LearningSession {
  let updated = session;
  for (const teachingNoteId of clickedTeachingNoteIds) {
    updated = appendTeachingNoteId(updated, teachingNoteId);
  }
  return updated;
}
