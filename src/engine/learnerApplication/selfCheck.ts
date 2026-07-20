/**
 * engine/learnerApplication/selfCheck.ts ── 開発時セルフチェック (Phase13.5)
 *
 * Learner Application Layer（Phase13.1〜13.4で確定した唯一の公開API
 * `deriveLearnerApplicationView`）に対する実行時自己診断。`engine/adaptiveLearning/selfCheck.ts`
 * （Phase12.5）等と同じ`if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜12と同じ理由。公開APIの一部
 * ではなく開発時専用の副作用ファイル）。
 *
 * 【Learner Application Layer公開API + 依存先の公開APIのみを利用して検証】
 * `noteResolve.ts`/`caseResolve.ts`の内部関数は一切importしない。テスト用のidはEducation Layer
 * （`getTeachingNote`）・Case Generator（`getCase`/`findCases`）の公開APIから取得し、
 * `AdaptiveLearningPlan`（Adaptive Learning Layer公開型、Phase12）のリテラルとして組み立てる。
 *
 * 確認する7項目:
 *   1. 空Plan（3項目とも空配列）→ LearnerApplicationViewの3項目すべて空配列
 *   2. 教材解決（priorityTeachingNotes/repeatPracticeNotesがgetTeachingNote()の結果と一致）
 *   3. 症例解決（recommendedCasesがgetCase()の結果と一致）
 *   4. unknown ID（解決不能なidは例外を投げず結果から除外される）
 *   5. 順序維持（plan中のid順序がView配列の順序と一致）
 *   6. 決定論性（同一planに対しderiveLearnerApplicationView()を複数回呼んでも同一出力）
 *   7. Negative Control（unknown idを除外しない壊れた実装との差異を検出できる）
 */
import { getTeachingNote } from '../education';
import { getCase, findCases } from '../caseGenerator';
import type { AdaptiveLearningPlan } from '../adaptiveLearning';
import { deriveLearnerApplicationView } from './view';

// data/earAtlas/entries.tsに実在するid（Phase6.3/Phase12.5 selfCheck.tsでも使用実績あり）。
const KNOWN_TEACHING_NOTE_ID = 'ossicle.malleus';
const OTHER_TEACHING_NOTE_ID = 'ossicle.incus';
const UNKNOWN_TEACHING_NOTE_ID = '__selfcheck_unknown_note_id__';
const UNKNOWN_CASE_ID = '__selfcheck_unknown_case_id__';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

/** findCases({})（Case Generator公開API）から実在する症例idを1件取得する。data/cases.tsへは依存しない。 */
function knownCaseId(): string {
  const [first] = findCases({});
  if (first === undefined) throw new Error('[learnerApplication] selfCheck: no known case available');
  return first.id;
}

function checkEmptyPlanYieldsAllEmpty(): CheckResult {
  const plan: AdaptiveLearningPlan = { priorityTeachingNoteIds: [], repeatPracticeIds: [], recommendedCaseIds: [] };
  const view = deriveLearnerApplicationView(plan);
  const ok =
    view.priorityTeachingNotes.length === 0 &&
    view.repeatPracticeNotes.length === 0 &&
    view.recommendedCases.length === 0;
  return { name: '空Planで3項目すべて空配列', ok };
}

function checkTeachingNoteResolution(): CheckResult {
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [KNOWN_TEACHING_NOTE_ID],
    repeatPracticeIds: [OTHER_TEACHING_NOTE_ID],
    recommendedCaseIds: [],
  };
  const view = deriveLearnerApplicationView(plan);
  const expectedPriority = getTeachingNote(KNOWN_TEACHING_NOTE_ID);
  const expectedRepeat = getTeachingNote(OTHER_TEACHING_NOTE_ID);
  const ok =
    view.priorityTeachingNotes.length === 1 &&
    expectedPriority !== null &&
    view.priorityTeachingNotes[0].id === expectedPriority.entry.id &&
    view.priorityTeachingNotes[0].titleJa === expectedPriority.entry.nameJa &&
    view.repeatPracticeNotes.length === 1 &&
    expectedRepeat !== null &&
    view.repeatPracticeNotes[0].id === expectedRepeat.entry.id;
  return { name: '教材解決（getTeachingNote()の結果と一致）', ok };
}

