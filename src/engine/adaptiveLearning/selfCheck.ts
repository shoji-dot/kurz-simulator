/**
 * engine/adaptiveLearning/selfCheck.ts ── 開発時セルフチェック (Phase12.5)
 *
 * Adaptive Learning Layer（Phase12.1〜12.4で確定した唯一の公開API`deriveAdaptiveLearningPlan`）
 * に対する実行時自己診断。`engine/recommendation/selfCheck.ts`（Phase11.5）等と同じ
 * `if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜11と同じ理由。公開APIの一部では
 * なく開発時専用の副作用ファイル）。
 *
 * 【Phase12公開APIのみを利用して検証（shojiさんPhase12.3/12.4レビュー所見どおり）】
 * `derivePriorityTeachingNoteIds`/`deriveRepeatPracticeIds`（aggregate.ts）・
 * `deriveRecommendedCaseIds`（caseRecommend.ts）はAdaptive Learning Layerの内部組み立て部品で
 * あり、一切importしない。`deriveAdaptiveLearningPlan`（Phase12公開API）のみを呼び出し、
 * その戻り値（`AdaptiveLearningPlan`）から判定する。テスト用の入力は`AssessmentResult`/
 * `RecommendationResult`（Assessment/Recommendation Layerの公開型）のリテラルとして直接組み立てる。
 * Negative Control（#7）では、Adaptive Learning内部関数の代わりにCase Generator公開API
 * （`findCases`/`buildCaseTeachingBundle`、Phase7凍結済み）のみを使って「自己除外しない壊れた
 * 実装」を手動構築し、`deriveAdaptiveLearningPlan()`の結果（`plan.recommendedCaseIds`）と比較する
 * （`recommendation/selfCheck.ts`のNegative Controlと同じ考え方）。
 *
 * 確認する7項目:
 *   1. 空履歴で3項目（priorityTeachingNoteIds/repeatPracticeIds/recommendedCaseIds）すべて空配列
 *   2. priorityTeachingNoteIdsが直近セッション（history末尾）のrecommendedTeachingNoteIdsと
 *      同一参照であること（単純転記、複数セッションを横断した判断をしていないこと）
 *   3. 同一教材idが複数セッションで繰り返し登場した場合のみrepeatPracticeIdsに含まれ、
 *      1セッションのみの登場では含まれないこと
 *   4. repeatPracticeIdsが空となる入力ではrecommendedCaseIdsも空（Case Generatorへの無駄な
 *      問い合わせを避ける境界条件がderiveAdaptiveLearningPlan()経由でも機能すること）
 *   5. 自己除外（履歴上で既に扱った症例はrecommendedCaseIdsに含まれない、複数セッション分への
 *      一般化）
 *   6. 決定論性（同一historyに対しderiveAdaptiveLearningPlan()を複数回呼んでも同一出力）
 *   7. Negative Control（自己除外を行わない壊れた実装との差異を検出できる）
 */
import type { AssessmentResult } from '../assessment';
import type { RecommendationResult } from '../recommendation';
import { findCases, buildCaseTeachingBundle } from '../caseGenerator';
import type { LearningHistory, LearningHistoryEntry } from './types';
import { deriveAdaptiveLearningPlan } from './plan';

// data/cases.tsに実在するid・Ear Atlas id（Phase10.5/Phase11.5 selfCheck.tsでも使用実績あり）。
const KNOWN_TEACHING_NOTE_ID = 'ossicle.malleus';
const OTHER_TEACHING_NOTE_ID = 'ossicle.incus';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function makeEntry(opts: {
  sessionId: string;
  caseId: string | null;
  recommendedTeachingNoteIds: readonly string[];
}): LearningHistoryEntry {
  const assessment: AssessmentResult = {
    sessionId: opts.sessionId,
    caseId: opts.caseId,
    masteryLevel: 'developing',
    assessedTeachingNoteIds: [],
    strengths: [],
    weaknesses: [],
  };
  const recommendation: RecommendationResult = {
    sessionId: opts.sessionId,
    caseId: opts.caseId,
    recommendedTeachingNoteIds: opts.recommendedTeachingNoteIds,
    recommendedCaseIds: [],
    reasons: [],
  };
  return { assessment, recommendation };
}

/** #2/#3/#5/#6/#7共通のセットアップ。3セッション分、KNOWN_TEACHING_NOTE_IDがs1・s3で繰り返し登場する。 */
function buildRepeatEstablishedHistory(): { history: LearningHistory; seenCaseIds: readonly string[] } {
  const seenCaseIds = ['case-001', 'case-004', 'case-002'] as const;
  const history: LearningHistory = [
    makeEntry({ sessionId: 'sc-adaptive-1', caseId: seenCaseIds[0], recommendedTeachingNoteIds: [KNOWN_TEACHING_NOTE_ID] }),
    makeEntry({ sessionId: 'sc-adaptive-2', caseId: seenCaseIds[1], recommendedTeachingNoteIds: [OTHER_TEACHING_NOTE_ID] }),
    makeEntry({ sessionId: 'sc-adaptive-3', caseId: seenCaseIds[2], recommendedTeachingNoteIds: [KNOWN_TEACHING_NOTE_ID] }),
  ];
  return { history, seenCaseIds };
}

