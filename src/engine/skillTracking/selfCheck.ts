/**
 * engine/skillTracking/selfCheck.ts ── 開発時セルフチェック（Phase18.5）
 *
 * Skill Tracking Layer（Phase18.1〜18.4で確定した公開API）に対する実行時自己診断。
 * `engine/assessment/selfCheck.ts`（Phase10.5）等と同じ`if (import.meta.env.DEV)`パターンを
 * 踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜10と同じ理由。公開APIの一部
 * ではなく開発時専用の副作用ファイル）。
 *
 * localStorage/useLearningHistoryStoreに実際にアクセスする`adaptScoreHistory()`/
 * `adaptAssessmentHistory()`（薄いラッパー）はここでは呼ばない。副作用を持ち込まず、
 * 決定論的に検証できる純粋関数（`parseScoreHistoryToObservations`/
 * `assessmentResultToObservations`/`aggregateSkillProfile`）のみを対象にする
 * （shojiさんPhase18.5指示「Adapter/Aggregatorの基本動作を軽く確認する程度で十分」）。
 *
 * 確認する7項目:
 *   1. ScoreHistory Adapter基本変換（1件のHistoryEntry→3件のSkillObservation、正規化値の正しさ）
 *   2. ScoreHistory Adapter異常系（不正JSON・非配列→空配列）
 *   3. Assessment Adapter基本変換（strengths→value100/weaknesses→value0）
 *   4. Assessment Adapter異常系（strengths/weaknessesとも空→空配列）
 *   5. Aggregator: Observation0件→4Skill全てvalue=0/sampleSize=0
 *   6. Aggregator: 複数Observationの単純平均・sampleSizeの正しさ
 *   7. Negative Control（平均計算を行わない壊れた実装との差異を検出できる）
 */
import { parseScoreHistoryToObservations } from './scoreHistoryAdapter';
import { assessmentResultToObservations } from './assessmentAdapter';
import { aggregateSkillProfile } from './aggregator';
import type { AssessmentResult } from '../assessment';
import type { SkillObservation } from './types';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function makeAssessment(overrides: Partial<AssessmentResult>): AssessmentResult {
  return {
    sessionId: 'sc-1',
    caseId: 'case-001',
    masteryLevel: 'developing',
    assessedTeachingNoteIds: [],
    strengths: [],
    weaknesses: [],
    ...overrides,
  };
}

function checkScoreHistoryAdapterBasicConversion(): CheckResult {
  const raw = JSON.stringify([
    { date: '2026-07-19T00:00:00.000Z', sizeScore: 25, positionScore: 18, angleScore: 10 },
  ]);
  const obs = parseScoreHistoryToObservations(raw);
  const size = obs.find((o) => o.skillId === 'sizeAccuracy');
  const position = obs.find((o) => o.skillId === 'positionAccuracy');
  const angle = obs.find((o) => o.skillId === 'angleAccuracy');
  const ok =
    obs.length === 3 &&
    size?.value === 100 &&
    position?.value === 72 &&
    angle?.value === 40 &&
    obs.every((o) => o.source === 'scoreHistory');
  return { name: 'ScoreHistory Adapter基本変換（1件→3件、正規化値の正しさ）', ok };
}

function checkScoreHistoryAdapterMalformedInputIsEmpty(): CheckResult {
  const ok =
    parseScoreHistoryToObservations('{not json').length === 0 &&
    parseScoreHistoryToObservations(JSON.stringify({ a: 1 })).length === 0 &&
    parseScoreHistoryToObservations(null).length === 0;
  return { name: 'ScoreHistory Adapter異常系（不正JSON・非配列・null→空配列）', ok };
}

function checkAssessmentAdapterBasicConversion(): CheckResult {
  const result = makeAssessment({ strengths: ['tn-1', 'tn-2'], weaknesses: ['tn-3'] });
  const obs = assessmentResultToObservations(result, 'T0');
  const ok =
    obs.length === 3 &&
    obs.filter((o) => o.value === 100).length === 2 &&
    obs.filter((o) => o.value === 0).length === 1 &&
    obs.every((o) => o.skillId === 'anatomyRecognition' && o.source === 'assessment');
  return { name: 'Assessment Adapter基本変換（strengths→100/weaknesses→0）', ok };
}

function checkAssessmentAdapterEmptyYieldsEmpty(): CheckResult {
  const result = makeAssessment({ caseId: null, strengths: [], weaknesses: [] });
  const ok = assessmentResultToObservations(result, 'T0').length === 0;
  return { name: 'Assessment Adapter異常系（strengths/weaknessesとも空→空配列）', ok };
}

function checkAggregatorEmptyYieldsAllZero(): CheckResult {
  const profile = aggregateSkillProfile([]);
  const all = [...profile.technical, ...profile.knowledge];
  const ok =
    profile.technical.length === 3 &&
    profile.knowledge.length === 1 &&
    all.every((s) => s.value === 0 && s.sampleSize === 0);
  return { name: 'Aggregator: Observation0件→4Skill全てvalue=0/sampleSize=0', ok };
}

function makeObs(skillId: SkillObservation['skillId'], value: number): SkillObservation {
  return { skillId, value, observedAt: 'T0', source: 'scoreHistory' };
}

function checkAggregatorAveragesCorrectly(): CheckResult {
  const profile = aggregateSkillProfile([
    makeObs('sizeAccuracy', 100),
    makeObs('sizeAccuracy', 80),
    makeObs('sizeAccuracy', 60),
  ]);
  const size = profile.technical.find((s) => s.id === 'sizeAccuracy');
  const position = profile.technical.find((s) => s.id === 'positionAccuracy');
  const ok =
    size?.value === 80 &&
    size?.sampleSize === 3 &&
    position?.value === 0 &&
    position?.sampleSize === 0;
  return { name: 'Aggregator: 複数Observationの単純平均・sampleSizeの正しさ', ok };
}

function checkNegativeControl(): CheckResult {
  // 意図的に平均計算を行わない「壊れた実装」を手動構築し、本実装との差異を検証する。
  function brokenAverage(observations: readonly SkillObservation[]): number {
    return observations.reduce((sum, o) => sum + o.value, 0); // 件数で割らない
  }
  const observations = [makeObs('angleAccuracy', 100), makeObs('angleAccuracy', 50)];
  const correctProfile = aggregateSkillProfile(observations);
  const correctAngle = correctProfile.technical.find((s) => s.id === 'angleAccuracy');
  const brokenValue = brokenAverage(observations);
  const ok = correctAngle?.value === 75 && brokenValue === 150;
  return { name: 'Negative Control（平均計算を行わない壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkScoreHistoryAdapterBasicConversion(),
    checkScoreHistoryAdapterMalformedInputIsEmpty(),
    checkAssessmentAdapterBasicConversion(),
    checkAssessmentAdapterEmptyYieldsEmpty(),
    checkAggregatorEmptyYieldsAllZero(),
    checkAggregatorAveragesCorrectly(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[skillTracking] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[skillTracking] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
