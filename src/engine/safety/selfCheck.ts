/**
 * engine/safety/selfCheck.ts ── 開発時セルフチェック (Phase20.2)
 *
 * engine/query/selfCheck.ts（Phase5.6）・engine/spatial/selfCheck.ts（Phase4.6）と同じ
 * `if (import.meta.env.DEV)` パターンを踏襲する。
 *
 * 【注意・重要】このファイル自体はどのシーン・App.tsxからもimportされていない。
 * `index.ts`からも意図的にexportしない（他engine/*のselfCheck.tsと同じ理由。公開APIの
 * 一部ではなく開発時専用の副作用ファイル）。
 *
 * 確認する6項目（shojiさんPhase20.1レビュー所見「境界値テストを1件追加」を反映）:
 *   1. ゾーン中心（距離0）でdanger判定される、かつ隣接ゾーンもwarningとして検出される
 *   2. warningRadius内・dangerRadius外の点でwarning判定される
 *   3. 境界値（distance===dangerRadius／distance===warningRadius）での判定が固定されている
 *      （将来、医師レビューで半径の数値だけが変わっても判定仕様自体はぶれないことの保証）
 *   4. warningRadiusの外側にある点はアラート対象外（空配列）になる
 *   5. computeSafetyScore()の加算性・下限クランプ（0未満にならない）
 *   6. describeSafetyAlert()の文言（危険域/警告域）・空配列時の空配列返却
 *
 * Negative Control（判定ロジックを意図的に反転させた場合にテストが検出できるか）は、
 * Phase20.1実装時にsandbox上で一時的な別実装との比較により確認済み（本ファイルには含めない、
 * [[feedback]]の既存運用どおり本実装への組み込みは行わない）。
 */
import { DANGER_ZONES } from '../../data/dangerZones';
import { checkProximityToDanger } from './proximity';
import { computeSafetyScore } from './score';
import { describeSafetyAlert } from './feedback';
import type { DangerAlert } from './types';

const FACIAL_TYMPANIC_ID = 'facial-tympanic'; // warningRadius=5 dangerRadius=2
const FACIAL_GENU_ID = 'facial-genu'; // facial-tympanicから約4.47mm（隣接区間）

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function getZone(id: string) {
  const zone = DANGER_ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`selfCheck: unknown danger zone id ${id}`);
  return zone;
}

/** zoneの位置からY軸方向にoffsetMmだけ離れた点を返す（境界値テスト用の合成点）。 */
function offsetPoint(zone: ReturnType<typeof getZone>, offsetMm: number): readonly [number, number, number] {
  return [zone.position[0], zone.position[1] + offsetMm, zone.position[2]];
}

function checkDangerAtZoneCenterWithAdjacent(): CheckResult {
  const zone = getZone(FACIAL_TYMPANIC_ID);
  const alerts = checkProximityToDanger(zone.position);
  const self = alerts.find((a) => a.dangerZoneId === FACIAL_TYMPANIC_ID);
  const adjacent = alerts.find((a) => a.dangerZoneId === FACIAL_GENU_ID);

  const ok =
    self !== undefined &&
    self.level === 'danger' &&
    self.distanceMm === 0 &&
    adjacent !== undefined &&
    adjacent.level === 'warning';
  return { name: 'ゾーン中心(距離0)でdanger、隣接ゾーンはwarning', ok, detail: JSON.stringify(alerts) };
}

function checkWarningWithinRadius(): CheckResult {
  const zone = getZone(FACIAL_TYMPANIC_ID);
  const alerts = checkProximityToDanger(offsetPoint(zone, 3.5)); // dangerRadius(2) < 3.5 < warningRadius(5)
  const self = alerts.find((a) => a.dangerZoneId === FACIAL_TYMPANIC_ID);

  const ok = self !== undefined && self.level === 'warning';
  return { name: 'dangerRadius外・warningRadius内でwarning', ok };
}

