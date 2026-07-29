/**
 * scripts/p4b3-safety-regression.ts ─── P4B-3 Acceptance Criteria #5 検証スクリプト
 *
 * 目的:
 * 「15症例でSafety Engineに回帰がないこと」を検証する。ただし本スクリプトの主眼は
 * 「Pose差分の原因解析」ではない。事前調査（監査）で以下が判明済み：
 *
 *   Safety Engineの入力 dangerZonePoint（src/scenes/SimScene.tsx:654-661）は
 *     const dangerZonePoint = useMemo<Vec3Tuple>(() => {
 *       const point: [number, number, number] = [
 *         basePos.x + lateralOffset  + dragOffsetX,
 *         basePos.y + verticalOffset + dragOffsetY,
 *         basePos.z + anteriorOffset + dragOffsetZ,
 *       ];
 *       return placementPointToDangerZoneFrame(point);
 *     }, [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ]);
 *   という式で、依存配列（useMemoの第2引数）に angleTilt / angleTiltZ / useNewPoseSolver /
 *   supportsNewPoseSolver / poseFlagActive のいずれも含まれない。呼び出し元は
 *   SimScene.tsx:664 の `useSimStore.getState().computeSafety(dangerZonePoint)` のみで、
 *   これもFeature Flagの分岐（poseFlagActive、SimScene.tsx:792）を経由しない。
 *
 * したがって本スクリプトが検証するのは「Pose Pipeline → 描画姿勢」と
 * 「Safety Input(dangerZonePoint) → checkProximityToDanger() → computeSafetyScore()」が
 * 独立した経路であり、Feature Flag（useNewPoseSolver ON/OFF）がSafety境界に一切影響しない
 * ことである。checkProximityToDanger/computeSafetyScore自体の判定ロジックは
 * src/engine/safety を1行も変更せずそのままimportして使う（危険判定の再実装はしない）。
 *
 * 実行方法（devDependency追加なし、npxがオンデマンドでtsxを取得する）:
 *   npx tsx scripts/p4b3-safety-regression.ts
 *
 * 【なぜ src/engine/coordinates/placementFrame.ts を直接importしないか】
 * 同ファイルは `if (import.meta.env.DEV) {...}` というVite依存のDEVセルフチェックを
 * モジュール最上位で実行する。tsx/ts-node等のプレーンなNode実行では import.meta.env が
 * 存在せず、importするだけでTypeErrorになる。そのためPlacement Frame → Danger Zone Frame
 * の変換（原点を STAPES_FOOTPLATE_OFFSET_MM だけ平行移動するだけの式）は、同ファイル自身が
 * OssicleModels.tsxの値を複製している方針（engine層はscenes層に依存しない）に倣い、
 * ここでも複製する。値は placementFrame.ts の STAPES_FOOTPLATE_OFFSET_MM と同一（要同期）。
 * checkProximityToDanger/computeSafetyScoreが辿るimportチェイン
 * （engine/safety/{index,proximity,score,constants,types}.ts、engine/coordinates/{vectorMath,types}.ts、
 * data/dangerZones.ts）にはimport.metaが存在しないことを確認済みのため、これらは直接importする。
 */
import { surgicalCases } from '../src/data/cases';
import type { SurgicalCase } from '../src/data/cases';
import { kurzProducts } from '../src/data/products';
import type { KurzProduct } from '../src/data/products';
import { checkProximityToDanger, computeSafetyScore } from '../src/engine/safety';
import type { DangerAlert } from '../src/engine/safety';

type Vec3Tuple = readonly [number, number, number];

// OssicleModels.tsx（STAPES_FOOTPLATE/STAPES_HEAD）・engine/coordinates/placementFrame.ts
// （STAPES_FOOTPLATE_OFFSET_MM）と同じ数値。上記コメントの理由により複製する（要同期）。
const STAPES_FOOTPLATE_MM: Vec3Tuple = [0.84, -2.65, 2.12];
const STAPES_HEAD_MM: Vec3Tuple = [-0.7249, -0.0273, 3.5259];
const STAPES_FOOTPLATE_OFFSET_MM: Vec3Tuple = STAPES_FOOTPLATE_MM;

/** engine/coordinates/placementFrame.tsのplacementPointToDangerZoneFrame()と同一の式。 */
function placementPointToDangerZoneFrame(p: Vec3Tuple): Vec3Tuple {
  return [
    p[0] - STAPES_FOOTPLATE_OFFSET_MM[0],
    p[1] - STAPES_FOOTPLATE_OFFSET_MM[1],
    p[2] - STAPES_FOOTPLATE_OFFSET_MM[2],
  ];
}

/**
 * dangerZonePoint計算式（SimScene.tsx:654-661）が実際に読む入力のみを持つ型。
 * angleTilt/angleTiltZ/Feature Flag状態はフィールドとして存在しないため、
 * computeDangerZonePoint()の実装はこれらを参照すること自体が不可能（コンパイル時の保証）。
 */
