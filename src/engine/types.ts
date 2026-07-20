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
/**
 * ToolPose ─ 削開ツールの姿勢（v2.0設計 §④ Tool Pose型）。
 * 【スコープ】今回はvelocityMmPerSec（Feed Rate/dwell検知の基礎）のみ実装。
 * axis（ドリル軸方向）は既存のcontactAngle計算（面法線×カメラ方向）で代替済みのため
 * 型としては保持するが今回は未使用（将来のスイープ形状・除去モデルへの本格反映で使用予定）。
 */
export interface ToolPose {
  position: THREE.Vector3;
  /** 直近フレームからの移動速度 mm/s。0=静止（dwelling）、大きいほど素早く掃引(sweep)している。 */
  velocityMmPerSec: number;
}

export interface GrowthRateInput {
  burr: Burr;
  contactAngleDeg: number;
  /** 荷重 0–1 */
  pressure: number;
  rpmPreset: RpmPreset;
  material: BoneMaterial;
  /** バーのフルート目詰まり度 0–1（Sprint3追補・clogFactor。0=清浄、1=最大目詰まり） */
  clogLevel: number;
}

/**
 * Sprint6（Heat）: 発熱蓄積の入力。文献（Thermal Osteonecrosis Caused by Bone Drilling in
 * Orthopedic Surgery, PMC6759003 等: 47℃60秒/50℃30秒で熱壊死）と、側頭骨手術での無注水・
 * 高速ダイヤモンドバー連続照射による顔面神経管内温度上昇報告（PubMed 11558764、
 * drillModel.tsに引用済み）に基づき、荷重・RPM・バー種(heatCoef)・留まり(dwell)・
 * 危険構造近接から発熱を算出する（removalModel.ts growHeatLevel参照）。
 */
export interface HeatGrowthInput {
  burr: Burr;
  /** 荷重 0–1 */
  pressure: number;
  rpmPreset: RpmPreset;
  /** 同じ場所に留まり続けている状態か（Sprint3 dwell検知の再利用。連続照射は間欠照射より有意に高温という文献知見に対応） */
  isDwelling: boolean;
  /** 危険構造への接近度 0–1（0=遠い、1=最近接。近いほど発熱の影響がより深刻＝接触なしでも熱損傷しうるため蓄積を加速） */
  dangerProximity: number;
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
  /**
   * 最も近い危険構造。【2026-07-12・Sprint4】AnatomyLayer（顔面神経ポリライン統合版）
   * ベースへ切替済み（旧DangerZoneの点ベース判定を一般化）。AnatomyLayerはDangerZoneが
   * 持つnameJa/clinicalNoteJa/complicationJa/id等を全て含む上位互換の型のため、
   * 既存の消費側（educationCards.ts/scoring.ts等）はフィールドアクセスの変更が不要。
   */
  zone: AnatomyLayer | null;
  /** 危険構造表面までの距離 mm（null=近傍に構造なし） */
  distMm: number | null;
  /** 接近度 0–1（1=最も近い/危険。色ブレンド・音程係数に使用） */
  proximity: number;
}

// ══════════════════════════════════════════════════════════════════════
// 4.7 Damage System（MVESは記録のみ）
// ══════════════════════════════════════════════════════════════════════

export type DamageEventType = 'contact' | 'overheat' | 'oticOvercut';

/**
 * Sprint5（Post Session Review）: ダメージイベント発生時点の削開条件スナップショット。
 * レビュー時に「なぜこの接触が起きたか」を説明するための補助情報（記録のみ、判定ロジックには使わない）。
 */
export interface ToolPoseSnapshot {
  burrId: string;
  rpmPreset: RpmPreset;
  /** 実効荷重 0.2-1.0（Shift/Ctrlクイック切替後の値） */
  pressure: number;
  contactAngleDeg: number;
  velocityMmPerSec: number;
  regionId: BoneRegionId;
}

