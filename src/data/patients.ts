/**
 * patients.ts  ── 患者バリエーションデータ
 *
 * ▼ 耳介モデルソース
 *   Viking HRTF Dataset v2 (CC-BY 4.0)
 *   Spagnol et al. (2020) DOI:10.5281/zenodo.4160401
 *   Creaform Go!SCAN 20 / 1mm 解像度
 *
 * ▼ 被験者選定基準（20体中5体）
 *   形状多様性（高さ・奥行き）をカバーする代表例
 *   全被験者: アイスランド人 (Saga Museum Reykjavík)
 *
 * ▼ EAC入口座標（eacInStl）
 *   STL座標系（重心中心化後）でのEAC入口中心
 *   Step1解析による実測値
 */

export type PinnaSizeCategory = 'small' | 'medium' | 'large' | 'xlarge';

export interface PatientProfile {
  /** 被験者ID（ファイル名: pinna_subj_<id>.stl） */
  id: string;
  /** 表示名 */
  name: string;
  /** サイズカテゴリ */
  size: PinnaSizeCategory;
  /** 耳介サイズ [W, H, D] mm */
  pinnaDimensions: { w: number; h: number; d: number };
  /** EAC入口座標（STL重心中心化後） */
  eacInStl: { x: number; y: number; z: number };
  /** 耳介の特徴説明 */
  pinnaNotes: string;
  /** 中耳所見（教育用ケース） */
  middleEarFindings: string;
  /** 推奨プロステーシスタイプ */
  recommendedProsthesis: 'PORP' | 'TORP';
  /** 推奨シャフト長 (mm) */
  recommendedShaftLength: number;
  /** 難易度 1-5 */
  difficulty: number;
}

export const PATIENTS: PatientProfile[] = [
  {
    id: 'J',
    name: '症例1: 小型耳介（60mm型）',
    size: 'small',
    pinnaDimensions: { w: 48.2, h: 60.6, d: 28.8 },
    eacInStl: { x: 0.78, y: -0.85, z: -10.99 },
    pinnaNotes: '耳介高さ最小クラス。耳甲介が浅く外耳道視野が比較的良好。',
    middleEarFindings: 'キヌタ骨長脚欠損（慢性中耳炎術後）。アブミ骨上部構造は温存。',
    recommendedProsthesis: 'PORP',
    recommendedShaftLength: 2.5,
    difficulty: 2,
  },
  {
    id: 'T',
    name: '症例2: 標準耳介（KEMAR）',
    size: 'medium',
    pinnaDimensions: { w: 57.2, h: 67.3, d: 24.8 },
    eacInStl: { x: -0.31, y: -0.89, z: -12.10 },
    pinnaNotes: 'KEMAR標準人工耳介。医療・音響研究のリファレンスモデル。',
    middleEarFindings: 'キヌタ骨体部・長脚完全欠損。アブミ骨頭部残存。PORP適応標準症例。',
    recommendedProsthesis: 'PORP',
    recommendedShaftLength: 2.5,
    difficulty: 2,
  },
  {
    id: 'A',
    name: '症例3: 中型深耳介（35mm深）',
    size: 'medium',
    pinnaDimensions: { w: 52.6, h: 67.1, d: 35.0 },
    eacInStl: { x: -0.03, y: -0.21, z: -16.62 },
    pinnaNotes: '耳甲介が深く外耳道入口が奥まった形状。視野確保に慎重な操作を要する。',
    middleEarFindings: 'キヌタ骨・アブミ骨上部構造欠損。底板のみ残存。TORP適応。',
    recommendedProsthesis: 'TORP',
    recommendedShaftLength: 4.0,
    difficulty: 3,
  },
  {
    id: 'H',
    name: '症例4: 大型耳介（76mm型）',
    size: 'large',
    pinnaDimensions: { w: 53.3, h: 75.7, d: 29.4 },
    eacInStl: { x: 0.30, y: -0.88, z: -11.97 },
    pinnaNotes: '耳介高さ最大クラス。耳輪が大きく発達。外耳道走行が急峻になりやすい。',
    middleEarFindings: '慢性中耳炎。キヌタ骨長脚壊死・アブミ骨頭残存。計測値がやや大きい（2.8mm）。',
    recommendedProsthesis: 'PORP',
    recommendedShaftLength: 3.0,
    difficulty: 3,
  },
  {
    id: 'E',
    name: '症例5: 超大型深耳介（74mm/37mm）',
    size: 'xlarge',
    pinnaDimensions: { w: 49.4, h: 74.2, d: 37.1 },
    eacInStl: { x: -0.09, y: -0.85, z: -16.85 },
    pinnaNotes: '高さ・奥行きとも大型。耳甲介腔が深いため外耳道鏡の挿入角度に注意。最上位難易度。',
    middleEarFindings: '真珠腫術後再建。全耳小骨欠損。底板可動性良好。TORP適応最難症例。',
    recommendedProsthesis: 'TORP',
    recommendedShaftLength: 4.5,
    difficulty: 5,
  },
];

/** IDで患者を検索 */
export function getPatientById(id: string): PatientProfile | undefined {
  return PATIENTS.find(p => p.id === id);
}

/** STLファイルパス（public/models/ 相対） */
export function getPinnaUrl(patientId: string): string {
  return `/models/pinna_subj_${patientId}.stl`;
}

/** 難易度ラベル */
export function getDifficultyLabel(d: number): string {
  return ['', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'][d] ?? '?';
}

/** サイズカテゴリラベル（日本語） */
export const SIZE_LABEL: Record<PinnaSizeCategory, string> = {
  small:  '小型',
  medium: '中型',
  large:  '大型',
  xlarge: '超大型',
};
