import { create } from 'zustand';
import type { KurzProduct } from '../data/products';
import type { SurgicalCase } from '../data/cases';

export type Screen = 'home' | 'learning' | 'simulation' | 'stepflow';
export type SimStep = 'case-select' | 'judgment' | 'product-select' | 'shaft-estimate' | 'placement' | 'score';
export type LearningTab = 'anatomy' | 'products' | 'procedure' | 'drilling';
export type PatientId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T';
export const ALL_PATIENT_IDS: PatientId[] = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

export interface PlacementState {
  selectedLength: number;
  lateralOffset: number;   // slider: -3 to +3 mm (内外側)
  anteriorOffset: number;  // slider: -3 to +3 mm (前後)
  verticalOffset: number;  // slider: -3 to +3 mm (上下 Y軸)
  angleTilt: number;       // degrees, -180 to +180 (前後傾斜)
  angleTiltZ: number;      // degrees, -180 to +180 (左右傾斜)
  dragOffsetX: number;     // 3D TransformControls drag accumulated X (mm)
  dragOffsetY: number;     // 3D TransformControls drag accumulated Y (mm)
  dragOffsetZ: number;     // 3D TransformControls drag accumulated Z (mm)
}

export interface ABGPrediction {
  /** 予測ABG改善量 (dB) — 術後ABGの改善見込み */
  improvementDb: number;
  /** 予測術後ABG (dB) — 術前ABG 30dB想定 */
  postOpAbg: number;
  /** Glasgow Benefit Plot 分類 */
  successCategory: 'excellent' | 'good' | 'fair' | 'poor';
  /** 臨床的解釈 */
  clinicalInterpretation: string;
}

export interface JudgmentResult {
  typeAnswer: string;
  typeCorrect: boolean;
  productAnswer: string;
  productCorrect: boolean;
}

export interface ScoreResult {
  sizeScore: number;
  positionScore: number;
  angleScore: number;
  stabilityScore: number;
  total: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  feedback: string[];
  /** 術後ABG改善予測 */
  abgPrediction: ABGPrediction;
}

interface SimStore {
  screen: Screen;
  learningTab: LearningTab;
  simStep: SimStep;
  selectedCase: SurgicalCase | null;
  selectedProduct: KurzProduct | null;
  placement: PlacementState;
  scoreResult: ScoreResult | null;
  judgmentResult: JudgmentResult | null;
  highlightedStructure: string | null;
  drillStep: number;
  /** 選択中の患者ID（耳介バリエーション） */
  selectedPatientId: PatientId;

  setScreen: (s: Screen) => void;
  setLearningTab: (t: LearningTab) => void;
  setSimStep: (s: SimStep) => void;
  setSelectedCase: (c: SurgicalCase) => void;
  setSelectedProduct: (p: KurzProduct) => void;
  updatePlacement: (p: Partial<PlacementState>) => void;
  setJudgmentResult: (r: JudgmentResult) => void;
  computeScore: () => void;
  resetSimulation: () => void;
  setHighlightedStructure: (s: string | null) => void;
  setDrillStep: (n: number) => void;
  setSelectedPatientId: (id: PatientId) => void;
}

function computeRank(total: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (total >= 90) return 'S';
  if (total >= 75) return 'A';
  if (total >= 60) return 'B';
  if (total >= 45) return 'C';
  return 'D';
}