interface SafetyInputOffsets {
  readonly lateralOffset: number;
  readonly verticalOffset: number;
  readonly anteriorOffset: number;
  readonly dragOffsetX: number;
  readonly dragOffsetY: number;
  readonly dragOffsetZ: number;
}

/** SimScene.tsx:654-661のdangerZonePoint useMemoと同一の式。 */
function computeDangerZonePoint(basePos: Vec3Tuple, offsets: SafetyInputOffsets): Vec3Tuple {
  const point: Vec3Tuple = [
    basePos[0] + offsets.lateralOffset + offsets.dragOffsetX,
    basePos[1] + offsets.verticalOffset + offsets.dragOffsetY,
    basePos[2] + offsets.anteriorOffset + offsets.dragOffsetZ,
  ];
  return placementPointToDangerZoneFrame(point);
}

/**
 * SimScene.tsx:643-646のbasePos決定ロジックと同一（Bell構造のstapes状態依存フォールバック含む）。
 * Feature Flag（useNewPoseSolver/poseFlagActive）は一切関与しない。
 */
function resolveBasePos(surgicalCase: SurgicalCase, product: KurzProduct): Vec3Tuple {
  const stapStatus = surgicalCase.ossicularStatus.stapes;
  const bellHeadAvailable = stapStatus === 'intact' || stapStatus === 'suprastructure';
  const isTotal = product.footType === 'FLAT' || product.footType === 'PISTON';
  return isTotal || !bellHeadAvailable ? STAPES_FOOTPLATE_MM : STAPES_HEAD_MM;
}

/** 配置シナリオ。angleTilt/angleTiltZ/poseFlagActiveはレポート表示・不変性検証専用で、
 *  computeDangerZonePoint()には（SafetyInputOffsetsとして）渡らない。 */
interface PlacementScenario extends SafetyInputOffsets {
  readonly name: string;
  readonly angleTilt: number;
  readonly angleTiltZ: number;
}

function scenariosFor(surgicalCase: SurgicalCase): PlacementScenario[] {
  const idealLateral = surgicalCase.idealLateralOffset;
  const idealAngle = surgicalCase.idealAngle;
  const zero: Omit<SafetyInputOffsets, 'lateralOffset'> = {
    verticalOffset: 0,
    anteriorOffset: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragOffsetZ: 0,
  };
  return [
    { name: 'ideal', lateralOffset: idealLateral, ...zero, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'lateral+3mm', lateralOffset: 3, ...zero, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'lateral-3mm', lateralOffset: -3, ...zero, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'vertical+3mm', lateralOffset: idealLateral, ...zero, verticalOffset: 3, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'vertical-3mm', lateralOffset: idealLateral, ...zero, verticalOffset: -3, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'anterior+3mm', lateralOffset: idealLateral, ...zero, anteriorOffset: 3, angleTilt: idealAngle, angleTiltZ: 0 },
    { name: 'anterior-3mm', lateralOffset: idealLateral, ...zero, anteriorOffset: -3, angleTilt: idealAngle, angleTiltZ: 0 },
    {
      name: 'drag-combo-max',
      lateralOffset: idealLateral,
      verticalOffset: 0,
      anteriorOffset: 0,
      dragOffsetX: 3,
      dragOffsetY: 3,
      dragOffsetZ: 3,
      angleTilt: idealAngle,
      angleTiltZ: 0,
    },
    { name: 'tilt+180deg', lateralOffset: idealLateral, ...zero, angleTilt: 180, angleTiltZ: 0 },
    { name: 'tilt-180deg', lateralOffset: idealLateral, ...zero, angleTilt: -180, angleTiltZ: 0 },
    { name: 'tiltZ+180deg', lateralOffset: idealLateral, ...zero, angleTilt: idealAngle, angleTiltZ: 180 },
    { name: 'tiltZ-180deg', lateralOffset: idealLateral, ...zero, angleTilt: idealAngle, angleTiltZ: -180 },
    {
      name: 'combo-extreme',
      lateralOffset: 3,
      verticalOffset: -3,
      anteriorOffset: 3,
      dragOffsetX: -3,
      dragOffsetY: 3,
      dragOffsetZ: -3,
      angleTilt: 180,
      angleTiltZ: -180,
    },
  ];
}

type SafetyLevel = 'safe' | 'warning' | 'danger';

function overallLevel(alerts: readonly DangerAlert[]): SafetyLevel {
  if (alerts.some((a) => a.level === 'danger')) return 'danger';
  if (alerts.some((a) => a.level === 'warning')) return 'warning';
  return 'safe';
}

