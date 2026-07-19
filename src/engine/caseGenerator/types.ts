/**
 * engine/caseGenerator/types.ts ─── Case Generator 型定義 (Phase7.1)
 *
 * Phase7_CaseGenerator_API設計_v1.0.md（shojiさん承認済み 2026-07-18、評価A）の実装。
 * Education Layer（Phase6凍結済み）とCase Library（`data/cases.ts`、既存・変更なし）を組み合わせて
 * 教材を構築するCase Generatorの型定義。
 */
import type { TeachingNote } from '../education';
import type { SurgicalCase } from '../../data/cases';

/**
 * 症例1件+関連する構造物の教育情報をまとめた教材の最小単位。
 * SurgicalCase自体は転記のみ（新しい症例データを捏造しない、Phase6の「変換のみ」方針と同じ考え方）。
 * 現時点ではmetadata等の追加フィールドは持たない（YAGNI。shojiさんのPhase7レビュー所見「後者を
 * 推す＝将来必要になるまで余計なフィールドを追加しない」を採用）。
 */
export interface CaseTeachingBundle {
  readonly surgicalCase: SurgicalCase;
  /**
   * この症例に関連する構造物のTeachingNote。`internal/caseMappings.ts`の静的対応表
   * （malleus/incus/stapes → Ear Atlas id）で決まる固定集合をEducation Layerの公開APIへ
   * そのまま渡した結果であり、Case Generator独自の関連度判断は行わない。
   */
  readonly relatedNotes: readonly TeachingNote[];
}
