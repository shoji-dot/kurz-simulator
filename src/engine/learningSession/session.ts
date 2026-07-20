/**
 * engine/learningSession/session.ts ─── Learning Session Layer 生成・更新 (Phase9.2)
 *
 * Phase9_LearningSessionLayer_API設計_v1.0.md §6（shojiさん承認済み 2026-07-18、評価A）の実装。
 * createSession/appendMessage/appendTeachingNoteId はすべてPure Function。副作用（永続化・
 * crypto.randomUUID()等のID生成・Date.now()等の現在時刻取得）はこの層に一切持ち込まない
 * （id/startedAtは呼び出し側から受け取る、§4 Compatibility Policy・§6参照）。
 */
import type { LearningSession } from './types';
import type { TutorMessage } from '../aiTutor';

export interface CreateSessionInput {
  readonly id: string;
  /** ISO 8601。呼び出し側から渡す（この層は現在時刻を取得しない）。 */
  readonly startedAt: string;
  /** 省略時はnull（症例に紐づかない単発質問セッションとして扱う）。 */
  readonly caseId?: string | null;
}

/** 入力値のみから`LearningSession`を構築する。id/startedAtの生成はこの関数の責務外。 */
export function createSession(input: CreateSessionInput): LearningSession {
  return {
    id: input.id,
    startedAt: input.startedAt,
    caseId: input.caseId ?? null,
    messages: [],
    teachingNoteIds: [],
  };
}

/**
 * `message`を1件追加した新しい`LearningSession`を返す（イミュータブル、`session`自体は変更しない）。
 * 重複排除は行わない（対話履歴は発言順の記録であり、`teachingNoteIds`とは性質が異なるため）。
 */
export function appendMessage(session: LearningSession, message: TutorMessage): LearningSession {
  return {
    ...session,
    messages: [...session.messages, message],
  };
}

/**
 * `teachingNoteId`を参照済み教材の集合へ追加した新しい`LearningSession`を返す（イミュータブル）。
 *
 * 【重複ポリシー（設計書§6で確定）】`teachingNoteIds`は「利用した教材の集合」を表す一意集合
 * （挿入順維持）として扱う。既に含まれるidを渡した場合は集合に変化がないため、新しいオブジェクトを
 * 作らず`session`をそのまま返す（参照の同一性を保つ）。頻度情報が必要な場合はこの層の責務外。
 */
export function appendTeachingNoteId(session: LearningSession, teachingNoteId: string): LearningSession {
  if (session.teachingNoteIds.includes(teachingNoteId)) {
    return session;
  }
  return {
    ...session,
    teachingNoteIds: [...session.teachingNoteIds, teachingNoteId],
  };
}
