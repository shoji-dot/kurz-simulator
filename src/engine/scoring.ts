/**
 * scoring.ts ─ 削開モード MVES ダメージ記録・採点（T9）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.7（Damage System・記録のみ）、§4.8（Scoring）
 * localStorage['kurz_drill_score_history']（既存 'kurz_score_history' とは別キー、最大10件）。
 *
 * 【設計上の注記】設計書の得点式は「安全60 = 100 − (危険接触critical×40) − (warn接近ペナルティ)、
 * 最小到達距離ボーナス」のように各軸の0-100サブスコアに対する式として書かれている（60/25/15は
 * 軸ごとの配分ウェイト）。critical×40は設計書に明記された数値。warnペナルティ・ボーナス・効率軸の
 * 内訳配分は設計書に具体的数値が無いため、本実装で暫定値を採用した（要耳科医較正、コメントに明記）。
 */

import type {
  BoneRegionId,
  DamageEvent,
  DangerLevel,
  DangerState,
  ScoreBreakdown,
  ScoreHistoryEntry,
  ToolPoseSnapshot,
} from './types';

// ══════════════════════════════════════════════════════════════════════
// localStorage
// ══════════════════════════════════════════════════════════════════════

export const SCORE_HISTORY_KEY = 'kurz_drill_score_history';
export const SCORE_HISTORY_MAX = 10;

/** loadScoreHistory(): 保存済みスコア履歴を新しい順で返す。壊れている場合は空配列。 */
export function loadScoreHistory(): ScoreHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoreHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** appendScoreHistory(): 新しいエントリを先頭に追加し、最大件数でトリムして保存する。 */
export function appendScoreHistory(entry: ScoreHistoryEntry): ScoreHistoryEntry[] {
  const next = [entry, ...loadScoreHistory()].slice(0, SCORE_HISTORY_MAX);
  try {
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // localStorage不可の環境（プライベートブラウズ等）では静かに失敗させる
  }
  return next;
}

// ══════════════════════════════════════════════════════════════════════
// Damage System（§4.7・記録のみ）
// ══════════════════════════════════════════════════════════════════════

/** oticCapsuleへ連続荷重した場合に oticOvercut イベントとみなす継続時間 ms（暫定） */
export const OTIC_OVERCUT_DWELL_MS = 1500;
/** この発熱レベル(0-1)以上でoverheatイベントを1回発火する（Sprint6・Heat、暫定閾値）。 */
export const HEAT_OVERHEAT_THRESHOLD = 0.85;
/** overheatFiredフラグをこの発熱レベルまで下がったら解除する（ヒステリシス、境界付近での連発防止）。 */
export const HEAT_OVERHEAT_RESET_THRESHOLD = 0.5;

export interface DamageTrackerState {
  lastZoneId: string | null;
  lastLevel: DangerLevel;
  oticDwellStartMs: number | null;
  oticOvercutFired: boolean;
  /** Sprint6・Heat: 直近のoverheatイベント発火状態（ヒステリシス制御用） */
  overheatFired: boolean;
}

export const initialDamageTrackerState: DamageTrackerState = {
  lastZoneId: null,
  lastLevel: 'safe',
  oticDwellStartMs: null,
  oticOvercutFired: false,
  overheatFired: false,
};

/**
 * stepDamageTracker(): 1フレーム分の危険状態からイベント（あれば）とトラッカー新状態を返す純関数。
 * - contact: ゾーンまたはlevelが変わった瞬間（新規遷移）のみ1回記録する（毎フレーム重複記録しない）。
 * - oticOvercut: oticCapsuleへの連続荷重が OTIC_OVERCUT_DWELL_MS を超えた瞬間に1回だけ記録する。
 */
/** Sprint5（Post Session Review）: イベント発生位置・工具条件スナップショット（記録専用、判定には使わない）。 */
export interface DamageEventContext {
  position: { x: number; y: number; z: number };
  toolPoseSnapshot: ToolPoseSnapshot;
}

