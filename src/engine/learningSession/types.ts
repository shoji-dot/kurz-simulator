/**
 * engine/learningSession/types.ts ─── Learning Session Layer 型定義 (Phase9.1)
 *
 * Phase9_LearningSessionLayer_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）の実装。
 * AI Tutor（Phase8凍結済み）のTutorMessageのみを再利用し、Learning Session Layer独自の
 * メッセージ型は作らない（重複データ構造を作らない方針）。
 *
 * 【Compatibility Policy（設計書§4）】Learning Session Layerは永続化（localStorage/IndexedDB/
 * Cloud同期/LMS等）を一切行わない。id・startedAtは呼び出し側から受け取る（createSession()が
 * Pure Functionであるため、crypto.randomUUID()やDate.now()等の非決定的処理をこの層に持たない）。
 */
import type { TutorMessage } from '../aiTutor';

/**
 * 学習者ごとの学習セッション。AI Tutorとの対話履歴・Case Generator/Education Layer由来の
 * 利用教材を記録・再構成する、Phase1〜8を通じて唯一「状態」を責務として持つ層のデータ型。
 */
export interface LearningSession {
  readonly id: string;
  /** ISO 8601。呼び出し側から渡される（この層は現在時刻を取得しない）。 */
  readonly startedAt: string;
  /** Case Generatorのcase id。症例に紐づかない単発質問セッションはnull（正式サポート対象）。 */
  readonly caseId: string | null;
  /** AI Tutor(Phase8)のTutorMessageをそのまま再利用。 */
  readonly messages: readonly TutorMessage[];
  /**
   * セッション中に参照したEducation LayerのTeachingNoteのid一覧。教材本体（TeachingNote自体）は
   * 保持せず、idのみを保持する（Case Generator/Education Layerへの依存をid参照のみに限定する方針）。
   */
  readonly teachingNoteIds: readonly string[];
}

/** summarizeSession()（Phase9.3）の戻り値。要約情報の導出のみで新規データは持たない。 */
export interface SessionSummary {
  readonly sessionId: string;
  readonly caseId: string | null;
  readonly messageCount: number;
  readonly teachingNoteCount: number;
  readonly startedAt: string;
}
