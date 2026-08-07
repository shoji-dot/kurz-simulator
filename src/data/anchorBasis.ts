import type { SurgicalCase } from './cases';

/**
 * Anchor Basis(再建経路)表示文字列 — Commit5(Priority3、2026-08-06)。
 *
 * `SurgicalCase.detailedReconstructionPattern`(Commit1で追加、PORP症例のみ設定)からの
 * 純粋な表示文字列変換(pure function)。Runtime臨床推論は行わない
 * (`Priority3_UI_Design_Review_v1.0.md` §2.1(B)参照)。
 *
 * **スコープをPORPのみに限定している理由(shoji確認済み、2026-08-06)**:
 * `P3_Completion_Summary_v1.0.md`(Frozen)§3 Anchor DefinitionはPORPのⅢc/Ⅲi-M判定
 * 手順のみを確定事項として扱っており、TORPについては言及がない。さらに同文書§5
 * Known Limitationsには「Soft Clip Stapes(Stapedotomy)のAnchor定義(キヌタ骨長突起→
 * 底板): Pending Clinical Confirmation」と明記されている。したがってTORP/Soft Clip
 * 症例に対して構造化Anchor Basisを表示すると、P3 Frozen文書が未確認とする内容を
 * UI上で確定情報として提示することになり、Clinical Safety First原則に反する。
 * `detailedReconstructionPattern`はPORP症例にしか設定されていない(Commit1)ため、
 * この関数はTORP/Soft Clip症例に対しては自然に`undefined`を返し、何も表示しない。
 *
 * 将来のロードマップ(shoji確認済み):
 * - TORPのAnchor Definitionを臨床的に確定 → P3文書更新 → 本関数へ追加、という順序
 * - Soft ClipはClinical Confirmation完了後に追加
 * を経てから対象を拡張する。今回のCommit5では拡張しない。
 */
export function getAnchorBasis(c: SurgicalCase): string | undefined {
  switch (c.detailedReconstructionPattern) {
    case 'Ⅲc':
      return '軟骨再建面(鼓膜) → アブミ骨頭部';
    case 'Ⅲi-M':
      return 'ツチ骨柄 → アブミ骨頭部';
    default:
      return undefined;
  }
}
