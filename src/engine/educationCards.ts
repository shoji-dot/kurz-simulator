/**
 * educationCards.ts ─ 削開モード MVES 教育カード選定ロジック（T8）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md Phase 3（教育設計）、§4.6、Phase 5 UI設計
 * プロジェクト最優先事項の3カードを状況に応じて1つ選び出す純関数。
 *   - whyRemoved   : なぜ削れた/削れないか（材料×バーの手応え説明）
 *   - whyDanger    : なぜ危険か（dangerZonesのclinicalNoteJa/complicationJaを流用）
 *   - whyBurrChange: なぜバー交換すべきか（危険近傍でCuttingバー使用中に表示）
 * 優先度: バー交換 > 危険 > 削れた/削れない（安全に直結する情報を最優先で表示する）。
 */

import type { Burr, DangerState, EducationCardContent, BoneMaterial } from './types';

/** この成長速度 mm/s を上回れば「よく削れている」とみなす（暫定閾値） */
export const ACTIVE_REMOVAL_THRESHOLD_MM_S = 0.5;
/** この硬さ以上は「硬さの壁」カードの対象（T2材料表: oticCapsule=1.0のみ該当） */
export const HARD_WALL_HARDNESS_THRESHOLD = 1.0;

export interface EducationCardContext {
  material: BoneMaterial;
  burr: Burr;
  dangerState: DangerState;
  growthRateMmPerSec: number;
}

function formatDist(distMm: number | null): string {
  return distMm !== null ? distMm.toFixed(1) : '?';
}

/**
 * selectEducationCard(): 現在の削開状況から表示すべき教育カードを1つ選ぶ。
 * 何も特筆すべき状況でなければ null（カード非表示）を返す。
 */
export function selectEducationCard(ctx: EducationCardContext): EducationCardContent | null {
  const { material, burr, dangerState, growthRateMmPerSec } = ctx;

  // 優先度1: 危険構造近傍でCuttingバー使用中 → バー交換を促す
  if (dangerState.level !== 'safe' && dangerState.zone && burr.type === 'cutting') {
    return {
      kind: 'whyBurrChange',
      titleJa: 'なぜバー交換？',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm以内。` +
        'Cuttingバーは食い込み（jump）による予期せぬ移動のリスクが高く、危険構造近傍での' +
        '制御が難しい。Diamondバーへ切り替えること。',
    };
  }

  // 優先度2: 危険接近（バー種問わず） → なぜ危険か（dangerZones既存データを流用）
  if (dangerState.level !== 'safe' && dangerState.zone) {
    return {
      kind: 'whyDanger',
      titleJa: 'なぜ危険？',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm。` +
        `${dangerState.zone.clinicalNoteJa} 接触時の合併症: ${dangerState.zone.complicationJa}`,
    };
  }

  // 優先度3-a: 硬さの壁（otic capsule等）に当たっている
  if (material.hardness >= HARD_WALL_HARDNESS_THRESHOLD) {
    return {
      kind: 'whyRemoved',
      titleJa: 'なぜ削れない？',
      bodyJa: `${material.educationTagJa}。${burr.labelJa}でもほぼ削れない＝硬さの壁。無理に押し込まず境界を確認すること。`,
    };
  }

  // 優先度3-b: 順調に除去できている
  if (growthRateMmPerSec > ACTIVE_REMOVAL_THRESHOLD_MM_S) {
    return {
      kind: 'whyRemoved',
      titleJa: 'なぜ削れる？',
      bodyJa: `${material.educationTagJa} ＋ ${burr.labelJa} → 高速除去。`,
    };
  }

  return null;
}
