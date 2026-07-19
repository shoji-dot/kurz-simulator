/**
 * store/useLearningHistoryStore.ts ─── Learning History Runtime Store (Phase14.3)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§3・§4の実装。
 * `engine/applicationIntegration`（Phase14.1〜14.3）が組み立てた`LearningHistoryEntry`
 * （`{assessment, recommendation}`）を、実行時のみ保持する。
 *
 * 【永続化しない（設計書§1・Non-goals、shojiさん確定事項）】localStorage/IndexedDB/Cloud等への
 * 保存は一切行わない。ページ再読み込みでリセットされるRuntime状態のみ。`zustand/middleware`の
 * `persist`は使用しない。
 * 【薄いstorageのみ（shojiさんPhase14.2レビュー所見「Zustand sliceは薄いstorageのみ」）】
 * `history`配列の保持と追加(`addEntry`)のみを提供し、判断ロジックは一切持たない。
 * `AdaptiveLearningPlan`の生成（`deriveAdaptivePlan()`、Phase12公開APIへの橋渡し）は本storeの
 * 責務ではなく、呼び出し側（Phase14.4のダッシュボード表示側）が`history`を読み取って都度呼び出す
 * （Adaptive Learning Layer自身の設計方針「Planは毎回Historyから導出するSnapshot」を継承）。
 * 【既存`useSimStore`とは独立（shojiさんPhase14.2レビュー所見「engine内state禁止」を踏まえ、
 * かつ既存Simulator状態とLearning Historyという別関心事を混在させないため）】
 */
import { create } from 'zustand';
import type { LearningHistory, LearningHistoryEntry } from '../engine/adaptiveLearning';

interface LearningHistoryState {
  readonly history: LearningHistory;
  /** `LearningHistoryEntry`を末尾へ追加する。既存配列は変更せず新しい配列を作る（イミュータブル）。 */
  addEntry: (entry: LearningHistoryEntry) => void;
}

export const useLearningHistoryStore = create<LearningHistoryState>((set) => ({
  history: [],
  addEntry: (entry) =>
    set((state) => ({ history: [...state.history, entry] })),
}));
