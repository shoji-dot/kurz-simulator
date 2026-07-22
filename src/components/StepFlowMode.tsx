/**
 * StepFlowMode.tsx — 8ステップ鼓室形成術フロー
 *
 * UpSurgeOn型の「1/8 → 8/8」進行管理を KURZ 版として実装。
 * 学習モード（解剖確認〜評価）をひとつのシナリオフローで統合。
 */

import { useState, useMemo } from 'react';
import { useSimStore, computeAssessmentStatus } from '../store/useSimStore';
import { surgicalCases } from '../data/cases';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import { SimScene } from '../scenes/SimScene';
import type { VisibilityMap, OpacityMode } from '../scenes/models/RealAnatomyModels';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';
import { Badge, Button, Alert, LearningPanel, TeachingPointList, StepProgress, Z_INDEX, ControlPad } from './ui';
import type { BadgeTone } from './ui';
import { SafetyScoreCard } from './SimulationMode';
import { CYCLE, MODE_LABEL, MODE_BG, MODE_FG } from '../scenes/models/visToggleConfig';
import { isCoordDebugMode } from '../utils/debugMode';

// ── 症例別耳小骨visマップ生成 ────────────────────────────────────
/**
 * 症例の ossicularStatus から耳小骨の表示モードを生成する。
 * absent → hidden, partial → ghost, intact/suprastructure → solid
 * ステップのvis定義とマージして使用する。
 */
function ossicleVisFromCase(c: SurgicalCase): VisibilityMap {
  const toMode = (s: string): OpacityMode =>
    s === 'absent' ? 'hidden' : s === 'partial' ? 'ghost' : 'solid';
  const stapesToMode = (s: string): OpacityMode =>
    s === 'absent' ? 'hidden' : s === 'footplate-only' ? 'ghost' : 'solid';

  return {
    malleus: toMode(c.ossicularStatus.malleus),
    incus:   toMode(c.ossicularStatus.incus),
    stapes:  stapesToMode(c.ossicularStatus.stapes),
  };
}

const DIFF_TONE: Record<string, BadgeTone> = { beginner: 'success', intermediate: 'warning', advanced: 'error' };
const DIFF_LABEL: Record<string, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' };

// ── ステップ定義 ──────────────────────────────────────────────────
interface StepDef {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  guide: string;
  clinicalNote?: string;
  /** AnatomyScene の表示設定 */
  vis?: VisibilityMap;
  highlightedKey?: string;
  /** プロステーシス配置シミュレーターを表示 */
  useSimScene?: boolean;
  /** スコアビューを表示 */
  useScoreView?: boolean;
  /** サマリービューを表示 */
  useSummaryView?: boolean;
}

