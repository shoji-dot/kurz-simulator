/**
 * developerTools/learningPipeline/collectLearningPipelineDebugData.ts
 *   ── Learning Pipeline Debug Data Provider (Phase19.1)
 *
 * `Phase18_SkillTracking_凍結_v1.0.md`「Phase19への接続」節、およびshojiさん承認のPhase19
 * スコープ（19.1 Debug Data Provider → 19.2 Debug Panel UI → 19.3 Read Only Timeline →
 * 19.4 Drill接続準備）に基づく。
 *
 * 責務は「Phase15 Evidence・Phase14 History（Assessment/Recommendation）・Phase18 Skillを
 * 1箇所で読み取り、1つのオブジェクトへ集約する」ことのみ。表示（UI）は持たない
 * （Phase19.2で別途実装予定）。新しい評価・推奨・集計ロジックは一切追加せず、すべて既存の
 * Phase10（assessment）/Phase11（recommendation）/Phase14（applicationIntegration、実体は
 * store経由）/Phase15（evidence）/Phase18（skillTracking）の公開APIへの委譲のみで構成する。
 *
 * 【最新1件のみを扱う理由】Phase14 LearningHistoryは複数セッション分の配列（時系列、古い順）
 * だが、Debug Panelは「直近の状態を俯瞰する」用途のため、本関数は最新1件（配列末尾）のみを
 * assessment/recommendationとして返す設計とした。historyが空の場合は両方ともnullを返す。
 * 複数セッションの時系列表示が必要になった場合はPhase19.3（Read Only Timeline）で別途検討する
 * （実装中に判明した設計判断、shojiさん確認要）。
 *
 * 【Phase19.1レビューでshojiさん承認済み・API契約として明記】
 * `collectLearningPipelineDebugData()` is intended to provide the current learning
 * pipeline snapshot. Therefore, `assessment` and `recommendation` expose only the
 * latest `LearningHistory` entry. Historical visualization is explicitly delegated
 * to Phase19.3 (Timeline).
 *
 * 【observationsを公開する理由】skillProfileの算出に使ったSkillObservation[]
 * （scoreHistory由来 + assessment由来を結合したもの）をそのまま公開する。Phase19.3の
 * Timeline表示（`observedAt`が実測時刻かAssessment由来の取得時刻かの区別、
 * `SkillObservation.source`参照）で再利用する想定。
 *
 * 【読み取り専用・副作用なし】呼び出しは状態を変更しない。呼び出しごとに現在の状態を
 * 再集計するのみで、キャッシュ・購読（subscribe）は行わない（Phase19.2側がpolling・
 * useStore等で再取得する運用を想定）。
 */
import { useLearningHistoryStore } from '../../store/useLearningHistoryStore';
import { useLearningEvidenceStore } from '../../store/useLearningEvidenceStore';
import type { AssessmentResult } from '../../engine/assessment';
import type { RecommendationResult } from '../../engine/recommendation';
import {
  adaptScoreHistory,
  adaptAssessmentHistory,
  aggregateSkillProfile,
} from '../../engine/skillTracking';
import type { SkillObservation, SkillProfile } from '../../engine/skillTracking';

/** `collectLearningPipelineDebugData()`の戻り値。表示専用データの集約結果（判断ロジックなし）。 */
export interface LearningPipelineDebugData {
  /** Phase15 Evidence: セッション中にクリックされたteachingNoteIdの集合（挿入順維持）。 */
  readonly evidence: readonly string[];
  /** Phase14 History最新1件のAssessment結果。historyが空の場合はnull。 */
  readonly assessment: AssessmentResult | null;
  /** Phase14 History最新1件のRecommendation結果。historyが空の場合はnull。 */
  readonly recommendation: RecommendationResult | null;
  /** Phase18 Skill Aggregatorの集約結果（4Skill軸、常に固定件数）。 */
  readonly skillProfile: SkillProfile;
  /**
   * skillProfile算出に使われたSkillObservation[]（scoreHistory由来 + assessment由来）。
   * 各要素の`source`/`observedAt`の意味の違いはPhase18 API契約（`SkillObservation`型定義の
   * JSDoc参照）に従う。ここでは並び替え・フィルタ等の加工は一切行わない。
   */
  readonly observations: readonly SkillObservation[];
}

/**
 * Phase15/14/18の公開APIのみを読み取り、1つのオブジェクトへ集約する。
 * 副作用（状態変更）を行わない読み取り専用関数。
 */
export function collectLearningPipelineDebugData(): LearningPipelineDebugData {
  const { history } = useLearningHistoryStore.getState();
  const { clickedTeachingNoteIds } = useLearningEvidenceStore.getState();
  const latestEntry = history.length > 0 ? history[history.length - 1] : null;

  const observations: readonly SkillObservation[] = [
    ...adaptScoreHistory(),
    ...adaptAssessmentHistory(),
  ];

  return {
    evidence: clickedTeachingNoteIds,
    assessment: latestEntry?.assessment ?? null,
    recommendation: latestEntry?.recommendation ?? null,
    skillProfile: aggregateSkillProfile(observations),
    observations,
  };
}
