/**
 * engine/recommendation/selfCheck.ts ── 開発時セルフチェック (Phase11.5)
 *
 * Recommendation Layer（Phase11.1〜11.4で確定した唯一の公開API`recommend`）に対する実行時
 * 自己診断。`engine/assessment/selfCheck.ts`（Phase10.5）等と同じ`if (import.meta.env.DEV)`
 * パターンを踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜10と同じ理由。公開APIの一部では
 * なく開発時専用の副作用ファイル）。
 *
 * 【shojiさんPhase11.4レビュー所見（Phase11.5への重点確認事項）への対応方針】
 * 「Recommendation Layer の公開API (`recommend`) のみを利用して検証していること（内部関数への
 * 依存を避ける）」に従い、`deriveWeaknessRecommendations`/`deriveCaseRecommendations`は
 * 一切importしない。テスト用の入力は`AssessmentResult`（Assessment Layerの公開型、Phase10.5の
 * `AssessmentResult`同様プレーンなデータ型）のリテラルとして直接組み立てる。Negative Control
 * （#7）では、Recommendation Layer内部関数の代わりにCase Generator公開API
 * （`findCases`/`buildCaseTeachingBundle`、Phase7凍結済み）のみを使って「自己除外しない壊れた
 * 実装」を手動構築し、`recommend()`の結果と比較する。
 *
 * 確認する7項目:
 *   1. weaknesses空（caseId=null）で全出力が空
 *   2. weaknesses空（caseIdありだが全参照済み想定）でもrecommendedCaseIdsは空
 *      （Case Generatorへの無駄な問い合わせを避ける分岐がrecommend()経由でも機能すること）
 *   3. sessionId/caseIdの単純転記 + recommendedTeachingNoteIdsがassessment.weaknessesと
 *      同一参照であること
 *   4. reasons内でkind='weakness'がすべてkind='relatedCase'より先に来る固定順
 *   5. 自己除外（assessment.caseId自身はrecommendedCaseIdsに含まれない）
 *   6. 決定論性（同一AssessmentResultに対しrecommend()を複数回呼んでも同一出力）
 *   7. Negative Control（自己除外を行わない壊れた実装との差異を検出できる）
 */
import type { AssessmentResult } from '../assessment';
import { findCases, buildCaseTeachingBundle } from '../caseGenerator';
import { recommend } from './recommend';

// data/cases.tsに実在するid（Phase10.5 selfCheck.ts・Phase11実装レビューでも使用実績あり）。
// bundler.ts（Phase7.2）の仕様によりrelatedNotesは全症例共通で
// ['ossicle.malleus','ossicle.incus','ossicle.stapes']固定のため、'ossicle.malleus'を
// weaknessとして与えると自分以外の全症例が関連症例候補になる（Phase11.3実装レビュー既知の制約）。
const KNOWN_CASE_ID = 'case-001';
const KNOWN_WEAKNESS_ID = 'ossicle.malleus';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function makeFakeAssessment(overrides: Partial<AssessmentResult>): AssessmentResult {
  return {
    sessionId: 'sc-rec-fake',
    caseId: null,
    masteryLevel: 'beginner',
    assessedTeachingNoteIds: [],
    strengths: [],
    weaknesses: [],
    ...overrides,
  };
}

function checkEmptyWeaknessesCaseIdNullYieldsAllEmpty(): CheckResult {
  const assessment = makeFakeAssessment({ sessionId: 'sc-rec-1', caseId: null, weaknesses: [] });
  const result = recommend(assessment);
  const ok =
    result.recommendedTeachingNoteIds.length === 0 &&
    result.recommendedCaseIds.length === 0 &&
    result.reasons.length === 0;
  return { name: 'weaknesses空（caseId=null）で全出力が空', ok };
}

function checkEmptyWeaknessesWithCaseIdYieldsEmptyCaseRecommendations(): CheckResult {
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-2',
    caseId: KNOWN_CASE_ID,
    masteryLevel: 'proficient',
    weaknesses: [], // 全教材参照済み想定
  });
  const result = recommend(assessment);
  const ok =
    result.recommendedTeachingNoteIds.length === 0 &&
    result.recommendedCaseIds.length === 0 &&
    result.reasons.length === 0;
  return { name: 'weaknesses空（caseIdありだが全参照済み想定）でもrecommendedCaseIdsは空', ok };
}

