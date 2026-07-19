/**
 * engine/learningSession/summary.ts ─── Learning Session Layer 要約 (Phase9.3)
 *
 * Phase9_LearningSessionLayer_API設計_v1.0.md §6（shojiさん承認済み）の実装。
 * `summarizeSession()`は`LearningSession`から`SessionSummary`への**集計のみ**を行う。
 * shojiさんのPhase9.2レビュー所見どおり、時間計算・学習時間推定・AI要約・重要度判定等は
 * この関数の責務外とし、将来のAssessment Layer/Learning Analytics側で扱う（Session→Summary→
 * Assessment→Recommendationという想定の流れにおいて、Summaryを薄いレイヤーに留める）。
 */
import type { LearningSession, SessionSummary } from './types';

/** `LearningSession`から件数等を集計するのみ。新規データ・推論を一切生成しない。 */
export function summarizeSession(session: LearningSession): SessionSummary {
  return {
    sessionId: session.id,
    caseId: session.caseId,
    messageCount: session.messages.length,
    teachingNoteCount: session.teachingNoteIds.length,
    startedAt: session.startedAt,
  };
}
