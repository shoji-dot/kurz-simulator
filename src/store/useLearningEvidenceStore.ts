/**
 * store/useLearningEvidenceStore.ts ─── Learning Evidence Runtime Store (Phase15.2)
 *
 * `Phase15_InteractionLoggingLayer_API設計_v1.0.md`（shojiさん承認済み）およびPhase15.1
 * レビュー（2026-07-18、shojiさん）で指定された保持場所・責務definitionの実装。
 *
 * `engine/interactionLogging`（Phase15.1、`resolveTeachingNoteIdsByStructureKey()`）が
 * StructureKeyから解決したteachingNoteId配列を、症例完了までの間だけ一時保持する。
 *
 * 【永続化しない】`useLearningHistoryStore`（Phase14.3）と同じ方針。localStorage/IndexedDB等
 * への保存は一切行わない。`zustand/middleware`の`persist`は使用しない。ページ再読み込みで
 * リセットされるRuntime状態のみ。
 * 【薄いstorageのみ】クリックされたteachingNoteIdの集合（重複排除・挿入順維持、
 * `engine/learningSession`の`appendTeachingNoteId`と同じ重複ポリシー）の保持・追加・クリアの
 * みを提供する。「どのStructureKeyがどのteachingNoteIdへ解決されるか」の判断ロジックは持たない
 * （それは`engine/interactionLogging`の責務、Phase15.1で確定済み）。
 * 【engineへの状態混入禁止】Phase14レビュー所見「engine内state禁止」を踏襲し、状態は
 * 本ファイル（`store`層）にのみ置く。`engine/interactionLogging`は引き続き純粋関数のみ。
 * 【既存`useSimStore`/`useLearningHistoryStore`とは独立】別関心事を混在させない。
 *
 * Phase15.2時点ではどのシーン・コンポーネントからも呼び出されていない
 * （Phase15.4で`AnatomyScene`/`LearningMode`への配線を予定、Small Change分割案参照）。
 */
import { create } from 'zustand';

interface LearningEvidenceState {
  /** セッション中にクリックされたteachingNoteIdの集合（重複排除・挿入順維持）。 */
  readonly clickedTeachingNoteIds: readonly string[];
  /**
   * `ids`を`clickedTeachingNoteIds`へ追加する。既存idはスキップし、新規idのみ末尾へ追加する
   * （`engine/learningSession`の`appendTeachingNoteId`と同じ重複排除ポリシー）。追加対象が1件も
   * 無い場合（全て既存id、または空配列）は既存配列を再生成せず同一参照を保つ。
   */
  addTeachingNoteIds: (ids: readonly string[]) => void;
  /** `clickedTeachingNoteIds`を空配列へ戻す。症例完了後の次セッション開始時に呼び出す想定
   * （Phase15.3以降で配線）。 */
  clear: () => void;
}

export const useLearningEvidenceStore = create<LearningEvidenceState>((set) => ({
  clickedTeachingNoteIds: [],
  addTeachingNoteIds: (ids) =>
    set((state) => {
      const existing = new Set(state.clickedTeachingNoteIds);
      const additions = ids.filter((id) => !existing.has(id));
      if (additions.length === 0) {
        return state;
      }
      return { clickedTeachingNoteIds: [...state.clickedTeachingNoteIds, ...additions] };
    }),
  clear: () => set({ clickedTeachingNoteIds: [] }),
}));