function checkTranscriptionAndReferenceEquality(): CheckResult {
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-3',
    caseId: KNOWN_CASE_ID,
    weaknesses: [KNOWN_WEAKNESS_ID],
  });
  const result = recommend(assessment);
  const ok =
    result.sessionId === assessment.sessionId &&
    result.caseId === assessment.caseId &&
    result.recommendedTeachingNoteIds === assessment.weaknesses;
  return { name: 'sessionId/caseIdの単純転記 + recommendedTeachingNoteIdsがweaknessesと同一参照', ok };
}

function checkReasonsOrderWeaknessBeforeRelatedCase(): CheckResult {
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-4',
    caseId: KNOWN_CASE_ID,
    weaknesses: [KNOWN_WEAKNESS_ID],
  });
  const result = recommend(assessment);
  const lastWeaknessIndex = result.reasons.map((r) => r.kind).lastIndexOf('weakness');
  const firstRelatedCaseIndex = result.reasons.map((r) => r.kind).indexOf('relatedCase');
  const ok =
    result.reasons.some((r) => r.kind === 'weakness') &&
    result.reasons.some((r) => r.kind === 'relatedCase') &&
    lastWeaknessIndex < firstRelatedCaseIndex;
  return { name: 'reasons内でkind=\'weakness\'が全てkind=\'relatedCase\'より先に来る固定順', ok };
}

function checkSelfExclusion(): CheckResult {
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-5',
    caseId: KNOWN_CASE_ID,
    weaknesses: [KNOWN_WEAKNESS_ID],
  });
  const result = recommend(assessment);
  const ok = !result.recommendedCaseIds.includes(KNOWN_CASE_ID);
  return { name: '自己除外（assessment.caseId自身はrecommendedCaseIdsに含まれない）', ok };
}

function checkDeterminism(): CheckResult {
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-6',
    caseId: KNOWN_CASE_ID,
    weaknesses: [KNOWN_WEAKNESS_ID],
  });
  const a = recommend(assessment);
  const b = recommend(assessment);
  const ok = JSON.stringify(a) === JSON.stringify(b);
  return { name: '決定論性（同一AssessmentResultに対しrecommend()を複数回呼んでも同一出力）', ok };
}

function checkNegativeControl(): CheckResult {
  // Recommendation Layer内部関数（deriveCaseRecommendations等）はimportせず、Case Generator
  // 公開APIのみを使って「自己除外しない壊れた実装」を手動構築し、recommend()と比較する。
  const assessment = makeFakeAssessment({
    sessionId: 'sc-rec-7',
    caseId: KNOWN_CASE_ID,
    weaknesses: [KNOWN_WEAKNESS_ID],
  });
  const real = recommend(assessment);

  const weaknessSet = new Set(assessment.weaknesses);
  const brokenCaseIds: string[] = [];
  for (const candidate of findCases({})) {
    // 意図的に自己除外の`continue`を行わない壊れた実装。
    const bundle = buildCaseTeachingBundle(candidate.id);
    if (bundle === null) continue;
    if (bundle.relatedNotes.some((note) => weaknessSet.has(note.entry.id))) {
      brokenCaseIds.push(candidate.id);
    }
  }

  const ok =
    brokenCaseIds.includes(KNOWN_CASE_ID) &&
    !real.recommendedCaseIds.includes(KNOWN_CASE_ID) &&
    brokenCaseIds.length === real.recommendedCaseIds.length + 1;
  return { name: 'Negative Control（自己除外を行わない壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkEmptyWeaknessesCaseIdNullYieldsAllEmpty(),
    checkEmptyWeaknessesWithCaseIdYieldsEmptyCaseRecommendations(),
    checkTranscriptionAndReferenceEquality(),
    checkReasonsOrderWeaknessBeforeRelatedCase(),
    checkSelfExclusion(),
    checkDeterminism(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[recommendation] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[recommendation] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