/**
 * 境界値（distance===dangerRadius、distance===warningRadius）での判定を固定する。
 * 現行仕様: distance<=dangerRadius→danger、distance<=warningRadius→warning、それ以外は対象外。
 * 将来DANGER_ZONESの半径数値だけが変わっても、この境界仕様自体は変えない前提のテスト。
 */
function checkExactBoundaryValues(): CheckResult {
  const zone = getZone(FACIAL_TYMPANIC_ID);

  const atDangerRadius = checkProximityToDanger(offsetPoint(zone, zone.dangerRadius))
    .find((a) => a.dangerZoneId === FACIAL_TYMPANIC_ID);
  const atWarningRadius = checkProximityToDanger(offsetPoint(zone, zone.warningRadius))
    .find((a) => a.dangerZoneId === FACIAL_TYMPANIC_ID);
  const justOutsideWarningRadius = checkProximityToDanger(offsetPoint(zone, zone.warningRadius + 0.01))
    .find((a) => a.dangerZoneId === FACIAL_TYMPANIC_ID);

  const ok =
    atDangerRadius !== undefined &&
    atDangerRadius.level === 'danger' &&
    atWarningRadius !== undefined &&
    atWarningRadius.level === 'warning' &&
    justOutsideWarningRadius === undefined;
  return {
    name: '境界値(distance===dangerRadius／===warningRadius)の判定固定',
    ok,
    detail: `atDangerRadius=${atDangerRadius?.level} atWarningRadius=${atWarningRadius?.level} justOutside=${justOutsideWarningRadius === undefined ? 'none' : justOutsideWarningRadius.level}`,
  };
}

function checkOutsideAllZones(): CheckResult {
  const farPoint: readonly [number, number, number] = [1000, 1000, 1000];
  const alerts = checkProximityToDanger(farPoint);

  const ok = alerts.length === 0 && computeSafetyScore(alerts) === 100;
  return { name: '全ゾーンから離れた点は空配列・Safety Score=100', ok };
}

function checkScoreAdditivityAndClamp(): CheckResult {
  const zone = getZone(FACIAL_TYMPANIC_ID);
  const nearAlerts = checkProximityToDanger(zone.position); // danger(自身) + warning(facial-genu)
  const additiveOk = computeSafetyScore(nearAlerts) === 100 - 40 - 15;

  const allDangerMock: DangerAlert[] = DANGER_ZONES.map((z) => ({
    dangerZoneId: z.id,
    nameJa: z.nameJa,
    distanceMm: 0,
    level: 'danger',
  }));
  const clampOk = computeSafetyScore(allDangerMock) === 0;

  const ok = additiveOk && clampOk;
  return { name: 'Safety Scoreの加算性・下限0クランプ', ok, detail: `additive=${additiveOk} clamp=${clampOk}` };
}

function checkFeedbackMessages(): CheckResult {
  const zone = getZone(FACIAL_TYMPANIC_ID);
  const dangerMsg = describeSafetyAlert([{ dangerZoneId: zone.id, nameJa: zone.nameJa, distanceMm: 0, level: 'danger' }]);
  const warningMsg = describeSafetyAlert([{ dangerZoneId: zone.id, nameJa: zone.nameJa, distanceMm: 3.5, level: 'warning' }]);
  const emptyMsg = describeSafetyAlert([]);

  const ok =
    dangerMsg.length === 1 &&
    dangerMsg[0].includes('危険域') &&
    warningMsg.length === 1 &&
    warningMsg[0].includes('警告域') &&
    emptyMsg.length === 0;
  return { name: 'describeSafetyAlert()の文言・空配列時の挙動', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkDangerAtZoneCenterWithAdjacent(),
    checkWarningWithinRadius(),
    checkExactBoundaryValues(),
    checkOutsideAllZones(),
    checkScoreAdditivityAndClamp(),
    checkFeedbackMessages(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[safety] selfCheck FAIL: ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }

  console.info(`[safety] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