export function stepDamageTracker(
  prev: DamageTrackerState,
  nowMs: number,
  dangerState: DangerState,
  isOnOticCapsule: boolean,
  isActivelyDrilling: boolean,
  context: DamageEventContext,
  /** Sprint6・Heat: 現在の発熱レベル 0-1（removalModel.ts growHeatLevel） */
  heatLevel: number
): { events: DamageEvent[]; next: DamageTrackerState } {
  const events: DamageEvent[] = [];
  const next: DamageTrackerState = { ...prev };

  if (dangerState.level !== 'safe' && dangerState.zone) {
    const isNewTransition =
      dangerState.zone.id !== prev.lastZoneId || dangerState.level !== prev.lastLevel;
    if (isNewTransition) {
      events.push({
        t: nowMs,
        type: 'contact',
        zoneId: dangerState.zone.id,
        zoneNameJa: dangerState.zone.nameJa,
        severity: dangerState.level === 'critical' ? 'critical' : 'warn',
        position: context.position,
        toolPoseSnapshot: context.toolPoseSnapshot,
      });
    }
    next.lastZoneId = dangerState.zone.id;
    next.lastLevel = dangerState.level;
  } else {
    next.lastZoneId = null;
    next.lastLevel = 'safe';
  }

  if (isActivelyDrilling && isOnOticCapsule) {
    const dwellStart = prev.oticDwellStartMs ?? nowMs;
    next.oticDwellStartMs = dwellStart;
    const dwellMs = nowMs - dwellStart;
    if (!prev.oticOvercutFired && dwellMs >= OTIC_OVERCUT_DWELL_MS) {
      events.push({
        t: nowMs,
        type: 'oticOvercut',
        zoneNameJa: '骨迷路（otic capsule）',
        severity: 'warn',
        position: context.position,
        toolPoseSnapshot: context.toolPoseSnapshot,
      });
      next.oticOvercutFired = true;
    }
  } else {
    next.oticDwellStartMs = null;
    next.oticOvercutFired = false;
  }

  // Sprint6・Heat: 発熱がHEAT_OVERHEAT_THRESHOLDへ到達した瞬間に1回だけ記録する
  // （oticOvercutと同様の一発火+ヒステリシスパターン。危険構造近傍かどうかでseverityを分ける
  // ＝近傍では接触なしでも熱損傷しうるためcritical、それ以外はwarn）。
  if (isActivelyDrilling && heatLevel >= HEAT_OVERHEAT_THRESHOLD) {
    if (!prev.overheatFired) {
      events.push({
        t: nowMs,
        type: 'overheat',
        zoneId: dangerState.zone?.id,
        zoneNameJa: dangerState.zone ? `発熱（${dangerState.zone.nameJa}近傍）` : '発熱',
        severity: dangerState.level !== 'safe' ? 'critical' : 'warn',
        position: context.position,
        toolPoseSnapshot: context.toolPoseSnapshot,
      });
      next.overheatFired = true;
    }
  } else if (heatLevel < HEAT_OVERHEAT_RESET_THRESHOLD) {
    next.overheatFired = false;
  }

  return { events, next };
}

// ══════════════════════════════════════════════════════════════════════
// Scoring（§4.8・3軸100点）
// ══════════════════════════════════════════════════════════════════════

export interface ScoreBreakdownInputs {
  damageEvents: DamageEvent[];
  /** 目標到達（乳突洞到達） */
  reachedAntrum: boolean;
  /** oticCapsuleリージョンで一定以上成長したホール数（除去無駄の代理指標） */
  oticCapsuleHolesCount: number;
  /** 生成ホール総数（除去無駄の分母） */
  totalHolesCount: number;
  /** セッション中の危険構造への最小到達距離 mm（安全ボーナス用） */
  minDistToDangerMm: number | null;
  /** 危険接近域(warn/critical)内でdiamondバーを使用していた累積時間 ms */
  nearDangerDiamondMs: number;
  /** 危険接近域(warn/critical)内でcuttingバーを使用していた累積時間 ms */
  nearDangerCuttingMs: number;
}

