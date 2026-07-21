/**
 * engine/safety/score.ts ─── Safety Score 算出 (Phase20.1)
 *
 * 既存のuseSimStore.computeScore()（Placement Score）は変更しない。Safety Scoreは
 * 完全に独立した戻り値として扱う（Phase20設計ドラフトv1.0 Compatibility Policy、
 * shojiさんPhase20.1レビュー所見: 「Placement 95 / Safety 30」も許容する設計とする）。
 */
import { SAFETY_SCORE_MAX, SAFETY_SCORE_MIN, SAFETY_SCORE_PENALTY } from './constants';
import type { DangerAlert } from './types';

/**
 * DangerAlert[]から単一のSafety Score（0-100）を算出する。100から各alertの減点幅
 * （constants.ts）を減算し、[SAFETY_SCORE_MIN, SAFETY_SCORE_MAX]にクランプするのみ。
 * alertsが空配列なら100を返す。
 */
export function computeSafetyScore(alerts: DangerAlert[]): number {
  const penalty = alerts.reduce((sum, alert) => sum + SAFETY_SCORE_PENALTY[alert.level], 0);
  return Math.min(SAFETY_SCORE_MAX, Math.max(SAFETY_SCORE_MIN, SAFETY_SCORE_MAX - penalty));
}
