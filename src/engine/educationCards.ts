/**
 * educationCards.ts ─ 削開モード MVES 教育カード選定ロジック（T8）／Expert Coach（Sprint4・V11）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md Phase 3（教育設計）、§4.6、Phase 5 UI設計
 * KURZ_Voxelアーキテクチャ設計_v2.0.md §⑥Expert Coach（2026-07-12・Sprint4で実装）:
 * 「新規サブシステムではなく、既存の優先度付きルール選択の枠組みを拡張する」方針に従い、
 * 本ファイルのselectEducationCard()へ新規入力（Pressure・Contact Angle・Feed Rate・
 * RPM×材料の不整合）を追加する形で実装した。数値閾値は文献・KURZ実機データが未確認のため
 * 全て暫定値とし、shojiさんの較正待ちとする（設計書§⑥「実装上の注意」に明記済みの方針）。
 *
 * プロジェクト最優先事項の3カードを状況に応じて1つ選び出す純関数。
 *   - whyRemoved   : なぜ削れた/削れないか（材料×バーの手応え説明。Feed Rate/RPM技術指導も含む）
 *   - whyDanger    : なぜ危険か（dangerZonesのclinicalNoteJa/complicationJaを流用。
 *                    Pressure/Contact Angleの危険近傍技術指導も含む）
 *   - whyBurrChange: なぜバー交換すべきか（危険近傍でCuttingバー使用中に表示）
 * 優先度: バー交換 > 危険（Pressure/Angle含む） > バー交換(clog) > 留まりすぎ >
 *         送り速度過大 > 回転数不足 > 削れた/削れない（安全に直結する情報を最優先で表示する）。
 */

import type { Burr, DangerState, EducationCardContent, BoneMaterial, RpmPreset } from './types';

/** この成長速度 mm/s を上回れば「よく削れている」とみなす（暫定閾値） */
export const ACTIVE_REMOVAL_THRESHOLD_MM_S = 0.5;
/** この硬さ以上は「硬さの壁」カードの対象（T2材料表: oticCapsule=1.0のみ該当） */
export const HARD_WALL_HARDNESS_THRESHOLD = 1.0;
/** この目詰まり度以上で「バー交換/間欠削開」カードの対象（Sprint3追補・clogFactor） */
export const CLOG_BURR_CHANGE_THRESHOLD = 0.6;
/** この継続「留まり」時間(ms)以上で「動かしながら削る」カードの対象（Sprint3追補・Tool Pose dwell検知） */
export const DWELL_WARNING_MS = 800;

// ══════════════════════════════════════════════════════════════════════
// Expert Coach 新規閾値（Sprint4・2026-07-12、全て暫定値・要ENT較正）
// ══════════════════════════════════════════════════════════════════════
/** 危険近傍でこの荷重(0–1)以上は「押し付け過ぎ」とみなす（暫定閾値） */
export const PRESSURE_DANGER_THRESHOLD = 0.8;
/** この接触角(度)未満は「先端が立っている」とみなす（暫定閾値。0°=先端直進、90°=側面） */
export const CONTACT_ANGLE_TIP_THRESHOLD_DEG = 30;
/** この硬さ(material.hardness)以上でRPMプリセットが'low'なら「回転数を上げて」の対象（暫定閾値） */
export const HARD_MATERIAL_RPM_THRESHOLD = 0.5;
/** この移動速度(mm/s)を超えると「なぞっただけ」で送り速度が速すぎるとみなす（暫定閾値） */
export const FEED_RATE_TOO_FAST_MM_S = 12;

// ══════════════════════════════════════════════════════════════════════
// Sprint6・Heat（2026-07-13、全て暫定値・要ENT較正）
// ══════════════════════════════════════════════════════════════════════
/** この発熱レベル(0-1)以上で発熱の教育カードを表示する（removalModel.ts growHeatLevel参照） */
export const HEAT_WARNING_THRESHOLD = 0.6;

