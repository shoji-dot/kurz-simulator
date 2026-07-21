/**
 * engine/safety/proximity.ts ─── 危険構造への近接判定 (Phase20.1)
 *
 * data/dangerZones.ts（DANGER_ZONES）を直接参照する。EarAtlas/engine/query経由の
 * findProximityAlerts()は使わない（Phase20設計レビューv1.1で判明: 対象データが異なり、
 * 現在アプリ内で実際に使われている危険構造はDANGER_ZONES側のため。findProximityAlertsは
 * どこからも配線されていない未使用の層であり、依存すればID体系統一というPhase20の
 * Non-goalへ踏み込むことになる）。
 * ベクトル演算はengine/spatial/query.tsと同じ方針でengine/coordinates/vectorMath.tsを
 * 再利用し、独自の距離計算を重複実装しない。
 *
 * engine/dangerModel.ts（削開中のリアルタイム危険検知、bone thicknessベース）とは別の
 * 関心事。本モジュールはプロステーシス設置（1点・静的）の安全性判定を扱う。
 */
import { DANGER_ZONES } from '../../data/dangerZones';
import type { DangerZone } from '../../data/dangerZones';
import { lengthVec3, subtractVec3 } from '../coordinates/vectorMath';
import type { DangerAlert, DangerAlertLevel, SafetyQueryPoint } from './types';

/**
 * pointと各DANGER_ZONEとの距離を、そのゾーン自身のwarningRadius/dangerRadiusと比較し、
 * 該当するものだけをDangerAlert[]として返す（近い順）。どのゾーンにも該当しなければ
 * 空配列を返す（例外を投げない、他engine/*と同じnullポリシー）。
 * 検索半径のような追加パラメータは持たない。各DANGER_ZONEが既に構造ごとに較正された
 * warningRadius/dangerRadiusを持つため、それをSingle Source of Truthとしてそのまま使う。
 */
/** findNearestDangerZone()専用のstate（Phase20.5.3）。DangerAlertLevelに'safe'を加えたもの。 */
export type NearestDangerZoneState = DangerAlertLevel | 'safe';

/**
 * デバッグ・原因切り分け専用（Phase20.5.2、Phase20.5.3でstate追加）。checkProximityToDanger()は
 * warningRadius圏外のゾーンを結果から除外するため、「近づけたつもりが警告が出ない」ケースで実際の
 * 最短距離が分からない。本関数はwarningRadiusとの比較を行わず、全DANGER_ZONESの中から単純に最も
 * 近いものを1件返す（境界の意味づけ自体はcheckProximityToDangerと同じ、閾値判定なしで生の距離を
 * 見るためのユーティリティ）。UI（SimScene.tsxのSafety Debugパネル等）からのみ使用する想定。
 * stateは境界判定の結果をそのまま返すだけで、Safety Score算出（computeSafetyScore）には使わない
 * （shojiさんPhase20.5.2レビュー所見「distance/warning/dangerから人間が判定するのではなく、
 * 内部判定そのものを表示すると分かりやすい」に対応）。
 */
export function findNearestDangerZone(
  point: SafetyQueryPoint,
): { zone: DangerZone; distanceMm: number; state: NearestDangerZoneState } | null {
  let nearest: { zone: DangerZone; distanceMm: number } | null = null;
  for (const zone of DANGER_ZONES) {
    const distanceMm = lengthVec3(subtractVec3(point, zone.position));
    if (!nearest || distanceMm < nearest.distanceMm) nearest = { zone, distanceMm };
  }
  if (!nearest) return null;
  const state: NearestDangerZoneState =
    nearest.distanceMm <= nearest.zone.dangerRadius ? 'danger'
    : nearest.distanceMm <= nearest.zone.warningRadius ? 'warning'
    : 'safe';
  return { ...nearest, state };
}

export function checkProximityToDanger(point: SafetyQueryPoint): DangerAlert[] {
  const alerts: DangerAlert[] = [];
  for (const zone of DANGER_ZONES) {
    const distanceMm = lengthVec3(subtractVec3(point, zone.position));
    if (distanceMm > zone.warningRadius) continue;
    const level: DangerAlertLevel = distanceMm <= zone.dangerRadius ? 'danger' : 'warning';
    alerts.push({ dangerZoneId: zone.id, nameJa: zone.nameJa, distanceMm, level });
  }
  return alerts.sort((a, b) => a.distanceMm - b.distanceMm);
}
