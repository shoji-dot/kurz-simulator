/**
 * engine/applicationIntegration/selfCheck.ts ── 開発時セルフチェック (Phase14.5)
 *
 * Application Integration Layer（Phase14.1〜14.4で確定した`createSessionFromCaseCompletion`/
 * `assessLearningSession`/`recommendFromAssessment`/`deriveAdaptivePlan`）に対する実行時自己
 * 診断。`engine/learnerApplication/selfCheck.ts`（Phase13.5）等と同じ
 * `if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 本ファイルは`engine/applicationIntegration`自身のみを対象とし、`src/store/
 * useLearningHistoryStore.ts`（UI/Application側のRuntime保持、Phase14.3）・
 * `LearningDashboard.tsx`（Phase14.4のレンダリング）はテストしない
 * （storeとUIレンダリングの検証はGUI Acceptance Test側の責務、
 * `Phase14.5_GUIAcceptanceTest_チェックリスト_2026-07-18.md`参照）。
 *
 * `index.ts`から意図的に未export（Phase3〜13と同じ理由。公開APIの一部ではなく開発時専用の
 * 副作用ファイル）。
 *
 * 確認する7項目:
 *   1. 既知症例idでcreateSessionFromCaseCompletion()が正しいLearningSessionを組み立てる
 *      （id/caseId/teachingNoteIds=relatedNotes全件/messages=空配列）
 *   2. 未知症例idでも例外を投げずteachingNoteIds=空のLearningSessionを返す
 *   3. assessLearningSession()がassessSession()直接呼び出しとJSON完全一致（橋渡しのみの証明）
 *   4. recommendFromAssessment()がrecommend()直接呼び出しとJSON完全一致（橋渡しのみの証明）
 *   5. deriveAdaptivePlan()がderiveAdaptiveLearningPlan()直接呼び出しとJSON完全一致
 *      （橋渡しのみの証明）
 *   6. 決定論性（同一入力を4関数すべてに対し複数回呼んでも同一出力）
 *   7. Negative Control（teachingNoteIdsを一切追加しない壊れた実装との差異を検出できる）
 */
import { createSession } from '../learningSession';
import { assessSession } from '../assessment';
import { recommend } from '../recommendation';
import { deriveAdaptiveLearningPlan } from '../adaptiveLearning';
import type { LearningHistory } from '../adaptiveLearning';
import { surgicalCases } from '../../data/cases';
import {
  createSessionFromCaseCompletion,
  assessLearningSession,
  recommendFromAssessment,
  deriveAdaptivePlan,
} from './index';

const UNKNOWN_CASE_ID = '__selfcheck_unknown_case_id__';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function checkKnownCaseAssemblesSession(): CheckResult {
  const caseId = surgicalCases[0].id;
  const session = createSessionFromCaseCompletion({ sessionId: 'sc-ai-1', startedAt: '2026-07-18T00:00:00.000Z', caseId });
  const ok =
    session.id === 'sc-ai-1' &&
    session.caseId === caseId &&
    session.messages.length === 0 &&
    session.teachingNoteIds.length === 3;
  return { name: '既知症例idでLearningSessionを正しく組み立てる(id/caseId/teachingNoteIds/messages=空)', ok };
}

function checkUnknownCaseNoThrow(): CheckResult {
  const session = createSessionFromCaseCompletion({ sessionId: 'sc-ai-2', startedAt: '2026-07-18T00:00:00.000Z', caseId: UNKNOWN_CASE_ID });
  const ok = session.caseId === UNKNOWN_CASE_ID && session.teachingNoteIds.length === 0;
  return { name: '未知症例idでも例外を投げずteachingNoteIds=空', ok };
}

function checkAssessmentBridgeMatchesDirectCall(): CheckResult {
  const caseId = surgicalCases[1].id;
  const session = createSessionFromCaseCompletion({ sessionId: 'sc-ai-3', startedAt: '2026-07-18T00:00:00.000Z', caseId });
  const ok = JSON.stringify(assessLearningSession(session)) === JSON.stringify(assessSession(session));
  return { name: 'assessLearningSession()がassessSession()直接呼び出しとJSON完全一致', ok };
}

