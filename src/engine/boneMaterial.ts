/**
 * boneMaterial.ts ─ 削開モード MVES 骨材料システム（T2）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.2
 * 部位判定は解析的リージョン（3Dセグメンテーション不要）。既存ランドマーク定数
 * （LANDMARKS.TL_Y, GUIDE.SURFACE_Z, DANGER_ZONES）をリージョン中心として再利用する。
 *
 * 【保留事項】LABYRINTH_CENTER / OTIC_R / SINUS_PLATE_R / CORTEX_THICKNESS は
 * Bone.glb 実測値ではなく解剖学的概算による暫定値。目視較正は本タスク完了後に実施する
 * （設計書「確定事項1」: 暫定値で着手、較正はT2完了後）。
 */

import * as THREE from 'three';
import type {
  BoneMaterial,
  BoneQualityProfile,
  BoneRegionId,
  RemainingThicknessResult,
} from './types';
import { DANGER_ZONES } from '../data/dangerZones';

// ══════════════════════════════════════════════════════════════════════
// リージョン境界座標（暫定値）
// ══════════════════════════════════════════════════════════════════════

/**
 * 骨迷路（otic capsule）の概算中心。
 * 座標系: アブミ骨底板=原点。卵円窓（底板が嵌る部位）は骨迷路の外側壁の一部であるため、
 * 中心は原点から後内側（前庭・蝸牛・半規管群の重心方向）に位置する。
 * 【暫定】Bone.glb 実測未実施。既存 facial-tympanic 危険ゾーン position [0, 2.8, -1.5]
 * （卵円窓上方を走る顔面神経水平部）との整合を考慮した近似値。
 */
export const LABYRINTH_CENTER = new THREE.Vector3(-1.5, 1.0, -2.5);
/** 骨迷路の判定半径 mm（設計書 §4.2: ≈6mm） */
export const OTIC_R = 6.0;

/**
 * 鼓室蓋（tegmen）レベル。既存 LANDMARKS.TL_Y（側頭線、Bone.glb 実測値 2026-06-24
 * InteractiveDrillScene.tsx）を流用。外科的に側頭線は中頭蓋窩硬膜（tegmen）の高さの
 * 目安として用いられる標準的近似のため、既存の実測済み定数をそのまま転用する。
 */
export const TEGMEN_Y = 9.0;
/**
 * 硬膜直下とみなす厚み mm。判定式は p.y > TEGMEN_Y かつ (p.y - TEGMEN_Y) < マージン、
 * すなわち「側頭線レベルから上方1.5mm以内の薄い骨殻」を tegmen リージョンとする。
 */
export const TEGMEN_DURA_MARGIN = 1.5;

/**
 * S状静脈洞板の判定半径 mm。【暫定】DANGER_ZONES['sigmoid-sinus'] の
 * dangerRadius(3mm) と warningRadius(6mm) の中間値。
 */
export const SINUS_PLATE_R = 5.0;

/** 外側皮質面 Z 座標。既存 GUIDE.SURFACE_Z（Bone.glb 実測値）を流用。 */
export const SURFACE_Z = 26.0;
/** 皮質骨シェルの厚み mm。【暫定】文献の皮質骨厚概算（2〜4mm）の中間値。 */
export const CORTEX_THICKNESS = 3.0;

const sigmoidSinusZone = DANGER_ZONES.find((z) => z.id === 'sigmoid-sinus');
if (!sigmoidSinusZone) {
  throw new Error('boneMaterial.ts: DANGER_ZONES に sigmoid-sinus が見つかりません');
}
const SINUS_CENTER = new THREE.Vector3(...sigmoidSinusZone.position);

