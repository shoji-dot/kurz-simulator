/**
 * engine/applicationIntegration/types.ts ─── Application Integration Layer 型定義 (Phase14.1)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§4の実装。
 * 既存SimulationModeの症例完了イベントから`LearningSession`（Phase9公開型）を組み立てるための
 * 入力型のみを定義する。ロジックは持たない（型定義のみ）。
 *
 * 【新しい判断ロジックを持たない（設計書§2・§6注意1で確定）】Application Integration Layerは
 * 既存Engine公開APIの呼び出し順序を管理するのみで、教育判断・推薦判断を一切追加しない。
 */

/** 症例完了イベント（`SimulationMode`の結果画面表示タイミング）から渡される最小限の入力。 */
export interface CaseCompletionInput {
  /** セッションid。呼び出し側（UI側）が生成する（Phase9の`createSession()`と同じ方針、非決定的
   *  処理をこの層の内部に持たない）。 */
  readonly sessionId: string;
  /** ISO 8601。呼び出し側が生成する。 */
  readonly startedAt: string;
  /** Case Generator（Phase7凍結）の`SurgicalCase.id`。 */
  readonly caseId: string;
}
