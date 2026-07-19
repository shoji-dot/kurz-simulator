/**
 * engine/aiTutor/types.ts ─── AI Tutor 型定義 (Phase8.1)
 *
 * Phase8_AITutor_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）の実装。
 * Case Generator（Phase7凍結済み）・Education Layer（Phase6凍結済み）の公開型のみを再利用し、
 * AI Tutor独自の教育コンテンツ・症例データは持たない。
 *
 * 【本Phaseの対象】Phase8.1では`TutorContext`（`context.ts`が生成する型）のみを実際に使用する。
 * `TutorMessage`/`TutorReply`/`TutorModelClient`はPhase8.2〜8.3（`prompt.ts`/`generator.ts`）の
 * 消費者がまだ存在しないが、設計書で確定済みの型のため、Phase6.1（`LearningPriority`を
 * `priority.ts`実装前に先出しした前例）と同じ考え方でここに先出しする。
 */
import type { CaseTeachingBundle } from '../caseGenerator';
import type { TeachingNote } from '../education';

/** 対話1件の発言者。呼び出し側の会話履歴（配列）の要素として使う想定（AI Tutor自体は保持しない）。 */
export type TutorRole = 'learner' | 'tutor';

export interface TutorMessage {
  readonly role: TutorRole;
  readonly textJa: string;
}

/**
 * AI Tutorへの入力文脈。Case Generator（症例ベース）・Education Layer（構造物ベース、症例に
 * 紐づかない単発の質問向け）の両方から組み立てられる。転記のみで、AI Tutor独自の教育コンテンツは
 * 生成しない（Phase6・Phase7の「変換のみ」方針を継承）。
 */
export interface TutorContext {
  /** caseIdを指定した場合のCase Generator由来の文脈。未指定/未知caseIdの場合はnull。 */
  readonly bundle: CaseTeachingBundle | null;
  /** 症例に紐づかない構造物ベースの文脈（例: 症例未選択時に「顔面神経について」等の単発質問）。 */
  readonly focusedNotes: readonly TeachingNote[];
}

/** generateTutorReply()の戻り値（Phase8.3で実装）。LLM生の出力は`raw`に保持し、`textJa`は表示用。 */
export interface TutorReply {
  readonly textJa: string;
  readonly raw?: string;
}

/**
 * LLM呼び出しの抽象インターフェース（Phase8が依存する唯一のLLM接点、Phase8.3で使用開始）。
 * 具体的なプロバイダ実装（Anthropic API等）はPhase8のスコープ外とし、このインターフェースを
 * 満たす形でPhase8の外側（呼び出し側）から注入する（shojiさん確定事項、設計書「AIとの境界」節参照）。
 */
export interface TutorModelClient {
  complete(promptJa: string): Promise<string>;
}
