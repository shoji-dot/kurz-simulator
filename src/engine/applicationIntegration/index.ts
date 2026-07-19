/**
 * engine/applicationIntegration/index.ts ─── Application Integration Layer バレル (Phase14.1〜15.3)
 *
 * `CaseCompletionInput`型（types.ts）+ `createSessionFromCaseCompletion`（sessionEntry.ts、
 * Phase14.1）+ `assessLearningSession`（assessmentEntry.ts、Phase14.2）+
 * `recommendFromAssessment`（recommendationEntry.ts、Phase14.3）+ `deriveAdaptivePlan`
 * （adaptivePlanEntry.ts、Phase14.3）+ `appendLearningEvidenceToSession`（evidenceEntry.ts、
 * Phase15.3）を公開する。いずれも対応するPhase9〜12公開APIへの薄い橋渡しのみで、新しい判断
 * ロジックは追加しない（設計書§6注意1「Integration Layerは判断禁止」）。
 * Phase14.4（Learner Application表示、`LearningDashboard.tsx`）はこれらの関数をUI側から
 * importして利用する。
 *
 * `LearningHistory`の実行時保持（Zustand slice）はEngine層ではなくApplication側
 * （`src/store/useLearningHistoryStore.ts`）の責務とし、本バレルはそれを知らない
 * （shojiさんPhase14.2レビュー所見「LearningHistory保持場所はApplication側」・
 * 「engine内state禁止」に対応）。同じ方針で、Phase15.2の`useLearningEvidenceStore`にも
 * 本バレルは依存しない（`appendLearningEvidenceToSession`はプレーンな`readonly string[]`を
 * 受け取るのみ）。
 *
 * Phase14.5で`selfCheck.ts`（開発時自己診断、7項目）を追加した。Phase3〜13と同じ理由でこの
 * バレルからは意図的にexportしない（公開APIの一部ではなく開発時専用の副作用ファイル。
 * `useLearningHistoryStore`/`LearningDashboard.tsx`のテストはGUI Acceptance Test側の責務、
 * `Phase14.5_GUIAcceptanceTest_チェックリスト_2026-07-18.md`参照）。
 * これでPhase14設計書のSmall Change分割案（14.1〜14.5）の実装がすべて完了した。
 *
 * Phase3〜13と異なり、本Phaseは意図的に既存UI（`SimulationMode.tsx`）から呼び出される
 * （Application Integration Layerという名前のとおり、既存Engine群と実UIをつなぐことが目的の
 * ため。Strangler Patternの「配線しない」ではなく「最小の配線を行う」フェーズ、設計書§2）。
 *
 * Phase15.3で`appendLearningEvidenceToSession`（evidenceEntry.ts）を追加した。既存の
 * `createSessionFromCaseCompletion`（Phase14.1）は無変更のまま、Interaction Evidence
 * （Phase15.2 `useLearningEvidenceStore`由来）を独立APIとして追加反映する構成とした
 * （shojiさんPhase15.2レビュー指定「createSessionFromCaseCompletion()は変更禁止」に対応）。
 * 呼び出し側（Phase15.4予定）は`appendLearningEvidenceToSession(createSessionFromCaseCompletion(input), clickedTeachingNoteIds)`
 * のように両関数を合成して使う想定。
 */
export type { CaseCompletionInput } from './types';
export { createSessionFromCaseCompletion } from './sessionEntry';
export { assessLearningSession } from './assessmentEntry';
export { recommendFromAssessment } from './recommendationEntry';
export { deriveAdaptivePlan } from './adaptivePlanEntry';
export { appendLearningEvidenceToSession } from './evidenceEntry';