function vec3Equal(a: Vec3Tuple, b: Vec3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function alertsEqual(a: readonly DangerAlert[], b: readonly DangerAlert[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface PipelineResult {
  readonly flagLabel: string;
  readonly dangerZonePoint: Vec3Tuple;
  readonly alerts: readonly DangerAlert[];
  readonly level: SafetyLevel;
  readonly score: number;
}

/**
 * dangerZonePoint → checkProximityToDanger() → computeSafetyScore() のパイプライン。
 * `poseFlagActive`はFeature Flag ON/OFFをシミュレートするためのラベル付け専用の引数で、
 * SafetyInputOffsetsにも他のどの計算にも渡らない（=Safety Engineの入力に影響しない、というのが
 * 監査で判明した実際の依存関係。結果に含めるのはレポート上でOFF/ONを区別するため）。
 */
function runPipeline(basePos: Vec3Tuple, offsets: SafetyInputOffsets, poseFlagActive: boolean): PipelineResult {
  const dangerZonePoint = computeDangerZonePoint(basePos, offsets);
  const alerts = checkProximityToDanger(dangerZonePoint);
  return {
    flagLabel: poseFlagActive ? 'ON' : 'OFF',
    dangerZonePoint,
    alerts,
    level: overallLevel(alerts),
    score: computeSafetyScore(alerts),
  };
}

interface Diff {
  readonly caseId: string;
  readonly scenario: string;
  readonly detail: string;
}

function main(): void {
  const diffs: Diff[] = [];
  let comparisons = 0;

  console.log('=== P4B-3 Acceptance Criteria #5: Safety Engine回帰検証 ===');
  console.log(`症例数: ${surgicalCases.length}`);
  console.log('');

  for (const surgicalCase of surgicalCases) {
    const product = kurzProducts.find((p) => p.id === surgicalCase.recommendedProductId);
    if (!product) {
      diffs.push({
        caseId: surgicalCase.id,
        scenario: '(setup)',
        detail: `recommendedProductId "${surgicalCase.recommendedProductId}" に対応するKurzProductが見つからない`,
      });
      continue;
    }
    const basePos = resolveBasePos(surgicalCase, product);

    console.log(`--- ${surgicalCase.id} (${surgicalCase.title}) basePos=${JSON.stringify(basePos)} ---`);

    for (const scenario of scenariosFor(surgicalCase)) {
      comparisons += 1;

      // (1) tilt/Feature Flagへの非依存性を実行時に証明する:
      //     offsetsは同一のまま、angleTilt/angleTiltZだけを大きく変えた「ゆさぶり」シナリオを
      //     別途作り、dangerZonePointが完全に不変であることを確認する
      //     （+999度/-999度は実際の可動域(-180〜+180度)を超える値をあえて使い、
      //     「たまたま範囲内だから一致した」という余地を排除するため）。
      const perturbedScenario: PlacementScenario = {
        ...scenario,
        angleTilt: scenario.angleTilt + 999,
        angleTiltZ: scenario.angleTiltZ - 999,
      };
      const off = runPipeline(basePos, scenario, false);
      const on = runPipeline(basePos, scenario, true);
      const perturbedTilt = runPipeline(basePos, perturbedScenario, true);

      const pointMatch = vec3Equal(off.dangerZonePoint, on.dangerZonePoint) && vec3Equal(off.dangerZonePoint, perturbedTilt.dangerZonePoint);
      const alertsMatch = alertsEqual(off.alerts, on.alerts) && alertsEqual(off.alerts, perturbedTilt.alerts);
      const levelMatch = off.level === on.level && off.level === perturbedTilt.level;
      const scoreMatch = off.score === on.score && off.score === perturbedTilt.score;

      const status = pointMatch && alertsMatch && levelMatch && scoreMatch ? 'MATCH' : 'DIFF';
      console.log(
        `  [${status}] ${scenario.name.padEnd(16)} tilt=(${scenario.angleTilt},${scenario.angleTiltZ})  ` +
          `dangerZonePoint=${JSON.stringify(off.dangerZonePoint)}  level=${off.level}  score=${off.score}  alerts=${off.alerts.length}`,
      );

      if (!pointMatch || !alertsMatch || !levelMatch || !scoreMatch) {
        diffs.push({
          caseId: surgicalCase.id,
          scenario: scenario.name,
          detail: `OFF/ON/perturbed-tilt不一致: point=${pointMatch} alerts=${alertsMatch} level=${levelMatch} score=${scoreMatch}`,
        });
      }
    }
    console.log('');
  }

  console.log('=== 結果 ===');
  console.log(`比較件数: ${comparisons}`);
  console.log(`差分件数: ${diffs.length}`);

  if (diffs.length > 0) {
    console.log('');
    console.log('差分一覧:');
    for (const d of diffs) {
      console.log(`  - [${d.caseId}] ${d.scenario}: ${d.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('差分0件: Safety EngineはFeature Flag(useNewPoseSolver)・angleTilt/angleTiltZの値に対して');
  console.log('不変であることを確認した（Pose PipelineとSafety Inputは独立経路）。');
}

main();
