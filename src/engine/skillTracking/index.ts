/**
 * engine/skillTracking/index.ts ── Skill Tracking Layer バレル（Phase18.5）
 *
 * Phase18.1（型定義）〜18.4（Aggregator）で確定した公開APIを再公開するのみのバレル。
 * `engine/query/index.ts`（Phase5）等と同じ位置づけ。ロジックは一切持たない。
 *
 * `selfCheck.ts`（Phase18.5）は`engine/assessment/index.ts`等と同じ理由で意図的に未export
 * （公開APIの一部ではなく開発時専用の副作用ファイル）。
 *
 * 本ファイルもPhase18.5時点ではどのシーン・コンポーネント・storeからも一切importされていない
 * （Strangler Pattern継続、配線はPhase18完了後の別途判断）。
 */
export type {
  SkillCategory,
  TechnicalSkillId,
  KnowledgeSkillId,
  SkillId,
  SkillDefinition,
  SkillObservationSource,
  SkillObservation,
  SkillScore,
  SkillProfile,
} from './types';
export { SKILL_DEFINITIONS } from './definitions';
export { parseScoreHistoryToObservations, adaptScoreHistory } from './scoreHistoryAdapter';
export { assessmentResultToObservations, adaptAssessmentHistory } from './assessmentAdapter';
export { aggregateSkillProfile } from './aggregator';