/** 危険接触critical1回あたりの減点（0-100スケール）。設計書に明記の数値。 */
const CRITICAL_PENALTY_100 = 40;
/** 危険接触warn1回あたりの減点（0-100スケール）。【暫定・設計書に数値なし】 */
const WARN_PENALTY_100 = 10;
/** 最小到達距離ボーナスがフルになる距離 mm。【暫定】 */
const SAFE_MARGIN_BONUS_MM = 8;
/** 最小到達距離ボーナスの上限（0-100スケール）。【暫定】 */
const MIN_DIST_BONUS_MAX_100 = 10;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** computeScoreBreakdown(): 蓄積データから3軸100点の内訳を算出する純関数。 */
export function computeScoreBreakdown(inputs: ScoreBreakdownInputs): ScoreBreakdown {
  const criticalCount = inputs.damageEvents.filter(
    (e) => e.type === 'contact' && e.severity === 'critical'
  ).length;
  const warnCount = inputs.damageEvents.filter(
    (e) => e.type === 'contact' && e.severity === 'warn'
  ).length;

  // 安全 60（設計書: 100 − critical×40 − warn接近ペナルティ、最小到達距離ボーナス）
  const minDistBonus100 =
    inputs.minDistToDangerMm !== null
      ? clamp01(inputs.minDistToDangerMm / SAFE_MARGIN_BONUS_MM) * MIN_DIST_BONUS_MAX_100
      : 0;
  const safety100 = clamp(
    100 - criticalCount * CRITICAL_PENALTY_100 - warnCount * WARN_PENALTY_100 + minDistBonus100,
    0,
    100
  );
  const safety = round1(safety100 * 0.6);

  // 効率 25（設計書: 目標到達＋除去無駄減点。到達を基礎点とし、無駄比率で減点する）
  const wasteRatio =
    inputs.totalHolesCount > 0
      ? clamp01(inputs.oticCapsuleHolesCount / inputs.totalHolesCount)
      : 0;
  const efficiency100 = inputs.reachedAntrum ? clamp(100 - wasteRatio * 100, 0, 100) : 0;
  const efficiency = round1(efficiency100 * 0.25);

  // 骨質適応 15（設計書: 危険近傍でdiamond使用していれば加点、cutting継続で減点）
  const totalNearDangerMs = inputs.nearDangerDiamondMs + inputs.nearDangerCuttingMs;
  const materialAdaptation100 =
    totalNearDangerMs > 0 ? clamp01(inputs.nearDangerDiamondMs / totalNearDangerMs) * 100 : 100;
  const materialAdaptation = round1(materialAdaptation100 * 0.15);

  const total = round1(safety + efficiency + materialAdaptation);

  return { safety, efficiency, materialAdaptation, total };
}

// ══════════════════════════════════════════════════════════════════════
// 事後レビュー（「事実→意味→改善策」形式、既存ScoreStepの方針を踏襲）
// ══════════════════════════════════════════════════════════════════════

export interface ScoreReviewItem {
  factJa: string;
  meaningJa: string;
  improvementJa: string;
}

/**
 * generateScoreReview(): スコア内訳と入力データから「事実→意味→改善策」のレビュー項目を生成する。
 * 該当する事象がない軸は項目を出さない（褒めるべき点のみのセッションでは空配列になりうる）。
 */
export function generateScoreReview(
  breakdown: ScoreBreakdown,
  inputs: ScoreBreakdownInputs
): ScoreReviewItem[] {
  const items: ScoreReviewItem[] = [];

  const criticalCount = inputs.damageEvents.filter(
    (e) => e.type === 'contact' && e.severity === 'critical'
  ).length;
  if (criticalCount > 0) {
    items.push({
      factJa: `危険構造への接触（critical）が${criticalCount}回発生しました。`,
      meaningJa: '実臨床では House-Brackmann grade 3以上の顔面神経麻痺や大量出血など、不可逆的な合併症に直結しうる接近です。',
      improvementJa: '危険構造まで2.5mm以内に入ったら削開速度を落とし、Diamondバーへ切り替えて接触角を浅くしてください。',
    });
  }

  const oticCount = inputs.oticCapsuleHolesCount;
  if (oticCount > 0) {
    items.push({
      factJa: `骨迷路（otic capsule）領域を${oticCount}箇所削開しました。`,
      meaningJa: 'otic capsuleは象牙骨で構成される「硬さの壁」であり、本来ほとんど削るべきではない領域です。',
      improvementJa: '硬い手応え＋高音を感じたら削開を止め、境界（リージョン変化）を確認してから方向を変えてください。',
    });
  }

  if (inputs.nearDangerCuttingMs > inputs.nearDangerDiamondMs && inputs.nearDangerCuttingMs > 0) {
    items.push({
      factJa: '危険構造接近域でCuttingバーを使用していた時間がDiamondバーより長くなっています。',
      meaningJa: 'Cuttingバーは食い込み（jump）のリスクが高く、危険構造近傍での使用は推奨されません。',
      improvementJa: '危険接近アラートが出た時点でDiamondバーへ切り替える習慣をつけてください。',
    });
  }

  if (!inputs.reachedAntrum) {
    items.push({
      factJa: '乳突洞（Mastoid Antrum）に到達しないままセッションが終了しました。',
      meaningJa: '乳突削開の第一目標（antrum到達）が未達のため、効率スコアが伸びていません。',
      improvementJa: 'ガイド表示のSaucerization Volume（すり鉢状）に沿って外側から内側へ計画的に削開してください。',
    });
  }

  if (items.length === 0 && breakdown.total >= 90) {
    items.push({
      factJa: `総合${breakdown.total}点。危険接触なく目標へ到達しました。`,
      meaningJa: '安全マージンを保ちながら効率的に削開できています。',
      improvementJa: 'この調子で、より小径のバーでの繊細な操作にも挑戦してみてください。',
    });
  }

  return items;
}