const STEPS: StepDef[] = [
  {
    id: 1,
    icon: '🦴',
    title: '解剖確認',
    subtitle: '側頭骨・耳小骨の解剖を確認',
    guide: '鼓膜を透かして中耳腔の全体像を把握します。側頭骨（半透明）の中に耳小骨連鎖（ツチ骨・キヌタ骨・アブミ骨）が連続していることを確認してください。',
    clinicalNote: '手術開始前の解剖確認が合併症予防の第一歩。特に顔面神経と耳小骨の位置関係を術前CTで把握しておく。',
    vis: { bone: 'solid', tympanic: 'solid', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'solid', eac: 'ghost', roundWindow: 'solid' },
  },
  {
    id: 2,
    icon: '🔼',
    title: '鼓膜挙上',
    subtitle: '外耳道後壁を切開し鼓膜フラップを挙上',
    guide: '外耳道皮膚切開を行い、鼓膜を挙上して鼓室内を露出します。鼓膜を半透明表示に切り替えて中耳の様子を確認してください。',
    clinicalNote: 'フラップの挙上はツチ骨付着部から慎重に剥離。鼓索神経（黄色）は温存。過剰な牽引は鼓索神経麻痺の原因となる。',
    vis: { bone: 'solid', tympanic: 'ghost', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'solid', chordaTympani: 'solid', eac: 'ghost', roundWindow: 'solid' },
    highlightedKey: 'tympanic',
  },
  {
    id: 3,
    icon: '🔴',
    title: '病変除去',
    subtitle: '真珠腫・肉芽組織を摘出し中耳腔を清掃',
    guide: '鼓室内の病変（真珠腫・肉芽）を丁寧に除去します。顔面神経・蝸牛への侵達がないことを確認しながら進めます。',
    clinicalNote: '真珠腫摘出は骨膜と病巣マトリクスの境界を維持しながら進める。顔面神経が露出している場合は特に慎重に。',
    vis: { bone: 'ghost', tympanic: 'hidden', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'solid', chordaTympani: 'solid', innerEar: 'ghost', roundWindow: 'solid' },
    highlightedKey: 'facialNerve',
  },
  {
    id: 4,
    icon: '🔍',
    title: '耳小骨評価',
    subtitle: '耳小骨連鎖の連続性・可動性を確認',
    guide: '耳小骨3骨の状態（連続性・可動性・固定の有無）を精査します。症例ごとに残存状態が異なります。どの骨が欠損・損傷しているか確認してください。',
    clinicalNote: 'アブミ骨の可動性確認は TORP/PORP 選択の決定打。細い吸引管や鑷子で軽く触れて可動性をチェック。固定底板は耳硬化症の合併を示唆する。',
    vis: { bone: 'ghost', tympanic: 'hidden', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'ghost', chordaTympani: 'ghost', innerEar: 'ghost', roundWindow: 'solid' },
    highlightedKey: 'stapes',
  },
  {
    id: 5,
    icon: '📏',
    title: 'サイジング',
    subtitle: 'サイザーで距離を計測し適切な長さを決定',
    guide: '専用サイザーを使い鼓膜（または軟骨）〜アブミ骨頭（または底板）間距離を計測します。この値が人工耳小骨のシャフト長決定の根拠になります。',
    clinicalNote: 'カルテ記録の距離は参考値。術中サイザーで必ず実測する。通常 PORP: 1.5〜3.0mm、TORP: 3.5〜6.0mm の範囲。+0.5mm の余裕を持たせることが多い。',
    vis: { bone: 'ghost', tympanic: 'hidden', malleus: 'ghost', incus: 'ghost', stapes: 'solid', roundWindow: 'solid', innerEar: 'ghost' },
    highlightedKey: 'stapes',
  },
  {
    id: 6,
    icon: '🔩',
    title: 'プロステーシス設置',
    subtitle: '人工耳小骨を最適位置に配置',
    guide: '選択した KURZ 人工耳小骨をアブミ骨頭/底板上に設置します。矢印ハンドルをドラッグして位置を最適化してください。中央・垂直設置が目標です。',
    clinicalNote: 'ベル型フット（PORP）はアブミ骨頭を包む形で設置。フラット型（TORP）は底板中央に均等接触。頭板と鼓膜の間に軟骨片を必ず挿入する。',
    useSimScene: true,
  },
  {
    id: 7,
    icon: '📊',
    title: '位置評価',
    subtitle: '設置精度をスコアリングで確認',
    guide: 'サイズ・位置・角度・安定性の4指標で設置精度を評価します。各指標25点満点（合計100点）。フィードバックを参考に次のトレーニングへ活かしてください。',
    clinicalNote: '術後成績（ABG改善量）は設置精度と直接相関する。位置ずれ1mmで約5〜8 dBの聴力改善が損なわれる可能性がある（Merchant et al. 1998）。',
    useScoreView: true,
  },
  {
    id: 8,
    icon: '✅',
    title: '結果確認',
    subtitle: 'ABG改善予測と今回の学習まとめ',
    guide: '今回のシミュレーションの結果を振り返ります。次のトレーニングへの改善点を確認してください。',
    useSummaryView: true,
  },
];

// ── 進行バー（KURZ Design System v1: 共通StepProgressを使用） ────────
function StepProgressBar({ currentStep, onStepClick }: { currentStep: number; totalSteps: number; onStepClick?: (i: number) => void }) {
  return (
    <div style={{
      padding: '16px 16px', borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
      overflowX: 'auto', minHeight: 48, display: 'flex', alignItems: 'center',
    }}>
      <StepProgress
        items={STEPS.map((s, i) => ({
          key: String(s.id),
          label: `${s.id}. ${s.title}`,
          icon: s.icon,
          status: i + 1 < currentStep ? 'done' as const : i + 1 === currentStep ? 'current' as const : 'upcoming' as const,
          onClick: onStepClick ? () => onStepClick(i + 1) : undefined,
        }))}
      />
    </div>
  );
}

// ── コンテキストタグバー（症例情報） ─────────────────────────────
function CaseTagBar({ surgicalCase }: { surgicalCase: SurgicalCase }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {surgicalCase.tags.procedure.map(t => (
        <Badge key={t} tone="primary">{t}</Badge>
      ))}
      {surgicalCase.tags.lesion.map(t => (
        <Badge key={t} tone="warning">{t}</Badge>
      ))}
      <Badge tone={DIFF_TONE[surgicalCase.difficulty] ?? 'neutral'}>{DIFF_LABEL[surgicalCase.difficulty] ?? surgicalCase.difficulty}</Badge>
    </div>
  );
}

