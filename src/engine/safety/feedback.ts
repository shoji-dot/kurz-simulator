/**
 * engine/safety/feedback.ts ─── Safety Feedback 文言生成 (Phase20.1)
 *
 * DangerAlert[]を学習者向けの日本語メッセージへ変換するだけの層。判定ロジック
 * （proximity.ts）・スコア算出（score.ts）には関与しない（Query Engine Semantic層の
 * 「数値を教育上の意味へ変換するだけ」という既存方針をSafety層でも踏襲）。
 */
import type { DangerAlert } from './types';

/**
 * DangerAlert[]を、距離順（=引数の順序をそのまま維持）の日本語メッセージ配列へ変換する。
 * alertsが空配列なら空配列を返す。
 */
export function describeSafetyAlert(alerts: DangerAlert[]): string[] {
  return alerts.map((alert) => {
    const distText = `${alert.distanceMm.toFixed(1)}mm`;
    return alert.level === 'danger'
      ? `${alert.nameJa}まで${distText} — 危険域に接近しています`
      : `${alert.nameJa}まで${distText} — 警告域に接近しています`;
  });
}
