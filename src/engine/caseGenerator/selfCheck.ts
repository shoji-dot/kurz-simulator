/**
 * engine/caseGenerator/selfCheck.ts ── 開発時セルフチェック (Phase7.3)
 *
 * Case Generator（Phase7.1〜7.2で確定した公開API）に対する実行時自己診断。
 * engine/education/selfCheck.ts（Phase6.3）等と同じ`if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的にexportしない（公開APIの一部ではなく開発時専用の
 * 副作用ファイル）。
 *
 * 【スコープ】網羅的なテストスイートではなく、各層につき代表的な正常系・境界値ケースを1〜数個ずつ。
 * data/cases.tsの実データ件数はハードコードしない（本番データ追加のたびに壊れるため）。期待値は
 * surgicalCasesをその場でフィルタして算出する。
 *
 * 確認する7項目:
 *   1. getCase()の基本動作（実在id/未知id）
 *   2. findCases()のdifficulty絞り込み（beginner/intermediate/advancedそれぞれ）
 *   3. findCases({})（difficulty省略）は全件を返す
 *   4. buildCaseTeachingBundle()の基本動作（surgicalCaseがgetCase()と同一参照であること）
 *   5. buildCaseTeachingBundle()の未知caseIdでnull
 *   6. relatedNotesがcaseMappingsの3件(malleus/incus/stapes)固定であること
 *   7. relatedNotesの各エントリがEar Atlas由来（idがossicle.*）であり、新しい教育コンテンツを
 *      捏造していないこと
 */
import { surgicalCases } from '../../data/cases';
import type { SurgicalCase } from '../../data/cases';
import { getCase, findCases } from './library';
import { buildCaseTeachingBundle } from './bundler';

const UNKNOWN_CASE_ID = '__selfcheck_unknown_case_id__';
const KNOWN_CASE_ID = surgicalCases[0].id;
const DIFFICULTIES: readonly SurgicalCase['difficulty'][] = ['beginner', 'intermediate', 'advanced'];

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

function checkGetCaseBasics(): CheckResult {
  const known = getCase(KNOWN_CASE_ID);
  const unknown = getCase(UNKNOWN_CASE_ID);
  const ok = known !== null && known.id === KNOWN_CASE_ID && unknown === null;
  return { name: 'getCase()の基本動作', ok };
}

function checkFindCasesByDifficulty(): CheckResult {
  const ok = DIFFICULTIES.every((d) => {
    const expected = surgicalCases.filter((c) => c.difficulty === d);
    const actual = findCases({ difficulty: d });
    return actual.length === expected.length && actual.every((c) => c.difficulty === d);
  });
  return { name: 'findCases()のdifficulty絞り込み', ok };
}

function checkFindCasesOmittedReturnsAll(): CheckResult {
  const all = findCases({});
  const ok = all.length === surgicalCases.length;
  return { name: 'findCases({})はdifficulty省略時に全件を返す', ok };
}

function checkBuildCaseTeachingBundleBasics(): CheckResult {
  const bundle = buildCaseTeachingBundle(KNOWN_CASE_ID);
  const ok = bundle !== null && bundle.surgicalCase === getCase(KNOWN_CASE_ID);
  return { name: 'buildCaseTeachingBundle()の基本動作（同一参照）', ok };
}

function checkBuildCaseTeachingBundleUnknownId(): CheckResult {
  const bundle = buildCaseTeachingBundle(UNKNOWN_CASE_ID);
  return { name: 'buildCaseTeachingBundle()の未知caseIdでnull', ok: bundle === null };
}

function checkRelatedNotesFixedMapping(): CheckResult {
  const bundle = buildCaseTeachingBundle(KNOWN_CASE_ID);
  const ids = (bundle?.relatedNotes ?? []).map((n) => n.entry.id).slice().sort();
  const expected = ['ossicle.incus', 'ossicle.malleus', 'ossicle.stapes'];
  const ok = ids.length === expected.length && ids.every((id, i) => id === expected[i]);
  return { name: 'relatedNotesが対応表の3件(malleus/incus/stapes)固定', ok };
}

function checkRelatedNotesAreEarAtlasOrigin(): CheckResult {
  const bundle = buildCaseTeachingBundle(KNOWN_CASE_ID);
  const ok = (bundle?.relatedNotes ?? []).length > 0 && (bundle?.relatedNotes ?? []).every((n) => n.entry.id.startsWith('ossicle.'));
  return { name: 'relatedNotesがEar Atlas由来（新規教育コンテンツの捏造なし）', ok };
}

if (import.meta.env.DEV) {
  const results: readonly CheckResult[] = [
    checkGetCaseBasics(),
    checkFindCasesByDifficulty(),
    checkFindCasesOmittedReturnsAll(),
    checkBuildCaseTeachingBundleBasics(),
    checkBuildCaseTeachingBundleUnknownId(),
    checkRelatedNotesFixedMapping(),
    checkRelatedNotesAreEarAtlasOrigin(),
  ];

  for (const r of results) {
    if (!r.ok) {
      console.warn(`[caseGenerator] selfCheck FAIL: ${r.name}`);
    }
  }

  console.info(`[caseGenerator] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
}
