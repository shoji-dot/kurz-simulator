/**
 * engine/assessment/mastery.ts ─── masteryLevel算出 (Phase10.2)
 *
 * Phase10_AssessmentLayer_API設計_v1.0.md（shojiさん承認済み）§10の実装。
 * `SessionSummary`（Phase9公開API）の量的指標のみから`MasteryLevel`を機械的に導出する。
 *
 * 【Compatibility Policy（設計書§4）】ここで行うのは閾値判定のみ。AIによる推論・確率的判断・
 * 将来予測は行わない。閾値・合算方法はいずれも暫定値であり、変更する場合はBreaking Changeとして
 * 扱う（設計書§11）。
 */
import type { SessionSummary } from '../learningSession';
import type { MasteryLevel } from './types';

/**
 * 活動量スコアがこの値未満は`beginner`と判定する（暫定値）。
 * 活動量ベースの代理指標であり、耳科教育としての妥当性を保証する値ではない
 * （要耳科医較正、`scoring.ts`の材料硬度暫定値と同じ扱い）。
 * `BEGINNER_THRESHOLD < PROFICIENT_THRESHOLD`を前提とする。変更する場合はBreaking Changeとして
 * 扱う（設計書§11参照）。
 */
export const BEGINNER_THRESHOLD = 2;

/**
 * 活動量スコアがこの値以上は`proficient`と判定する（暫定値）。
 * 活動量ベースの代理指標であり、耳科教育としての妥当性を保証する値ではない（要耳科医較正）。
 * 変更する場合はBreaking Changeとして扱う（設計書§11参照）。
 */
export const PROFICIENT_THRESHOLD = 8;

/**
 * **Activity Score** = `messageCount + teachingNoteCount`の単純合算（暫定的な均等重み付け）。
 * この名称（Activity Score）はPhase10設計書・コード双方で固定する（shojiさんPhase10.2レビュー
 * 所見）。対話数と参照教材数を区別せず合算する。この合算方法自体も暫定値であり、重み付けの
 * 妥当性検証（耳科医較正）が必要になった場合はBreaking Changeとして見直す（設計書§11参照）。
 * この関数は`index.ts`からはもちろん、`mastery.ts`の外からも一切exportしない（Activity Score
 * 自体を公開APIにする予定はない、shojiさんPhase10.2レビュー所見）。
 */
function computeActivityScore(summary: SessionSummary): number {
  return summary.messageCount + summary.teachingNoteCount;
}

/**
 * `SessionSummary`からActivity Scoreを算出し、`MasteryLevel`を導出する。
 *
 * 【判定順序を固定する】まず`proficient`を判定し、次に`beginner`、それ以外を`developing`とする
 * （`beginner → developing → proficient`という一次元の活動量尺度だが、判定は「高い方から」行う）。
 * `BEGINNER_THRESHOLD < PROFICIENT_THRESHOLD`である限りこの順序は結果に影響しないが、将来
 * 閾値の見直しで前提が崩れた場合でも、この順序（proficient優先）により未定義動作を防ぐ安全策
 * として固定する。判定順序の変更もBreaking Change対象（設計書§11参照）。
 */
export function deriveMasteryLevel(summary: SessionSummary): MasteryLevel {
  const score = computeActivityScore(summary);
  if (score >= PROFICIENT_THRESHOLD) return 'proficient';
  if (score < BEGINNER_THRESHOLD) return 'beginner';
  return 'developing';
}
