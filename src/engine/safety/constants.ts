/**
 * engine/safety/constants.ts ─── Safety Score 算出係数 (Phase20.1)
 *
 * DANGER_ZONE自体のwarningRadius/dangerRadius（data/dangerZones.ts、構造ごとに文献値で
 * 較正済み）は変更しない。ここではcomputeSafetyScore()がDangerAlertLevelから減点幅へ
 * 変換する際の係数のみを定数化する。医師レビューによる将来的な再較正（MacEwen三角Step2と
 * 同種の運用）をロジック変更なしで反映できるようにするため（shojiさんPhase20.1レビュー所見、
 * 2026-07-21）。
 */
import type { DangerAlertLevel } from './types';

/** レベル別の減点幅（100点満点からの減算、mm単位ではなく点数）。 */
export const SAFETY_SCORE_PENALTY: Record<DangerAlertLevel, number> = {
  warning: 15,
  danger: 40,
};

export const SAFETY_SCORE_MIN = 0;
export const SAFETY_SCORE_MAX = 100;
