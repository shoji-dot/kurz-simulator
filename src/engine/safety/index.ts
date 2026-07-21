/**
 * engine/safety/index.ts ─── Safety Foundation バレル (Phase20.1、Phase21.1で追記)
 *
 * checkProximityToDanger（proximity.ts）/ computeSafetyScore（score.ts）/
 * describeSafetyAlert（feedback.ts）を公開する。SelfCheck（Phase20.2で追加済み）は
 * engine/query/selfCheck.ts等と同じ理由でこのバレルからは意図的にexportしない。
 * Phase20.3でuseSimStore.tsへ配線済み（computeSafetyアクション、scoreResultとは独立したstate）。
 * 座標変換はengine/coordinates/placementFrame.ts、Scene層からの呼び出し配線はPhase20.4c。
 * findNearestDangerZone（Phase20.5.2追加）はデバッグ・原因切り分け専用。warningRadius判定を
 * 行わない生の最短距離を返すだけで、Safety Score算出（computeSafetyScore）には使わない。
 * SafetyFeedback（Phase21.1追加）はdescribeSafetyAlert()の戻り値型（Phase21.2で変更予定）。
 */
export type { DangerAlert, DangerAlertLevel, SafetyQueryPoint, SafetyFeedback } from './types';
export { SAFETY_SCORE_MAX, SAFETY_SCORE_MIN, SAFETY_SCORE_PENALTY } from './constants';
export { checkProximityToDanger, findNearestDangerZone } from './proximity';
export type { NearestDangerZoneState } from './proximity';
export { computeSafetyScore } from './score';
export { describeSafetyAlert } from './feedback';
