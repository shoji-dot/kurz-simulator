import { create } from 'zustand';
import type { KurzProduct } from '../data/products';
import type { SurgicalCase } from '../data/cases';

export type Screen = 'home' | 'learning' | 'simulation' | 'surgical' | 'stepflow';
export type SimStep = 'case-select' | 'product-select' | 'placement' | 'score';
export type LearningTab = 'anatomy' | 'products' | 'procedure' | 'drilling';
export type PatientId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T';
export const ALL_PATIENT_IDS: PatientId[] = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

export interface PlacementState {
  selectedLength: number;
  lateralOffset: number;  // slider: -1 to +1 mm
  anteriorOffset: number; // slider: -1 to +1 mm
  angleTilt: number;      // degrees, -15 to +15
  dragOffsetX: number;    // 3D TransformControls drag accumulated X (mm)
  dragOffsetZ: number;    // 3D TransformControls drag accumulated Z (mm)
}

export interface ScoreResult {
  sizeScore: number;
  positionScore: number;
  angleScore: number;
  stabilityScore: number;
  total: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  feedback: string[];
}

interface SimStore {
  screen: Screen;
  learningTab: LearningTab;
  simStep: SimStep;
  selectedCase: SurgicalCase | null;
  selectedProduct: KurzProduct | null;
  placement: PlacementState;
  scoreResult: ScoreResult | null;
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
  placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, angleTilt: 0, dragOffsetX: 0, dragOffsetZ: 0 },
  scoreResult: null,
  highlightedStructure: null,

  setScreen: (s) => set({ screen: s }),
  setLearningTab: (t) => set({ learningTab: t }),
  setSimStep: (s) => set({ simStep: s }),
  setSelectedCase: (c) => set({
    selectedCase: c,
    placement: { selectedLength: c.recommendedLength, lateralOffset: 0, anteriorOffset: 0, angleTilt: 0, dragOffsetX: 0, dragOffsetZ: 0 },
    scoreResult: null,
  }),
  setSelectedProduct: (p) => set({ selectedProduct: p }),
  updatePlacement: (p) => set((s) => ({ placement: { ...s.placement, ...p } })),
  setHighlightedStructure: (s) => set({ highlightedStructure: s }),
  setDrillStep: (n) => set({ drillStep: n }),

  computeScore: () => {
    const { selectedCase, placement } = get();
    if (!selectedCase) return;

    const { selectedLength, lateralOffset, anteriorOffset, angleTilt, dragOffsetX, dragOffsetZ } = placement;
    const { recommendedLength, idealAngle } = selectedCase;

    // 合計オフセット（スライダー + 3Dドラッグ）
    const totalLateral  = lateralOffset + dragOffsetX;
    const totalAnterior = anteriorOffset + dragOffsetZ;

    // Size score (25pts)
    const lengthDiff = Math.abs(selectedLength - recommendedLength);
    let sizeScore = 0;
    if (lengthDiff <= 0.5) sizeScore = 25;
    else if (lengthDiff <= 1.0) sizeScore = 15;
    else if (lengthDiff <= 1.5) sizeScore = 5;
    else sizeScore = 0;

    // Position score (25pts)
    const posMag = Math.sqrt(totalLateral ** 2 + totalAnterior ** 2);
    let positionScore = Math.round(25 * Math.max(0, 1 - posMag * 1.5));

    // Angle score (25pts)
    const angleDiff = Math.abs(angleTilt - idealAngle);
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
    if (positionScore < 20) feedback.push(`配置位置：中心から${posMag.toFixed(2)}mmのずれ。アブミ骨頭部の中央に設置すること。`);
    if (angleScore < 20) feedback.push(`傾斜角：${angleTilt}° → 垂直（0°）に近づけること。`);
    if (stabilityScore < 20) feedback.push('安定性：位置または角度を最適化して安定性を改善。');
    if (total >= 90) feedback.push('✓ 優秀な設置です。臨床でそのまま使用できるレベルです。');
    else if (total >= 75) feedback.push('✓ 良好な設置です。微調整でさらに改善できます。');

    set({ scoreResult: { sizeScore, positionScore, angleScore, stabilityScore, total, rank, feedback } });
  },

  resetSimulation: () => set({
    simStep: 'case-select',
    selectedCase: null,
    selectedProduct: null,
    placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, angleTilt: 0, dragOffsetX: 0, dragOffsetZ: 0 },
    scoreResult: null,
  }),

  setSelectedPatientId: (id) => set({ selectedPatientId: id }),
}));
