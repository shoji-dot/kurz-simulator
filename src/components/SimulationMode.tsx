import React, { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';

// ─── Error Boundary ────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, message: error?.message ?? String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: 32, color: 'var(--color-error)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>描画エラーが発生しました</div>
          <div style={{ fontSize: 11, color: 'rgba(255,128,128,0.7)', maxWidth: 400, marginBottom: 20 }}>
            {this.state.message}
          </div>
          <button className="btn btn-ghost" onClick={() => this.setState({ hasError: false, message: '' })}>
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useSimStore, computeAssessmentStatus, type JudgmentResult } from '../store/useSimStore';
import type { DangerAlert, SafetyFeedback } from '../engine/safety';
import { getEducationCases, type SurgicalCase, resolveIdealLateralOffset, resolveIdealAngle } from '../data/cases';
import { kurzProducts } from '../data/products';
import { SimScene, SIM_DEFAULT_VIS, type DragMode, type SimViewMode, saveSimCam, resetSimCam, setSimCameraView, getSimCam } from '../scenes/SimScene';
import { DIRECT_MANIPULATION_UX } from '../scenes/transformControlsConfig';
import type { TransportControls } from '../scenes/transport/ManipulationLayer';
import type { PlacementControls } from '../scenes/canonicalPose';
import { ViewPresetPanel } from './ViewPresetPanel';
import { shiftViewForSim, SURGICAL_VIEWS } from '../scenes/ViewPresets';
import {
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';
import { SIM_VIS_ITEMS, CYCLE, MODE_LABEL, MODE_BG, MODE_FG } from '../scenes/models/visToggleConfig';
import { getAnchorBasis } from '../data/anchorBasis';
import { Button, IconButton, PillToggleGroup, ToolbarContainer, StepProgress, LearningPanel, TeachingPointList, ScoreStat, Feedback, Alert, Toggle, Z_INDEX, AdjRow, ControlPad, ContextTagBar } from './ui';
import { createSessionFromCaseCompletion, appendLearningEvidenceToSession, assessLearningSession, recommendFromAssessment } from '../engine/applicationIntegration';
import { summarizeSession } from '../engine/learningSession';
import { useLearningHistoryStore } from '../store/useLearningHistoryStore';
import { useLearningEvidenceStore } from '../store/useLearningEvidenceStore';

// ── スコア履歴 (localStorage) ──────────────────────────────────────
interface HistoryEntry {
  date: string;
  caseTitle: string;
  productName: string;
  total: number;
  rank: string;
  sizeScore: number;
  positionScore: number;
  angleScore: number;
  stabilityScore: number;
}

const HISTORY_KEY = 'kurz_score_history';
const MAX_HISTORY = 10;
const SKIP_QUIZ_KEY = 'kurz_skip_judgment_quiz';

function loadSkipQuiz(): boolean {
  try { return localStorage.getItem(SKIP_QUIZ_KEY) === 'true'; } catch { return false; }
}
function saveSkipQuiz(v: boolean): void {
  try { localStorage.setItem(SKIP_QUIZ_KEY, v ? 'true' : 'false'); } catch { /* */ }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch { /* quota exceeded */ }
}

function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const prev = loadHistory();
  const next = [entry, ...prev].slice(0, MAX_HISTORY);
  saveHistory(next);
  return next;
}

// ── シミュレーション用表示切替アイテム（Phase22.2でscenes/models/visToggleConfig.tsへ切り出し。
//    StepFlowMode.tsxからも参照するための共有化。値・ロジックは無変更） ──────────────


const diffLabel: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};
const diffBadge: Record<string, string> = {
  beginner: 'badge-green',
  intermediate: 'badge-yellow',
  advanced: 'badge-red',
};
const ossicleLabel: Record<string, string> = {
  intact:          '温存',
  partial:         '部分欠損',
  absent:          '欠損',
  suprastructure:  '上部構造温存',
  'footplate-only': '底板のみ',
};

// ─── 微調整行コンポーネント ───────────────────────────────────────────────
// AdjRow は components/ui/AdjRow.tsx へ切り出し済み（Phase22.2 GUI Follow-up P1、STEP6と共有）。

