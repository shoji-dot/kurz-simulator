/**
 * types.ts ─ 削開モード MVES 共有型定義（T1）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md Phase 4（4.2〜4.8）
 * このファイルは型のみ。値・純関数は T2以降（boneMaterial.ts 等）で実装する。
 * 既存 InteractiveDrillScene.tsx の座標系・DangerZone・localStorage・UIを差分再利用する前提。
 */

import type * as THREE from 'three';
import type { DangerZone } from '../data/dangerZones';

// ══════════════════════════════════════════════════════════════════════
// 4.2 Bone Material System（boneMaterial.ts で実装）
// ══════════════════════════════════════════════════════════════════════

/** 骨材料リージョンID。判定順（先勝ち）は boneMaterial.ts の regionAt() 参照。 */
export type BoneRegionId =
  | 'cortex'       // 皮質骨（外側シェル）
  | 'airCells'     // 乳突蜂巣（既定リージョン）
  | 'oticCapsule'  // 骨迷路（象牙骨・硬い壁）
  | 'tegmen'       // 鼓室蓋（硬膜直上）
  | 'sinusPlate';  // S状静脈洞板

/** 部位ごとの材料パラメータ（材料表は boneMaterial.ts に実装、4.2 参照） */
export interface BoneMaterial {
  id: BoneRegionId;
  /** 0–1 骨密度（表示・音の基準） */
  density: number;
  /** 0–1 除去率の分母（大きいほど削れにくい。oticCapsule=1.0 で成長率≈0） */
  hardness: number;
  /** 0–1 手応え（UI・振動表現） */
  resistance: number;
  /** 音の基準音程 Hz（audioEngine.ts の pitch 計算の起点） */
  basePitchHz: number;
  /** 骨粉量係数 0–1（Month2 Particle 用、MVESでは軽量表現に使用可） */
  particleAmount: number;
  /** 表示色 */
  color: THREE.ColorRepresentation;
  /** Damage System 用しきい値（Month2で本格使用、MVESは未使用可） */
  damageThreshold: number;
  /** 教育カード用の短い日本語タグ（例: 「低密度・サクサク」） */
  educationTagJa: string;
}

/** 残存骨厚チェックの結果。remainingThicknessToDanger() の戻り値型。 */
export interface RemainingThicknessResult {
  /** 危険構造表面までの距離 mm（zone.dangerRadius を差し引き済み、負値=侵入） */
  dist: number;
  /** 最も近い危険構造 */
  zone: DangerZone;
}

// ══════════════════════════════════════════════════════════════════════
// 4.3 Drill System（drillModel.ts で実装）
// ══════════════════════════════════════════════════════════════════════

export type BurrType = 'cutting' | 'diamond';

/** バー定義（既存 cutterSizeMm をここへ発展させる） */
export interface Burr {
  /** 一意ID（例: 'cutting-3', 'diamond-2'） */
  id: string;
  type: BurrType;
  diameterMm: 1 | 2 | 3 | 4;
  /** 切削効率係数（cutting:1.0 / diamond:0.45 が基準値） */
  efficiency: number;
  /** 発熱係数（Month2用。cutting:0.6 / diamond:圧力比例0.9 が基準値） */
  heatCoef: number;
  /** 側面切削係数（赤道ヒット時。既定1.3、先端ヒットで1.0） */
  sideCutBoost: number;
  /** 推奨回転数レンジ rpm（表示用） */
  recommendedRpm: [number, number];
  /** UI表示名（日本語） */
  labelJa: string;
}

/** RPMプリセット（触覚デバイス非対応のためUI代替、4.4参照） */
export type RpmPreset = 'low' | 'mid' | 'high';

// ══════════════════════════════════════════════════════════════════════
// 4.4 Removal Model（removalModel.ts で実装）── 固定値禁止
// ══════════════════════════════════════════════════════════════════════

