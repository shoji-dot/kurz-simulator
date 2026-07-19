/**
 * engine/adaptiveLearning/aggregate.ts ─── 履歴からの基礎集計 (Phase12.2)
 *
 * Phase12_AdaptiveLearning_API設計_v1.0.md（shojiさん承認済み）§6・§10の実装。
 * `LearningHistory`（複数セッション分のAssessment/Recommendation結果）から
 * `priorityTeachingNoteIds`/`repeatPracticeIds`を算出する。両者は責務を明確に分離する
 * （shojiさんPhase12.1レビュー所見「算出責務を明確に分離していること」）。
 *
 * 【Compatibility Policy（設計書§4）】`LearningHistory`全体から毎回独立に計算する完全な純粋関数。
 * 同一履歴→常に同一出力という決定論性を維持する。ソート・`Set`はmembership判定・重複排除にのみ
 * 使用し、`LearningHistory`の要素順序（時系列、古い順）に対しては安定な走査のみを行う。
 */
import type { LearningHistory } from './types';

/**
 * `deriveRepeatPracticeIds()`が「反復練習が必要」と判定する最小出現回数（暫定値）。
 * 学習効果としての妥当性を保証する値ではない（要耳科医較正、`assessment/mastery.ts`の
 * `BEGINNER_THRESHOLD`等と同じ扱い）。変更する場合はBreaking Change対象（設計書§11参照）。
 */
export const REPEAT_THRESHOLD = 2;

/**
 * 直近セッション（`history`の末尾要素）が推奨した教材idを、そのまま優先教材として返す。
 *
 * 【責務】「今このセッションを終えた時点で、次に取り組むべきものは何か」という**直近の状態**の
 * 転記のみを行う（Recommendation Layer(Phase11)の`recommendedTeachingNoteIds`をそのまま引き継ぐ、
 * `weaknessRecommend.ts`と同じ「単純転記に留める」設計思想を踏襲）。複数セッションを横断した
 * 傾向分析は`deriveRepeatPracticeIds()`の責務であり、本関数では行わない。
 *
 * `history`が空の場合は空配列を返す（呼び出し側の責務、例外は投げない）。
 */
export function derivePriorityTeachingNoteIds(history: LearningHistory): readonly string[] {
  if (history.length === 0) return [];
  const latest = history[history.length - 1];
  return latest.recommendation.recommendedTeachingNoteIds;
}

/**
 * `history`全体を通じて、複数セッションにまたがって繰り返し推奨されている教材id
 * （= 出現回数が`REPEAT_THRESHOLD`以上）を、初出順で返す。
 *
 * 【責務】単一セッションでは検出できない「同じ苦手が繰り返し現れている」という**複数セッションを
 * 横断した傾向**のみを扱う（Adaptive Learning Layerが新たに導入する時間軸、設計書§2参照）。
 * 直近セッションの状態そのものは`derivePriorityTeachingNoteIds()`の責務であり、本関数では
 * 出現回数のみに基づいて判定する（1セッション内での重複は数えない。各エントリの
 * `recommendedTeachingNoteIds`はそのエントリにつき1回のみカウントする）。
 *
 * `history`が空の場合は空配列を返す。
 */
export function deriveRepeatPracticeIds(history: LearningHistory): readonly string[] {
  const occurrenceCount = new Map<string, number>(); // membership/カウント用途にのみ使用
  const firstSeenOrder: string[] = [];

  for (const entry of history) {
    const seenInThisEntry = new Set<string>(); // 同一エントリ内の重複を1回として数えるためのガード
    for (const id of entry.recommendation.recommendedTeachingNoteIds) {
      if (seenInThisEntry.has(id)) continue;
      seenInThisEntry.add(id);
      if (!occurrenceCount.has(id)) firstSeenOrder.push(id);
      occurrenceCount.set(id, (occurrenceCount.get(id) ?? 0) + 1);
    }
  }

  return firstSeenOrder.filter((id) => (occurrenceCount.get(id) ?? 0) >= REPEAT_THRESHOLD);
}