function checkCaseResolution(): CheckResult {
  const caseId = knownCaseId();
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [],
    repeatPracticeIds: [],
    recommendedCaseIds: [caseId],
  };
  const view = deriveLearnerApplicationView(plan);
  const expected = getCase(caseId);
  const ok =
    view.recommendedCases.length === 1 &&
    expected !== null &&
    view.recommendedCases[0].id === expected.id &&
    view.recommendedCases[0].titleJa === expected.title;
  return { name: '症例解決（getCase()の結果と一致）', ok };
}

function checkUnknownIdExcludedWithoutThrowing(): CheckResult {
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [UNKNOWN_TEACHING_NOTE_ID],
    repeatPracticeIds: [],
    recommendedCaseIds: [UNKNOWN_CASE_ID],
  };
  let view: ReturnType<typeof deriveLearnerApplicationView> | null = null;
  let threw = false;
  try {
    view = deriveLearnerApplicationView(plan);
  } catch {
    threw = true;
  }
  const ok = !threw && view !== null && view.priorityTeachingNotes.length === 0 && view.recommendedCases.length === 0;
  return { name: 'unknown IDは例外を投げず結果から除外される', ok };
}

function checkOrderPreserved(): CheckResult {
  const caseId = knownCaseId();
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [OTHER_TEACHING_NOTE_ID, KNOWN_TEACHING_NOTE_ID],
    repeatPracticeIds: [],
    recommendedCaseIds: [caseId],
  };
  const view = deriveLearnerApplicationView(plan);
  const ok =
    view.priorityTeachingNotes.length === 2 &&
    view.priorityTeachingNotes[0].id === OTHER_TEACHING_NOTE_ID &&
    view.priorityTeachingNotes[1].id === KNOWN_TEACHING_NOTE_ID;
  return { name: '順序維持（plan中のid順序とView配列順序が一致）', ok };
}

function checkDeterminism(): CheckResult {
  const caseId = knownCaseId();
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [KNOWN_TEACHING_NOTE_ID],
    repeatPracticeIds: [OTHER_TEACHING_NOTE_ID],
    recommendedCaseIds: [caseId],
  };
  const a = deriveLearnerApplicationView(plan);
  const b = deriveLearnerApplicationView(plan);
  const ok = JSON.stringify(a) === JSON.stringify(b);
  return { name: '決定論性（同一planに対し複数回呼んでも同一出力）', ok };
}

function checkNegativeControl(): CheckResult {
  // noteResolve.ts/caseResolve.tsの内部関数は使わず、Education Layer公開API（getTeachingNote）
  // のみで「unknown idを除外しない壊れた実装」を手動構築し、deriveLearnerApplicationView()の
  // 結果と比較する（adaptiveLearning/selfCheck.tsのNegative Controlと同じ考え方）。
  const plan: AdaptiveLearningPlan = {
    priorityTeachingNoteIds: [KNOWN_TEACHING_NOTE_ID, UNKNOWN_TEACHING_NOTE_ID],
    repeatPracticeIds: [],
    recommendedCaseIds: [],
  };
  const view = deriveLearnerApplicationView(plan);

  // 意図的にnullを除外しない壊れた実装（mapのみ、filterなし）。
  const brokenResolved = plan.priorityTeachingNoteIds.map((id) => getTeachingNote(id));

  const ok =
    brokenResolved.length === 2 && // 壊れた実装はunknown id分のnullも保持してしまう
    brokenResolved.some((n) => n === null) &&
    view.priorityTeachingNotes.length === 1 && // 正しい実装はnullを除外する
    view.priorityTeachingNotes.every((n) => n.id !== UNKNOWN_TEACHING_NOTE_ID);
  return { name: 'Negative Control（unknown idを除外しない壊れた実装との差異を検出できる）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkEmptyPlanYieldsAllEmpty(),
    checkTeachingNoteResolution(),
    checkCaseResolution(),
    checkUnknownIdExcludedWithoutThrowing(),
    checkOrderPreserved(),
    checkDeterminism(),
    checkNegativeControl(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[learnerApplication] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[learnerApplication] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