function checkRecommendationBridgeMatchesDirectCall(): CheckResult {
  const caseId = surgicalCases[1].id;
  const session = createSessionFromCaseCompletion({ sessionId: 'sc-ai-4', startedAt: '2026-07-18T00:00:00.000Z', caseId });
  const assessment = assessLearningSession(session);
  const ok = JSON.stringify(recommendFromAssessment(assessment)) === JSON.stringify(recommend(assessment));
  return { name: 'recommendFromAssessment()がrecommend()直接呼び出しとJSON完全一致', ok };
}

function buildSampleHistory(): LearningHistory {
  const caseId = surgicalCases[0].id;
  const session = createSessionFromCaseCompletion({ sessionId: 'sc-ai-5', startedAt: '2026-07-18T00:00:00.000Z', caseId });
  const assessment = assessLearningSession(session);
  const recommendation = recommendFromAssessment(assessment);
  return [{ assessment, recommendation }];
}

function checkAdaptivePlanBridgeMatchesDirectCall(): CheckResult {
  const history = buildSampleHistory();
  const ok = JSON.stringify(deriveAdaptivePlan(history)) === JSON.stringify(deriveAdaptiveLearningPlan(history));
  return { name: 'deriveAdaptivePlan()がderiveAdaptiveLearningPlan()直接呼び出しとJSON完全一致', ok };
}

function checkDeterminism(): CheckResult {
  const caseId = surgicalCases[0].id;
  const inputA = { sessionId: 'sc-ai-6', startedAt: '2026-07-18T00:00:00.000Z', caseId };
  const s1 = createSessionFromCaseCompletion(inputA);
  const s2 = createSessionFromCaseCompletion(inputA);
  const a1 = assessLearningSession(s1);
  const a2 = assessLearningSession(s2);
  const r1 = recommendFromAssessment(a1);
  const r2 = recommendFromAssessment(a2);
  const history: LearningHistory = [{ assessment: a1, recommendation: r1 }];
  const p1 = deriveAdaptivePlan(history);
  const p2 = deriveAdaptivePlan(history);
  const ok =
    JSON.stringify(s1) === JSON.stringify(s2) &&
    JSON.stringify(a1) === JSON.stringify(a2) &&
    JSON.stringify(r1) === JSON.stringify(r2) &&
    JSON.stringify(p1) === JSON.stringify(p2);
  return { name: '決定論性(同一入力を4関数すべてに対し複数回呼んでも同一出力)', ok };
}

function checkNegativeControl(): CheckResult {
  // createSessionFromCaseCompletion()の内部実装は使わず、Learning Session Layer公開API
  // (createSession)のみで「teachingNoteIdsを一切追加しない壊れた実装」を手動構築し、
  // 実際の実装の結果と比較する。
  const caseId = surgicalCases[0].id;
  const input = { sessionId: 'sc-ai-7', startedAt: '2026-07-18T00:00:00.000Z', caseId };

  const real = createSessionFromCaseCompletion(input);
  const broken = createSession({ id: input.sessionId, startedAt: input.startedAt, caseId: input.caseId }); // teachingNoteIds追加なし

  const ok = real.teachingNoteIds.length === 3 && broken.teachingNoteIds.length === 0;
  return { name: 'Negative Control(teachingNoteIdsを追加しない壊れた実装との差異を検出できる)', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkKnownCaseAssemblesSession(),
    checkUnknownCaseNoThrow(),
    checkAssessmentBridgeMatchesDirectCall(),
    checkRecommendationBridgeMatchesDirectCall(),
    checkAdaptivePlanBridgeMatchesDirectCall(),
    checkDeterminism(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[applicationIntegration] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[applicationIntegration] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