export interface EducationCardContext {
  material: BoneMaterial;
  burr: Burr;
  dangerState: DangerState;
  growthRateMmPerSec: number;
  /** バーのフルート目詰まり度 0–1（Sprint3追補・removalModel.ts clogLevel） */
  clogLevel: number;
  /** 同じ場所に留まり続けている継続時間 ms（Sprint3追補・removalModel.ts advanceDwellMs） */
  dwellMs: number;
  /** Sprint4追補・Expert Coach: 実効荷重 0–1（Shift/Ctrlクイック切替後の値） */
  pressure: number;
  /** Sprint4追補・Expert Coach: 現在のRPMプリセット */
  rpmPreset: RpmPreset;
  /** Sprint4追補・Expert Coach: 接触角(度)。0°=先端直進、90°=側面 */
  contactAngleDeg: number;
  /** Sprint4追補・Expert Coach（Feed Rate）: Tool Pose移動速度 mm/s */
  toolVelocityMmPerSec: number;
  /** Sprint6・Heat: 現在の発熱レベル 0-1（removalModel.ts growHeatLevel） */
  heatLevel: number;
}

function formatDist(distMm: number | null): string {
  return distMm !== null ? distMm.toFixed(1) : '?';
}

/**
 * selectEducationCard(): 現在の削開状況から表示すべき教育カードを1つ選ぶ。
 * 何も特筆すべき状況でなければ null（カード非表示）を返す。
 */
