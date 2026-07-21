/**
 * engine/safety/types.ts ─── Safety Foundation 型定義 (Phase20.1)
 *
 * data/dangerZones.ts（DANGER_ZONES）をSingle Source of Truthとして扱う。
 * EarAtlas/engine/query（findProximityAlerts等）には依存しない。両者は別データソースであり、
 * 現在アプリ内で実際に危険構造として使われているのはDANGER_ZONES側のため
 * （Phase20設計レビュー v1.1、2026-07-21確認）。ID体系統一はPhase20のNon-goal。
 */
import type { Vec3Tuple } from '../coordinates/types';

/** 近接度合い。zone.dangerRadius以内='danger'、zone.warningRadius以内='warning'。 */
export type DangerAlertLevel = 'warning' | 'danger';

/** 1つのDANGER_ZONEに対する近接判定結果。 */
export interface DangerAlert {
  readonly dangerZoneId: string;
  readonly nameJa: string;
  readonly distanceMm: number;
  readonly level: DangerAlertLevel;
}

/** checkProximityToDanger()への入力点。 */
export type SafetyQueryPoint = Vec3Tuple;