// ══════════════════════════════════════════════════════════════════════
// 材料表（暫定値, 設計書 §4.2）
// ══════════════════════════════════════════════════════════════════════
//
// resistance（手応え）と damageThreshold（Month2用）は設計書の材料表に個別値の
// 記載がないため、暫定的に hardness と同値を採用する（触覚差の実データが無い段階での
// 仮置き。Month2で耳科医較正のうえ分離する）。
//
// color（2026-07-12 修正）: shojiさんから「削開練習の骨モデルが解剖モードの骨モデルより
// 黄色みが強い」との指摘。文献確認の結果、乳突洞・皮質骨は基本的にアイボリー白（"ivory"）
// であり（Ento Key/StatPearls「Mastoidectomy」: 半規管・骨迷路周囲を dense ivory bone と
// 記述）、硬膜近接=ピンク／静脈洞近接=青という配色は側頭骨手術トレーニング教材でも標準的な
// 色分け規約であること（Cambridge Core, temporal bone prototype評価論文: dura=pink,
// sinus=blue, bone=whiteの塗装規約）を確認。旧色（airCells #d8c8a8 / cortex #c8b090）は
// 黄土色〜茶色に寄りすぎていたため、解剖モード（RealAnatomyModels.tsx の bone
// matKey= '#f2ead8'）と同系統のアイボリー白へ統一（cortexは解剖モードと同一色に合わせた）。
// tegmen/sinusPlateのピンク/青の方向性自体は文献根拠ありのため維持し、彩度のみ調整。

export const BONE_MATERIALS: Record<BoneRegionId, BoneMaterial> = {
  airCells: {
    id: 'airCells',
    density: 0.25,
    // 2026-07-13: shojiさんの指示で相対的に柔らかく調整（0.20→0.10）。理由: トレーニングの
    // 大半を占める乳突蜂巣の削開に時間がかかりすぎると利用者が離脱してしまう、という
    // 事業判断（growthRateMmPerSecはhardnessに反比例するため、この変更だけで乳突蜂巣の
    // 削開速度は約2倍になる）。cortex(0.50)/tegmen・sinusPlate(0.30)/oticCapsule(1.00)は
    // 解剖学的な相対的硬さの順序を保つため変更していない（airCellsが最も軟らかいという
    // 順序自体は元々正しく、その差をさらに広げる方向の調整）。
    hardness: 0.10,
    resistance: 0.10,
    basePitchHz: 260,
    particleAmount: 1.0,
    color: '#f1e8d4',
    damageThreshold: 0.10,
    educationTagJa: '低密度・サクサク',
  },
  cortex: {
    id: 'cortex',
    density: 0.55,
    hardness: 0.50,
    resistance: 0.50,
    basePitchHz: 480,
    particleAmount: 0.6,
    color: '#f2ead8',
    damageThreshold: 0.50,
    educationTagJa: '中密度・皮質',
  },
  oticCapsule: {
    id: 'oticCapsule',
    density: 1.00,
    hardness: 1.00,
    resistance: 1.00,
    basePitchHz: 900,
    particleAmount: 0.15,
    color: '#f6f1e6',
    damageThreshold: 1.00,
    educationTagJa: '象牙骨・硬い壁',
  },
  tegmen: {
    id: 'tegmen',
    density: 0.30,
    hardness: 0.30,
    resistance: 0.30,
    basePitchHz: 1000,
    particleAmount: 0.2,
    color: '#f0ddd2',
    damageThreshold: 0.30,
    educationTagJa: '硬膜直上・薄い',
  },
  sinusPlate: {
    id: 'sinusPlate',
    density: 0.30,
    hardness: 0.30,
    resistance: 0.30,
    basePitchHz: 1050,
    particleAmount: 0.2,
    color: '#d2d9ea',
    damageThreshold: 0.30,
    educationTagJa: '洞直上・青み',
  },
};

// ══════════════════════════════════════════════════════════════════════
// リージョン判定（解析的、純関数）
// ══════════════════════════════════════════════════════════════════════

/**
 * regionAt(): ワールド座標 p が属する骨材料リージョンIDを判定する純関数。
 * 判定順（先勝ち, 設計書 §4.2）:
 *   1. oticCapsule ─ 骨迷路中心からの距離 < OTIC_R
 *   2. tegmen      ─ 側頭線レベルから上方 TEGMEN_DURA_MARGIN 以内
 *   3. sinusPlate  ─ S状静脈洞中心からの距離 < SINUS_PLATE_R
 *   4. cortex      ─ 外側皮質シェル（SURFACE_Z - CORTEX_THICKNESS より外側）
 *   5. airCells    ─ 既定（乳突蜂巣）
 */
