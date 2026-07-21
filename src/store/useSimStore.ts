import { create } from 'zustand';
import type { KurzProduct } from '../data/products';
import type { SurgicalCase } from '../data/cases';
import { checkProximityToDanger, computeSafetyScore, describeSafetyAlert } from '../engine/safety';
import type { DangerAlert, SafetyQueryPoint, SafetyFeedback } from '../engine/safety';

export type Screen = 'home' | 'learning' | 'simulation' | 'stepflow' | 'drill' | 'dashboard';
export type SimStep = 'case-select' | 'judgment' | 'product-select' | 'shaft-estimate' | 'placement' | 'score';
export type LearningTab = 'anatomy' | 'products' | 'procedure' | 'drilling' | 'real-ear';

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

/**
 * Phase17.1（Issue-023 Assessment State Model Design Review v1.0）で確定した「操作済みフラグ」。
 * 値がデフォルトと一致するかどうかではなく、対応する操作イベントが発火したかどうかで判定する
 * （一度trueになったら症例セッション中はリセットしない。resetSimulation()/setSelectedCase()時のみ
 * falseへ戻す）。stabilityは独立した操作ではなくposition/angleからの導出値のためフラグを持たない。
 */
export interface InteractionFlags {
  sizeTouched: boolean;
  positionTouched: boolean;
  angleTouched: boolean;
}

const initialInteractionFlags: InteractionFlags = {
  sizeTouched: false,
  positionTouched: false,
  angleTouched: false,
};

/** InteractionFlagsからの導出値（保持しない、都度計算）。Phase17.1設計書§1参照。 */
export interface AssessmentStatus {
  hasUserInteracted: boolean;
  canCalculateScore: boolean;
}

export function computeAssessmentStatus(flags: InteractionFlags): AssessmentStatus {
  const hasUserInteracted = flags.sizeTouched || flags.positionTouched || flags.angleTouched;
  return { hasUserInteracted, canCalculateScore: hasUserInteracted };
}

interface SimStore {
  screen: Screen;
  learningTab: LearningTab;
  simStep: SimStep;
  selectedCase: SurgicalCase | null;
  selectedProduct: KurzProduct | null;
  placement: PlacementState;
  /** Phase17.1 Assessment State Model。placement本体には混ぜず並置する。 */
  interactionFlags: InteractionFlags;
  scoreResult: ScoreResult | null;
  judgmentResult: JudgmentResult | null;
  highlightedStructure: string | null;
  drillStep: number;
  /**
   * Phase20.3: Safety Foundation。Placement Score（scoreResult）とは完全に独立した値として扱う
   * （Phase20設計レビュー Compatibility Policy、shojiさんPhase20.1レビュー所見「Placement 95 /
   * Safety 30も許容する設計」）。computeScore()は無変更、こちらは並行して呼ばれる別軸の評価。
   */
  safetyAlerts: DangerAlert[];
  safetyScore: number | null;
  safetyFeedback: SafetyFeedback[]; // Phase21.2: 型のみSafetyFeedback[]へ同期（describeSafetyAlert()のAPI変更に追従、ロジック変更なし）

  setScreen: (s: Screen) => void;
  setLearningTab: (t: LearningTab) => void;
  setSimStep: (s: SimStep) => void;
  setSelectedCase: (c: SurgicalCase) => void;
  setSelectedProduct: (p: KurzProduct) => void;
  updatePlacement: (p: Partial<PlacementState>) => void;
  /** Phase17.2: サイズ/位置/角度いずれかの操作イベント発火時に呼ぶ。値の一致では判定しない。 */
  markSizeTouched: () => void;
  markPositionTouched: () => void;
  markAngleTouched: () => void;
  setJudgmentResult: (r: JudgmentResult) => void;
  computeScore: () => void;
  /**
   * Phase20.3: pointに対するDANGER_ZONES近接判定→Safety Score→フィードバック文言を算出しstateへ
   * 反映する。point座標系の変換（配置状態→3D点）はcaller側（Phase20.4のScene層）の責務であり、
   * ここでは座標変換を行わない。computeScore()とは呼び出しタイミング・戻り値とも独立している。
   */
  computeSafety: (point: SafetyQueryPoint) => void;
  resetSimulation: () => void;
  setHighlightedStructure: (s: string | null) => void;
  setDrillStep: (n: number) => void;
}

// H1: 採点ランクの境界を厳格化（スコア履歴のS/A/B/C/D表示のみに影響。旧: 90/75/60/45）
function computeRank(total: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (total >= 95) return 'S';
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 50) return 'C';
  return 'D';
}