export interface DamageEvent {
  /** 発生時刻（削開開始からの経過ms） */
  t: number;
  type: DamageEventType;
  zoneId?: string;
  /** 危険構造の日本語名（AnatomyLayer.nameJa）。oticOvercutは固定文言。Sprint5で追加、旧データにはない場合がありoptional。 */
  zoneNameJa?: string;
  severity: 'warn' | 'critical';
  /** Sprint5: 発生位置（ワールド座標mm、3Dピン留めレビュー用）。旧セッション履歴データにはない場合がありoptional。 */
  position?: { x: number; y: number; z: number };
  /** Sprint5: 発生時点の削開条件スナップショット。旧セッション履歴データにはない場合がありoptional。 */
  toolPoseSnapshot?: ToolPoseSnapshot;
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

// ══════════════════════════════════════════════════════════════════════
// Voxelアーキテクチャ v2.0（voxelVolume.ts / volumeSource.ts で実装）
// 設計書: KURZ_削開アルゴリズム再設計_v1.0.md, KURZ_Voxelアーキテクチャ設計_v2.0.md
// ══════════════════════════════════════════════════════════════════════

/** ボクセルグリッドの解像度階層。Base=全体粗解像度／Fine=危険構造周囲の限定高解像度。 */
export type ResolutionTier = 'base' | 'fine';

/**
 * VolumeSource: ワールド座標→ボクセル初期値のサンプリング元を抽象化するインターフェース。
 * 現状は Bone.glb（解析的 regionAt 分類 + メッシュ内外判定）を実装とするが、
 * 将来の患者別CTボリュームも同じインターフェースで供給できるようにする（設計書§8）。
 */
export interface VolumeSample {
  /** 0–1 初期密度（1=骨実質、0=骨の外＝空気） */
  density: number;
  materialId: BoneRegionId;
}

export interface VolumeSource {
  sampleAt(p: THREE.Vector3): VolumeSample;
}

/** 1ボクセルチャンクの座標（tierごとに独立したチャンク格子を持つ） */
export interface VoxelChunkCoord {
  cx: number;
  cy: number;
  cz: number;
  tier: ResolutionTier;
}

/** ブラシ（バー）適用1回分の入力。円形/球形の密度減算に使う純粋な幾何パラメータ。 */
export interface VoxelBrushInput {
  center: THREE.Vector3;
  radiusMm: number;
  /** 1フレーム分の除去量（mm相当、removalModel.growthRateMmPerSec × dt から算出） */
  amount: number;
}

export type EducationCardKind = 'whyRemoved' | 'whyDanger' | 'whyBurrChange';

export interface EducationCardContent {
  kind: EducationCardKind;
  titleJa: string;
  bodyJa: string;
}

// ══════════════════════════════════════════════════════════════════════
// v2.1追補 確定事項1: Bone Quality Profile（boneMaterial.ts で実装）
// ══════════════════════════════════════════════════════════════════════

/**
 * 個体差プロファイル。BONE_MATERIALS（構造分類・部位ごとの基準値、変更なし）とは
 * 独立したシナリオ単位のグローバル係数。effectiveMaterial() で合成する。
 */
export interface BoneQualityProfile {
  id: string;
  nameJa: string;
  /** 全体密度係数（1.0=標準） */
  densityFactor: number;
  /** 含気化係数（1.0=標準、高いほど蜂巣発達=柔らかい）。骨迷路(oticCapsule)には非適用 */
  pneumatizationFactor: number;
  /** 石灰化係数（1.0=標準、高齢・慢性中耳炎既往で上昇し硬さのみ増加） */
  calcificationFactor: number;
}

// ══════════════════════════════════════════════════════════════════════
// v2.1追補 確定事項2: Education Mode / Real Mode
// ══════════════════════════════════════════════════════════════════════

/**
 * 計算は常時同一、表示のみモードで切替（危険UI/教育カード/Expert Coach/バー推奨が対象）。
 * 【2026-07-12・Sprint4での実装判断】実際のUIには本型を直接使わず、既存の`expertMode`
 * boolean（InteractiveDrillScene.tsx。元は「専門医モード」としてAntrum強調球/削開方向
 * ガイドの表示切替のみを担っていた）を拡張し、Real Mode相当の挙動（危険バナー・色透見・
 * 教育カード・Expert Coach非表示）も持たせる形にした。トグルを2つ並べるUXの悪化を避ける
 * ための判断（shojiさん承認済み、2026-07-12）。本型はドキュメント目的で残置する。
 */
export type SimMode = 'education' | 'real';

// ══════════════════════════════════════════════════════════════════════
// AnatomyLayer 基盤（anatomyLayer.ts で実装、V9）
// ══════════════════════════════════════════════════════════════════════

/** 危険構造の空間表現。単一点（球）または折れ線（連続した神経走行など）。 */
export type AnatomyLayerGeometry =
  | { kind: 'point'; position: THREE.Vector3 }
  | { kind: 'polyline'; points: THREE.Vector3[] };

/**
 * AnatomyLayer: 危険構造の汎化表現（v2.1追補・V9）。既存DangerZone（点のみ）を、
 * 折れ線（連続した神経走行など）も同じインターフェースで扱えるよう一般化したもの。
 * anatomyLayer.ts の ANATOMY_LAYERS で、DANGER_ZONES から合成される（顔面神経3点は
 * 1本のpolylineへ統合、それ以外はDangerZone 1点＝AnatomyLayer 1点として変換）。
 */
export interface AnatomyLayer {
  id: string;
  nameJa: string;
  geometry: AnatomyLayerGeometry;
  warningRadius: number;
  dangerRadius: number;
  category: DangerZone['category'];
  color: string;
  glowColor: string;
  shortDescJa: string;
  clinicalNoteJa: string;
  complicationJa: string;
  /** このレイヤーの元になったDANGER_ZONESのid一覧（point=自身のみ、polyline=構成する全点） */
  sourceZoneIds: string[];
}

/** remainingThicknessToLayer() の返り値。remainingThicknessToDanger()（boneMaterial.ts）のAnatomyLayer版。 */
export interface LayerThicknessResult {
  dist: number;
  layer: AnatomyLayer;
}