export const useSimStore = create<SimStore>((set, get) => ({
  screen: 'home',
  learningTab: 'anatomy',
  drillStep: 0,
  selectedPatientId: 'T',
  simStep: 'case-select',
  selectedCase: null,
  selectedProduct: null,
  placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
  scoreResult: null,
  judgmentResult: null,
  highlightedStructure: null,

  setScreen: (s) => set({ screen: s }),
  setLearningTab: (t) => set({ learningTab: t }),
  setSimStep: (s) => set({ simStep: s }),
  setSelectedCase: (c) => set({
    selectedCase: c,
    placement: { selectedLength: c.recommendedLength, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
    scoreResult: null,
  }),
  setSelectedProduct: (p) => set({ selectedProduct: p }),
  updatePlacement: (p) => set((s) => ({ placement: { ...s.placement, ...p } })),
  setJudgmentResult: (r) => set({ judgmentResult: r }),
  setHighlightedStructure: (s) => set({ highlightedStructure: s }),
  setDrillStep: (n) => set({ drillStep: n }),

  computeScore: () => {
    const { selectedCase, placement } = get();
    if (!selectedCase) return;

    const { selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ } = placement;
    const { recommendedLength, idealAngle, idealLateralOffset } = selectedCase;

    // 合計オフセット（スライダー + 3Dドラッグ）
    const totalLateral   = lateralOffset   + dragOffsetX;
    const totalAnterior  = anteriorOffset  + dragOffsetZ;
    const totalVertical  = verticalOffset  + dragOffsetY;

    // 症例別理想位置からの偏差で評価（理想が0でない症例を正しく採点）
    const lateralDeviation   = totalLateral  - idealLateralOffset;
    const anteriorDeviation  = totalAnterior; // 前後の理想は全症例0
    const verticalDeviation  = totalVertical; // 上下の理想は全症例0（底板・アブミ骨頭基準）

    // Size score (25pts)
    const lengthDiff = Math.abs(selectedLength - recommendedLength);
    let sizeScore = 0;
    if (lengthDiff <= 0.5) sizeScore = 25;
    else if (lengthDiff <= 1.0) sizeScore = 15;
    else if (lengthDiff <= 1.5) sizeScore = 5;
    else sizeScore = 0;

    // Position score (25pts) — 症例別 idealLateralOffset 基準（3軸）
    const posMag = Math.sqrt(lateralDeviation ** 2 + anteriorDeviation ** 2 + verticalDeviation ** 2);
    let positionScore = Math.round(25 * Math.max(0, 1 - posMag * 1.5));

    // Angle score (25pts) — 前後傾斜 + 左右傾斜の合成
    const angleDiffX = Math.abs(angleTilt  - idealAngle);
    const angleDiffZ = Math.abs(angleTiltZ); // 左右傾斜の理想は全症例0°
    const angleDiff  = Math.sqrt(angleDiffX ** 2 + angleDiffZ ** 2);
    let angleScore = 0;
    if (angleDiff <= 3) angleScore = 25;
    else if (angleDiff <= 7) angleScore = 18;
    else if (angleDiff <= 12) angleScore = 10;
    else angleScore = 3;

    // Stability score (25pts) — derived from position+angle combo
    const instability = posMag * 0.6 + (angleDiff / 15) * 0.4;
    let stabilityScore = Math.round(25 * Math.max(0, 1 - instability));

    const total = sizeScore + positionScore + angleScore + stabilityScore;
    const rank = computeRank(total);

    const feedback: string[] = [];
    if (sizeScore < 25) feedback.push(`シャフト長：${selectedLength}mm → 推奨は${recommendedLength}mm（差${lengthDiff.toFixed(1)}mm）`);
    if (positionScore < 20) feedback.push(`配置位置：理想位置から${posMag.toFixed(2)}mmのずれ（内外側理想: ${idealLateralOffset > 0 ? '+' : ''}${idealLateralOffset.toFixed(1)}mm）。`);
    if (angleScore < 20) feedback.push(`傾斜角：前後${angleTilt}° 左右${angleTiltZ}° → 理想は前後${idealAngle}° 左右0°。`);
    if (stabilityScore < 20) feedback.push('安定性：位置または角度を最適化して安定性を改善。');
    if (total >= 90) feedback.push('✓ 優秀な設置です。臨床でそのまま使用できるレベルです。');
    else if (total >= 75) feedback.push('✓ 良好な設置です。微調整でさらに改善できます。');

    // ── ABG改善予測（文献根拠ベース）────────────────────────────────
    // 参考: Austin (1994), Yung (2003), Merchant (2003) らの鼓室形成術成績
    // PORP/TORP 術後ABG: 理想例で0〜10dB、平均15〜20dB残存
    // 術前ABG想定: 30dB（慢性中耳炎の典型値）
    //
    // モデル:
    //   サイズ精度がABGに最も寄与（1mm誤差 ≒ 5〜10dB悪化）
    //   位置偏心がABGに次いで寄与（0.5mm偏心 ≒ 5dB悪化）
    //   角度は安定性を介して寄与
    const PRE_OP_ABG = 30; // dB (術前ABG想定値)
    const IDEAL_IMPROVEMENT = 25; // dB (理想的設置での改善上限)

    // サイズ誤差による改善阻害（最大15dB減点）
    const sizeImpact   = (sizeScore / 25) * 15;
    // 位置誤差による改善阻害（最大7dB減点）
    const posImpact    = (positionScore / 25) * 7;
    // 角度・安定性による改善（最大3dB）
    const stabImpact   = ((angleScore + stabilityScore) / 50) * 3;

    const improvementDb = Math.round(sizeImpact + posImpact + stabImpact);
    const postOpAbg     = Math.max(0, PRE_OP_ABG - improvementDb);

    let successCategory: ABGPrediction['successCategory'];
    let clinicalInterpretation: string;
    if (postOpAbg <= 10) {
      successCategory = 'excellent';
      clinicalInterpretation = '術後ABG ≤ 10dB。社会的聴力として十分な改善が期待できます。';
    } else if (postOpAbg <= 20) {
      successCategory = 'good';
      clinicalInterpretation = '術後ABG 11〜20dB。日常会話は可能なレベル。補聴器不要の可能性が高い。';
    } else if (postOpAbg <= 30) {
      successCategory = 'fair';
      clinicalInterpretation = '術後ABG 21〜30dB。軽度難聴が残存。サイズ・位置の最適化で改善余地あり。';
    } else {
      successCategory = 'poor';
      clinicalInterpretation = '術後ABG > 30dB。改善不十分。特にシャフト長の再評価が必要。';
    }

    const abgPrediction: ABGPrediction = {
      improvementDb,
      postOpAbg,
      successCategory,
      clinicalInterpretation,
    };

    set({ scoreResult: { sizeScore, positionScore, angleScore, stabilityScore, total, rank, feedback, abgPrediction } });
  },

  resetSimulation: () => set({
    simStep: 'case-select',
    selectedCase: null,
    selectedProduct: null,
    placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
    scoreResult: null,
    judgmentResult: null,
  }),

  setSelectedPatientId: (id) => set({ selectedPatientId: id }),
}));
