/**
 * engine/safety/feedback.ts ─── Safety Feedback 生成 (Phase20.1、Phase21.2で構造化)
 *
 * DangerAlert[]を、DANGER_ZONESの臨床知識（clinicalNoteJa/complicationJa）と結合し、
 * 学習者向けの構造化SafetyFeedback[]へ変換するだけの層。判定ロジック（proximity.ts）・
 * スコア算出（score.ts）には関与しない（Query Engine Semantic層の「数値を教育上の意味へ
 * 変換するだけ」という既存方針をSafety層でも踏襲）。
 * DANGER_ZONESをdangerZoneIdでlookupする点はproximity.tsと同じSSoT参照パターン。
 * clinicalNoteJa/complicationJaが存在しない場合はフィールド自体を省略する（空文字列への
 * フォールバックはしない、Phase21設計レビューでのshojiさん指摘を反映）。
 * Phase21設計レビュー（Phase21_ClinicalSafetyEducationLayer_API設計_v1.0.md）でshojiさん承認済み。
 */
import { DANGER_ZONES } from '../../data/dangerZones';
import type { DangerAlert, SafetyFeedback } from './types';

/**
 * DangerAlert[]を、距離順（=引数の順序をそのまま維持）のSafetyFeedback[]へ変換する。
 * 各alertのdangerZoneIdでDANGER_ZONESを参照し、該当ゾーンが見つかりclinicalNoteJa/
 * complicationJaを持つ場合のみclinicalNote/complicationを付与する。ゾーンが見つからない
 * 場合も例外は投げず、clinicalNote/complicationを省略したSafetyFeedbackを返す（他engine/*と
 * 同じnullセーフ方針）。alertsが空配列なら空配列を返す。
 */
export function describeSafetyAlert(alerts: DangerAlert[]): SafetyFeedback[] {
  return alerts.map((alert) => {
    const zone = DANGER_ZONES.find((z) => z.id === alert.dangerZoneId);
    return {
      dangerZoneId: alert.dangerZoneId,
      nameJa: alert.nameJa,
      distanceMm: alert.distanceMm,
      level: alert.level,
      ...(zone?.clinicalNoteJa ? { clinicalNote: zone.clinicalNoteJa } : {}),
      ...(zone?.complicationJa ? { complication: zone.complicationJa } : {}),
    };
  });
}