/** 削開入力状態（デバイス非依存。荷重/RPM=UI、接触角=幾何算出） */
export interface DrillInputState {
  burr: Burr;
  /** 荷重 0.2–1.0、既定0.6（UIスライダー） */
  pressure: number;
  rpmPreset: RpmPreset;
  /** レイキャスト面法線とドリル軸のなす角（度）。側面≈90°、先端≈0° */
  contactAngleDeg: number;
  material: BoneMaterial;
}

/** ドリルホールの成長状態（既存シェーダー drillHoleRadii uniform と対応） */
export interface DrillHoleState {
  position: THREE.Vector3;
  /** 現在半径 mm（毎フレーム growthRate·dt で成長） */
  currentR: number;
  /** 目標半径 mm（= burr.diameterMm / 2） */
  targetR: number;
  regionId: BoneRegionId;
}

/** growthRate() の入力（4.4 の式に対応） */
export interface GrowthRateInput {
  burr: Burr;
  contactAngleDeg: number;
  /** 荷重 0–1 */
  pressure: number;
  rpmPreset: RpmPreset;
  material: BoneMaterial;
}

// ══════════════════════════════════════════════════════════════════════
// 4.5 Audio（audioEngine.ts で実装）
// ══════════════════════════════════════════════════════════════════════

/** 削開音の合成状態 */
export interface AudioState {
  /** 現在の合成音程 Hz（basePitchHz → 1200Hz へ thinFactor で線形補間） */
  pitchHz: number;
  /** 0–1 音量（growthRate に比例） */
  gain: number;
  /** 0–1 ノイズ/トーン混合比（density 由来。0=ノイズ主体=低密度、1=トーン主体=高密度） */
  toneMix: number;
}

// ══════════════════════════════════════════════════════════════════════
// 4.6 Danger Detection 拡張（dangerModel.ts で実装）
// ══════════════════════════════════════════════════════════════════════

export type DangerLevel = 'safe' | 'warn' | 'critical';

/** 多感覚危険判定の統合結果（テキスト・音程・色透見の共通入力） */
export interface DangerState {
  level: DangerLevel;
  zone: DangerZone | null;
  /** 危険構造表面までの距離 mm（null=近傍に構造なし） */
  distMm: number | null;
  /** 接近度 0–1（1=最も近い/危険。色ブレンド・音程係数に使用） */
  proximity: number;
}

// ══════════════════════════════════════════════════════════════════════
// 4.7 Damage System（MVESは記録のみ）
// ══════════════════════════════════════════════════════════════════════

export type DamageEventType = 'contact' | 'overheat' | 'oticOvercut';

export interface DamageEvent {
  /** 発生時刻（削開開始からの経過ms） */
  t: number;
  type: DamageEventType;
  zoneId?: string;
  severity: 'warn' | 'critical';
}

// ══════════════════════════════════════════════════════════════════════
// 4.8 Scoring（scoring.ts で実装）
// ══════════════════════════════════════════════════════════════════════

export interface ScoreBreakdown {
  /** 安全 60点満点 */
  safety: number;
  /** 効率 25点満点 */
  efficiency: number;
  /** 骨質適応 15点満点 */
  materialAdaptation: number;
  /** 合計 100点満点 */
  total: number;
}

/** localStorage['kurz_drill_score_history']（既存 kurz_score_history とは別キー、最大10件） */
export interface ScoreHistoryEntry {
  /** ISO 8601 */
  date: string;
  breakdown: ScoreBreakdown;
  damageEvents: DamageEvent[];
  reachedAntrum: boolean;
}

// ══════════════════════════════════════════════════════════════════════
// Phase 3 教育カード（EducationCards コンポーネントで使用、T8）
// ══════════════════════════════════════════════════════════════════════

export type EducationCardKind = 'whyRemoved' | 'whyDanger' | 'whyBurrChange';

export interface EducationCardContent {
  kind: EducationCardKind;
  titleJa: string;
  bodyJa: string;
}
