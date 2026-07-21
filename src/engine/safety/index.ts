/**
 * engine/safety/index.ts ─── Safety Foundation バレル (Phase20.1)
 *
 * checkProximityToDanger（proximity.ts）/ computeSafetyScore（score.ts）/
 * describeSafetyAlert（feedback.ts）を公開する。SelfCheck（Phase20.2で追加予定）は
 * engine/query/selfCheck.ts等と同じ理由でこのバレルからは意図的にexportしない。
 * 本ファイルはPhase20.1時点でどこからもimportされていない（useSimStore/SimSceneへの
 * 配線はPhase20.3以降）。既存コード（useSimStore.ts・SimScene.tsを含む）は無変更。
 */
export type { DangerAlert, DangerAlertLevel, SafetyQueryPoint } from './types';
export { SAFETY_SCORE_MAX, SAFETY_SCORE_MIN, SAFETY_SCORE_PENALTY } from './constants';
export { checkProximityToDanger } from './proximity';
export { computeSafetyScore } from './score';
export { describeSafetyAlert } from './feedback';
