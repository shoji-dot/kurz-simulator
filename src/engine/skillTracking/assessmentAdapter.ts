/**
 * engine/skillTracking/assessmentAdapter.ts ── Assessment Adapter（Phase18.3）
 *
 * 設計書: Phase18_SkillTracking_API設計_v1.0.md / shojiさんPhase18.3確認事項（2026-07-19）。
 * 責務は「AssessmentResult → SkillObservation[]への変換」のみに限定する。
 *
 * Adapterがやること: useLearningHistoryStoreの公開API(getState())経由でのhistory取得・
 * AssessmentResult.strengths/weaknessesからKnowledge軸(anatomyRecognition)のSkillObservationへの
 * 変換。
 * Adapterがやらないこと（すべてPhase18.4 Skill Aggregatorの責務）: 平均・統合・スコア算出・
 * Technical軸の生成。
 *
 * 【Technical軸を生成しない理由】AssessmentResultはmasteryLevel/strengths/weaknesses（教材参照の
 * 集合演算結果）のみを持ち、sizeAccuracy等のTechnical軸に相当するデータを持たない
 * （Technical軸はPhase18.2 ScoreHistory Adapterの担当）。
 */
import type { SkillObservation } from './types';
import type { AssessmentResult } from '../assessment';
import { useLearningHistoryStore } from '../../store/useLearningHistoryStore';

/**
 * 1件のAssessmentResultから、Knowledge軸(anatomyRecognition)のSkillObservation[]へ変換する
 * 純粋関数（useLearningHistoryStore非依存）。
 *
 * strengths（関連教材のうち参照済み、= relatedNotes ∩ teachingNoteIds）の1件を value=100、
 * weaknesses（未参照、= relatedNotes − teachingNoteIds）の1件を value=0 の観測事実として、
 * それぞれ1件ずつのSkillObservationへ変換するのみ。複数件の平均化・統合は行わない
 * （strengths/weaknessesの要素数に応じてSkillObservationの件数が変わる設計、平均・スコア算出は
 * Aggregatorへ委譲）。
 *
 * observedAtは呼び出し側から受け取る（Pure Function、Phase9.2 createSession()と同じ方針。
 * AssessmentResult/RecommendationResultのいずれも実際の観測時刻を持つフィールドを持たないため、
 * この関数自身はDate.now()等の非決定的処理を持たない）。
 */
export function assessmentResultToObservations(
  result: AssessmentResult,
  observedAt: string,
): readonly SkillObservation[] {
  const strengthObservations: readonly SkillObservation[] = result.strengths.map(
    (): SkillObservation => ({
      skillId: 'anatomyRecognition',
      value: 100,
      observedAt,
      source: 'assessment',
    }),
  );
  const weaknessObservations: readonly SkillObservation[] = result.weaknesses.map(
    (): SkillObservation => ({
      skillId: 'anatomyRecognition',
      value: 0,
      observedAt,
      source: 'assessment',
    }),
  );
  return [...strengthObservations, ...weaknessObservations];
}

/**
 * Assessment Adapter本体。useLearningHistoryStoreの公開API（`getState()`、SimulationMode.tsxの
 * `useLearningHistoryStore.getState().addEntry(...)`と同じ既存の呼び出し方式）のみを利用し、
 * history各エントリの`assessment`をassessmentResultToObservations()へ委譲する薄いラッパー。
 * 内部状態（zustand storeの実装詳細）には依存しない。
 *
 * 【既知の制約】AssessmentResult/LearningHistoryEntry/RecommendationResultのいずれにも実際の
 * 観測時刻（セッション完了時刻）を持つフィールドが存在しない（Phase9 LearningSession.startedAtが
 * LearningHistoryEntryへ引き継がれていない、Phase18範囲外の上流設計ギャップ）。そのため本関数は
 * 変換実行時刻（`new Date().toISOString()`）を全エントリ共通のobservedAtとして使う。過去セッション
 * の実際の完了時刻を表すものではない点に注意（Phase18.4 Aggregator・将来のUI表示側は、この値を
 * 「最終同期時刻」程度の意味として扱うこと）。
 *
 * 【API契約】Assessment由来のObservationのobservedAtは取得時刻であり、学習イベントの発生時刻
 * ではない。並び替え・時系列解析・経時変化の根拠として利用してはならない（types.ts
 * SkillObservation.observedAtのJSDocと同一の契約）。
 */
export function adaptAssessmentHistory(): readonly SkillObservation[] {
  const { history } = useLearningHistoryStore.getState();
  const observedAt = new Date().toISOString();
  const observations: SkillObservation[] = [];
  for (const entry of history) {
    observations.push(...assessmentResultToObservations(entry.assessment, observedAt));
  }
  return observations;
}