// ══════════════════════════════════════════════════════════════════════
// Sprint5: Post Session Review（個別ダメージイベントの空間紐付けレビュー）
// ══════════════════════════════════════════════════════════════════════

/**
 * describeDamageEvent(): 1件のDamageEventを「事実→意味→改善策」形式で説明する。
 * generateScoreReview()がセッション全体の集計（回数ベース）であるのに対し、こちらは
 * 3Dピン1個＝1イベントに対応する個別説明（Sprint5 Post Session Reviewで使用）。
 */
export function describeDamageEvent(event: DamageEvent): ScoreReviewItem {
  const pose = event.toolPoseSnapshot;
  const poseNoteJa = pose
    ? `（${pose.burrId.startsWith('cutting') ? 'Cuttingバー' : 'Diamondバー'}・RPM${
        pose.rpmPreset === 'low' ? '低' : pose.rpmPreset === 'mid' ? '中' : '高'
      }・荷重${Math.round(pose.pressure * 100)}%）`
    : '';
  const zoneLabel = event.zoneNameJa ?? '危険構造';

  if (event.type === 'contact' && event.severity === 'critical') {
    return {
      factJa: `${zoneLabel}へのcritical接触が発生しました${poseNoteJa}。`,
      meaningJa: '実臨床では House-Brackmann grade 3以上の顔面神経麻痺や大量出血など、不可逆的な合併症に直結しうる接近です。',
      improvementJa: 'この地点では削開速度を落とし、Diamondバーへ切り替えて接触角を浅くしてから再アプローチしてください。',
    };
  }
  if (event.type === 'contact') {
    return {
      factJa: `${zoneLabel}へ接近（warn）しました${poseNoteJa}。`,
      meaningJa: 'まだ接触には至っていませんが、安全マージンが縮まっている状態です。',
      improvementJa: 'この距離感を覚えておき、次回はより早い段階で減速・バー交換を検討してください。',
    };
  }
  if (event.type === 'oticOvercut') {
    return {
      factJa: `${zoneLabel}へ${OTIC_OVERCUT_DWELL_MS / 1000}秒以上連続して荷重しました${poseNoteJa}。`,
      meaningJa: 'otic capsuleは象牙骨で構成される「硬さの壁」であり、本来ほとんど削るべきではない領域です。',
      improvementJa: '硬い手応え＋高音を感じたら削開を止め、境界（リージョン変化）を確認してから方向を変えてください。',
    };
  }
  if (event.type === 'overheat') {
    // Sprint6・Heat: 文献根拠は removalModel.ts のHeatセクション参照
    // （47℃60秒/50℃30秒で熱壊死、無注水連続照射で顔面神経管内温度33℃上昇の報告）。
    const nearDanger = event.severity === 'critical';
    return {
      factJa: `発熱が蓄積しました${poseNoteJa}。`,
      meaningJa: nearDanger
        ? '骨組織は47℃で60秒、50℃で30秒の熱曝露で熱壊死を起こしうるとされます。特に危険構造（顔面神経等）は熱伝導による損傷を受けやすく、バーが直接触れていなくても熱で損傷しうることが報告されています。'
        : '骨組織は47℃で60秒、50℃で30秒の熱曝露で熱壊死を起こしうるとされます。連続した削開は間欠的な削開より発熱が有意に大きくなります。',
      improvementJa: 'バーを一度浮かせて間欠的に削り、同じ場所に留まらないこと。危険構造近傍では特に荷重と回転数を落としてください。',
    };
  }
  // その他（現状未発火の型が今後追加された場合のフォールバック）
  return {
    factJa: `記録されたイベントが発生しました${poseNoteJa}。`,
    meaningJa: '詳細な説明が未定義のイベント種別です。',
    improvementJa: '教育カード・危険アラートの表示内容を確認してください。',
  };
}

/** 削開結果からリージョン別ホール数を集計する補助関数（UI表示・デバッグ用） */
export function countHolesByRegion(
  regionIds: BoneRegionId[]
): Partial<Record<BoneRegionId, number>> {
  const counts: Partial<Record<BoneRegionId, number>> = {};
  for (const id of regionIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