export const useSimStore = create<SimStore>((set, get) => ({
  screen: 'home',
  learningTab: 'anatomy',
  drillStep: 0,
  simStep: 'case-select',
  selectedCase: null,
  selectedProduct: null,
  placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
  interactionFlags: initialInteractionFlags,
  scoreResult: null,
  judgmentResult: null,
  highlightedStructure: null,
  safetyAlerts: [],
  safetyScore: null,
  safetyFeedback: [],

  setScreen: (s) => set({ screen: s }),
  setLearningTab: (t) => set({ learningTab: t }),
  setSimStep: (s) => set({ simStep: s }),
  setSelectedCase: (c) => set({
    selectedCase: c,
    placement: { selectedLength: c.recommendedLength, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
    interactionFlags: initialInteractionFlags,
    scoreResult: null,
    safetyAlerts: [],
    safetyScore: null,
    safetyFeedback: [],
  }),
  setSelectedProduct: (p) => set({ selectedProduct: p }),
  updatePlacement: (p) => set((s) => ({ placement: { ...s.placement, ...p } })),
  markSizeTouched: () => set((s) =>
    s.interactionFlags.sizeTouched ? s : { interactionFlags: { ...s.interactionFlags, sizeTouched: true } }
  ),
  markPositionTouched: () => set((s) =>
    s.interactionFlags.positionTouched ? s : { interactionFlags: { ...s.interactionFlags, positionTouched: true } }
  ),
  markAngleTouched: () => set((s) =>
    s.interactionFlags.angleTouched ? s : { interactionFlags: { ...s.interactionFlags, angleTouched: true } }
  ),
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
    // 段階式: ±0.3mm以内=25点, ±0.6mm=18点, ±1.0mm=10点, それ以上=3点
    const posMag = Math.sqrt(lateralDeviation ** 2 + anteriorDeviation ** 2 + verticalDeviation ** 2);
    let positionScore = 0;
    if (posMag <= 0.3) positionScore = 25;
    else if (posMag <= 0.6) positionScore = 18;
    else if (posMag <= 1.0) positionScore = 10;
    else positionScore = 3;

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

    // ── サイズフィードバック（方向 + 臨床的意味 + 改善策）──
    if (sizeScore < 25) {
      const diff = selectedLength - recommendedLength;
      if (diff > 0) {
        feedback.push(
          `【シャフト長】${selectedLength}mmは推奨${recommendedLength}mmより${lengthDiff.toFixed(1)}mm長すぎます。` +
          `長すぎると鼓膜（再建材）を押し上げ、張力過多による穿孔リスクが高まります。` +
          `改善：術中サイザーで実測し、${recommendedLength}mmへ変更してください。`
        );
      } else {
        feedback.push(
          `【シャフト長】${selectedLength}mmは推奨${recommendedLength}mmより${lengthDiff.toFixed(1)}mm短すぎます。` +
          `短すぎるとアブミ骨頭（または底板）との接触が不安定になり、音響伝達が低下します。` +
          `改善：${recommendedLength}mmに変更してください。`
        );
      }
    }

    // ── 位置フィードバック（軸ごとの方向 + 臨床的意味）──
    if (positionScore < 20) {
      if (Math.abs(lateralDeviation) >= 0.4) {
        if (lateralDeviation > 0) {
          feedback.push(
            `【位置・内外側】プロステーシスが内側に${Math.abs(lateralDeviation).toFixed(1)}mmずれています。` +
            `内側すぎると鼓膜との接触面積が減少し、音響エネルギーの伝達効率が低下します。` +
            `改善：外側（外耳道方向）へ${Math.abs(lateralDeviation).toFixed(1)}mm程度移動させてください。`
          );
        } else {
          feedback.push(
            `【位置・内外側】プロステーシスが外側に${Math.abs(lateralDeviation).toFixed(1)}mmずれています。` +
            `外側すぎると鼓膜再建材への過剰圧となり、長期的な穿孔リスクが上昇します。` +
            `改善：内側（アブミ骨頭中心軸方向）へ${Math.abs(lateralDeviation).toFixed(1)}mm程度引いてください。`
          );
        }
      }
      if (Math.abs(anteriorDeviation) >= 0.4) {
        if (anteriorDeviation > 0) {
          feedback.push(
            `【位置・前後】プロステーシスが前方に${Math.abs(anteriorDeviation).toFixed(1)}mmずれています。` +
            `前方偏位はツチ骨柄との干渉や可動性低下の原因となります。` +
            `改善：後方へ調整してください。`
          );
        } else {
          feedback.push(
            `【位置・前後】プロステーシスが後方に${Math.abs(anteriorDeviation).toFixed(1)}mmずれています。` +
            `後方偏位はアブミ骨頭への接触が偏り、安定性低下につながります。` +
            `改善：前方へ調整してください。`
          );
        }
      }
      if (Math.abs(verticalDeviation) >= 0.4) {
        if (verticalDeviation > 0) {
          feedback.push(
            `【位置・上下】プロステーシスが上方に${Math.abs(verticalDeviation).toFixed(1)}mmずれています。` +
            `上方偏位はアブミ骨頭への接触過剰となり、可動性を制限する可能性があります。` +
            `改善：下方（鼓室腔深部方向）へ調整してください。`
          );
        } else {
          feedback.push(
            `【位置・上下】プロステーシスが下方に${Math.abs(verticalDeviation).toFixed(1)}mmずれています。` +
            `下方偏位はアブミ骨頭から浮いた状態となり、接触不安定・音響損失の原因となります。` +
            `改善：上方へ調整し、アブミ骨頭との接触を確保してください。`
          );
        }
      }
    }

    // ── 角度フィードバック ──
    if (angleScore < 20) {
      const tiltXErr = angleTilt - idealAngle;
      if (Math.abs(tiltXErr) > 5) {
        if (tiltXErr > 0) {
          feedback.push(
            `【角度・前後傾斜】前傾きが${angleTilt}°（推奨${idealAngle}°）。${Math.abs(tiltXErr).toFixed(0)}°過傾斜しています。` +
            `前傾きすぎると頭部と鼓膜の接触面積が減少し、音響伝達効率が低下します。` +
            `改善：後方に引いて傾斜を${idealAngle}°付近に修正してください。`
          );
        } else {
          feedback.push(
            `【角度・前後傾斜】後傾きが強い（${angleTilt}°、推奨${idealAngle}°）。` +
            `後傾きすぎるとアブミ骨頭への圧が不均一になり、長期安定性が低下します。` +
            `改善：前方に傾けて傾斜を${idealAngle}°付近に修正してください。`
          );
        }
      }
      if (Math.abs(angleTiltZ) > 8) {
        feedback.push(
          `【角度・左右傾斜】左右傾斜が${Math.abs(angleTiltZ).toFixed(0)}°あります（推奨0°）。` +
          `左右傾斜は鼓室腔内での安定性を損ない、術後の脱落リスクを高めます。` +
          `改善：左右傾斜をゼロに近づけてください。`
        );
      }
    }

    // ── 安定性フィードバック ──
    if (stabilityScore < 20) {
      feedback.push(
        `【安定性】設置の安定性が不十分です（位置誤差${posMag.toFixed(1)}mm + 角度誤差${angleDiff.toFixed(0)}°の複合）。` +
        `不安定な配置は術後のプロステーシス脱落リスクを高め、再手術の原因となります。` +
        `改善：位置と角度の両方を最適化してください。`
      );
    }

    // ── 総合評価 ──
    if (total >= 90) feedback.push('✓ 優秀な設置です。臨床でそのまま使用できるレベルです。');
    else if (total >= 75) feedback.push('✓ 良好な設置です。微調整でさらに改善できます。');

    // ── ABG改善予測（文献根拠ベース）────────────────────────────────
    // 参考: Austin (1994), Yung (2003), Merchant (2003) らの鼓室形成術成績
    // PORP/TORP 術後ABG: 理想例で0〜10dB、平均15〜20dB残存
    // 術前ABG: 症例別 preOpAbg フィールドから取得
    //
    // モデル:
    //   サイズ精度がABGに最も寄与（1mm誤差 ≒ 5〜10dB悪化）
    //   位置偏心がABGに次いで寄与（0.5mm偏心 ≒ 5dB悪化）
    //   角度は安定性を介して寄与
    const PRE_OP_ABG = selectedCase.preOpAbg; // dB (症例別術前ABG)
    const IDEAL_IMPROVEMENT = Math.min(PRE_OP_ABG, 25); // dB (改善上限は術前ABGを超えない)

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

  computeSafety: (point) => {
    const alerts = checkProximityToDanger(point);
    set({
      safetyAlerts: alerts,
      safetyScore: computeSafetyScore(alerts),
      safetyFeedback: describeSafetyAlert(alerts),
    });
  },

  resetSimulation: () => set({
    simStep: 'case-select',
    selectedCase: null,
    selectedProduct: null,
    placement: { selectedLength: 2.5, lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 },
    interactionFlags: initialInteractionFlags,
    scoreResult: null,
    judgmentResult: null,
    safetyAlerts: [],
    safetyScore: null,
    safetyFeedback: [],
  }),


}));