function checkEmptyHistoryYieldsAllEmpty(): CheckResult {
  const plan = deriveAdaptiveLearningPlan([]);
  const ok =
    plan.priorityTeachingNoteIds.length === 0 &&
    plan.repeatPracticeIds.length === 0 &&
    plan.recommendedCaseIds.length === 0;
  return { name: '空履歴で3項目すべて空配列', ok };
}

function checkPriorityIsLatestSessionTranscription(): CheckResult {
  const { history } = buildRepeatEstablishedHistory();
  const plan = deriveAdaptiveLearningPlan(history);
  const latest = history[history.length - 1];
  const ok =
    plan.priorityTeachingNoteIds === latest.recommendation.recommendedTeachingNoteIds &&
    plan.priorityTeachingNoteIds.length === 1 &&
    plan.priorityTeachingNoteIds[0] === KNOWN_TEACHING_NOTE_ID;
  return { name: 'priorityTeachingNoteIdsが直近セッションのrecommendedTeachingNoteIdsと同一参照', ok };
}

function checkRepeatOnlyForMultiSessionOccurrence(): CheckResult {
  const { history } = buildRepeatEstablishedHistory();
  const plan = deriveAdaptiveLearningPlan(history);
  const ok =
    plan.repeatPracticeIds.includes(KNOWN_TEACHING_NOTE_ID) && // s1・s3で2回登場
    !plan.repeatPracticeIds.includes(OTHER_TEACHING_NOTE_ID); // s2のみ1回登場
  return { name: '複数セッションで繰り返し登場した教材idのみrepeatPracticeIdsに含まれる', ok };
}

function checkNoRepeatYieldsEmptyRecommendedCaseIds(): CheckResult {
  const history: LearningHistory = [
    makeEntry({ sessionId: 'sc-adaptive-4', caseId: null, recommendedTeachingNoteIds: ['ossicle.stapes'] }),
    makeEntry({ sessionId: 'sc-adaptive-5', caseId: null, recommendedTeachingNoteIds: [OTHER_TEACHING_NOTE_ID] }),
  ];
  const plan = deriveAdaptiveLearningPlan(history);
  const ok = plan.repeatPracticeIds.length === 0 && plan.recommendedCaseIds.length === 0;
  return { name: 'repeatPracticeIdsが空となる入力ではrecommendedCaseIdsも空（境界条件）', ok };
}

function checkSelfExclusionAcrossHistory(): CheckResult {
  const { history, seenCaseIds } = buildRepeatEstablishedHistory();
  const plan = deriveAdaptiveLearningPlan(history);
  const ok = seenCaseIds.every((id) => !plan.recommendedCaseIds.includes(id));
  return { name: '自己除外（履歴上で既に扱った症例はrecommendedCaseIdsに含まれない）', ok };
}

function checkDeterminism(): CheckResult {
  const { history } = buildRepeatEstablishedHistory();
  const a = deriveAdaptiveLearningPlan(history);
  const b = deriveAdaptiveLearningPlan(history);
  const ok = JSON.stringify(a) === JSON.stringify(b);
  return { name: '決定論性（同一historyに対しderiveAdaptiveLearningPlan()を複数回呼んでも同一出力）', ok };
}

function checkNegativeControl(): CheckResult {
  // Adaptive Learning内部関数（deriveRecommendedCaseIds等）はimportせず、Case Generator
  // 公開APIのみを使って「履歴上の既出症例を自己除外しない壊れた実装」を手動構築し、
  // deriveAdaptiveLearningPlan()の結果（plan.recommendedCaseIds）と比較する。
  const { history, seenCaseIds } = buildRepeatEstablishedHistory();
  const plan = deriveAdaptiveLearningPlan(history);

  const repeatSet = new Set(plan.repeatPracticeIds); // 公開出力(plan)由来。内部関数には依存しない
  const brokenCaseIds: string[] = [];
  for (const candidate of findCases({})) {
    // 意図的に「履歴上で既に扱った症例」の除外を行わない壊れた実装。
    const bundle = buildCaseTeachingBundle(candidate.id);
    if (bundle === null) continue;
    if (bundle.relatedNotes.some((note) => repeatSet.has(note.entry.id))) {
      brokenCaseIds.push(candidate.id);
    }
  }

  const ok =
    seenCaseIds.every((id) => brokenCaseIds.includes(id)) &&
    seenCaseIds.every((id) => !plan.recommendedCaseIds.includes(id)) &&
    brokenCaseIds.length === plan.recommendedCaseIds.length + seenCaseIds.length;
  return { name: 'Negative Control（履歴上の既出症例を自己除外しない壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkEmptyHistoryYieldsAllEmpty(),
    checkPriorityIsLatestSessionTranscription(),
    checkRepeatOnlyForMultiSessionOccurrence(),
    checkNoRepeatYieldsEmptyRecommendedCaseIds(),
    checkSelfExclusionAcrossHistory(),
    checkDeterminism(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[adaptiveLearning] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[adaptiveLearning] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
