/**
 * engine/skillTracking/scoreHistoryAdapter.ts ── ScoreHistory Adapter（Phase18.2）
 *
 * 設計書: Phase18_SkillTracking_API設計_v1.0.md / shojiさんPhase18.2確認事項（2026-07-19）。
 * 責務は「localStorage['kurz_score_history']の読み取り → SkillObservation[]への変換」のみに限定する。
 *
 * Adapterがやること: localStorage読み込み・JSON解析・HistoryEntry形状検証・SkillObservationへの変換。
 * Adapterがやらないこと（すべてPhase18.4 Skill Aggregatorの責務）: 平均値計算・最大値計算・ランク化・
 * SkillProfile生成・Technical/Knowledge分類。
 *
 * `kurz_score_history`はSimulationMode.tsxが所有するキーで、同ファイル内の非公開interface
 * `HistoryEntry`としてのみ定義されている（exportされていない）。既存ファイル（Strangler Pattern対象外の
 * frozen層）は無変更のまま、このAdapterがHistoryEntryと同一形状を独自に再定義して読み取る
 * （Phase18設計確定事項①、Phase14/15の凍結契約に触れない）。
 */
import type { SkillObservation, TechnicalSkillId } from './types';

/** SimulationMode.tsxのHISTORY_KEYと同一値。キー自体もそちらが所有する定数のため複製する。 */
const SCORE_HISTORY_KEY = 'kurz_score_history';

/**
 * SimulationMode.tsx内の非公開`HistoryEntry`と同一形状のうち、本Adapterが実際に使うフィールドのみ。
 * sizeScore/positionScore/angleScoreは各0〜25点満点（useSimStore.ts computeScore()の配点、
 * 4項目合計で100点満点になる設計）。stabilityScoreはPhase18設計確定事項でSkill Tracking対象外
 * （独立した操作ではなくposition/angleからの導出値のため）。
 */
interface ScoreHistoryEntryShape {
  readonly date: string;
  readonly sizeScore: number;
  readonly positionScore: number;
  readonly angleScore: number;
}

/** computeScore()の各サブスコア満点（useSimStore.ts参照）。0-100正規化の基準値。 */
const SUBSCORE_MAX = 25;
const NORMALIZED_MAX = 100;

/** サブスコア(0-25)をSkillObservation.value(0-100)へ正規化する。 */
function normalizeSubscore(subscore: number): number {
  return (subscore / SUBSCORE_MAX) * NORMALIZED_MAX;
}

/** HistoryEntry検証: 本Adapterが必要とする4フィールドの型のみを確認する（他フィールドは無視）。 */
function isScoreHistoryEntryShape(value: unknown): value is ScoreHistoryEntryShape {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === 'string' &&
    typeof v.sizeScore === 'number' &&
    Number.isFinite(v.sizeScore) &&
    typeof v.positionScore === 'number' &&
    Number.isFinite(v.positionScore) &&
    typeof v.angleScore === 'number' &&
    Number.isFinite(v.angleScore)
  );
}

/** 1件のHistoryEntryから3件のSkillObservation（size/position/angle）を生成する。 */
function toObservations(entry: ScoreHistoryEntryShape): readonly SkillObservation[] {
  const pairs: readonly (readonly [TechnicalSkillId, number])[] = [
    ['sizeAccuracy', entry.sizeScore],
    ['positionAccuracy', entry.positionScore],
    ['angleAccuracy', entry.angleScore],
  ];
  return pairs.map(([skillId, subscore]) => ({
    skillId,
    value: normalizeSubscore(subscore),
    observedAt: entry.date,
    source: 'scoreHistory',
  }));
}

/**
 * 生のJSON文字列からSkillObservation[]への変換のみを行う純粋関数（localStorage非依存）。
 * localStorageへアクセスしないため、テスト・SelfCheckから任意の文字列を直接渡して検証できる。
 * 不正な入力（JSON解析失敗・配列でない・要素の形状不一致）は例外を投げず、該当要素をスキップ
 * するか空配列を返す（Phase1〜5から一貫するnullポリシー/例外を投げない設計方針の踏襲）。
 */
export function parseScoreHistoryToObservations(raw: string | null): readonly SkillObservation[] {
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const observations: SkillObservation[] = [];
  for (const item of parsed) {
    if (!isScoreHistoryEntryShape(item)) continue;
    observations.push(...toObservations(item));
  }
  return observations;
}

/**
 * ScoreHistory Adapter本体。localStorage['kurz_score_history']を読み取りSkillObservation[]へ変換する
 * 薄いラッパー（実質的な変換ロジックはすべてparseScoreHistoryToObservationsへ委譲、resolve()中心設計
 * ・薄いAdapter/Resolverと同じ思想を踏襲）。集計・平均化・カテゴリ分類は一切行わない。
 */
export function adaptScoreHistory(): readonly SkillObservation[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SCORE_HISTORY_KEY);
  } catch {
    return [];
  }
  return parseScoreHistoryToObservations(raw);
}
