/**
 * engine/recommendation/caseRecommend.ts ─── 関連症例の推奨算出 (Phase11.3)
 *
 * Phase11_RecommendationLayer_API設計_v1.0.md（shojiさん承認済み）§5-2・§10の実装。
 * Case Generator（`engine/caseGenerator`、Phase7凍結済み）の**公開API（`findCases`/
 * `buildCaseTeachingBundle`）のみ**を利用し、`AssessmentResult.weaknesses`（Phase10公開API
 * 由来の事実）に関連する教材を持つ、評価対象のセッションとは別の症例を抽出する。
 *
 * 【仕様と実装詳細の分離（設計書§5-2）】仕様として固定するのは「Case Generatorの公開APIを
 * 利用して関連症例を抽出する」という点までであり、本ファイルの具体的なアルゴリズム
 * （`findCases({})`で全件取得→`buildCaseTeachingBundle()`で`relatedNotes`を照合、という
 * 全件走査方式）は実装詳細として凍結しない。将来症例数が増えた場合の内部実装変更
 * （例: インデックス化）はBreaking Changeに該当しない。
 *
 * 【決定論性の維持】`findCases({})`が返す順序（`data/cases.ts`の記述順、Case Generator
 * 凍結文書で確認済みのdifficulty省略時=全件・順序保持の挙動）をそのまま`recommendedCaseIds`/
 * `reasons`へ引き継ぐ。ソート・`Set`による出力順序の変更は行わない（`Set`はmembership判定にのみ
 * 使用、Phase10の`compareTeachingNotes()`と同じ考え方）。
 */
import type { AssessmentResult } from '../assessment';
import type { RecommendationReason } from './types';
import { findCases, buildCaseTeachingBundle } from '../caseGenerator';

export interface CaseRecommendation {
  readonly recommendedCaseIds: readonly string[];
  readonly reasons: readonly RecommendationReason[];
}

/**
 * `assessment.weaknesses`に関連する教材を持つ、評価対象のセッションとは別の症例を抽出する。
 *
 * - `weaknesses`が空（`caseId=null`または全参照済み）の場合は、Case Generatorへ問い合わせず
 *   即座に空の結果を返す（無駄な全件走査を避ける、Phase10.4の
 *   「`caseId===null`なら`buildCaseTeachingBundle()`を呼ばない」と同じ考え方）。
 * - 評価対象のセッション自身の症例（`assessment.caseId`）は候補から除外する（自己除外、
 *   Phase4.2`findNearest()`/Phase5.5`findNearestByDangerLevel()`と同じ方針）。
 * - `buildCaseTeachingBundle()`が`null`を返す候補（理論上は起こらないが、Case Generatorの
 *   nullポリシーに従い防御的に処理）はスキップする。
 */
export function deriveCaseRecommendations(assessment: AssessmentResult): CaseRecommendation {
  if (assessment.weaknesses.length === 0) {
    return { recommendedCaseIds: [], reasons: [] };
  }

  const weaknessSet = new Set(assessment.weaknesses); // membership判定にのみ使用、出力順は変更しない
  const recommendedCaseIds: string[] = [];
  const reasons: RecommendationReason[] = [];

  for (const candidate of findCases({})) {
    if (candidate.id === assessment.caseId) continue; // 自己除外
    const bundle = buildCaseTeachingBundle(candidate.id);
    if (bundle === null) continue;
    const isRelated = bundle.relatedNotes.some((note) => weaknessSet.has(note.entry.id));
    if (!isRelated) continue;

    recommendedCaseIds.push(candidate.id);
    reasons.push({
      kind: 'relatedCase',
      caseId: candidate.id,
      messageJa: '未参照の教材に関連する別の症例があります。',
    });
  }

  return { recommendedCaseIds, reasons };
}
