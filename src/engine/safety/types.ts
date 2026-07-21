/**
 * engine/safety/types.ts ─── Safety Foundation 型定義 (Phase20.1、Phase21.1で追記)
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

/**
 * 学習者向けの構造化Safety Feedback (Phase21.1)。
 * DangerAlert（距離判定）とDANGER_ZONESの臨床知識（clinicalNoteJa/complicationJa）を
 * 結合したもの。Engine層の型のためUI語彙（title/severity等）は持たず、DangerAlertと
 * 同じフィールド名（nameJa/level）を踏襲する。clinicalNote/complicationは対応する
 * DANGER_ZONEにデータがない場合はフィールド自体を省略する（空文字列へのフォールバックはしない）。
 * Phase21設計レビュー（Phase21_ClinicalSafetyEducationLayer_API設計_v1.0.md）でshojiさん承認済み。
 */
export interface SafetyFeedback {
  readonly dangerZoneId: string;
  readonly nameJa: string;
  readonly distanceMm: number;
  readonly level: DangerAlertLevel;
  readonly clinicalNote?: string;
  readonly complication?: string;
}
