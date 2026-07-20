/**
 * engine/adaptiveLearning/caseRecommend.ts ─── recommendedCaseIdsの算出 (Phase12.3)
 *
 * Phase12_AdaptiveLearning_API設計_v1.0.md（shojiさん承認済み）§5-5・§7・§9の実装。
 * Case Generator（`engine/caseGenerator`、Phase7凍結済み）の**公開API（`findCases`/
 * `buildCaseTeachingBundle`）のみ**を利用する。内部実装（`internal/caseMappings.ts`等）へは
 * 依存しない。
 *
 * 【priorityTeachingNoteIdsとの責務境界（レビュー確認事項2）】本ファイルは症例の推奨のみを扱う。
 * `derivePriorityTeachingNoteIds()`（aggregate.ts）が返す「直近セッションの優先教材」は教材の話で
 * あり、ここでは扱わない。本ファイルが入力に使うのは`deriveRepeatPracticeIds()`（aggregate.ts）が
 * 返す「複数セッションを横断した反復練習教材」のみであり、これはAdaptive Learning Layerが新たに
 * 導入する時間軸（設計書§2）に基づく判断であって、直近セッションの状態（priorityTeachingNoteIds）
 * とは独立している。
 *
 * 【Recommendation Layerとのロジック重複を作らない（レビュー確認事項5）】
 * `recommendation/caseRecommend.ts`（Phase11.3）も同じCase Generator公開APIを使うが、
 * 入力・除外範囲が異なり、答えている問いが異なる。
 * - Phase11.3: 「今回のセッション1回分の`weaknesses`」に関連する症例を、「今回の症例1件」を
 *   除外して探す（単一セッションの話）。
 * - Phase12.3（本ファイル）: 「複数セッションを横断して繰り返し現れる教材
 *   （`repeatPracticeIds`）」に関連する症例を、「履歴上で既に扱ったすべての症例」を除外して探す
 *   （複数セッションの話）。
 * `deriveCaseRecommendations`（Phase11.3）はRecommendation Layerのバレルから意図的に非公開
 * （`recommendation/index.ts`参照）であり、そもそも参照できない。Case Generatorへの問い合わせ方
 * （`findCases({})`で全件取得→`buildCaseTeachingBundle()`で`relatedNotes`照合）という「型」が
 * Phase11.3と共通しているのは、Case Generator公開APIの正しい使い方が1通りであるためであり、
 * 業務ロジック（何を根拠に関連症例とするか）自体は重複していない。
 *
 * 【決定論性の維持】`findCases({})`の順序（`data/cases.ts`記述順）をそのまま引き継ぐ。
 * ソート・`Set`による出力順序の変更は行わない（`Set`はmembership判定にのみ使用）。
 */
import type { LearningHistory } from './types';
import { deriveRepeatPracticeIds } from './aggregate';
import { findCases, buildCaseTeachingBundle } from '../caseGenerator';

/**
 * `history`全体を通じて反復練習が必要と判定された教材（`deriveRepeatPracticeIds()`）に関連する
 * 教材を持つ症例のうち、`history`上でまだ扱われていない症例のidを抽出する。
 *
 * 【境界条件（レビュー確認事項4）】`deriveRepeatPracticeIds(history)`が空配列の場合
 * （反復練習が必要な教材が無い、または`history`が空）は、Case Generatorへ問い合わせず即座に
 * 空配列を返す（`recommendation/caseRecommend.ts`の`weaknesses.length === 0`と同じ
 * 「無駄な全件走査を避ける」方針）。
 */
export function deriveRecommendedCaseIds(history: LearningHistory): readonly string[] {
  const repeatIds = deriveRepeatPracticeIds(history);
  if (repeatIds.length === 0) return [];

  const repeatSet = new Set(repeatIds); // membership判定にのみ使用、出力順は変更しない
  const seenCaseIds = new Set<string>(); // 履歴上で既に扱った症例（自己除外の対象）
  for (const entry of history) {
    if (entry.assessment.caseId !== null) seenCaseIds.add(entry.assessment.caseId);
  }

  const recommendedCaseIds: string[] = [];
  for (const candidate of findCases({})) {
    if (seenCaseIds.has(candidate.id)) continue; // 履歴上で既に扱った症例は除外
    const bundle = buildCaseTeachingBundle(candidate.id);
    if (bundle === null) continue; // 理論上は起こらないが防御的に処理（Phase11.3と同じ方針）
    const isRelated = bundle.relatedNotes.some((note) => repeatSet.has(note.entry.id));
    if (!isRelated) continue;

    recommendedCaseIds.push(candidate.id);
  }

  return recommendedCaseIds;
}