// ── ステップコンテンツ（ガイドパネル） ────────────────────────────
function StepGuidePanel({
  step, surgicalCase, product,
  currentStepIndex, totalSteps,
  onPrev, onNext,
}: {
  step: StepDef;
  surgicalCase: SurgicalCase;
  product: KurzProduct | null;
  currentStepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 症例情報 */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{surgicalCase.title}</div>
        <CaseTagBar surgicalCase={surgicalCase} />
        {product && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            選択製品: <strong style={{ color: 'var(--color-primary)' }}>{product.name}</strong>
            {' / '}シャフト長: <strong style={{ color: 'var(--color-primary)' }}>{surgicalCase.recommendedLength} mm</strong>
          </div>
        )}
      </div>

      {/* ステップガイド */}
      <div className="card" style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{step.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
              STEP {step.id} / {totalSteps} — {step.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{step.subtitle}</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
          {step.guide}
        </p>

        {step.clinicalNote && (
          <div style={{ marginBottom: 14 }}>
            <Alert tone="info">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 臨床メモ</div>
                <div style={{ font: 'var(--text-small)', lineHeight: 1.65 }}>{step.clinicalNote}</div>
              </div>
            </Alert>
          </div>
        )}

        {/* ティーチングポイント（step 4,5,6 で表示） */}
        {[4, 5, 6].includes(step.id) && (
          <div style={{ marginBottom: 14 }}>
            <LearningPanel title="ティーチングポイント">
              <TeachingPointList points={surgicalCase.teachingPoints.slice(0, 2)} />
            </LearningPanel>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '8px 0' }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={onPrev} disabled={currentStepIndex === 0}>
          ← 前へ
        </Button>
        <Button variant={isLast ? 'secondary' : 'primary'} style={{ flex: 2 }} onClick={onNext}>
          {isLast ? '↺ 最初から' : `次へ: STEP ${step.id + 1} →`}
        </Button>
      </div>
    </div>
  );
}

// Phase22.1追加: 総合スコアのRankバッジ色（SimulationMode ScoreStepのRANK_COLORと同じ意味付け）
const RANK_TONE: Record<string, BadgeTone> = { S: 'success', A: 'success', B: 'primary', C: 'warning', D: 'error' };

// ── スコア表示（Step 7） ─────────────────────────────────────────
function ScorePanel({ surgicalCase }: { surgicalCase: SurgicalCase }) {
  const { scoreResult, placement, safetyScore, safetyAlerts, safetyFeedback } = useSimStore();

  // Phase22.1 P0-1: STEP6で未操作（interactionFlagsすべてfalse）の場合はcomputeScore()を呼ばず
  // （handleNext側でゲート済み）、「未評価」表示のみ行う。SimulationMode ScoreStepと同じ方針
  // （Phase17.1設計書「未評価と0点を混同しない」）。
  if (!scoreResult) {
    return (
      <div className="sidebar" style={{ overflowY: 'auto' }}>
        <Alert tone="info">
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>未評価</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              STEP 6でプロステーシスの設置操作が行われていないため、今回のスコアは算出されません。
            </div>
          </div>
        </Alert>
        {/* Phase22.1 P0-2: Safety ScoreはPlacement Scoreの未評価ゲートとは独立した別軸のため、
            interactionFlagsに関係なく表示する（SimulationMode ScoreStepと同じ方針、Phase20.5.1） */}
        <div style={{ marginTop: 16 }}>
          <SafetyScoreCard safetyScore={safetyScore} safetyAlerts={safetyAlerts} safetyFeedback={safetyFeedback} />
        </div>
      </div>
    );
  }

  const { feedback } = scoreResult;

  return (
    <div className="sidebar" style={{ overflowY: 'auto' }}>
      {/* 症例情報 */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{surgicalCase.title}</div>
        <CaseTagBar surgicalCase={surgicalCase} />
      </div>

      {/* 総合スコア（Phase22.1追加: 従来ScorePanelに総合スコアの数値表示自体が存在しなかった） */}
      <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>総合スコア（Placement Score）</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {scoreResult.total}<span style={{ fontSize: 14, color: 'var(--color-text-muted)', marginLeft: 4 }}>/ 100</span>
        </div>
        <Badge tone={RANK_TONE[scoreResult.rank] ?? 'neutral'} style={{ marginTop: 6 }}>Rank {scoreResult.rank}</Badge>
      </div>

      {/* あなたの設置 */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>あなたの設置</div>
        {[
          ['シャフト長', `${placement.selectedLength} mm`, `（推奨: ${surgicalCase.recommendedLength} mm）`],
          ['内外側', `${(placement.lateralOffset + placement.dragOffsetX).toFixed(2)} mm`, `（理想: ${surgicalCase.idealLateralOffset > 0 ? '+' : ''}${surgicalCase.idealLateralOffset.toFixed(1)}mm）`],
          ['上下', `${(placement.verticalOffset + placement.dragOffsetY).toFixed(2)} mm`, '（理想: 0.0mm）'],
          ['前後', `${(placement.anteriorOffset + placement.dragOffsetZ).toFixed(2)} mm`, '（理想: 0.0mm）'],
          ['傾斜(前後)', `${placement.angleTilt}°`, `（理想: ${surgicalCase.idealAngle}°）`],
          ['傾斜(左右)', `${placement.angleTiltZ}°`, '（理想: 0°）'],
        ].map(([k, v, hint]) => (
          <div key={k} className="info-row">
            <span className="label">{k}</span>
            <span className="value" style={{ fontSize: 11 }}>{v} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{hint}</span></span>
          </div>
        ))}
      </div>

      {/* 安全性評価（Phase22.1 P0-2、Placement Scoreとは独立した別軸） */}
      <SafetyScoreCard safetyScore={safetyScore} safetyAlerts={safetyAlerts} safetyFeedback={safetyFeedback} />

      {/* フィードバック */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>フィードバック</div>
        {feedback.map((f, i) => (
          <div key={i} style={{
            fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6,
            marginBottom: 6, paddingLeft: 10,
            borderLeft: '2px solid var(--color-primary)',
          }}>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── サマリービュー（Step 8） ──────────────────────────────────────
const ABG_TONE: Record<string, { text: string; bg: string; border: string }> = {
  excellent: { text: 'var(--color-success)', bg: 'var(--color-success-bg)', border: 'var(--color-success)' },
  good:      { text: 'var(--color-primary)', bg: 'var(--color-primary-tint)', border: 'var(--color-primary)' },
  fair:      { text: 'var(--color-warning)', bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  poor:      { text: 'var(--color-error)',   bg: 'var(--color-error-bg)',   border: 'var(--color-error)' },
};

function SummaryPanel({
  surgicalCase, onRestart, onHome,
}: {
  surgicalCase: SurgicalCase;
  onRestart: () => void;
  onHome: () => void;
}) {
  const { scoreResult } = useSimStore();
  const abg = scoreResult?.abgPrediction;
  const abgTone = ABG_TONE[abg?.successCategory ?? 'excellent'];

  return (
    <div className="sidebar" style={{ overflowY: 'auto' }}>
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>シミュレーション完了</div>
        <CaseTagBar surgicalCase={surgicalCase} />
      </div>

      {scoreResult && abg && (
        <div className="card">
          <div style={{ marginTop: 10, padding: '10px 14px', background: abgTone.bg, border: `1px solid ${abgTone.border}`, borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: abgTone.text, fontWeight: 700, marginBottom: 4 }}>📈 術後ABG改善予測</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>改善: <strong style={{ color: abgTone.text }}>+{abg.improvementDb} dB</strong></span>
              <span style={{ fontSize: 13 }}>術後ABG目安: <strong style={{ color: abgTone.text }}>{abg.postOpAbg} dB</strong></span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{abg.clinicalInterpretation}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-title" style={{ marginBottom: 10 }}>今回の学習ポイント</div>
        <TeachingPointList points={surgicalCase.teachingPoints} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '8px 0' }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={onRestart}>
          ↺ 同症例で再挑戦
        </Button>
        <Button variant="primary" style={{ flex: 1 }} onClick={onHome}>
          🏠 ホームへ
        </Button>
      </div>
    </div>
  );
}

// ── 症例・製品選択（フロー開始） ──────────────────────────────────
function FlowSetup({ onStart }: { onStart: (c: SurgicalCase, p: KurzProduct) => void }) {
  // シミュレーションモードから遷移した場合、既選択症例を引き継ぐ
  const storeCase    = useSimStore(s => s.selectedCase);
  const storeProduct = useSimStore(s => s.selectedProduct);
  const [selectedCaseId,    setSelectedCaseId]    = useState<string | null>(storeCase?.id ?? null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(storeProduct?.id ?? null);
  const selectedCase    = surgicalCases.find(c => c.id === selectedCaseId) ?? null;
  const selectedProduct = kurzProducts.find(p => p.id === selectedProductId) ?? null;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, height: '100%', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: 4, fontSize: 20, color: 'var(--color-text-primary)' }}>🎬 手術フロー — 症例・製品選択</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        8ステップで鼓室形成術の全工程をシミュレーションします。症例と使用製品を選択してください。
      </p>

      <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--color-text-secondary)' }}>Step 1 — 症例を選択</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {[...surgicalCases].sort((a, b) => {
          const numA = parseInt(a.id.replace('case-', ''), 10);
          const numB = parseInt(b.id.replace('case-', ''), 10);
          return numA - numB;
        }).map(c => (
          <div
            key={c.id}
            className={`selectable-card ${selectedCaseId === c.id ? 'selected' : ''} kz-focusable`}
            onClick={() => { setSelectedCaseId(c.id); setSelectedProductId(c.recommendedProductId); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCaseId(c.id); setSelectedProductId(c.recommendedProductId); } }}
            aria-pressed={selectedCaseId === c.id}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</span>
              <Badge tone={DIFF_TONE[c.difficulty] ?? 'neutral'}>{DIFF_LABEL[c.difficulty] ?? c.difficulty}</Badge>
            </div>
            {selectedCaseId === c.id && (
              <>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, marginBottom: 6 }}>
                  {c.tags.procedure.map(t => <Badge key={t} tone="primary">{t}</Badge>)}
                  {c.tags.lesion.map(t => <Badge key={t} tone="warning">{t}</Badge>)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { key: 'malleus', label: 'ツ', status: c.ossicularStatus.malleus },
                    { key: 'incus',   label: 'キ', status: c.ossicularStatus.incus },
                    { key: 'stapes',  label: 'ア', status: c.ossicularStatus.stapes },
                  ] as const).map(({ key, label, status }) => {
                    const absent = status === 'absent';
                    const partial = status === 'partial' || status === 'footplate-only';
                    const tone: BadgeTone = absent ? 'error' : partial ? 'warning' : 'success';
                    const statusLabel = absent ? '欠損' : partial ? '部分' : '温存';
                    return (
                      <Badge key={key} tone={tone}>
                        {label} {statusLabel}
                      </Badge>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginTop: 6 }}>{c.description}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {selectedCase && (
        <>
          <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--color-text-secondary)' }}>Step 2 — 製品を確認</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {kurzProducts.map(p => (
              <div
                key={p.id}
                className={`selectable-card ${selectedProductId === p.id ? 'selected' : ''} kz-focusable`}
                onClick={() => setSelectedProductId(p.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProductId(p.id); } }}
                aria-pressed={selectedProductId === p.id}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                  <Badge tone={p.type === 'PORP' ? 'primary' : 'success'}>{p.type}</Badge>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{p.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <Button
        variant="primary"
        style={{ width: '100%', fontSize: 15, padding: '14px 0' }}
        disabled={!selectedCase || !selectedProduct}
        onClick={() => selectedCase && selectedProduct && onStart(selectedCase, selectedProduct)}
      >
        🎬 フローを開始 →
      </Button>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────
export function StepFlowMode() {
  const { setScreen, resetSimulation, updatePlacement, computeScore, placement, interactionFlags } = useSimStore();
  const [zoomLevel, setZoomLevel] = useState(0);
  const [boneGhostOpacity, setBoneGhostOpacity] = useState(0.25);
  const [showCartilage, setShowCartilage] = useState(false);
  // Phase22.2 P0-1: STEP6（SimScene）の側頭骨表示/非表示トグル。SimulationMode PlacementStepの
  // simVis/cycleVis（実体→半透明→非表示の循環）と同じ仕組みを、STEP6のvisをハードコードしていた
  // 箇所に配線する。CYCLE/MODE_LABEL/MODE_BG/MODE_FGは scenes/models/visToggleConfig.ts に集約した
  // 共有定数を再利用し、ロジックの二重実装はしない（[[feedback]]「UI仕様を共有するものはexportして共通化」方針）。
  // 初期値は従来STEP6にハードコードされていた表示（骨=半透明等）をそのまま維持する。
  // Phase22.2 GUI Follow-up P2: 外耳道(eac)は既定'ghost'（半透明）でも視界を遮るとの指摘を受け、
  // STEP6限定でhiddenへ変更（shojiさん確認済み、SimulationMode側のSIM_DEFAULT_VIS.eac='solid'は無変更）。
  const [simVis, setSimVis] = useState<VisibilityMap>({
    bone: 'ghost', tympanic: 'hidden', malleus: 'ghost', incus: 'ghost', stapes: 'solid', eac: 'hidden',
  });
  const cycleBoneVis = () => {
    setSimVis((prev) => {
      const current: OpacityMode = prev.bone ?? 'ghost';
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      return { ...prev, bone: next };
    });
  };
  const [panMode, setPanMode] = useState(false);
  // Phase22.2 GUI Follow-up P2（TransformControls位置付け整理、shojiさん案A確定 2026-07-22）:
  // STEP6はControlPadのみを操作手段とし、TransformControls（ドラッグギズモ）は非表示に統一する
  // （「ドラッグ」「ControlPad」の2種UIが混在していたPhase22.1由来の状態を解消）。SimScene自体は
  // dragModeで表示/有効を制御する既存設計のまま無変更、STEP6側は常に'view'を渡すだけでTC非表示・
  // OrbitControls常時有効（従来の視点モードと同じ挙動）になる。SimulationMode側は元の移動/視点
  // トグル＋TransformControlsを引き続き提供（案A対象外、無変更）。
  // Phase22.1追加: ?debug=coords時、AnatomyScene/SimScene内蔵のCoordinateDebugPanel（top:8,right:8）・
  // SimScene内蔵のSafety Debugパネル（top:8,left:8）と、StepFlowMode自前のトグル/タグバーが同じ
  // 四隅に重なる不具合をGUI確認で発見。coordDebug時のみ自前オーバーレイの位置をずらす。
  const [coordDebug] = useState(() => isCoordDebugMode());

  const [phase, setPhase] = useState<'setup' | 'flow'>('setup');
  const [flowCase, setFlowCase]       = useState<SurgicalCase | null>(null);
  const [flowProduct, setFlowProduct] = useState<KurzProduct | null>(null);
  const [stepIndex, setStepIndex]     = useState(0); // 0-indexed

  const step = STEPS[stepIndex];

  const handleStart = (c: SurgicalCase, p: KurzProduct) => {
    setFlowCase(c);
    setFlowProduct(p);
    resetSimulation();
    // ストアに症例・製品・推奨長をセット
    useSimStore.getState().setSelectedCase(c);
    useSimStore.getState().setSelectedProduct(p);
    updatePlacement({ selectedLength: c.recommendedLength });
    setPhase('flow');
    setStepIndex(0);
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      // Step 6 → 7 に進む際にスコアを計算（Phase22.1 P0-1: 未操作の場合は計算しない。
      // Issue-023・SimulationMode handleConfirmと同じcomputeAssessmentStatus()ゲート）
      if (step.id === 6 && computeAssessmentStatus(interactionFlags).hasUserInteracted) computeScore();
      setStepIndex(i => i + 1);
    } else {
      // 最後のステップからは再開
      setStepIndex(0);
      setPhase('setup');
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  const handleHome = () => {
    setScreen('home');
    resetSimulation();
  };

  const handleRestart = () => {
    if (flowCase && flowProduct) handleStart(flowCase, flowProduct);
  };

  // AnatomyScene の vis 設定（症例別耳小骨状態をマージ）
  const ossicleVis = useMemo(
    () => flowCase ? ossicleVisFromCase(flowCase) : {},
    [flowCase]
  );
  const visForScene: VisibilityMap = useMemo(() => {
    const base = step.vis ?? { bone: 'ghost', tympanic: 'solid', malleus: 'solid', incus: 'solid', stapes: 'solid' };
    // ステップvis内で solid 指定されている耳小骨だけ症例状態で上書き
    // (ghost/hidden 指定のステップは意図的な非表示なので維持)
    const merged: VisibilityMap = { ...base };
    (['malleus', 'incus', 'stapes'] as const).forEach((key) => {
      if (base[key] === 'solid' && ossicleVis[key]) {
        merged[key] = ossicleVis[key];
      }
    });
    return merged;
  }, [step, ossicleVis]);

  if (phase === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px)' }}>
        <FlowSetup onStart={handleStart} />
      </div>
    );
  }

  if (!flowCase || !flowProduct) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px)' }}>


      {/* 進行バー */}
      <StepProgressBar currentStep={stepIndex + 1} totalSteps={STEPS.length} onStepClick={setStepIndex} />

      <div className="layout-split" style={{ flex: 1 }}>
        {/* 3D / スコア / サマリービュー */}
        <div className="canvas-wrapper">
          {step.useSimScene ? (
            <SimScene
              surgicalCase={flowCase}
              product={flowProduct}
              placement={placement}
              // 不具合修正（2026-07-22、shojiさんGUI確認で発見）: showIdeal={true}が
              // ハードコードされており、症例のidealLateralOffset/idealAngleに基づく半透明の
              // 「理想配置ゴースト」(IdealGhostProsthesis、ghost=true・opacity 0.28)が常時
              // 表示され続けていた。理想位置が現在位置に近い症例では金属質感のため半透明でも
              // ほぼ判別できず、「プロステーシスが2つある（動かすと1つだけ残る）」ように見えて
              // いた。この機能自体はPhase22.2より前から存在（Session12由来、今回のControlPad
              // 実装とは無関係）。SimulationMode側は同じ機能を既定OFF+「📍理想位置」トグルで
              // 提供しており、STEP6もそれに合わせ既定非表示にする（トグルが必要になれば別途追加）。
              showIdeal={false}
              showCartilage={showCartilage}
              dragMode="view"
              vis={simVis}
              panMode={panMode}
            />
          ) : step.useScoreView || step.useSummaryView ? (
            <AnatomyScene
              vis={{ bone: 'ghost', tympanic: 'hidden', malleus: 'ghost', incus: 'ghost', stapes: 'solid', innerEar: 'ghost' }}
              highlightedKey="stapes"
              zoomLevel={zoomLevel}
              boneGhostOpacity={boneGhostOpacity}
            />
          ) : (
            <AnatomyScene
              vis={visForScene}
              highlightedKey={step.highlightedKey}
              zoomLevel={zoomLevel}
              boneGhostOpacity={boneGhostOpacity}
              panMode={panMode}
            />
          )}

          {/* Phase22.2 P2（案A確定）: 旧・視点/移動トグル（TransformControls切替用）はここに
              あったが、STEP6ではTC自体を非表示化したため削除（SimulationMode側は現存・無変更）。 */}

          {/* 側頭骨 表示/非表示トグル（Phase22.2 P0-1、STEP6限定）: SimulationMode PlacementStepの
              「3D 表示切替」と同じ CYCLE(実体→半透明→非表示) を側頭骨1項目に適用したもの。 */}
          {step.useSimScene && (
            <div style={{ position: 'absolute', top: coordDebug ? 235 : 52, right: 12, zIndex: Z_INDEX.toolbar }}>
              <button
                onClick={cycleBoneVis}
                aria-label="側頭骨の表示切替"
                title="クリックで 実体 → 半透明 → 非表示 を切替"
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: MODE_BG[simVis.bone ?? 'ghost'], color: MODE_FG[simVis.bone ?? 'ghost'], backdropFilter: 'var(--glass-blur)', transition: 'all .15s' }}
              >🦴 側頭骨: {MODE_LABEL[simVis.bone ?? 'ghost']}</button>
            </div>
          )}

          {/* Phase22.2 GUI Follow-up P1: 通常ビューでもPan(平行移動)の存在を明示するトグル。
              右ドラッグ=Panは以前からコード上動作していたが、UIに手がかりがなく「回転しかできない」
              という誤解を招いていた（shojiさんGUI確認で指摘）。既存panMode/setPanMode（AnatomyScene
              ステップで既に使用中の状態）をSTEP6でも再利用する。 */}
          {step.useSimScene && (
            <div style={{ position: 'absolute', top: coordDebug ? 275 : 92, right: 12, zIndex: Z_INDEX.toolbar }}>
              <button
                onClick={() => setPanMode(v => !v)}
                aria-label={panMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
                title={panMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: panMode ? 'var(--color-success)' : 'var(--color-surface-hover)', color: panMode ? 'var(--color-bg-primary)' : 'var(--color-text-muted)', backdropFilter: 'var(--glass-blur)', transition: 'all .15s' }}
              >{panMode ? '↔ 平行移動' : '🔄 回転'}</button>
            </div>
          )}

          {/* Phase22.2 GUI Follow-up（操作パネル方針転換）: PC/iPhone/iPad共通の「プロステーシス
              操作パネル」。TransformControls（ドラッグ）は粗調整専用、本パネルが精密調整の主役
              という役割分担（shojiさん確定方針）。前回実装したAdjRow単一クリック式の「詳細調整」
              パネルは本パネルに置き換え、削除した（3種類の操作UIが混在する状態を避けるため）。
              内部はuseSimStore.getState().translateSelectedObject()/rotateSelectedObject()を
              呼ぶのみ（矢印キーと完全に同じAPI）。常時表示（開閉トグルなし、shojiさん指定）。 */}
          {step.useSimScene && (
            <div style={{ position: 'absolute', bottom: 16, left: 12, zIndex: Z_INDEX.toolbar }}>
              <ControlPad />
            </div>
          )}

          {/* 操作モードトグル + ズームボタン */}
          {!step.useSimScene && (
            <>
              <div style={{ position: 'absolute', top: coordDebug ? 195 : 12, right: 12, display: 'flex', gap: 4, background: 'var(--glass-bg)', padding: '4px 6px', borderRadius: 'var(--radius-md)', backdropFilter: 'var(--glass-blur)', zIndex: Z_INDEX.toolbar }}>
                <button onClick={() => setPanMode(false)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: !panMode ? 'var(--color-primary)' : 'var(--color-surface-hover)', color: !panMode ? 'var(--color-bg-primary)' : 'var(--color-text-muted)', transition: 'all .15s' }}>🔄 回転</button>
                <button onClick={() => setPanMode(true)}  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: panMode ? 'var(--color-success)' : 'var(--color-surface-hover)', color: panMode ? 'var(--color-bg-primary)' : 'var(--color-text-muted)', transition: 'all .15s' }}>↔ 平行移動</button>
              </div>
              <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: Z_INDEX.toolbar }}>
                {[{ label: '＋', delta: 1 }, { label: '－', delta: -1 }].map(({ label, delta }) => (
                  <button key={label} onClick={() => setZoomLevel(z => z + delta)}
                    style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-bright)', background: 'var(--glass-bg)', color: 'var(--color-text-primary)', fontSize: 18, cursor: 'pointer', backdropFilter: 'var(--glass-blur)', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 側頭骨不透明度スライダー（骨が ghost の場合） */}
          {!step.useSimScene && visForScene.bone === 'ghost' && (
            <div style={{ position: 'absolute', bottom: 96, right: 8, zIndex: Z_INDEX.toolbar, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, color: 'var(--color-text-secondary)', writingMode: 'vertical-rl' }}>半透明濃度</span>
              <input type="range" min={0} max={1} step={0.02} value={boneGhostOpacity}
                onChange={e => setBoneGhostOpacity(Number(e.target.value))}
                style={{ appearance: 'slider-vertical', writingMode: 'vertical-lr', height: 80, width: 20, cursor: 'pointer', accentColor: 'var(--color-primary)' } as unknown as React.CSSProperties} />
              <span style={{ fontSize: 9, color: 'var(--color-text-primary)' }}>{Math.round(boneGhostOpacity * 100)}%</span>
            </div>
          )}

          {/* キャンバスオーバーレイ: コンテキストタグ */}
          <div style={{ position: 'absolute', top: (step.useSimScene && coordDebug) ? 195 : 10, left: 10, zIndex: Z_INDEX.hud, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {flowCase.tags.procedure.map(t => (
              <Badge key={t} tone="primary" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'var(--glass-blur)' }}>{t}</Badge>
            ))}
            {flowCase.tags.lesion.map(t => (
              <Badge key={t} tone="warning" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'var(--glass-blur)' }}>{t}</Badge>
            ))}
          </div>

          {/* 軟骨スライストグル（SimScene表示時のみ） */}
          {step.useSimScene && (
            <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: Z_INDEX.toolbar }}>
              <Button
                variant={showCartilage ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowCartilage(v => !v)}
                style={{ backdropFilter: 'var(--glass-blur)' }}
              >
                🟡 軟骨スライス
              </Button>
            </div>
          )}

          {/* 操作ヒント。STEP6は左下にControlPadを常時表示するため、ヒントは衝突を避け左上へ
              （ControlPad自体が位置/回転の操作方法を視覚的に示すため文言も簡略化）。 */}
          <div className={step.useSimScene ? 'canvas-overlay top-left' : 'canvas-overlay bottom-left'}>
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '5px 9px', borderRadius: 6, backdropFilter: 'var(--glass-blur)', fontSize: 11 }}>
              {step.useSimScene
                ? '🖱 ドラッグ: 視点回転 ｜ 左下パネル: 位置・角度調整 ｜ 左右ドラッグ切替は🔄/↔ボタン'
                : 'ドラッグ: 回転 ｜ ホイール: ズーム'}
            </div>
          </div>
        </div>

        {/* サイドパネル */}
        {step.useScoreView ? (
          <ScorePanel surgicalCase={flowCase} />
        ) : step.useSummaryView ? (
          <SummaryPanel surgicalCase={flowCase} onRestart={handleRestart} onHome={handleHome} />
        ) : (
          <StepGuidePanel
            step={step}
            surgicalCase={flowCase}
            product={flowProduct}
            currentStepIndex={stepIndex}
            totalSteps={STEPS.length}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}
      </div>
    </div>
  );
}