export function regionAt(p: THREE.Vector3): BoneRegionId {
  if (p.distanceTo(LABYRINTH_CENTER) < OTIC_R) return 'oticCapsule';

  const aboveTegmenLine = p.y - TEGMEN_Y;
  if (aboveTegmenLine >= 0 && aboveTegmenLine < TEGMEN_DURA_MARGIN) return 'tegmen';

  if (p.distanceTo(SINUS_CENTER) < SINUS_PLATE_R) return 'sinusPlate';

  if (p.z > SURFACE_Z - CORTEX_THICKNESS) return 'cortex';

  return 'airCells';
}

/** materialAt(): 座標→材料パラメータの直接取得（regionAt() のショートカット） */
export function materialAt(p: THREE.Vector3): BoneMaterial {
  return BONE_MATERIALS[regionAt(p)];
}

// ══════════════════════════════════════════════════════════════════════
// 残存骨厚（危険接近の中核指標）
// ══════════════════════════════════════════════════════════════════════

/**
 * remainingThicknessToDanger(): 全 DANGER_ZONES について p から zone.position までの
 * 距離 − zone.dangerRadius を計算し、最小値（＝最も近い危険構造）を返す純関数。
 * 音程・危険判定・色透見の共通入力（設計書 §4.2, §4.5, §4.6）。
 * 負値は危険核（dangerRadius）への侵入を意味する。
 */
export function remainingThicknessToDanger(p: THREE.Vector3): RemainingThicknessResult | null {
  if (DANGER_ZONES.length === 0) return null;
  let best: RemainingThicknessResult | null = null;
  for (const zone of DANGER_ZONES) {
    const zPos = new THREE.Vector3(...zone.position);
    const dist = p.distanceTo(zPos) - zone.dangerRadius;
    if (!best || dist < best.dist) {
      best = { dist, zone };
    }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════════
// Bone Quality Profile（v2.1追補・確定事項1）
// ══════════════════════════════════════════════════════════════════════
//
// BONE_MATERIALS（上記, 構造分類=部位ごとの基準値）とは独立に、シナリオ単位の
// グローバル個体差係数として BoneQualityProfile を適用する。骨迷路（oticCapsule）は
// 胎生期軟骨内骨化由来の緻密骨であり生涯を通じてほぼ再構築されないため、含気化
// （pneumatizationFactor）の影響を受けない（乳突蜂巣・皮質骨とは異なる）。
// 【暫定】係数の絶対値は臨床論文からの直接較正ではなく、含気型/硬化型乳突の一般的な
// 手応え差を表現するための仮置き。他の暫定値（LABYRINTH_CENTER等）と同様、耳科医較正が必要。

export const BONE_QUALITY_PROFILES: Record<string, BoneQualityProfile> = {
  standard: {
    id: 'standard',
    nameJa: '標準',
    densityFactor: 1.0,
    pneumatizationFactor: 1.0,
    calcificationFactor: 1.0,
  },
  wellPneumatized: {
    id: 'wellPneumatized',
    nameJa: '含気型（若年・健常）',
    densityFactor: 0.9,
    pneumatizationFactor: 1.3,
    calcificationFactor: 0.9,
  },
  sclerotic: {
    id: 'sclerotic',
    nameJa: '硬化型（高齢・慢性中耳炎既往）',
    densityFactor: 1.2,
    pneumatizationFactor: 0.6,
    calcificationFactor: 1.3,
  },
};

/**
 * effectiveMaterial(): BONE_MATERIALS の基準値に BoneQualityProfile を合成し、
 * シナリオ固有の実効材料パラメータを返す純関数。
 * - density: densityFactor のみ反映
 * - hardness/resistance: densityFactor × calcificationFactor を反映し、
 *   さらに oticCapsule 以外（airCells/cortex/tegmen/sinusPlate）は
 *   pneumatizationFactor の逆数を追加反映（含気化が進むほど手応えが柔らかくなる）
 */
export function effectiveMaterial(base: BoneMaterial, quality: BoneQualityProfile): BoneMaterial {
  const pneumatizationAffects = base.id !== 'oticCapsule';
  const hardnessFactor =
    quality.densityFactor *
    quality.calcificationFactor *
    (pneumatizationAffects ? 1 / quality.pneumatizationFactor : 1);
  const clamp = (v: number) => Math.min(1.3, Math.max(0.1, v));
  return {
    ...base,
    density: clamp(base.density * quality.densityFactor),
    hardness: clamp(base.hardness * hardnessFactor),
    resistance: clamp(base.resistance * hardnessFactor),
  };
}
