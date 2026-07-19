/**
 * engine/learnerApplication/caseResolve.ts ─── 症例id→実体解決 (Phase13.3)
 *
 * Phase13_LearnerApplicationLayer_API設計_v1.0.md（shojiさん承認済み）§5-1・§7・§8の実装。
 * Case Generator（`engine/caseGenerator`、Phase7凍結済み）の**公開API（`getCase`）のみ**を
 * 利用し、症例idを`CaseActionView`へ解決する。`data/cases.ts`への直接参照は行わない
 * （型import含め一切依存しない。`getCase()`の戻り値型のみから`CaseActionView`を組み立てる）。
 *
 * 【責務の境界（shojiさんPhase13.2レビュー所見「Phase13.3レビュー観点」への対応）】本ファイルが
 * 行うのは「症例ID → SurgicalCase実体 → 表示用整形」のみ。Case検索ルールの追加・難易度の変更・
 * 推薦理由の生成・未実施症例判定ロジックの追加は一切行わない（`title`/`description`/
 * `difficulty`の単純転記のみ）。Phase7がLibrary/Bundlerに分離した責務のうち、本ファイルは
 * 「Case Generatorが返す既存情報を表示化する」だけに留める。
 */
import { getCase } from '../caseGenerator';
import type { CaseActionView } from './types';

/** `getCase()`の戻り値（`SurgicalCase`）をCaseActionViewへ変換する。転記のみ。 */
function toCaseActionView(surgicalCase: NonNullable<ReturnType<typeof getCase>>): CaseActionView {
  return {
    type: 'case',
    id: surgicalCase.id,
    titleJa: surgicalCase.title,
    descriptionJa: surgicalCase.description,
    difficulty: surgicalCase.difficulty,
  };
}

/**
 * 症例idの配列を`CaseActionView`の配列へ解決する。`ids`の順序をそのまま維持する
 * （ソート・並べ替えは行わない、設計書§5-1「新しい優先順位付けは行わない」）。
 *
 * `getCase(id)`が`null`を返すid（Case Generatorで解決できないid）は結果から除外する
 * （設計書§8 nullポリシー、例外を投げない）。
 */
export function deriveCaseActionViews(ids: readonly string[]): readonly CaseActionView[] {
  const views: CaseActionView[] = [];
  for (const id of ids) {
    const surgicalCase = getCase(id);
    if (surgicalCase === null) continue; // 解決不能idは除外
    views.push(toCaseActionView(surgicalCase));
  }
  return views;
}