// ─── Step 1: Case selection ───────────────────────────────────────────────
function CaseSelect({ skipQuiz, onToggleSkip }: { skipQuiz: boolean; onToggleSkip: () => void }) {
  const { selectedCase, setSelectedCase, setSimStep } = useSimStore();
  const [diffFilter, setDiffFilter] = useState<string>('all');

  // D-3 AD-3: 教育UIは15症例ではなくEDUCATION_CASE_IDS(PORP/TORP/Soft Clip の3症例)のみを表示する。
  // surgicalCases自体は無変更のまま（engine/caseGenerator等の既存参照を壊さないため）。
  const educationCases = getEducationCases();
  const filtered = diffFilter === 'all' ? educationCases : educationCases.filter(c => c.difficulty === diffFilter);

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>症例選択</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
        練習する手術症例を選んでください。実際の耳小骨連鎖の状態が3Dで示されます。
      </p>

      {/* 難易度フィルター */}
      <div style={{ marginBottom: 16 }}>
        <PillToggleGroup<string>
          ariaLabel="難易度フィルター"
          value={diffFilter}
          onChange={setDiffFilter}
          options={[
            { value: 'all',          label: `すべて (${educationCases.length})` },
            { value: 'beginner',     label: `初級 (${educationCases.filter(c => c.difficulty === 'beginner').length})` },
            { value: 'intermediate', label: `中級 (${educationCases.filter(c => c.difficulty === 'intermediate').length})` },
            { value: 'advanced',     label: `上級 (${educationCases.filter(c => c.difficulty === 'advanced').length})` },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((c) => {
          const isSelected = selectedCase?.id === c.id;
          return (
            <div
              key={c.id}
              className={`selectable-card ${isSelected ? 'selected' : ''} kz-focusable`}
              onClick={() => setSelectedCase(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCase(c); } }}
              aria-pressed={isSelected}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className={`badge ${diffBadge[c.difficulty]}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{diffLabel[c.difficulty]}</span>
              </div>
              {isSelected && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, marginBottom: 8 }}>{c.description}</p>
                  <ContextTagBar procedureTags={c.tags.procedure} lesionTags={c.tags.lesion} style={{ marginBottom: 6 }} />
                  {c.detailedReconstructionPattern && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      細分類: <strong style={{ color: 'var(--color-primary)' }}>{c.detailedReconstructionPattern}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>ツチ骨: {ossicleLabel[c.ossicularStatus.malleus] ?? c.ossicularStatus.malleus}</span>
                    <span>·</span>
                    <span>キヌタ骨: {ossicleLabel[c.ossicularStatus.incus] ?? c.ossicularStatus.incus}</span>
                    <span>·</span>
                    <span>アブミ骨: {ossicleLabel[c.ossicularStatus.stapes] ?? c.ossicularStatus.stapes}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* 判断クイズスキップ設定 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <Toggle checked={skipQuiz} onChange={onToggleSkip} aria-label="判断クイズをスキップ" />
          判断クイズをスキップ
        </label>
        <button
          className="btn btn-primary"
          disabled={!selectedCase}
          onClick={() => setSimStep(skipQuiz ? 'product-select' : 'judgment')}
        >
          次へ: {skipQuiz ? '製品選択' : '適応判断'} →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1.5: Judgment (適応判断クイズ) ────────────────────────────────────

/** 症例タグから鼓室形成型を導出 */
function deriveSurgicalType(sc: SurgicalCase): string {
  const procs = sc.tags.procedure;
  if (procs.some(p => p.includes('IV型'))) return 'IV型';
  if (procs.some(p => p.includes('III型'))) return 'III型';
  if (procs.some(p => p.includes('II型'))) return 'II型';
  if (procs.some(p => p.includes('アブミ骨') || p.includes('Stapedotomy'))) return 'アブミ骨手術';
  return 'その他';
}

/** recommendedProductId からプロステーシス種別を導出 */
function deriveProsthesisType(productId: string): string {
  if (productId.includes('torp')) return 'TORP';
  if (productId.includes('soft-clip')) return 'Soft Clip (PISTON)';
  return 'PORP';
}

/** 症例の ossicularStatus から確認すべき解剖構造を導出 */
function deriveFocusStructures(sc: SurgicalCase): { key: string; label: string; reason: string }[] {
  const structures: { key: string; label: string; reason: string }[] = [
    { key: 'facialNerve', label: '顔面神経', reason: 'プロステーシス設置の最重要危険構造。水平部はアブミ骨直上を走行。' },
    { key: 'chordaTympani', label: '鼓索神経', reason: 'ツチ骨柄内側を通過。PORP設置経路と交差することがある。' },
  ];
  if (sc.ossicularStatus.stapes === 'footplate-only') {
    structures.push({ key: 'stapes', label: 'アブミ骨底板', reason: 'TORPフット部の設置目標。底板中央への設置が必須。' });
    structures.push({ key: 'innerEar', label: '卵円窓・内耳', reason: '底板偏心で内耳障害のリスクあり。' });
  } else if (sc.ossicularStatus.stapes === 'suprastructure') {
    structures.push({ key: 'stapes', label: 'アブミ骨上部構造', reason: 'PORPのベル型フット設置目標。頭部の可動性を確認。' });
  }
  return structures;
}

/** 鼓室形成型の臨床根拠（不正解時の説明） */
function deriveTypeExplanation(sc: SurgicalCase): string {
  const type = deriveSurgicalType(sc);
  const os = sc.ossicularStatus;
  if (type === 'IV型') {
    return 'ツチ骨・キヌタ骨・アブミ骨上部構造がすべて欠損し底板のみ残存するためIV型（TORP適応）となります。';
  }
  if (type === 'III型') {
    const hasM = os.malleus === 'intact' ? 'ツチ骨柄温存' : 'ツチ骨柄欠損';
    return `${hasM}・キヌタ骨欠損でアブミ骨上部構造が温存されているためIII型（PORP適応）となります。`;
  }
  if (type === 'II型') {
    return 'キヌタ骨のみ欠損し、ツチ骨柄とアブミ骨上部構造が温存されているためII型となります。';
  }
  if (type === 'アブミ骨手術') {
    return 'アブミ骨底板固着（耳硬化症または奇形）が主病変のためStapedotomy適応となります。';
  }
  return '術式分類は耳小骨連鎖の現存状態に基づいて決定されます。';
}

/** 選択肢をシャッフル（Fisher-Yates） */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type JudgmentPhase = 'anatomy-guide' | 'quiz' | 'result';

function JudgmentStep() {
  const { selectedCase, setSimStep, setJudgmentResult } = useSimStore();
  const [phase, setPhase] = useState<JudgmentPhase>('anatomy-guide');

  // クイズ状態
  const [typeSelected,    setTypeSelected]    = useState<string | null>(null);
  const [productSelected, setProductSelected] = useState<string | null>(null);

  // useMemo は早期 return の前に呼ぶ（Rules of Hooks）
  const caseId         = selectedCase?.id ?? '';
  const typeOptions    = useMemo(() => shuffled(['II型', 'III型', 'IV型', 'アブミ骨手術']), [caseId]);
  const productOptions = useMemo(() => shuffled(['PORP', 'TORP', 'Soft Clip (PISTON)']), [caseId]);

  if (!selectedCase) return null;

  const correctType     = deriveSurgicalType(selectedCase);
  const correctProduct  = deriveProsthesisType(selectedCase.recommendedProductId);
  const focusStructures = deriveFocusStructures(selectedCase);

  const typeCorrect    = typeSelected === correctType;
  const productCorrect = productSelected === correctProduct;
  const canSubmit      = typeSelected !== null && productSelected !== null;

  function handleSubmit() {
    if (!canSubmit) return;
    const result: JudgmentResult = {
      typeAnswer: typeSelected!,
      typeCorrect,
      productAnswer: productSelected!,
      productCorrect,
    };
    setJudgmentResult(result);
    setPhase('result');
  }

  // ── 解剖確認ガイド画面 ──
  if (phase === 'anatomy-guide') {
    return (
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
        <div className="card">
          <div className="section-title" style={{ color: 'var(--color-primary)', marginBottom: 12 }}>
            🔬 術前解剖確認
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            {selectedCase.title}に進む前に、以下の解剖構造を3Dビューで確認してください。
          </div>
          {focusStructures.map(s => (
            <div key={s.key} style={{ marginBottom: 8 }}>
              <Alert tone="info">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>{s.reason}</div>
                </div>
              </Alert>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            💡 解剖タブで各構造を solid / ghost / hidden に切り替えて立体位置を確認してから次に進むことを推奨します。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('case-select')}>← 戻る</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setPhase('quiz')}>
            確認完了 → 判断クイズへ
          </button>
        </div>
      </div>
    );
  }

  // ── 判断クイズ画面 ──
  if (phase === 'quiz') {
    const optionStyle = (opt: string, selected: string | null): CSSProperties => ({
      padding: '10px 16px', marginBottom: 8, borderRadius: 8, cursor: 'pointer',
      border: `1px solid ${selected === opt ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)'}`,
      background: selected === opt ? 'var(--color-primary-tint)' : 'rgba(255,255,255,0.04)',
      color: selected === opt ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      fontSize: 13, fontWeight: selected === opt ? 700 : 400,
      transition: 'all .15s',
    });

    return (
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
        {/* 症例サマリ */}
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>症例情報</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {selectedCase.description}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['malleus', 'incus', 'stapes'] as const).map(bone => {
              const status = selectedCase.ossicularStatus[bone];
              const labels: Record<string, string> = { malleus: 'ツチ骨', incus: 'キヌタ骨', stapes: 'アブミ骨' };
              const statusLabel: Record<string, string> = {
                intact: '正常', partial: '部分', absent: '欠損',
                suprastructure: '上部構造あり', 'footplate-only': '底板のみ',
              };
              const color = status === 'intact' ? 'var(--color-success)' : status === 'absent' || status === 'footplate-only' ? 'var(--color-error)' : 'var(--color-warning)';
              const colorRgb = status === 'intact' ? 'var(--color-success-rgb)' : status === 'absent' || status === 'footplate-only' ? 'var(--color-error-rgb)' : 'var(--color-warning-rgb)';
              return (
                <div key={bone} style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: `rgba(${colorRgb},0.09)`, border: `1px solid rgba(${colorRgb},0.33)`, color,
                }}>
                  {labels[bone]}：{statusLabel[status] ?? status}
                </div>
              );
            })}
          </div>
        </div>

        {/* Q1: 鼓室形成型 */}
        <div className="card">
          <div className="section-title">Q1. この症例の鼓室形成型は？</div>
          {typeOptions.map(opt => (
            <div
              key={opt}
              style={optionStyle(opt, typeSelected)}
              onClick={() => setTypeSelected(opt)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTypeSelected(opt); } }}
              aria-pressed={typeSelected === opt}
              className="kz-focusable"
            >
              {opt}
            </div>
          ))}
        </div>

        {/* Q2: プロステーシス種別 */}
        <div className="card">
          <div className="section-title">Q2. 適切なプロステーシス種類は？</div>
          {productOptions.map(opt => (
            <div
              key={opt}
              style={optionStyle(opt, productSelected)}
              onClick={() => setProductSelected(opt)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProductSelected(opt); } }}
              aria-pressed={productSelected === opt}
              className="kz-focusable"
            >
              {opt}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPhase('anatomy-guide')}>← 解剖確認に戻る</button>
          <button
            className="btn btn-primary" style={{ flex: 1, opacity: canSubmit ? 1 : 0.4 }}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            回答する
          </button>
        </div>
      </div>
    );
  }

  // ── 結果フィードバック画面 ──
  const recommendedProduct = kurzProducts.find(p => p.id === selectedCase.recommendedProductId);
  const typeExplanation    = deriveTypeExplanation(selectedCase);
  const productExplanation = recommendedProduct?.selectionRationale;

  const ResultBadge = ({ correct, label, answer, correct_answer, explanation }: { correct: boolean; label: string; answer: string; correct_answer: string; explanation?: string }) => (
    <div style={{
      padding: '12px 16px', marginBottom: 12, borderRadius: 8,
      background: correct ? 'rgba(var(--color-success-rgb),0.08)' : 'rgba(var(--color-error-rgb),0.08)',
      border: `1px solid ${correct ? 'rgba(var(--color-success-rgb),0.35)' : 'rgba(var(--color-error-rgb),0.35)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{correct ? '✅' : '❌'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: correct ? 'var(--color-success)' : 'var(--color-error)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        あなたの回答：<span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{answer}</span>
        {!correct && (
          <span> → 正解：<span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{correct_answer}</span></span>
        )}
      </div>
      {!correct && explanation && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: 11, color: 'var(--color-warning)', lineHeight: 1.65,
        }}>
          📖 {explanation}
        </div>
      )}
    </div>
  );

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          {typeCorrect && productCorrect ? '🎉 完全正解！' : typeCorrect || productCorrect ? '⚡ 部分正解' : '📚 要復習'}
        </div>
        <ResultBadge
          correct={typeCorrect}
          label="Q1. 鼓室形成型"
          answer={typeSelected!}
          correct_answer={correctType}
          explanation={typeExplanation}
        />
        <ResultBadge
          correct={productCorrect}
          label="Q2. プロステーシス種別"
          answer={productSelected!}
          correct_answer={correctProduct}
          explanation={productExplanation}
        />
        {/* Teaching points 全件表示 */}
        {selectedCase.teachingPoints.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8, letterSpacing: '.04em' }}>
              💡 学習ポイント
            </div>
            <TeachingPointList points={selectedCase.teachingPoints} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('quiz'); setTypeSelected(null); setProductSelected(null); }}>
          やり直す
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>
          プロステーシス選択へ →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Product selection ─────────────────────────────────────────────
function ProductSelect() {
  const { selectedCase, selectedProduct, placement, setSelectedProduct, setSimStep, updatePlacement, markSizeTouched } = useSimStore();
  // 症例選択時にsetSelectedCaseがrecommendedLengthをplacementにセット済み → それを初期値に使う
  const [selectedLength, setSelectedLength] = useState<number | null>(placement.selectedLength ?? null);

  const recommendedId = selectedCase?.recommendedProductId;
  const recommendedProduct = kurzProducts.find(p => p.id === recommendedId);

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>製品・シャフト長選択</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        症例に適した人工耳小骨と長さを選択してください。
      </p>

      {selectedCase && (
        <div className="card" style={{ marginBottom: 16, background: 'rgba(var(--color-primary-rgb),.05)', borderColor: 'rgba(var(--color-primary-rgb),.2)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            📋 <strong style={{ color: 'var(--text-primary)' }}>症例メモ</strong>：{selectedCase.clinicalNotes}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {kurzProducts.map((p) => {
          const isSelected = selectedProduct?.id === p.id;
          const isRecommended = p.id === recommendedId;
          const isWrongChoice = isSelected && !isRecommended;

          return (
            <div key={p.id}>
              <div
                className={`selectable-card ${isSelected ? 'selected' : ''} kz-focusable`}
                onClick={() => { setSelectedProduct(p); setSelectedLength(placement.selectedLength); }}
                style={isRecommended ? { borderColor: 'rgba(var(--color-success-rgb),.4)' } : undefined}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProduct(p); setSelectedLength(placement.selectedLength); } }}
                aria-pressed={isSelected}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    {isRecommended && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px',
                        borderRadius: 10, background: 'rgba(var(--color-success-rgb),.15)',
                        color: 'var(--color-success)', border: '1px solid rgba(var(--color-success-rgb),.3)',
                        whiteSpace: 'nowrap',
                      }}>✓ この症例に推奨</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span className={`badge badge-${p.type === 'PORP' ? 'blue' : p.type === 'TORP' ? 'green' : 'yellow'}`}>{p.type}</span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text-secondary)' }}>
                      {p.footType}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{p.description}</p>

                {/* Indications chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {p.indications.map((ind, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'rgba(255,255,255,.05)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}>{ind}</span>
                  ))}
                </div>

                {/* Selected: 選択根拠 + 主な特徴 */}
                {isSelected && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    {p.selectionRationale && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 8, lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>選択根拠：</span>{p.selectionRationale}
                      </div>
                    )}
                    {p.keyFeatures && p.keyFeatures.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>主な特徴</div>
                        {p.keyFeatures.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3, paddingLeft: 8 }}>
                            • {f}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 誤選択警告 */}
              {isWrongChoice && recommendedProduct && (
                <div style={{
                  padding: '10px 14px', marginTop: -2,
                  background: 'rgba(var(--color-warning-rgb),.07)', border: '1px solid rgba(var(--color-warning-rgb),.25)',
                  borderTop: 'none', borderRadius: '0 0 8px 8px', fontSize: 12, lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>
                    ⚠️ この症例には <span style={{ color: 'var(--text-primary)' }}>{recommendedProduct.name}</span> が推奨されます
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {recommendedProduct.selectionRationale}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                    <span style={{ fontWeight: 600 }}>この製品が適さない場面：</span>
                    {p.notForWhen.slice(0, 2).join('／')}
                  </div>
                </div>
              )}

              {/* Length selector */}
              {isSelected && (
                <div style={{ padding: '12px 14px', background: 'rgba(var(--color-primary-rgb),.08)', border: '1px solid var(--color-primary)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginTop: isWrongChoice ? 0 : -2 }}>
                  <div className="section-title" style={{ marginBottom: 8 }}>シャフト長を選択</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.shaftLengths.map((l) => (
                      <button
                        key={l}
                        onClick={(e) => { e.stopPropagation(); setSelectedLength(l); updatePlacement({ selectedLength: l }); markSizeTouched(); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: selectedLength === l ? '2px solid var(--color-primary)' : '1px solid var(--color-border-bright)',
                          background: selectedLength === l ? 'var(--color-primary)' : 'transparent',
                          color: selectedLength === l ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                        }}
                      >
                        {l} mm
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={() => setSimStep('case-select')}>← 戻る</button>
        <button
          className="btn btn-primary"
          disabled={!selectedProduct || selectedLength === null}
          onClick={() => setSimStep(selectedProduct?.type === 'PISTON' ? 'placement' : 'shaft-estimate')}
        >
          {/* D-3: Soft Clip（type==='PISTON'）はAC Sizerステップを使わないため配置調整へ直行する。
              PORP/TORPは既存通りAC Sizerステップ（shaft-estimate）を経由する。 */}
          {selectedProduct?.type === 'PISTON' ? '次へ: 配置調整 →' : '次へ: ACサイザー →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 2.5: AC Sizer使用ガイド（PORP/TORPのみ、Soft Clipはスキップ） ──────────────
function ShaftEstimateStep() {
  const { selectedCase, selectedProduct, placement, setSimStep } = useSimStore();
  const [sizerGuideOpen, setSizerGuideOpen] = useState(false);

  if (!selectedCase || !selectedProduct) return null;

  const selected = placement.selectedLength;

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
      <div className="card">
        <div className="section-title" style={{ color: 'var(--color-primary)', marginBottom: 12 }}>
          📏 ACサイザー使用ガイド
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          {/* D-3: 従来はここでシャフト長を再度「推定」させ、選択済みの値と比較する重複クイズが
              あった。シャフト長選択（前ステップ）で既に確定済みのため、ここではAC Sizerの
              実測手順ガイドのみを示し、そのまま配置調整へ進む。 */}
          術中はACサイザーで実測してからシャフト長を確定します。選択したシャフト長
          （<strong style={{ color: 'var(--text-primary)' }}>{selected} mm</strong>）で配置を行います。
        </div>

        {/* 症例参考情報 */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>症例参考情報</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {selectedCase.clinicalNotes}
          </div>
        </div>

        {/* AC サイザー使用ガイド（M4: 概要3行＋詳細アコーディオン） */}
        <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--color-success-bg)', border:'1px solid rgba(var(--color-success-rgb),0.25)', marginBottom:16 }}>
          <div
            onClick={() => setSizerGuideOpen(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSizerGuideOpen(v => !v); } }}
            aria-expanded={sizerGuideOpen}
            className="kz-focusable"
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' }}
          >
            <div style={{ fontSize:11, fontWeight:700, color:'var(--color-success)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{fontSize:14}}>📐</span> ACサイザー使用手順
            </div>
            <span style={{ fontSize:11, color:'var(--color-success)', display:'inline-block', transform: sizerGuideOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▾</span>
          </div>
          {/* 概要3行（常時表示） */}
          <div style={{ fontSize:10, color:'var(--color-text-muted)', lineHeight:1.7, marginTop:8 }}>
            ① サイザーを鼓膜グラフト下面〜アブミ骨頭部（PORP）/底板（TORP）に当てて実測<br />
            ② 0.25mm単位で目盛りを読み記録（体位・軟骨補強厚で変動）<br />
            ③ 軟骨補強ありの場合は実測値 +0.25〜0.5mm を推奨長として加算
          </div>
          {sizerGuideOpen && (
            <>
          {/* SVG: サイザー模式図 */}
          <svg viewBox="0 0 280 90" style={{ width:'100%', height:'auto', display:'block', marginTop:10, marginBottom:10 }}>
            {/* 解剖断面背景 */}
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(0,20,30,0.6)" />
            {/* 底板 / アブミ骨頭 */}
            <ellipse cx="60" cy="72" rx="14" ry="4" fill="#8b6030" opacity="0.9" />
            <text x="60" y="84" textAnchor="middle" fontSize="7" fill="#c4944a">底板</text>
            <ellipse cx="60" cy="38" rx="8" ry="3" fill="#9a7040" opacity="0.8" />
            <text x="60" y="30" textAnchor="middle" fontSize="7" fill="#c4944a">鼓膜側</text>
            {/* ACサイザー本体 */}
            <rect x="54" y="40" width="12" height="30" rx="2" fill="none" stroke="var(--color-success)" strokeWidth="1.5" />
            <line x1="48" y1="40" x2="72" y2="40" stroke="var(--color-success)" strokeWidth="1.2" />
            <line x1="48" y1="70" x2="72" y2="70" stroke="var(--color-success)" strokeWidth="1.2" />
            {/* 双方向矢印 */}
            <line x1="78" y1="40" x2="78" y2="70" stroke="var(--color-warning)" strokeWidth="1.2" />
            <polygon points="78,36 75,43 81,43" fill="var(--color-warning)" />
            <polygon points="78,74 75,67 81,67" fill="var(--color-warning)" />
            <text x="84" y="57" fontSize="9" fill="var(--color-warning)" fontWeight="bold">L mm</text>
            {/* 目盛り */}
            {[0,1,2,3,4,5].map((i) => null)}
            <line x1="56" y1="45" x2="60" y2="45" stroke="var(--color-success)" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="50" x2="60" y2="50" stroke="var(--color-success)" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="55" x2="60" y2="55" stroke="var(--color-success)" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="60" x2="60" y2="60" stroke="var(--color-success)" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="65" x2="60" y2="65" stroke="var(--color-success)" strokeWidth="0.8" opacity="0.6" />
            {/* テキスト説明 */}
            <text x="105" y="22" fontSize="8.5" fill="var(--color-text-primary)" fontWeight="600">ACサイザー計測手順</text>
            <text x="105" y="36" fontSize="8" fill="var(--color-text-muted)">① サイザーを鼓膜グラフト下面に当てる</text>
            <text x="105" y="48" fontSize="8" fill="var(--color-text-muted)">② 下端をアブミ骨頭（PORP）または</text>
            <text x="105" y="58" fontSize="8" fill="var(--color-text-muted)">　 底板（TORP）まで伸ばす</text>
            <text x="105" y="70" fontSize="8" fill="var(--color-text-muted)">③ 目盛りを読み、0.25mm単位で記録</text>
            <text x="105" y="82" fontSize="8" fill="var(--color-success)">④ 読んだ値 = シャフト長の基準</text>
          </svg>
            </>
          )}
        </div>


        {/* TTP-VARIAC シャフト長調整手順（Soft Clip 以外・詳細アコーディオン展開時のみ表示） */}
        {selectedProduct.id !== 'soft-clip-stapes' && sizerGuideOpen && (
          <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--color-primary-tint)', border:'1px solid rgba(var(--color-primary-rgb),0.28)', marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--color-primary)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{fontSize:14}}>🔧</span> TTP-VARIAC® シャフト長調整手順（サイザーディスク使用）
            </div>
            <ol style={{ margin:0, padding:'0 0 0 16px', fontSize:11, color:'var(--color-text-muted)', lineHeight:1.8 }}>
              <li>Micro Scissors でサイザーを shaft 付着部から切り取り、中耳腔に挿入する</li>
              <li>Head plate を鼓膜・ツチ骨柄側、foot part をアブミ骨側（PORP: 頭部 / TORP: 底板）に位置合わせする</li>
              <li>軟骨補強を使用する場合は軟骨の厚さを考慮して最適な長さを決定する</li>
              <li>プロステーシスを生食で湿らし、Titanium Tweezers で head plate を持って、<span style={{color:'var(--color-primary)', fontWeight:600}}>目的の長さの溝にシャフトを挿入する</span></li>
              <li>Micro Closing Forceps で head plate を固定する<br/><span style={{color:'var(--color-warning)'}}>（INSIDE 面を head plate 内側に、OUTSIDE 面を外側に合わせて挟む）</span></li>
              <li>Cutting Forceps で外側に突き出たシャフトを切断する<br/><span style={{color:'var(--color-text-muted)', fontSize:10}}>※ head plate から少しシャフトが飛び出すが、これは軟骨固定に使用する</span></li>
            </ol>
          </div>
        )}

        {/* D-3: 従来ここにあった「推定入力→正解と比較するクイズ（Size Confirmationの重複）」は
            削除した。シャフト長は前ステップ（製品選択）で既に確定済みであり、ここで再度確認
            させる必要がないため（Task Order要求④）。以下は選択済みサイズの案内のみ。 */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          💡 選択したシャフト長（<strong style={{ color: 'var(--color-text-secondary)' }}>{selected} mm</strong>）でそのまま配置を行います。
          変更する場合は「プロステーシス選択に戻る」から選び直せます。
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>← プロステーシス選択に戻る</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>
          配置調整へ →
        </button>
      </div>
    </div>
  );
}

// ─── PlacementFeedback：リアルタイム配置状況 ───────────────────────────────
interface SafePlacement {
  selectedLength: number;
  lateralOffset: number; anteriorOffset: number; verticalOffset: number;
  angleTilt: number; angleTiltZ: number;
  dragOffsetX: number; dragOffsetY: number; dragOffsetZ: number;
}

type PFLevel = 'ok' | 'warn' | 'err';

function pfLevel(absVal: number, warnT: number, errT: number): PFLevel {
  if (absVal <= warnT) return 'ok';
  if (absVal <= errT) return 'warn';
  return 'err';
}

const PF_COLOR: Record<PFLevel, string> = { ok: 'var(--color-success)', warn: 'var(--color-warning)', err: 'var(--color-error)' };
const PF_COLOR_RGB: Record<PFLevel, string> = { ok: 'var(--color-success-rgb)', warn: 'var(--color-warning-rgb)', err: 'var(--color-error-rgb)' };
const PF_TAG:   Record<PFLevel, string> = { ok: '✓ 適切', warn: '▲ 要調整', err: '✗ 要修正' };

function posHint(latDev: number, antDev: number, vertDev: number): string {
  const la = Math.abs(latDev), aa = Math.abs(antDev), va = Math.abs(vertDev);
  if (la >= aa && la >= va) return latDev > 0 ? '外側方向にずれ / 内側へ移動' : '内側方向にずれ / 外側へ移動';
  if (aa >= va)             return antDev > 0 ? '前方にずれ / 後方へ移動'    : '後方にずれ / 前方へ移動';
  return vertDev > 0 ? '上方にずれ / 下方へ移動' : '下方にずれ / 上方へ移動';
}

function PlacementFeedback({ safeP, sc }: { safeP: SafePlacement; sc: SurgicalCase }) {
  // [M-2 issue⑤] モバイルでの下部情報パネル高さ削減のため、既存の詳細調整/3D表示切替と同じ
  // アコーディオンパターンを適用する。「常時表示すべき本質情報＋折りたたみ可能な副次情報」の
  // 原則（Task Order指示）に従い、一目でわかるべき総合ステータス（配置良好/要調整/要修正の
  // バッジ）は常に表示したまま、シャフト長/設置位置/設置角度の内訳3行のみを折りたたみ対象にする
  // （情報の削除ではなく、既定折りたたみ＋タップで展開）。
  const [detailOpen, setDetailOpen] = useState(false);
  // D-2 AD-2: idealPlacement保存時はそちらを優先（未指定なら従来値へフォールバック）。
  // computeScore()と同じ解決ロジックを使い、リアルタイムフィードバックとGround Truthの
  // 不一致を防ぐ。
  const idealLateralOffset = resolveIdealLateralOffset(sc);
  const idealAngle = resolveIdealAngle(sc);
  const lengthDiff = safeP.selectedLength - sc.recommendedLength;
  const latDev  = (safeP.lateralOffset + safeP.dragOffsetX) - idealLateralOffset;
  const antDev  = safeP.anteriorOffset + safeP.dragOffsetZ;
  const vertDev = safeP.verticalOffset + safeP.dragOffsetY;
  const posErr  = Math.sqrt(latDev * latDev + antDev * antDev + vertDev * vertDev);
  const aDiff   = Math.abs(safeP.angleTilt - idealAngle);
  const rDiff   = Math.abs(safeP.angleTiltZ);

  const lv = pfLevel(Math.abs(lengthDiff), 0.25, 0.5);
  const pv = pfLevel(posErr, 0.3, 0.7);
  const av = pfLevel(aDiff + rDiff * 0.5, 5, 15);

  const lengthDetail = Math.abs(lengthDiff) < 0.01
    ? safeP.selectedLength.toFixed(2) + 'mm（推奨と一致）'
    : safeP.selectedLength.toFixed(2) + 'mm（推奨比 ' + (lengthDiff > 0 ? '+' : '') + lengthDiff.toFixed(2) + 'mm）';
  const lengthHint = lv === 'ok' ? '' : lengthDiff > 0
    ? '長すぎ / 鼓膜再建材への張力過多リスク'
    : '短すぎ / アブミ骨頭との接触が不安定';

  const posDetail = posErr < 0.01 ? '理想位置と一致'
    : '理想位置まで ' + posErr.toFixed(2) + 'mm のずれ';
  const posHintStr = pv === 'ok' ? '' : posHint(latDev, antDev, vertDev);

  const tiltFwd = safeP.angleTilt > idealAngle ? '前傾' : '後傾';
  const tiltLR  = safeP.angleTiltZ > 0 ? '右傾' : '左傾';
  const angleParts: string[] = [];
  if (aDiff >= 1) angleParts.push('前後 ' + tiltFwd + ' ' + aDiff.toFixed(0) + '°');
  if (rDiff >= 1) angleParts.push('左右 ' + tiltLR + ' ' + rDiff.toFixed(0) + '°');
  const angleDetail = aDiff < 1 && rDiff < 1 ? '適切な角度' : angleParts.join(' / ');
  const angleHint = av === 'ok' ? '' : '傾きすぎ / 音響伝達効率が低下します';

  const allLevels: PFLevel[] = [lv, pv, av];
  const overall: PFLevel = allLevels.includes('err') ? 'err' : allLevels.includes('warn') ? 'warn' : 'ok';
  const overallLabel = overall === 'ok' ? '配置良好' : overall === 'warn' ? '要調整' : '要修正';

  const rows = [
    { label: 'シャフト長', lv, detail: lengthDetail, hint: lengthHint },
    { label: '設置位置',   lv: pv, detail: posDetail,    hint: posHintStr },
    { label: '設置角度',   lv: av, detail: angleDetail,  hint: angleHint },
  ];

  return (
    <div className="card" style={{ borderColor: `rgba(${PF_COLOR_RGB[overall]},0.27)`, background: `rgba(${PF_COLOR_RGB[overall]},0.03)`, padding: '12px 14px' }}>
      <div
        onClick={() => setDetailOpen(v => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailOpen(v => !v); } }}
        aria-expanded={detailOpen}
        className="kz-focusable"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: detailOpen ? 10 : 0, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '.04em' }}>配置状況</div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'inline-block', transform: detailOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: PF_COLOR[overall], padding: '3px 10px', borderRadius: 99, background: `rgba(${PF_COLOR_RGB[overall]},0.09)` }}>
          {overallLabel}
        </div>
      </div>
      {detailOpen && rows.map((row) => (
        <div key={row.label} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: PF_COLOR[row.lv], padding: '1px 7px', borderRadius: 99, background: `rgba(${PF_COLOR_RGB[row.lv]},0.09)` }}>
              {PF_TAG[row.lv]}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>{row.detail}</div>
          {row.hint !== '' && (
            <div style={{ marginTop: 3, fontSize: 10, color: PF_COLOR[row.lv], lineHeight: 1.4 }}>{row.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 3: Placement ─────────────────────────────────────────────────────
function PlacementStep() {
  const { selectedCase, selectedProduct, placement, updatePlacement, setSimStep, computeScore, interactionFlags, markSizeTouched, markPositionTouched, markAngleTouched } = useSimStore();
  const [showIdeal, setShowIdeal] = useState(false);
  const [showCartilage, setShowCartilage] = useState(false);
  // 症例の耳小骨欠損ステータスに基づいて初期表示を設定
  const [simVis, setSimVis] = useState<VisibilityMap>(() => {
    const sc = useSimStore.getState().selectedCase;
    if (!sc) return {};
    const init: VisibilityMap = {};
    const { malleus, incus, stapes } = sc.ossicularStatus;
    if (malleus === 'absent')  init.malleus = 'hidden';
    if (incus   === 'absent')  init.incus   = 'hidden';
    // footplate-only / absent → GLBは非表示（底板ハイライトが別途表示される）
    if (stapes === 'footplate-only' || stapes === 'absent') init.stapes = 'hidden';
    return init;
  });
  const [dragMode, setDragMode] = useState<DragMode>('view');
  // Phase1 Interaction/Transport Layer（Instrument Select→Grasp→Transport→Release）用の
  // 最小状態。DragMode（既存のmove/view切替、同じくローカルuseState）と同じ前例に従い、
  // グローバルstoreへは置かない。PlacementStepが再マウントされるたび（症例切替のたび）に
  // false/falseへ戻る＝Transportは毎回新しい症例の開始時に外部位置からやり直す想定。
  const [instrumentSelected, setInstrumentSelected] = useState(false);
  const [isGrasped, setIsGrasped] = useState(false);
  const [manipulationCommitted, setManipulationCommitted] = useState(false);
  // [TEST-ONLY, 一時] Phase C-2実機検証（Architect依頼2026-08-14、Collision Boundary Warp）。
  // requestIdはボタン押下のたびにインクリメントするbump pattern（SimScene側と同じ規約）。
  // Phase C検証完了後、対応するSimScene/CollisionVerifyOverlay側のコードとまとめて削除する。
  const [collisionBoundaryWarpRequestId, setCollisionBoundaryWarpRequestId] = useState(0);
  const [collisionBoundaryWarpStatus, setCollisionBoundaryWarpStatus] = useState<string | null>(null);
  // [TEST-ONLY, 一時] Phase C-3実機検証（Architect依頼2026-08-14、Rotation Boundary Warp）。
  // 上のCollisionBoundaryWarpRequestIdと同じbump pattern。axis/directionはボタン押下時に
  // 一緒にセットする（SimScene側は最新のaxis/directionを見て探索するため、setStateの
  // バッチング順序に依存しない設計＝onClick内で3つまとめてsetする）。
  const [rotationBoundaryWarpRequestId, setRotationBoundaryWarpRequestId] = useState(0);
  const [rotationBoundaryWarpAxis, setRotationBoundaryWarpAxis] = useState<'tilt' | 'tiltZ'>('tilt');
  const [rotationBoundaryWarpDirection, setRotationBoundaryWarpDirection] = useState<1 | -1>(1);
  const [rotationBoundaryWarpStatus, setRotationBoundaryWarpStatus] = useState<string | null>(null);
  // Phase1-B ControlPad Transport対応: SimScene（子）が公開するTransport操作用コールバックを
  // 保持し、sibling（ControlPad）へ橋渡しする。transportPose/transportTilt自体の所有権は
  // SimSceneに残したまま（liftしない）、この薄いコールバックのみを中継する。
  const [transportControls, setTransportControls] = useState<TransportControls | null>(null);
  // [D-4、Implementation Specification Section 11 Requirement 4] transportControlsと同じ
  // パターン（sibling ControlPadへCollision Candidate評価済みの操作関数を公開する）。
  const [placementControls, setPlacementControls] = useState<PlacementControls | null>(null);
  const [viewMode, setViewMode] = useState<SimViewMode>('normal');
  const [vis3dOpen, setVis3dOpen] = useState(false);
  const [adjPanelOpen, setAdjPanelOpen] = useState(false);
  // [M-2 real-device follow-up、issue B root cause] 実機（iPhone Safari）でLower Information
  // Panel（PlacementFeedback/ViewPresetPanel）の開閉トリガーに到達できないという報告の実際の
  // 原因は、sidebarの一番上のカード（🔧プロステーシス留置の案内＋下記2つの[TEST-ONLY]ボタン）が
  // 442px（sidebarの可視領域260pxの1.7倍）にも達し、その下にある本来の折りたたみトリガーへ
  // 到達するのに440px超のスクロールを要していたこと（DOM実測で確認、elementFromPointによる
  // 実際のヒットテストではトリガー自体は正しく機能していた）。TEST-ONLY判定用ボタン
  // （Phase C-2実機検証用、削除は別タスク）を折りたたみ可能にして、この最大の占有源を縮小する。
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const [showCamDebug, setShowCamDebug] = useState(false);
  const [camInfo, setCamInfo] = useState<{pos:[number,number,number];target:[number,number,number]} | null>(null);

  // ── 顕微鏡モード: 視点固定/移動切替（解剖モードと同仕様）────────────
  const [microscopePositionMode, setMicroscopePositionMode] = useState(false);
  // ── 顕微鏡モード: 回転↔平行移動切替（シム専用）─────────────────────
  const [simPanMode, setSimPanMode] = useState(false);

  if (!selectedCase || !selectedProduct) return null;

  const handleConfirm = () => {
    // Phase17.3: 未操作（InteractionFlagsすべてfalse）の場合はcomputeScore()を呼ばず、
    // scoreResultをnullのまま結果画面へ進める（Phase17.1設計書「未評価と0点を混同しない」方針）。
    if (computeAssessmentStatus(interactionFlags).hasUserInteracted) {
      computeScore();
    }
    setSimStep('score');
  };

  const cycleVis = useCallback((key: StructureKey) => {
    const current: OpacityMode = simVis[key] ?? (SIM_DEFAULT_VIS[key] ?? 'solid');
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setSimVis((prev) => ({ ...prev, [key]: next }));
  }, [simVis]);

  // ⑧ ドラッグ中のダブルクリック誤発火を防ぐ
  const _simPMoved = useRef(false);
  const _simPStart = useRef({ x: 0, y: 0 });
  const simCanvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = simCanvasRef.current;
    if (!el) return;
    const dn = (e: PointerEvent) => { _simPStart.current = { x: e.clientX, y: e.clientY }; _simPMoved.current = false; };
    const mv = (e: PointerEvent) => { const dx = e.clientX - _simPStart.current.x, dy = e.clientY - _simPStart.current.y; if (dx*dx+dy*dy > 25) _simPMoved.current = true; };
    el.addEventListener('pointerdown', dn);
    el.addEventListener('pointermove', mv);
    return () => { el.removeEventListener('pointerdown', dn); el.removeEventListener('pointermove', mv); };
  }, []);
  const guardedCycleVis = useCallback((key: StructureKey) => {
    if (!_simPMoved.current) cycleVis(key);
  }, [cycleVis]);

  // (wheel zoom removed — microscope now matches anatomy mode: simple vignette + position lock)

  // 防御的な placement フィールド取得（undefined が混入しても NaN クラッシュしない）
  const safeP = {
    selectedLength: placement.selectedLength ?? 2.5,
    lateralOffset:  placement.lateralOffset  ?? 0,
    anteriorOffset: placement.anteriorOffset ?? 0,
    verticalOffset: placement.verticalOffset ?? 0,
    angleTilt:      placement.angleTilt      ?? 0,
    angleTiltZ:     placement.angleTiltZ     ?? 0,
    dragOffsetX:    placement.dragOffsetX    ?? 0,
    dragOffsetY:    placement.dragOffsetY    ?? 0,
    dragOffsetZ:    placement.dragOffsetZ    ?? 0,
  };

  // [M-2 real-device follow-up 3、issue①] 実機フィードバック（2026-08-20）: モバイルでは
  // このツールバー（移動/視点/通常/内視鏡/理想位置/軟骨/回転）を画面上部（Canvas右上）に
  // 置いたままだと、片手操作時に毎回指を画面上部まで動かす必要があり操作性が悪いとの指摘。
  // 下のTTP-VARIAC PORPカード（サイドバー最上部、親指の届く範囲）へ移設する。デスクトップは
  // 従来通りCanvas右上のToolbarContainerに残す（実機フィードバックはモバイルのみが対象）。
  // JSXを2箇所で完全に重複させると状態分岐（顕微鏡時のみの2ボタン等）がズレる危険があるため、
  // 中身を1つのローカル変数として1度だけ定義し、2箇所ではCSSクラス（.toolbar-desktop-only/
  // .toolbar-mobile-only、index.cssのモバイルメディアクエリで表示を切り替え）で出し分けるだけに
  // する——「祖先のdisplay:noneは子の実描画そのものを止める」という既知の挙動を利用し、
  // 非表示側は文字通りDOMから見えなくなる（インラインstyleとCSSクラスの優先順位問題を踏まない）。
  const toolbarRow = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--toolbar-pill-gap, var(--space-1))', flexWrap: 'nowrap',
      overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', paddingBottom: 2,
    }}>
      <PillToggleGroup<DragMode>
        ariaLabel="操作モード"
        value={dragMode}
        onChange={setDragMode}
        options={
          manipulationCommitted
            ? [
                { value: 'move', label: '移動' },
                { value: 'rotate', label: '回転' },
                { value: 'view', label: '視点' },
              ]
            : [
                { value: 'move', label: '移動' },
                { value: 'view', label: '視点' },
              ]
        }
      />
      <PillToggleGroup<SimViewMode>
        ariaLabel="視野モード"
        value={viewMode}
        onChange={(mode) => {
          setViewMode(mode);
          if (mode === 'microscope') {
            setDragMode('view');
            setMicroscopePositionMode(false);
            setSimPanMode(false);
          }
        }}
        options={[
          { value: 'normal' as SimViewMode, label: '👁 通常' },
          { value: 'endoscope' as SimViewMode, label: '🔭 内視鏡' },
        ]}
      />
      <IconButton
        aria-label="理想配置位置を表示/非表示"
        title="理想配置位置を表示/非表示"
        active={showIdeal}
        onClick={() => setShowIdeal(!showIdeal)}
        style={{ width: 'auto', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))', fontSize: 'var(--toolbar-pill-fs, 11px)', fontWeight: 700 }}
      >📍 理想位置</IconButton>
      <IconButton
        aria-label="軟骨スライスを表示/非表示"
        title="軟骨スライスを表示/非表示"
        active={showCartilage}
        onClick={() => setShowCartilage(!showCartilage)}
        style={{ width: 'auto', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))', fontSize: 'var(--toolbar-pill-fs, 11px)', fontWeight: 700 }}
      >🩺 軟骨</IconButton>

      {/* 顕微鏡時のみ — 固定/移動中 + 回転/平行移動 */}
      {viewMode === 'microscope' && (
        <>
          <IconButton
            aria-label={microscopePositionMode ? '移動モード中 — クリックで固定へ' : '固定モード — クリックで移動可へ'}
            title={microscopePositionMode ? '移動モード中 — クリックで固定へ' : '固定モード — クリックで移動可へ'}
            active={microscopePositionMode}
            onClick={() => setMicroscopePositionMode(v => !v)}
            style={{ width: 'auto', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))', fontSize: 'var(--toolbar-pill-fs, 11px)', fontWeight: 700 }}
          >
            {microscopePositionMode ? '🔓 移動中' : '🔒 固定'}
          </IconButton>
          {microscopePositionMode && (
            <IconButton
              aria-label={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
              title={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
              active={simPanMode}
              onClick={() => setSimPanMode(v => !v)}
              style={{ width: 'auto', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))', fontSize: 'var(--toolbar-pill-fs, 11px)', fontWeight: 700 }}
            >
              {simPanMode ? '↔↕ 平行移動' : '↺↻ 回転'}
            </IconButton>
          )}
        </>
      )}

      {viewMode !== 'microscope' && (
        <IconButton
          aria-label={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
          title={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
          active={simPanMode}
          onClick={() => setSimPanMode(v => !v)}
          style={{ width: 'auto', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))', fontSize: 'var(--toolbar-pill-fs, 11px)', fontWeight: 700 }}
        >
          {simPanMode ? '↔↕ 平行移動' : '↺↻ 回転'}
        </IconButton>
      )}
    </div>
  );

  return (
    <div className="layout-split" style={{ height: '100%' }}>
      {/* 3D Scene */}
      <div className="canvas-wrapper" ref={simCanvasRef}>
        {/* 内視鏡モード: 円形クリップを3Dシーンのみに適用 */}
        <div style={viewMode === 'endoscope' ? { position: 'absolute', inset: 0, clipPath: 'circle(43% at center)', background: 'black' } : { position: 'absolute', inset: 0 }}>
        <ErrorBoundary>
        <SimScene
          surgicalCase={selectedCase}
          product={selectedProduct}
          placement={safeP}
          showIdeal={showIdeal}
          showCartilage={showCartilage}
          vis={simVis}
          dragMode={dragMode}
          viewMode={viewMode}
          onStructureClick={guardedCycleVis}
          showDebugMarkers={showCamDebug}
          onCameraChange={(p, t) => setCamInfo({ pos: p, target: t })}
          scopePositionMode={microscopePositionMode}
          panMode={simPanMode}
          manipulation={{ instrumentSelected, isGrasped, committed: manipulationCommitted }}
          onDirectRelease={() => setManipulationCommitted(true)}
          onTransportControlsReady={setTransportControls}
          onPlacementControlsReady={setPlacementControls}
          collisionBoundaryWarpRequestId={collisionBoundaryWarpRequestId}
          onCollisionBoundaryWarpResult={(message) => setCollisionBoundaryWarpStatus(message)}
          rotationBoundaryWarpRequestId={rotationBoundaryWarpRequestId}
          rotationBoundaryWarpAxis={rotationBoundaryWarpAxis}
          rotationBoundaryWarpDirection={rotationBoundaryWarpDirection}
          onRotationBoundaryWarpResult={(message) => setRotationBoundaryWarpStatus(message)}
        />
        </ErrorBoundary>
        </div>{/* /endoscope clip div */}
        {/* 顕微鏡モード ビネットオーバーレイ（KURZ Design System v1: --z-vignette層） */}
        {viewMode === 'microscope' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z_INDEX.vignette,
            background: 'radial-gradient(circle at center, transparent 28%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.90) 68%, black 82%)',
          }} />
        )}
        {/* 内視鏡モード: 円形ビネット + 青みフィルター */}
        {viewMode === 'endoscope' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z_INDEX.vignette,
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.0) 36%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.88) 62%, black 72%)',
          }} />
        )}
        {viewMode === 'endoscope' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z_INDEX.vignette,
            background: 'rgba(10, 25, 60, 0.08)',
          }} />
        )}


        {/* カメラデバッグオーバーレイ（KURZ Design System v1: --z-hud層） */}
        {showCamDebug && camInfo && (
          <div style={{
            position: 'absolute', bottom: 80, left: 12, zIndex: Z_INDEX.hud, pointerEvents: 'none',
            background: 'rgba(0,0,0,.85)', padding: '6px 10px', borderRadius: 6,
            fontFamily: 'monospace', fontSize: 10, color: 'var(--color-primary)',
            backdropFilter: 'blur(4px)', border: '1px solid rgba(var(--color-primary-rgb),0.35)',
            lineHeight: 1.6,
          }}>
            <div style={{fontWeight:700, marginBottom:2, fontSize:11}}>📐 カメラ座標 (world)</div>
            <div>pos&nbsp;&nbsp;&nbsp;: [{camInfo.pos.map(v=>v.toFixed(1)).join(', ')}]</div>
            <div>target: [{camInfo.target.map(v=>v.toFixed(1)).join(', ')}]</div>
            <div style={{marginTop:4, fontSize:9, color:'rgba(255,255,255,0.5)'}}>
              🟡底板 🔵頭部 🟣臍部
            </div>
          </div>
        )}
        <div className="canvas-overlay top-left">
          {/* [M-2 real-device follow-up 7、issue③] 実機（iPhone Safari縦画面）で procedure
              タグ（青、鼓室形成型/PORP等）とlesionタグ（オレンジ、慢性穿孔性中耳炎等）が
              1本のflex-wrap行に混在しているため、症例によって3行以上に折り返り読みにくいと
              の指摘。デスクトップでは折り返さず収まっている（無変更）ため、モバイルのみ
              種類ごとに2行へグルーピングする（青=1行目、オレンジ=2行目）。ContextTagBar自体
              （StepFlowMode.tsx等、他の呼び出し元と共有）は変更せず、`wrap={false}`で本体
              (タグのみ)を取り出し、ここで2行のレイアウトを組む——共有コンポーネントの既定挙動
              には一切影響しない。 */}
          <div className="tagbar-desktop-only">
            <ContextTagBar
              procedureTags={selectedCase.tags.procedure}
              lesionTags={selectedCase.tags.lesion}
            />
          </div>
          {/* displayはここに書かず.tagbar-mobile-onlyクラス側で管理する（inline styleの
              displayがメディアクエリ上書きに常に勝つ罠、issue③/toolbar-mobile-onlyと同じ理由）。 */}
          <div className="tagbar-mobile-only" style={{ flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <ContextTagBar wrap={false} procedureTags={selectedCase.tags.procedure} lesionTags={[]} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <ContextTagBar wrap={false} procedureTags={[]} lesionTags={selectedCase.tags.lesion} />
            </div>
          </div>
        </div>
        {/* ── ツールバー: top-right（KURZ Design System v1: ToolbarContainer + PillToggleGroup） ── */}
        {/* [M-2 real-device follow-up、issue C] 実機（iPhone Safari）でこのツールバーが左上の
            ContextTagBar（.canvas-overlay.top-left、モバイルでmax-width:55%）と重なる報告あり。
            root causeはmaxWidth: 'calc(100% - 20px)'（デスクトップでは適切だが、モバイルでは
            Canvas幅のほぼ全域まで広がることを許してしまい、右上アンカーのはずが実質ほぼ全幅の
            バーになっていた——実機DOM測定で338px/359px幅のCanvasを確認）。
            var(--toolbar-container-maxwidth)へ切り出し、モバイルのみ58%へ絞ることで
            top-leftのタグと重ならない領域に収める（デスクトップは既存値のまま無変更）。 */}
        {/* [M-2 real-device follow-up 2] 実機スクリーンショットで「移動/視点」「通常/内視鏡」
            「理想位置」「軟骨」「回転」の各グループが縦に5行積みになり、Canvasの半分近くを覆う
            との指摘を受けた。全グループを1本のflex行（flexWrap:'nowrap'）にまとめ、行自体の幅を
            ToolbarContainerの実効幅（var(--toolbar-container-maxwidth)、左上ContextTagBarとの
            重なりを避けるために据え置き）に固定した上でoverflowX:'auto'を与える——4〜7個の
            コントロールが1行の視覚幅に収まらない場合は横スクロールで到達させる（タップ領域や
            フォントサイズを再び犠牲にしない、iOSのコントロールストリップ等でも一般的なパターン）。 */}
        {/* [M-2 real-device follow-up 3、issue①] このツールバーはデスクトップ/タブレットのみ
            ここ（Canvas右上）に残す。モバイルでは.toolbar-desktop-onlyがdisplay:noneとなり
            （index.css）、サイドバー最上部（下記.toolbar-mobile-only）へ完全に切り替わる。
            中身はtoolbarRow（上でローカル変数化、二重管理を避けるため）を共有する。 */}
        <div className="toolbar-desktop-only">
          <ToolbarContainer anchor="top-right" style={{ alignItems: 'flex-end', maxWidth: 'var(--toolbar-container-maxwidth, calc(100% - 20px))', padding: 'var(--space-2)' }}>
            {toolbarRow}
          </ToolbarContainer>
        </div>

        {/* Phase22.2 GUI Follow-up P1: STEP6(StepFlowMode)で確立したControlPadをSimulationMode
            にも展開（横展開、shojiさん指示「操作体系を統一する」）。既存の詳細調整(AdjRow)パネルは
            シャフト長調整を含み、ControlPadはシャフト長を扱わないため、今回はAdjRowを置き換えず
            並存させる（P1は「UI追加のみ・API/Store変更なし」の方針どおり、Small Change）。
            表示位置・zIndexはSTEP6と同一（bottom:16, left:12, Z_INDEX.toolbar）でアプリ全体の
            操作パネル位置を統一。dragModeに関わらず常時表示（translateSelectedObject/
            rotateSelectedObjectはTransformControlsの選択状態と独立した純粋なstore操作のため）。 */}
        {/* [M-2 issue②] top・bottom両方を指定することで、position:relativeな.canvas-wrapper内で
            このホストdivに確定した高さを与える（M1投資調査：旧実装はbottomのみでheight:autoだった
            ため、ControlPad展開時に.canvas-wrapperのoverflow:hiddenへ突き当たり閉じるボタンが
            クリップされていた）。ControlPad自身のmaxHeight:'100%'はこの確定高さを基準に解決され、
            それを超える分は内部スクロールへ回るため、パネル自体が.canvas-wrapperの外へはみ出さない。
            このdiv自体はpointerEvents:'none'とし、ControlPadの実描画領域だけがauto（.canvas-overlay
            と同じ既存パターン）——空の領域がCanvasのドラッグ/オービット操作を塞がないようにする。 */}
        <div style={{
          position: 'absolute', top: 12, bottom: 16, left: 12, zIndex: Z_INDEX.toolbar,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}>
          <ControlPad
            manipulationCommitted={manipulationCommitted}
            transportControls={transportControls}
            placementControls={placementControls}
            enforcePlacementCollisionGate
          />
        </div>
      </div>

      {/* Controls */}
      <div className="sidebar">
        <div className="card">
          {/* [M-2 real-device follow-up 3、issue①] モバイル専用: このカード（TTP-VARIAC PORP等の
              製品情報カード）の一番上にツールバーを移設（片手操作時の親指到達範囲、実機指摘対応）。
              デスクトップでは.toolbar-mobile-onlyがdisplay:noneのまま（index.css）で、Canvas右上の
              既存ToolbarContainerのみが表示される。 */}
          <div className="toolbar-mobile-only">{toolbarRow}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedProduct.name}</div>
            {/* [M-2 real-device follow-up 2、issue③] モバイルではステップ進行バー行から退避した
                判断クイズバッジ（.step-quiz-badge-mobile、既定display:none、モバイルのみflex）。
                デスクトップは.step-quiz-badge-desktop（ステップ進行バー行）が引き続き表示するため
                ここは常にdisplay:noneのまま。PlacementStepはSimulationMode本体のskipQuiz state
                を受け取っていないため、同じlocalStorageキーを読むloadSkipQuiz()を直接呼ぶ
                （CaseSelect後は値が変わらないため、propバケツリレーより単純で安全）。 */}
            {loadSkipQuiz() && (
              <div
                className="step-quiz-badge-mobile"
                title="設定でスキップされています。症例選択画面のトグルで解除できます。"
                style={{
                  flexShrink: 0, alignItems: 'center',
                  padding: '2px 6px', borderRadius: 999, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
                  background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)',
                }}
              >
                クイズOFF
              </div>
            )}
          </div>
          {getAnchorBasis(selectedCase) && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              再建経路: <strong style={{ color: 'var(--color-primary)' }}>{getAnchorBasis(selectedCase)}</strong>
            </div>
          )}
        </div>

        {/* [M-2 real-device follow-up、issue B] 実機（iPhone Safari）実測で、PlacementFeedback/
            ViewPresetPanel（＝「Lower Information Panel」acceptance criterionの対象）の折りたたみ
            トリガーが、この下にある案内カード・開発者検証ツール・詳細調整セクション（合計約380px）
            より後ろに置かれていたため、260px程度しかないsidebarの可視領域内では378px分の
            スクロールを経ないと到達できなかった（トリガー自体はelementFromPointで正しく機能する
            ことを確認済み——純粋な到達性の問題）。この2つを製品情報の直後、案内カード等より前へ
            移動し、スクロールなしまたは最小限のスクロールで到達できるようにする
            （情報は削除しない、位置のみ変更）。 */}
        <PlacementFeedback safeP={safeP} sc={selectedCase} />

        <div className="card" style={{ padding: '10px 12px' }}>
          <ViewPresetPanel
              collapsible
              defaultOpen={false}
              onSelectView={v => setSimCameraView(shiftViewForSim(v))}
              surgicalKeys={['overview', 'tympanic_membrane', 'tympanoplasty', 'ossicles']}
              showAnatomical={false}
              getCamera={() => {
                const c = getSimCam();
                // SIM_OFF = [2.12, 2.65, 0.84] を逆適用して未シフト座標に変換
                return {
                  pos:    [c.pos[0]-2.12, c.pos[1]-2.65, c.pos[2]-0.84] as [number,number,number],
                  target: [c.target[0]-2.12, c.target[1]-2.65, c.target[2]-0.84] as [number,number,number],
                };
              }}
            />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 4px' }}>
          <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={saveSimCam}>
            視点を保存
          </Button>
          <Button variant="ghost" size="sm" style={{ flex: 1, color: 'var(--color-text-muted)' }} onClick={resetSimCam}>
            視点リセット
          </Button>
        </div>

        <div className="card">
          {/* [M-2 real-device follow-up、issue B root cause fix] 実機（iPhone Safari）でLower
              Information Panel（PlacementFeedback/ViewPresetPanel）の開閉トリガーに到達できない
              という報告のroot causeは、以下の複数の[TEST-ONLY]開発者検証ツール（Phase C-2/C-3
              実機検証用、既存コメント参照・削除はしない）が常時展開表示され、sidebarの可視領域
              （260px程度）の1.7倍超（実機DOM測定: 442px）を占有していたこと。トグルはCommit前
              （Transport段階）・Commit後のどちらでも同じ場所からアクセスできるよう、
              `!manipulationCommitted`の条件分岐の外（カード最上部）に置く。 */}
          <div
            onClick={() => setTestToolsOpen(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTestToolsOpen(v => !v); } }}
            aria-expanded={testToolsOpen}
            className="kz-focusable"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginBottom: 10, paddingBottom: 8, borderBottom: '1px dashed rgba(255,255,255,.08)' }}
          >
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '.04em' }}>🧪 開発者検証ツール</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-block', transform: testToolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
          </div>
          {testToolsOpen && !manipulationCommitted && (
            <>
              <Button
                variant="ghost"
                size="sm"
                style={{ width: '100%', marginBottom: 8, borderStyle: 'dashed' }}
                onClick={() => {
                  updatePlacement({
                    lateralOffset: selectedCase.idealLateralOffset,
                    anteriorOffset: 0, verticalOffset: 0,
                    angleTilt: selectedCase.idealAngle, angleTiltZ: 0,
                    dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
                  });
                  setManipulationCommitted(true);
                }}
              >
                🧪 [TEST] 理想位置で配置を強制確定
              </Button>
              <Button
                variant="ghost"
                size="sm"
                style={{ width: '100%', marginBottom: 10, borderStyle: 'dashed' }}
                onClick={() => {
                  setCollisionBoundaryWarpStatus('探索中…');
                  setCollisionBoundaryWarpRequestId((n) => n + 1);
                }}
              >
                🧪 [TEST] Collision境界直前へワープ（Bone手前・非衝突）
              </Button>
            </>
          )}

          {/* ── Phase1-B: Direct Manipulation UX（既定、DIRECT_MANIPULATION_UX=true）──
              committed(=留置済み)になるまでは3Dビュー上にプロステーシスが「術野の外」にある。
              Prosthesisを直接クリック→ドラッグ→離す（release）だけで留置される
              （Select/Grasp/Releaseボタンの中間ステップは廃止、SimScene.tsx側の
              DirectTransportProsthesis + onDirectReleaseが実際のCommitを行う）。 */}
          {DIRECT_MANIPULATION_UX && !manipulationCommitted && (
            <div className="card" style={{ marginBottom: 'var(--space-3)', border: '1px solid rgba(0,180,216,0.35)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-primary)' }}>
                🔧 プロステーシス留置
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                プロステーシスは現在、術野の外（Transport位置）にあります。3Dビューでプロステーシスを直接クリックしてドラッグし、留置位置で離してください。
              </div>
            </div>
          )}

          {/* [TEST-ONLY, 一時] Collision Boundary Warpのステータス表示。上のボタンを含むカードとは
              あえて別ブロックにしている: ワープ成功時はonWarp内でmanipulationCommittedがtrueになり
              上のカード（!manipulationCommitted条件）が同じレンダーで消えるため、カード内に置くと
              成功/失敗メッセージが1フレームも表示されずに消えてしまう（実機確認で発覚した不具合、
              2026-08-14修正）。manipulationCommittedの値に関わらず独立して表示させることで解消する。 */}
          {DIRECT_MANIPULATION_UX && collisionBoundaryWarpStatus && (
            <div className="card" style={{ marginBottom: 'var(--space-3)', border: '1px dashed rgba(0,180,216,0.35)', fontSize: 10, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              🧪 [TEST] Collision Boundary Warp: {collisionBoundaryWarpStatus}
            </div>
          )}

          {/* ── Phase1 Interaction/Transport Layer: Instrument Select → Grasp → Release ──
              DIRECT_MANIPULATION_UX flag OFF時のみ表示する旧UI（a2247d5相当、完全復帰用）。
              committed(=Release実行済み)になるまでは3Dビュー上にプロステーシスが「術野の外」
              にあり、既存のPlacement操作（3Dドラッグ/矢印キー/ControlPad/理想位置ボタン等）は
              まだ対象となる実体を持たない。Releaseが押されるとPlacementState（dragOffsetX/Y/Z）
              へ一度だけCommitされ（SimScene.tsx側）、以降はこのカードが消えて既存UIのみになる。 */}
          {!DIRECT_MANIPULATION_UX && !manipulationCommitted && (
            <div className="card" style={{ marginBottom: 'var(--space-3)', border: '1px solid rgba(0,180,216,0.35)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-primary)' }}>
                🔧 器具操作
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                プロステーシスは現在、術野の外（Transport位置）にあります。器具を選択→把持→3Dビューでドラッグして移動→解放の順に操作してください。
              </div>
              <Button
                variant={instrumentSelected ? 'ghost' : 'primary'}
                size="sm"
                disabled={instrumentSelected}
                style={{ width: '100%', marginBottom: 6 }}
                onClick={() => setInstrumentSelected(true)}
              >
                {instrumentSelected ? '✓ 器具選択済み（鑷子）' : '① 器具を選択（鑷子）'}
              </Button>
              <Button
                variant={isGrasped ? 'ghost' : 'primary'}
                size="sm"
                disabled={!instrumentSelected || isGrasped}
                style={{ width: '100%', marginBottom: 6 }}
                onClick={() => setIsGrasped(true)}
              >
                {isGrasped ? '✓ 把持中 — 3Dビューでドラッグして移動' : '② 把持する'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!isGrasped}
                style={{ width: '100%' }}
                onClick={() => setManipulationCommitted(true)}
              >
                ③ 解放（留置位置へ）
              </Button>
            </div>
          )}

          {/* ── スナップ + リセット ── */}
          <Button
            variant="primary"
            style={{ width: '100%', marginBottom: 'var(--space-2)', letterSpacing: '.02em' }}
            onClick={() => updatePlacement({
              // D-2 AD-2: idealPlacement保存時はそちらを優先（未指定なら従来のidealLateralOffset/
              // idealAngleへフォールバック）。Scoring/理想ゴーストと同じ解決ロジックを使うことで、
              // このボタンで飛ぶ先が常にGround Truthと一致することを保証する。
              lateralOffset: resolveIdealLateralOffset(selectedCase),
              anteriorOffset: 0, verticalOffset: 0,
              angleTilt: resolveIdealAngle(selectedCase), angleTiltZ: 0,
              dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
            })}
          >
            理想位置に配置
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{ width: '100%', marginBottom: 'var(--space-4)' }}
            onClick={() => updatePlacement({
              lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0,
              angleTilt: 0, angleTiltZ: 0,
              dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
            })}
          >
            ↺ すべてリセット
          </Button>

          {/* [TEST-ONLY, 一時] Phase C-3実機検証（Architect依頼2026-08-14、Rotation Boundary
              Warp）。Collision Boundary Warp（Translation）と異なり、Placement段階
              （manipulationCommitted=true、Shift+矢印キーが有効な状態）で完結する操作のため
              manipulationCommittedには一切触れない。軸(tilt/tiltZ)・方向(+/-)はshojiさんが
              3D Viewer目視で「Boneへ近づく方向」を確認して選ぶ想定（SimScene.tsx/
              CollisionVerifyOverlay.tsx のRotationBoundaryWarpTracker参照）。Phase C-3検証
              完了後もC-2の前例（Collision Boundary Warp）に倣い、恒久的なテストツールとして
              温存する想定。 */}
          {/* [M-2 real-device follow-up、issue B] このカードも🔧プロステーシス留置カードの2ボタンと
              同じ「開発者検証ツール」に分類されるTEST-ONLYブロック（既存コメント参照、恒久的な
              テストツールとして温存する想定・削除はしない）。Placement Commit後に表示される
              ため、Commit前のtestToolsOpen（同じstate）と合わせて一貫した「開発者検証ツール」
              トグルの下に畳み、Commit後もsidebarの大半を占有しないようにする。 */}
          {manipulationCommitted && testToolsOpen && (
            <div className="card" style={{ marginBottom: 'var(--space-3)', border: '1px dashed rgba(0,180,216,0.35)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                🧪 [TEST] Rotation Boundary Warp（Bone手前・非衝突角度へ）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['tilt', 'tiltZ'] as const).map((axis) => (
                  <div key={axis} style={{ display: 'flex', gap: 4 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ flex: 1, borderStyle: 'dashed', fontSize: 10, padding: '2px 4px' }}
                      onClick={() => {
                        setRotationBoundaryWarpAxis(axis);
                        setRotationBoundaryWarpDirection(1);
                        setRotationBoundaryWarpStatus('探索中…');
                        setRotationBoundaryWarpRequestId((n) => n + 1);
                      }}
                    >
                      {axis === 'tilt' ? 'tilt(↑↓) +' : 'tiltZ(←→) +'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ flex: 1, borderStyle: 'dashed', fontSize: 10, padding: '2px 4px' }}
                      onClick={() => {
                        setRotationBoundaryWarpAxis(axis);
                        setRotationBoundaryWarpDirection(-1);
                        setRotationBoundaryWarpStatus('探索中…');
                        setRotationBoundaryWarpRequestId((n) => n + 1);
                      }}
                    >
                      {axis === 'tilt' ? 'tilt(↑↓) −' : 'tiltZ(←→) −'}
                    </Button>
                  </div>
                ))}
              </div>
              {rotationBoundaryWarpStatus && (
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 6, wordBreak: 'break-all' }}>
                  {rotationBoundaryWarpStatus}
                </div>
              )}
            </div>
          )}

          {/* ── 詳細調整（H2-b: 既定折りたたみ。3Dドラッグを一次操作、数値微調整は二次操作として序列化） ── */}
          <div
            onClick={() => setAdjPanelOpen(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdjPanelOpen(v => !v); } }}
            aria-expanded={adjPanelOpen}
            className="kz-focusable"
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none', margin:'10px 0 8px', borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:10 }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.04em' }}>
              詳細調整 ▸ シャフト長・位置・傾斜の数値微調整
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-block', transform: adjPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
          </div>
          {!adjPanelOpen && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              3Dドラッグで位置・角度を調整できます。ミリ単位の最終合わせ込みが必要な場合はここを開いてください。
            </div>
          )}
          {adjPanelOpen && (
            <>
          {/* ── シャフト長 ── */}
          <AdjRow
            label="シャフト長"
            value={`${safeP.selectedLength.toFixed(1)} mm`}
            onStep={(d) => {
              const lengths = selectedProduct.shaftLengths;
              const cur = safeP.selectedLength;
              const next = parseFloat((cur + d).toFixed(1));
              if (next >= lengths[0] && next <= lengths[lengths.length - 1]) {
                updatePlacement({ selectedLength: next });
                markSizeTouched();
              }
            }}
            steps={[{ label: '−0.25', d: -0.25 }, { label: '+0.25', d: 0.25 }]}
          />

          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', margin: '10px 0 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.04em', paddingTop: 8 }}>
            位置調整（mm）
          </div>

          {/* ── 位置 3軸 ── */}
          {([
            { key: 'lateralOffset'  as const, label: '内外側', neg: '内', pos: '外', dragKey: 'dragOffsetX' as const },
            { key: 'anteriorOffset' as const, label: '前後',   neg: '後', pos: '前', dragKey: 'dragOffsetZ' as const },
            { key: 'verticalOffset' as const, label: '上下',   neg: '下', pos: '上', dragKey: 'dragOffsetY' as const },
          ]).map(({ key, label, neg, pos, dragKey }) => {
            const total = safeP[key] + safeP[dragKey];
            return (
              <AdjRow
                key={key}
                label={label}
                value={
                  total > 0.005 ? `${pos} ${total.toFixed(2)}` :
                  total < -0.005 ? `${neg} ${(-total).toFixed(2)}` : '0.00'
                }
                onStep={(d) => { updatePlacement({ [key]: Math.max(-3, Math.min(3, safeP[key] + d)) }); markPositionTouched(); }}
                steps={[
                  { label: `−0.1`, d: -0.1 },
                  { label: `+0.1`, d:  0.1 },
                ]}
              />
            );
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', margin: '10px 0 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.04em', paddingTop: 8 }}>
            傾斜調整（°）
          </div>

          {/* ── 傾斜 2軸 ── */}
          {([
            { key: 'angleTilt'  as const, label: '前後傾斜', neg: '後', pos: '前' },
            { key: 'angleTiltZ' as const, label: '左右傾斜', neg: '左', pos: '右' },
          ]).map(({ key, label, neg, pos }) => {
            const val = safeP[key];
            return (
              <AdjRow
                key={key}
                label={label}
                value={val === 0 ? '0°' : val > 0 ? `${pos} ${val}°` : `${neg} ${-val}°`}
                onStep={(d) => { updatePlacement({ [key]: Math.max(-180, Math.min(180, safeP[key] + d)) }); markAngleTouched(); }}
                steps={[
                  { label: `−5°`, d: -5 },
                  { label: `+5°`, d:  5 },
                ]}
              />
            );
          })}

          {/* ドラッグリセット（ドラッグ済みの場合のみ表示）*/}
          {(safeP.dragOffsetX !== 0 || safeP.dragOffsetY !== 0 || safeP.dragOffsetZ !== 0) && (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4, fontSize: 11 }}
              onClick={() => updatePlacement({ dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0 })}>
              ドラッグをリセット
            </button>
          )}
            </>
          )}
        </div>

        {/* 3D 表示切替 */}
        <div className="card">
          <div
            onClick={() => setVis3dOpen(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVis3dOpen(v => !v); } }}
            aria-expanded={vis3dOpen}
            className="kz-focusable"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="section-title" style={{ margin: 0 }}>3D 表示切替</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-block', transform: vis3dOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
          </div>
          {vis3dOpen && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 8 }}>
                クリックまたは3Dダブルクリックで 実体 → 半透明 → 非表示 を切替
              </div>
              {SIM_VIS_ITEMS.map(({ key, label, color }) => {
                const mode: OpacityMode = simVis[key] ?? (SIM_DEFAULT_VIS[key] ?? 'solid');
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: mode === 'hidden' ? 0.2 : mode === 'ghost' ? 0.5 : 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: mode === 'hidden' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{label}</span>
                    </div>
                    <button
                      onClick={() => cycleVis(key)}
                      style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: MODE_BG[mode], color: MODE_FG[mode], minWidth: 52 }}
                    >
                      {MODE_LABEL[mode]}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <Button variant="ghost" onClick={() => setSimStep('product-select')}>← 戻る</Button>
          <Button variant="primary" onClick={handleConfirm}>評価する →</Button>
        </div>
      </div>
    </div>
  );
}

// ── Safety Score カード（Phase20.5、Phase20.5.1でscoreResultの未評価ゲートから独立） ──
// Placement Score（scoreResultの有無・interactionFlags）とは無関係に、safetyScoreが算出済み
// （SimScene.tsxのuseEffect、Phase20.4c）であれば常に表示できるよう単独コンポーネント化する。
export interface SafetyScoreCardProps {
  safetyScore:    number | null;
  safetyAlerts:   DangerAlert[];
  safetyFeedback: SafetyFeedback[]; // Phase21.2で型同期、Phase21.3でclinicalNote/complicationの表示に対応
}
export function SafetyScoreCard({ safetyScore, safetyAlerts, safetyFeedback }: SafetyScoreCardProps) {
  const worstLevel = safetyAlerts.some((a) => a.level === 'danger')
    ? 'danger'
    : safetyAlerts.length > 0 ? 'warning' : null;
  const safetyColor = worstLevel === 'danger' ? 'var(--color-error)'
    : worstLevel === 'warning' ? 'var(--color-warning)'
    : 'var(--color-success)';
  return (
    <div className="card">
      <div className="section-title">安全性評価（Safety Score）</div>
      {safetyScore === null ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          未評価（配置画面を一度も開いていないため未算出です）
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>危険部位への近接度に基づく評価（配置精度とは別軸）</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: safetyColor }}>
              {safetyScore}<span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 3 }}>/ 100</span>
            </span>
          </div>
          {safetyAlerts.length === 0 ? (
            <Alert tone="success">
              <div style={{ fontSize: 12 }}>危険部位への接近は検出されませんでした。</div>
            </Alert>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {safetyAlerts.map((a, i) => {
                const feedback = safetyFeedback[i];
                return (
                  <Alert key={a.dangerZoneId} tone={a.level === 'danger' ? 'error' : 'warning'}>
                    <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                      <div>
                        {`${feedback?.nameJa ?? a.nameJa}まで${(feedback?.distanceMm ?? a.distanceMm).toFixed(1)}mm`}
                      </div>
                      {feedback?.clinicalNote && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                            なぜ危険か
                          </div>
                          <div>{feedback.clinicalNote}</div>
                        </div>
                      )}
                      {feedback?.complication && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                            想定される合併症
                          </div>
                          <div>{feedback.complication}</div>
                        </div>
                      )}
                    </div>
                  </Alert>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Step 4: Score ────────────────────────────────────────────────────────
function ScoreStep() {
  const { selectedCase, selectedProduct, placement, scoreResult, judgmentResult, resetSimulation, setSimStep, setScreen,
    // Phase20.5: Safety Score/Feedback。scoreResult（Placement Score）とは完全に独立した別軸の値
    // （Phase20設計方針、[[phase20-safety-foundation]]参照）。SimScene.tsxのuseEffect（Phase20.4c）で
    // 配置が変わるたびに継続更新されるため、ここでは読み取るだけで良い。
    safetyScore, safetyAlerts, safetyFeedback } = useSimStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [scoreDetailOpen, setScoreDetailOpen] = useState(false);
  // Phase14.1: React StrictMode(開発時)はuseEffectを1マウントにつき2回実行するため、
  // このrefで「このマウントで既にLearning Flowを記録したか」を管理し、二重記録を防ぐ
  // (Refはコンポーネントインスタンスが同一である限りStrictModeの2回実行をまたいで保持される)。
  const learningFlowRecordedRef = useRef(false);

  useEffect(() => {
    if (scoreResult && selectedCase && selectedProduct) {
      const entry: HistoryEntry = {
        date: new Date().toISOString(),
        caseTitle: selectedCase.title,
        productName: selectedProduct.name,
        total: scoreResult.total,
        rank: scoreResult.rank,
        sizeScore: scoreResult.sizeScore,
        positionScore: scoreResult.positionScore,
        angleScore: scoreResult.angleScore,
        stabilityScore: scoreResult.stabilityScore,
      };
      const updated = pushHistory(entry);
      setHistory(updated);

      // Phase14.1: Learning Flow入口（Phase14_ApplicationIntegrationLayer_API設計_v1.0.md）。
      // 既存のスコア履歴記録（上記）とは独立した副作用として追加するのみで、既存のスコア表示・
      // 履歴機能には一切影響しない（try/catchで隔離、失敗しても上記の表示は継続する）。
      // 保存先（Zustand slice等）はPhase14.3で決定するため、現時点ではconsole出力のみで動作確認
      // する（GUI表示はPhase14.4以降）。
      if (!learningFlowRecordedRef.current) {
        learningFlowRecordedRef.current = true;
        try {
          const caseSession = createSessionFromCaseCompletion({
            sessionId: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
            caseId: selectedCase.id,
          });
          // Phase15.5: Interaction Evidence（Phase15.2 useLearningEvidenceStore、学習モードで
          // 記録された構造物クリック集合）をLearningSessionへ反映する。既存の
          // createSessionFromCaseCompletion()は無変更のまま、その戻り値へ独立API
          // appendLearningEvidenceToSession()（Phase15.3）を追加適用するのみ
          // （shojiさんPhase15.2レビュー指定「createSessionFromCaseCompletion()は変更禁止」を継続遵守）。
          const learningSession = appendLearningEvidenceToSession(
            caseSession,
            useLearningEvidenceStore.getState().clickedTeachingNoteIds,
          );
          // Phase14.2: Assessment接続 → Phase14.3: Recommendation接続 + LearningHistory蓄積。
          // AdaptiveLearningPlanの生成はここでは行わない（ダッシュボード側が表示時に都度導出する、
          // Phase14_ApplicationIntegrationLayer_API設計_v1.0.md§4・useLearningHistoryStoreのコメント参照）。
          const assessment = assessLearningSession(learningSession);
          const recommendation = recommendFromAssessment(assessment);
          useLearningHistoryStore.getState().addEntry({ assessment, recommendation });
          console.info('[applicationIntegration] session recorded:', summarizeSession(learningSession));
          // Phase15.5: この症例へInteraction Evidenceを反映し終えたのでstoreをクリアする
          // （shojiさん指定「症例完了後にclear」。次の症例では学習モードでの新規クリックのみが
          // 反映される。反映前に例外が発生した場合はcatch節でclearせず証拠を保持する）。
          useLearningEvidenceStore.getState().clear();
        } catch (e) {
          console.warn('[applicationIntegration] failed to record learning session', e);
        }
      }
    } else {
      setHistory(loadHistory());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selectedCase || !selectedProduct) return null;

  // Phase17.3: 未操作（scoreResult===null）の場合は「未評価」表示のみ行う
  // （Phase17.1設計書§3、"未評価"と"0点"を混同しない）。既存の操作済みフロー（下記）は無変更。
  if (!scoreResult) {
    return (
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
        <Alert tone="info">
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>未評価</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              インプラント設置操作が行われていないため、今回のスコアは算出されません。
            </div>
          </div>
        </Alert>
        <Button style={{ marginTop: 16 }} onClick={() => setSimStep('placement')}>設置画面へ戻る</Button>
        {/* Phase20.5.1: Safety ScoreはPlacement Scoreの未評価ゲートとは独立した別軸のため、
            interactionFlagsに関係なく表示する（配置画面を開いていればsafetyScoreは算出済み）。 */}
        <div style={{ marginTop: 16 }}>
          <SafetyScoreCard safetyScore={safetyScore} safetyAlerts={safetyAlerts} safetyFeedback={safetyFeedback} />
        </div>
      </div>
    );
  }

  const RANK_COLOR: Record<string, string> = { S: 'var(--color-rank-s)', A: 'var(--color-success)', B: 'var(--color-primary)', C: 'var(--color-warning)', D: 'var(--color-error)' };
  const abg = scoreResult.abgPrediction;
  const ABG_COLOR: Record<string, string> = { excellent: 'var(--color-success)', good: 'var(--color-primary)', fair: 'var(--color-warning)', poor: 'var(--color-error)' };
  const ABG_COLOR_RGB: Record<string, string> = { excellent: 'var(--color-success-rgb)', good: 'var(--color-primary-rgb)', fair: 'var(--color-warning-rgb)', poor: 'var(--color-error-rgb)' };
  const abgColor = abg ? ABG_COLOR[abg.successCategory] : 'var(--color-success)';
  const abgColorRgb = abg ? ABG_COLOR_RGB[abg.successCategory] : 'var(--color-success-rgb)';

  const SCORE_ITEMS = [
    { label: 'サイズ選択',  score: scoreResult.sizeScore,      max: 25, color: 'var(--color-primary)' },
    { label: '設置位置',    score: scoreResult.positionScore,  max: 25, color: 'var(--color-success)' },
    { label: '設置角度',    score: scoreResult.angleScore,     max: 25, color: 'var(--color-warning)' },
    { label: '安定性',      score: scoreResult.stabilityScore, max: 25, color: '#f08050' },
  ];

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
      {/* ── ABG改善量グラフ（主評価指標）── */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 14 }}>
          術後ABG改善予測　|　{selectedCase.title}
        </div>
        {abg ? (
          <>
            {/* 改善バー */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', width: 32, textAlign: 'right', flexShrink: 0 }}>術前</div>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: 'rgba(255,255,255,0.18)', borderRadius: 5 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', width: 42, flexShrink: 0, textAlign: 'right' }}>
                  {selectedCase?.preOpAbg ?? 30} dB
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', width: 32, textAlign: 'right', flexShrink: 0 }}>術後</div>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((abg.postOpAbg / (selectedCase?.preOpAbg ?? 30)) * 100)}%`,
                    background: abgColor,
                    borderRadius: 5,
                    transition: 'width .8s ease',
                  }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: abgColor, width: 42, flexShrink: 0, textAlign: 'right' }}>
                  {abg.postOpAbg} dB
                </div>
              </div>
            </div>
            {/* 数値行 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <ScoreStat label="ABG改善量" value={`−${abg.improvementDb}`} unit="dB" color={abgColor} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ padding: '5px 14px', borderRadius: 999, background: `rgba(${abgColorRgb},0.13)`, border: `1px solid rgba(${abgColorRgb},0.40)`, fontSize: 13, fontWeight: 700, color: abgColor, marginBottom: 8, display: 'inline-block' }}>
                  {{ excellent: '優秀', good: '良好', fair: '可', poor: '要改善' }[abg.successCategory]}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {scoreResult.total}<span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 3 }}>/ 100</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: `rgba(${abgColorRgb},0.06)`, borderLeft: `3px solid rgba(${abgColorRgb},0.53)`, fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.6, fontWeight: 500 }}>
              {abg.clinicalInterpretation}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
              ※ {selectedProduct.name} {placement.selectedLength}mm　/ Austin (1994), Merchant (2003) 文献値ベース
            </div>
          </>
        ) : (
          <div style={{ padding: '12px 0' }}>
            <ScoreStat
              label="総合スコア"
              value={String(scoreResult.total)}
              unit="/ 100"
              caption={`${selectedCase.title}　|　${selectedProduct.name} ${placement.selectedLength}mm`}
            />
          </div>
        )}
      </div>

      {/* ── Safety Score（Phase20.5、Placement Scoreとは独立した別軸の評価。Phase20.5.1でコンポーネント化） ── */}
      <SafetyScoreCard safetyScore={safetyScore} safetyAlerts={safetyAlerts} safetyFeedback={safetyFeedback} />

      <div className="card">
        <div className="section-title">評価詳細</div>
        {SCORE_ITEMS.map(({ label, score, max, color }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 700, color }}>{score} / {max}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(score / max) * 100}%`, background: color, borderRadius: 3, transition: 'width .6s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── 総合レビューカード（P4） ── */}
      {(() => {
        const scoreItems = [
          { key: 'size',     label: 'サイズ選択', score: scoreResult.sizeScore,      max: 25,
            goodNote: '適切なシャフト長を選択。過長・過短による押出しや振動伝達不良のリスクを回避できました。',
            improveTip: 'サイザーで鼓膜グラフト下面〜アブミ骨頭部（PORP）または底板（TORP）の距離を実測し、0.25mm単位で選択します。' },
          { key: 'position', label: '設置位置',   score: scoreResult.positionScore,  max: 25,
            goodNote: 'プロステーシスの中心位置が解剖学的に適切。アブミ骨との接触面積が最大化されています。',
            improveTip: 'フット中心をアブミ骨頭部／底板の中心に合わせ、外側・内側へのずれを最小化します。' },
          { key: 'angle',    label: '設置角度',   score: scoreResult.angleScore,     max: 25,
            goodNote: '設置角度が鼓膜〜アブミ骨軸に沿っており、振動伝達効率が高い状態です。',
            improveTip: '鼓膜面に対してシャフトが垂直に近い角度が理想です。前後・左右の傾きを確認してください。' },
          { key: 'stability',label: '安定性',     score: scoreResult.stabilityScore, max: 25,
            goodNote: 'プロステーシスが安定設置されており、術後の位置ずれリスクが低い状態です。',
            improveTip: '設置後に軽く触れて安定性を確認します。TTP-VARIACはBELLエキスパンダーを適切に展開してください。' },
        ];
        const goodItems = scoreItems.filter(s => s.score === s.max);
        const worstItem = [...scoreItems].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];
        if (goodItems.length === 0 && worstItem.score === worstItem.max) return null;
        return (
          <div className="card" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="section-title" style={{ marginBottom: 12 }}>総合レビュー</div>
            {goodItems.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  良かった点
                </div>
                <Feedback items={goodItems.map(item => ({ tone: 'positive' as const, text: `${item.label}：${item.goodNote}` }))} />
              </div>
            )}
            {worstItem.score < worstItem.max && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-warning)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  次回意識するポイント
                </div>
                <Feedback items={[{ tone: 'improvement' as const, text: `${worstItem.label}（${worstItem.score}/${worstItem.max}点）：${worstItem.improveTip}` }]} />
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 詳細情報（L2: 既定折りたたみ。学習ポイント/判断結果/スコア履歴は参照情報として二次表示） ── */}
      <div
        onClick={() => setScoreDetailOpen(v => !v)}
        className="card kz-focusable"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setScoreDetailOpen(v => !v); } }}
        aria-expanded={scoreDetailOpen}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none', padding:'12px 16px' }}
      >
        <div className="section-title" style={{ margin: 0 }}>詳細情報（フィードバック・学習ポイント・スコア履歴）</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-block', transform: scoreDetailOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
      </div>
      {scoreDetailOpen && (
        <>
      {scoreResult.feedback.length > 0 && (
        <div className="card">
          <div className="section-title">フィードバック</div>
          {scoreResult.feedback.map((fb, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.6 }}>
              ⚠ {fb}
            </div>
          ))}
        </div>
      )}

      {selectedCase && selectedCase.teachingPoints.length > 0 && (
        <LearningPanel title="📚 この症例から学ぶこと">
          <div style={{ font: 'var(--text-small)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
            {selectedCase.clinicalNotes}
          </div>
          <TeachingPointList points={selectedCase.teachingPoints} />
        </LearningPanel>
      )}

      {judgmentResult && (
        <div className="card">
          <div className="section-title">適応判断 結果</div>
          {[
            { label: '鼓室形成型', correct: judgmentResult.typeCorrect, answer: judgmentResult.typeAnswer },
            { label: 'プロステーシス', correct: judgmentResult.productCorrect, answer: judgmentResult.productAnswer },
          ].map(({ label, correct, answer }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: correct ? 'var(--color-success)' : 'var(--color-error)' }}>{correct ? '✅ 正解' : '❌ 不正解'}</span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>（{answer}）</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div className="section-title">スコア履歴（直近{Math.min(history.length, MAX_HISTORY)}件）</div>

          {/* サマリ行：前回比 + ベストスコア */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {history.length > 1 && (() => {
              const trend = history[0].total - history[1].total;
              const tColor = trend > 0 ? 'var(--color-success)' : trend < 0 ? 'var(--color-error)' : 'var(--color-text-muted)';
              return (
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 3 }}>前回比</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: tColor }}>
                    {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '→ 変化なし'}
                  </div>
                </div>
              );
            })()}
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 3 }}>ベスト</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-rank-s)' }}>
                {Math.max(...history.map(h => h.total))}点
              </div>
            </div>
          </div>

          {/* ミニバーチャート（古→新、左→右） */}
          {history.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: 12, padding: '0 2px' }}>
              {[...history.slice(0, 5)].reverse().map((h, i, arr) => {
                const color = RANK_COLOR[h.rank] ?? 'var(--color-text-muted)';
                const isLatest = i === arr.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 8, color: isLatest ? color : 'var(--color-text-muted)', fontWeight: 700, marginBottom: 1 }}>{h.total}</div>
                    <div style={{
                      width: '100%',
                      height: `${Math.max(4, h.total)}%`,
                      background: color,
                      borderRadius: '2px 2px 0 0',
                      opacity: isLatest ? 1 : 0.45,
                    }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* エントリーリスト */}
          {history.slice(0, 5).map((h, i) => {
            const trend = i < history.length - 1 ? h.total - history[i + 1].total : null;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                <div>
                  <span style={{ color: RANK_COLOR[h.rank] ?? 'var(--color-text-muted)', fontWeight: 700, marginRight: 8 }}>{h.rank}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{h.caseTitle.slice(0, 18)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {trend !== null && (
                    <span style={{ fontSize: 10, color: trend > 0 ? 'var(--color-success)' : trend < 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                      {trend > 0 ? `↑${trend}` : trend < 0 ? `↓${-trend}` : '–'}
                    </span>
                  )}
                  <span style={{ fontWeight: 700 }}>{h.total}点</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

        </>
      )}

      {/* ── 次の推奨症例 ── */}
      {(() => {
        const score = scoreResult.total;
        const currentDiff = selectedCase.difficulty;
        const currentId   = selectedCase.id;

        // 推奨ロジック: 低スコア→同症例、中→同難易度別症例、高→上難易度
        let nextCase: SurgicalCase | undefined;
        let reason = '';

        if (score < 60) {
          nextCase = selectedCase;
          reason = 'スコアアップを目指してもう一度チャレンジ';
        } else {
          const nextDiff = score >= 80 && currentDiff !== 'advanced'
            ? (currentDiff === 'beginner' ? 'intermediate' : 'advanced')
            : currentDiff;
          // D-3 AD-3: 推奨候補も教育UIの3症例に限定する（15症例プールから非表示症例を
          // 提示してしまわないように）。
          const educationCases = getEducationCases();
          nextCase = educationCases.find(c => c.difficulty === nextDiff && c.id !== currentId);
          if (!nextCase) nextCase = educationCases.find(c => c.id !== currentId);
          reason = score >= 80 && currentDiff !== 'advanced'
            ? `高スコア達成！次の難易度（${nextDiff}）に挑戦`
            : '同難易度の別症例で定着度を確認';
        }

        if (!nextCase) return null;

        const diffColor: Record<string, { solid: string; rgb: string }> = {
          beginner: { solid: 'var(--color-success)', rgb: 'var(--color-success-rgb)' },
          intermediate: { solid: 'var(--color-warning)', rgb: 'var(--color-warning-rgb)' },
          advanced: { solid: 'var(--color-error)', rgb: 'var(--color-error-rgb)' },
        };
        const diffLabel: Record<string, string> = { beginner: '入門', intermediate: '中級', advanced: '上級' };
        const dc = diffColor[nextCase.difficulty] ?? diffColor.intermediate;

        return (
          <div style={{
            margin: '0 4px 8px',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(0,80,120,0.18) 0%, rgba(0,40,80,0.12) 100%)',
            border: '1px solid rgba(var(--color-primary-rgb),0.2)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '.05em', marginBottom: 10 }}>
              次の推奨症例
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                  {nextCase.title}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                    background: `rgba(${dc.rgb},0.13)`,
                    border: `1px solid rgba(${dc.rgb},0.31)`,
                    color: dc.solid,
                  }}>{diffLabel[nextCase.difficulty] ?? nextCase.difficulty}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{reason}</div>
              </div>
            </div>
            <button
              onClick={() => {
                const { setSelectedCase, resetSimulation } = useSimStore.getState();
                resetSimulation();
                setSelectedCase(nextCase!);
              }}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(var(--color-primary-rgb),0.18)', color: 'var(--color-primary)',
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.02em',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.30)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.18)'; }}
            >
              この症例を始める →
            </button>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 4px 24px' }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>← やり直す</Button>
        <Button variant="ghost" style={{ flex: 1 }} onClick={() => resetSimulation()}>別の症例へ</Button>
        <Button variant="primary" style={{ flex: 1 }} onClick={() => setScreen('stepflow')}>🎬 手術フローへ</Button>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────

const SIM_STEPS = [
  { id: 'case-select',    label: '症例選択' },
  { id: 'judgment',       label: '適応判断' },
  { id: 'product-select', label: '製品選択' },
  { id: 'shaft-estimate', label: 'サイズ' },
  { id: 'placement',      label: '配置調整' },
  { id: 'score',          label: '評価' },
] as const;

export function SimulationMode() {
  const { simStep, selectedProduct } = useSimStore();
  const [skipQuiz, setSkipQuiz] = useState<boolean>(loadSkipQuiz);
  const handleSkipToggle = () => {
    const next = !skipQuiz;
    setSkipQuiz(next);
    saveSkipQuiz(next);
  };
  // D-3: Soft Clip（type==='PISTON'）はAC Sizerステップ（shaft-estimate）を経由しないため、
  // 進行バーからもそのステップを外す（実際には訪れないステップが「完了」表示されるのを防ぐ）。
  // simStep自体の型・switch分岐は無変更 — 表示用のリストだけを絞り込む。
  const isSoftClip = selectedProduct?.type === 'PISTON';
  const visibleSimSteps = isSoftClip ? SIM_STEPS.filter(s => s.id !== 'shaft-estimate') : SIM_STEPS;
  const currentIdx = visibleSimSteps.findIndex(s => s.id === simStep);

  const stepContent = (() => {
    switch (simStep) {
      case 'case-select':     return <CaseSelect skipQuiz={skipQuiz} onToggleSkip={handleSkipToggle} />;
      case 'judgment':        return <JudgmentStep />;
      case 'product-select':  return <ProductSelect />;
      case 'shaft-estimate':  return <ShaftEstimateStep />;
      case 'placement':       return <PlacementStep />;
      case 'score':           return <ScoreStep />;
      default:                return <CaseSelect skipQuiz={skipQuiz} onToggleSkip={handleSkipToggle} />;
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)' }}>
      {/* ── 6ステップ プログレスバー（KURZ Design System v1: 共通StepProgress） ──
          [M-2 real-device follow-up 2、issue③] 実機スクリーンショットで「製品選択」「サイズ」の
          先まで見切れる（画面右端で見えなくなる）ことを確認。root causeはこの行が
          justify-content:space-betweenのflex行で、幅を持て余さない限りStepProgress自身の
          flex-wrapが働かず、6ステップ分のラベル幅がバッジ分の余白を差し引いた残り幅を
          超えると水平方向に溢れてしまうこと。バッジ（判断クイズ: OFF）をこの行から完全に外し
          （モバイルではsidebar側、issue②で圧縮済みの製品情報カードの下に小さく再配置——デスクトップは
          従来通りこの位置に残す、.step-quiz-badge-desktopクラスで表示切替）、StepProgress自体は
          overflowX:'auto'による横スクロールへフォールバックさせることで、6ステップすべてに
          （スクロールしてでも）到達可能にする——ラベルの短縮や情報の削減はしない。 */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 16px',
        height: 36, borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <StepProgress
          items={visibleSimSteps.map((s, i) => ({
            key: s.id,
            label: s.label,
            status: i < currentIdx ? 'done' as const : i === currentIdx ? 'current' as const : 'upcoming' as const,
          }))}
        />
        {skipQuiz && (
          <div
            className="step-quiz-badge-desktop"
            title="設定でスキップされています。症例選択画面のトグルで解除できます。"
            style={{
              // [M-2 real-device follow-up 2、issue③] displayはここに書かず.step-quiz-badge-desktop
              // クラス側（index.css）に置く——inline styleのdisplay:'flex'はCSSクラスの
              // display:noneメディアクエリ上書きより常に優先されてしまい、モバイルでバッジが
              // 非表示にならない不具合が実機検証で判明したため。
              flexShrink: 0, alignItems: 'center', marginLeft: 'var(--space-3)',
              padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700,
              background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)',
            }}
          >
            判断クイズ: OFF（設定）
          </div>
        )}
      </div>
      {/* ── ステップコンテンツ ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: simStep === 'placement' ? 'hidden' : 'auto' }}>
        {stepContent}
      </div>
    </div>
  );
}
