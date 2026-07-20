/**
 * engine/skillTracking/definitions.ts ── Skill定義テーブル（Phase18.4）
 *
 * 全SkillId（Technical3軸+Knowledge1軸）の静的な参照テーブル。Aggregatorが「Observationが
 * 1件も無いSkillでもSkillScoreを必ず生成する」（shojiさんPhase18.3レビュー確定事項）ために、
 * 全軸を列挙する基点として使う。ロジックは持たない（Ear Atlasのentries.tsと同じ、
 * 型定義とは別ファイルに分離した静的データ）。
 */
import type { SkillDefinition } from './types';

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  { id: 'sizeAccuracy', category: 'technical', labelJa: 'サイズ選択' },
  { id: 'positionAccuracy', category: 'technical', labelJa: '設置位置' },
  { id: 'angleAccuracy', category: 'technical', labelJa: '設置角度' },
  { id: 'anatomyRecognition', category: 'knowledge', labelJa: '解剖学的認識' },
];