export function selectEducationCard(ctx: EducationCardContext): EducationCardContent | null {
  const {
    material, burr, dangerState, growthRateMmPerSec, clogLevel, dwellMs,
    pressure, rpmPreset, contactAngleDeg, toolVelocityMmPerSec, heatLevel,
  } = ctx;

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

  // 優先度2: 危険近傍＋荷重過大（Sprint4追補・Expert Coach）。文献: Pressureが高いほど
  // 除去速度は上がるが危険構造近傍での制御性が下がる（v2.0設計書§⑤⑥）。
  if (dangerState.level !== 'safe' && dangerState.zone && pressure >= PRESSURE_DANGER_THRESHOLD) {
    return {
      kind: 'whyDanger',
      titleJa: '押し付け過ぎです',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm。` +
        '荷重が高いまま危険構造へ近づくと、わずかな手元のブレでも接触するリスクが高い。' +
        '危険構造近傍では荷重を弱めて制御性を優先すること。',
    };
  }

  // 優先度2-b: 危険近傍＋接触角過小（先端が立っている、Sprint4追補・Expert Coach）。
  // 文献: 危険構造近傍では側面を使った浅い削り方が標準技術（drtbalu's tips）。
  if (
    dangerState.level !== 'safe' && dangerState.zone &&
    contactAngleDeg < CONTACT_ANGLE_TIP_THRESHOLD_DEG
  ) {
    return {
      kind: 'whyDanger',
      titleJa: 'バーを寝かせてください',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm。` +
        '先端を立てたまま直進的に削ると深追いしやすい。バーを寝かせて側面を使い、' +
        '浅く広く削ること。',
    };
  }

  // 優先度2-c: 危険近傍＋発熱（Sprint6・Heat）。文献: 無注水・高速ダイヤモンドバーの連続照射で
  // 顔面神経管内温度が33℃上昇した報告があり（PubMed 11558764）、接触なしでも熱伝導により
  // 危険構造が損傷しうる。危険構造近傍かつ発熱が閾値を超えたら、直接接触とは別の危険として案内する。
  if (dangerState.level !== 'safe' && dangerState.zone && heatLevel >= HEAT_WARNING_THRESHOLD) {
    return {
      kind: 'whyDanger',
      titleJa: '熱がこもっています',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm。` +
        'バーが直接触れていなくても、熱が骨を伝わって危険構造を損傷することがあります。' +
        '一度バーを浮かせて冷まし、荷重と回転数を落としてから再開すること。',
    };
  }

  // 優先度3: 危険接近（バー種問わず） → なぜ危険か（dangerZones既存データを流用）
  if (dangerState.level !== 'safe' && dangerState.zone) {
    return {
      kind: 'whyDanger',
      titleJa: 'なぜ危険？',
      bodyJa:
        `${dangerState.zone.nameJa}まで${formatDist(dangerState.distMm)}mm。` +
        `${dangerState.zone.clinicalNoteJa} 接触時の合併症: ${dangerState.zone.complicationJa}`,
    };
  }

  // 優先度4: フルート目詰まり（継続削開で蓄積。文献: 骨粉・血液の混入がフルート閉塞を招き
  // 切削効率が低下する。間欠的な軽圧削開やバー交換で解消する）。安全系(優先度1-3)には劣後させる。
  if (clogLevel >= CLOG_BURR_CHANGE_THRESHOLD) {
    return {
      kind: 'whyBurrChange',
      titleJa: 'なぜバー交換？',
      bodyJa:
        'バーのフルート（溝）が骨粉で目詰まりし、切削効率が落ちている。' +
        '押し付け続けるより、間欠的に軽く当てる方が目詰まりを防げる。' +
        'バーを交換するか、一度離して目詰まりを解消すること。',
    };
  }

  // 優先度4-b: 発熱（危険構造近傍でない場合。Sprint6・Heat）。文献: 骨組織は47℃60秒/
  // 50℃30秒の熱曝露で熱壊死を起こしうる（PMC6759003）。危険系(優先度1-3)には劣後させる。
  if (heatLevel >= HEAT_WARNING_THRESHOLD) {
    return {
      kind: 'whyRemoved',
      titleJa: '発熱が蓄積しています',
      bodyJa:
        '同じ場所への連続削開で熱がこもってきている。骨組織は熱曝露（目安: 47℃で60秒程度）で' +
        '熱壊死を起こしうる。バーを浮かせて間欠的に削り、冷ます時間を作ること。',
    };
  }

  // 優先度5: 同じ場所に留まり続けている（Tool Pose速度がほぼ0の状態が継続）。
  // 文献: saucerization（表層から均等に、動かしながら削る）が標準技術。留まって押し込むと
  // 局所的な深追い・予期せぬjumpのリスクが高まる（危険系(優先度1-3)には劣後させる）。
  if (dwellMs >= DWELL_WARNING_MS) {
    return {
      kind: 'whyRemoved',
      titleJa: 'なぜこの削り方は危険？',
      bodyJa:
        '同じ場所に留まって押し込み続けている。実際の手術ではSaucerization' +
        '（表層から均等に、バーを動かしながら削る）が基本技術。留まり続けると' +
        '局所的に深く削れすぎ、予期せぬ深追い（jump）のリスクが高まる。',
    };
  }

  // 優先度6: 送り速度が速すぎる（Sprint4追補・Expert Coach・Feed Rate）。文献: 速すぎる
  // Feed Rateは一箇所あたりの除去量が不足し「なぞっただけ」になる（v2.0設計書§③表）。
  if (toolVelocityMmPerSec > FEED_RATE_TOO_FAST_MM_S) {
    return {
      kind: 'whyRemoved',
      titleJa: '送り速度が速すぎます',
      bodyJa:
        'バーを動かす速度が速く、一箇所あたりの接触時間が短いため十分に削れていない。' +
        '少しゆっくり、確実に接触させながら動かすこと。',
    };
  }

  // 優先度7: 硬い材料×RPM低（Sprint4追補・Expert Coach）
  if (material.hardness >= HARD_MATERIAL_RPM_THRESHOLD && rpmPreset === 'low') {
    return {
      kind: 'whyRemoved',
      titleJa: '回転数を上げてください',
      bodyJa:
        `${material.educationTagJa}。低い回転数のまま硬い骨に押し当てると効率が悪く、` +
        'Cuttingバーの場合は引っかかり（grab）のリスクも高まる。回転数を上げること。',
    };
  }

  // 優先度8: 硬さの壁（otic capsule等）に当たっている。優先度7で低RPMが原因の場合は
  // そちらが先に該当するため、ここに到達するのは既に高RPMでも削れない真の壁の場合。
  if (material.hardness >= HARD_WALL_HARDNESS_THRESHOLD) {
    return {
      kind: 'whyRemoved',
      titleJa: 'なぜ削れない？',
      bodyJa: `${material.educationTagJa}。${burr.labelJa}でもほぼ削れない＝硬さの壁。無理に押し込まず境界を確認すること。`,
    };
  }

  // 優先度9: 順調に除去できている
  if (growthRateMmPerSec > ACTIVE_REMOVAL_THRESHOLD_MM_S) {
    return {
      kind: 'whyRemoved',
      titleJa: 'なぜ削れる？',
      bodyJa: `${material.educationTagJa} ＋ ${burr.labelJa} → 高速除去。`,
    };
  }

  return null;
}
