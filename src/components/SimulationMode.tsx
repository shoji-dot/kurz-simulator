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
          height: '100%', padding: 32, color: '#ff8080', textAlign: 'center',
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
import { useSimStore, type JudgmentResult } from '../store/useSimStore';
import { surgicalCases, type SurgicalCase } from '../data/cases';
import { kurzProducts } from '../data/products';
import { SimScene, SIM_DEFAULT_VIS, type DragMode, type SimViewMode, saveSimCam, resetSimCam, setSimCameraView, getSimCam } from '../scenes/SimScene';
import { ViewPresetPanel } from './ViewPresetPanel';
import { shiftViewForSim, SURGICAL_VIEWS } from '../scenes/ViewPresets';
import {
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';
import { Button, IconButton, PillToggleGroup, ToolbarContainer, StepProgress, LearningPanel, TeachingPointList, ScoreStat, Feedback, Z_INDEX } from './ui';

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

// ── シミュレーション用表示切替アイテム ─────────────────────────────
const SIM_VIS_ITEMS: { key: StructureKey; label: string; color: string; indent?: boolean }[] = [
  { key: 'bone',          label: '側頭骨',    color: '#f2ead8' },
  { key: 'malleus',       label: 'ツチ骨',    color: '#e6a93a', indent: true },
  { key: 'incus',         label: 'キヌタ骨',  color: '#d9892a', indent: true },
  { key: 'stapes',          label: 'アブミ骨',  color: '#f2cb54', indent: true },
  { key: 'stapesFootplate', label: '底板',      color: '#00e5ff', indent: true },
  { key: 'tympanic',        label: '鼓膜',      color: '#f8d8c0' },
  { key: 'innerEar',      label: '内耳',      color: '#60b8e0' },
  { key: 'facialNerve',   label: '顔面神経',  color: '#f5d820' },
  { key: 'chordaTympani', label: '鼓索神経',  color: '#f0b830' },
  { key: 'eac',           label: '外耳道',    color: '#d8c8a0' },
  { key: 'roundWindow',   label: '正円窓',    color: '#5888a8' },
];

const CYCLE: OpacityMode[] = ['solid', 'ghost', 'hidden'];
const MODE_LABEL: Record<OpacityMode, string> = { solid: '実体', ghost: '半透明', hidden: '非表示' };
const MODE_BG: Record<OpacityMode, string> = {
  solid:  'var(--accent)',
  ghost:  'rgba(0,180,216,0.30)',
  hidden: 'rgba(255,255,255,0.07)',
};
const MODE_FG: Record<OpacityMode, string> = {
  solid:  '#001a20',
  ghost:  '#7dd8e8',
  hidden: '#555',
};


// ── コンテキストタグバー ──────────────────────────────────────────
interface ContextTagBarProps {
  procedureTags: string[];
  lesionTags: string[];
  style?: CSSProperties;
}
function ContextTagBar({ procedureTags, lesionTags, style }: ContextTagBarProps) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
      ...style,
    }}>
      {procedureTags.map(t => (
        <span key={t} style={{
          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(0,180,216,0.18)', color: '#7dd8e8',
          border: '1px solid rgba(0,180,216,0.35)', letterSpacing: '.02em',
        }}>{t}</span>
      ))}
      {lesionTags.map(t => (
        <span key={t} style={{
          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(255,209,102,0.15)', color: '#ffd166',
          border: '1px solid rgba(255,209,102,0.35)', letterSpacing: '.02em',
        }}>{t}</span>
      ))}
    </div>
  );
}

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
function AdjRow({
  label, value, onStep, steps,
}: {
  label: string;
  value: string;
  onStep: (d: number) => void;
  steps: { label: string; d: number }[];
}) {
  const btnStyle = (i: number): CSSProperties => ({
    flex: 1,
    padding: '8px 4px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,.12)',
    background: i < steps.length / 2 ? 'rgba(255,120,80,.1)' : 'rgba(80,200,120,.1)',
    color: i < steps.length / 2 ? '#ff9060' : '#60e090',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background .1s',
  });
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', minWidth: 60, textAlign: 'right' }}>{value}</span>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {steps.map(({ label: l, d }, i) => (
          <button key={l} style={btnStyle(i)} onClick={() => onStep(d)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Case selection ───────────────────────────────────────────────
function CaseSelect({ skipQuiz, onToggleSkip }: { skipQuiz: boolean; onToggleSkip: () => void }) {
  const { selectedCase, setSelectedCase, setSimStep } = useSimStore();
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const filtered = diffFilter === 'all' ? surgicalCases : surgicalCases.filter(c => c.difficulty === diffFilter);

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>症例選択</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
        練習する手術症例を選んでください。実際の耳小骨連鎖の状態が3Dで示されます。
      </p>

      {/* 難易度フィルター */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',          label: 'すべて', count: surgicalCases.length },
          { key: 'beginner',     label: '初級',   count: surgicalCases.filter(c => c.difficulty === 'beginner').length },
          { key: 'intermediate', label: '中級',   count: surgicalCases.filter(c => c.difficulty === 'intermediate').length },
          { key: 'advanced',     label: '上級',   count: surgicalCases.filter(c => c.difficulty === 'advanced').length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setDiffFilter(key)}
            style={{
              padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: diffFilter === key ? 700 : 400,
              border: `1px solid ${diffFilter === key ? 'var(--accent)' : 'var(--border)'}`,
              background: diffFilter === key ? 'rgba(0,180,216,0.18)' : 'rgba(255,255,255,0.04)',
              color: diffFilter === key ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {label} <span style={{ opacity: 0.6 }}>({count})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((c) => {
          const isSelected = selectedCase?.id === c.id;
          return (
            <div
              key={c.id}
              className={`selectable-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedCase(c)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className={`badge ${diffBadge[c.difficulty]}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{diffLabel[c.difficulty]}</span>
              </div>
              {isSelected && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, marginBottom: 8 }}>{c.description}</p>
                  <ContextTagBar procedureTags={c.tags.procedure} lesionTags={c.tags.lesion} style={{ marginBottom: 6 }} />
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
          <div
            onClick={onToggleSkip}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
              background: skipQuiz ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
              transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: skipQuiz ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left .2s',
            }} />
          </div>
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
          <div className="section-title" style={{ color: 'var(--accent)', marginBottom: 12 }}>
            🔬 術前解剖確認
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            {selectedCase.title}に進む前に、以下の解剖構造を3Dビューで確認してください。
          </div>
          {focusStructures.map(s => (
            <div key={s.key} style={{
              padding: '10px 14px', marginBottom: 8, borderRadius: 8,
              background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.25)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {s.reason}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
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
      border: `1px solid ${selected === opt ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
      background: selected === opt ? 'rgba(0,180,216,0.15)' : 'rgba(255,255,255,0.04)',
      color: selected === opt ? 'var(--accent)' : 'var(--text-secondary)',
      fontSize: 13, fontWeight: selected === opt ? 700 : 400,
      transition: 'all .15s',
    });

    return (
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
        {/* 症例サマリ */}
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>症例情報</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
              const color = status === 'intact' ? '#4ade80' : status === 'absent' || status === 'footplate-only' ? '#ff6666' : '#ffd166';
              return (
                <div key={bone} style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: `${color}18`, border: `1px solid ${color}55`, color,
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
            <div key={opt} style={optionStyle(opt, typeSelected)} onClick={() => setTypeSelected(opt)}>
              {opt}
            </div>
          ))}
        </div>

        {/* Q2: プロステーシス種別 */}
        <div className="card">
          <div className="section-title">Q2. 適切なプロステーシス種類は？</div>
          {productOptions.map(opt => (
            <div key={opt} style={optionStyle(opt, productSelected)} onClick={() => setProductSelected(opt)}>
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
      background: correct ? 'rgba(74,222,128,0.08)' : 'rgba(255,100,100,0.08)',
      border: `1px solid ${correct ? 'rgba(74,222,128,0.35)' : 'rgba(255,100,100,0.35)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{correct ? '✅' : '❌'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: correct ? '#4ade80' : '#ff8080' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        あなたの回答：<span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{answer}</span>
        {!correct && (
          <span> → 正解：<span style={{ color: '#4ade80', fontWeight: 700 }}>{correct_answer}</span></span>
        )}
      </div>
      {!correct && explanation && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: 11, color: '#fbbf24', lineHeight: 1.65,
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
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, letterSpacing: '.04em' }}>
              💡 学習ポイント
            </div>
            {selectedCase.teachingPoints.map((tp, i) => (
              <div key={i} style={{ padding: '7px 12px', marginBottom: 6, borderRadius: 7, background: 'rgba(0,180,216,0.06)', borderLeft: '2px solid rgba(0,180,216,0.3)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {tp}
              </div>
            ))}
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
  const { selectedCase, selectedProduct, placement, setSelectedProduct, setSimStep, updatePlacement } = useSimStore();
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
        <div className="card" style={{ marginBottom: 16, background: 'rgba(0,180,216,.05)', borderColor: 'rgba(0,180,216,.2)' }}>
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
                className={`selectable-card ${isSelected ? 'selected' : ''}`}
                onClick={() => { setSelectedProduct(p); setSelectedLength(placement.selectedLength); }}
                style={isRecommended ? { borderColor: 'rgba(74,222,128,.4)' } : undefined}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    {isRecommended && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px',
                        borderRadius: 10, background: 'rgba(74,222,128,.15)',
                        color: '#4ade80', border: '1px solid rgba(74,222,128,.3)',
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
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>選択根拠：</span>{p.selectionRationale}
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
                  background: 'rgba(255,200,100,.07)', border: '1px solid rgba(255,200,100,.25)',
                  borderTop: 'none', borderRadius: '0 0 8px 8px', fontSize: 12, lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 600, color: '#ffd166', marginBottom: 4 }}>
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
                <div style={{ padding: '12px 14px', background: 'rgba(0,180,216,.08)', border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginTop: isWrongChoice ? 0 : -2 }}>
                  <div className="section-title" style={{ marginBottom: 8 }}>シャフト長を選択</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.shaftLengths.map((l) => (
                      <button
                        key={l}
                        onClick={(e) => { e.stopPropagation(); setSelectedLength(l); updatePlacement({ selectedLength: l }); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: selectedLength === l ? '2px solid var(--accent)' : '1px solid var(--border-bright)',
                          background: selectedLength === l ? 'var(--accent)' : 'transparent',
                          color: selectedLength === l ? '#fff' : 'var(--text-secondary)',
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
          onClick={() => setSimStep('shaft-estimate')}
        >
          次へ: サイズ確認 →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2.5: Shaft Length Estimation ────────────────────────────────────
function ShaftEstimateStep() {
  const { selectedCase, selectedProduct, placement, updatePlacement, setSimStep } = useSimStore();
  const [estimated, setEstimated] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sizerGuideOpen, setSizerGuideOpen] = useState(false);

  if (!selectedCase || !selectedProduct) return null;

  const recommended = selectedCase.recommendedLength;
  const selected    = placement.selectedLength;
  const diff        = estimated !== null ? Math.abs(estimated - recommended) : null;

  // 推定精度評価
  const getEstimateGrade = (d: number) => {
    if (d <= 0.5) return { label: '優秀', color: '#4ade80', comment: '臨床的に許容範囲内の推定です。' };
    if (d <= 1.0) return { label: '良好', color: '#60b8e0', comment: '1mm以内の誤差。術中サイザーで微調整できます。' };
    if (d <= 1.5) return { label: '要改善', color: '#ffd166', comment: '1.5mm以上の誤差。術前CT計測を再確認してください。' };
    return { label: '不十分', color: '#ff6666', comment: '2mm以上の誤差。音伝達効率に影響します。シャフト長の計測方法を復習してください。' };
  };

  // 長さ候補（選択製品のshaftLengthsを使用）
  const lengthOptions = selectedProduct.shaftLengths;

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, maxHeight: 'none', paddingBottom: 40 }}>
      <div className="card">
        <div className="section-title" style={{ color: 'var(--accent)', marginBottom: 12 }}>
          📏 シャフト長 推定トレーニング
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          術中サイザーを使う前に、CT所見と症例情報から<strong style={{ color: 'var(--text-primary)' }}>何mmが最適か</strong>を推定してください。
        </div>

        {/* 症例参考情報 */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>症例参考情報</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {selectedCase.clinicalNotes}
          </div>
        </div>

        {/* AC サイザー使用ガイド（M4: 概要3行＋詳細アコーディオン） */}
        <div style={{ padding:'12px 14px', borderRadius:8, background:'rgba(0,100,80,0.12)', border:'1px solid rgba(0,200,150,0.25)', marginBottom:16 }}>
          <div
            onClick={() => setSizerGuideOpen(v => !v)}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' }}
          >
            <div style={{ fontSize:11, fontWeight:700, color:'#4de8b8', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{fontSize:14}}>📐</span> ACサイザー使用手順
            </div>
            <span style={{ fontSize:11, color:'#4de8b8', display:'inline-block', transform: sizerGuideOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▾</span>
          </div>
          {/* 概要3行（常時表示） */}
          <div style={{ fontSize:10, color:'#8899aa', lineHeight:1.7, marginTop:8 }}>
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
            <rect x="54" y="40" width="12" height="30" rx="2" fill="none" stroke="#4de8b8" strokeWidth="1.5" />
            <line x1="48" y1="40" x2="72" y2="40" stroke="#4de8b8" strokeWidth="1.2" />
            <line x1="48" y1="70" x2="72" y2="70" stroke="#4de8b8" strokeWidth="1.2" />
            {/* 双方向矢印 */}
            <line x1="78" y1="40" x2="78" y2="70" stroke="#ffd166" strokeWidth="1.2" />
            <polygon points="78,36 75,43 81,43" fill="#ffd166" />
            <polygon points="78,74 75,67 81,67" fill="#ffd166" />
            <text x="84" y="57" fontSize="9" fill="#ffd166" fontWeight="bold">L mm</text>
            {/* 目盛り */}
            {[0,1,2,3,4,5].map((i) => null)}
            <line x1="56" y1="45" x2="60" y2="45" stroke="#4de8b8" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="50" x2="60" y2="50" stroke="#4de8b8" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="55" x2="60" y2="55" stroke="#4de8b8" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="60" x2="60" y2="60" stroke="#4de8b8" strokeWidth="0.8" opacity="0.6" />
            <line x1="56" y1="65" x2="60" y2="65" stroke="#4de8b8" strokeWidth="0.8" opacity="0.6" />
            {/* テキスト説明 */}
            <text x="105" y="22" fontSize="8.5" fill="#c8e0f0" fontWeight="600">ACサイザー計測手順</text>
            <text x="105" y="36" fontSize="8" fill="#8899aa">① サイザーを鼓膜グラフト下面に当てる</text>
            <text x="105" y="48" fontSize="8" fill="#8899aa">② 下端をアブミ骨頭（PORP）または</text>
            <text x="105" y="58" fontSize="8" fill="#8899aa">　 底板（TORP）まで伸ばす</text>
            <text x="105" y="70" fontSize="8" fill="#8899aa">③ 目盛りを読み、0.25mm単位で記録</text>
            <text x="105" y="82" fontSize="8" fill="#4de8b8">④ 読んだ値 = シャフト長の基準</text>
          </svg>
            </>
          )}
          {submitted && (
            <div style={{ textAlign:'right', marginTop: sizerGuideOpen ? 0 : 10 }}>
              <div style={{ fontSize:9, color:'#4de8b8', marginBottom:2 }}>この症例の正解</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#4ade80' }}>{recommended} mm</div>
            </div>
          )}
        </div>


        {/* TTP-VARIAC シャフト長調整手順（Soft Clip 以外・詳細アコーディオン展開時のみ表示） */}
        {selectedProduct.id !== 'soft-clip-stapes' && sizerGuideOpen && (
          <div style={{ padding:'12px 14px', borderRadius:8, background:'rgba(0,60,120,0.14)', border:'1px solid rgba(0,140,220,0.28)', marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#60b8f8', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{fontSize:14}}>🔧</span> TTP-VARIAC® シャフト長調整手順（サイザーディスク使用）
            </div>
            <ol style={{ margin:0, padding:'0 0 0 16px', fontSize:11, color:'#8899aa', lineHeight:1.8 }}>
              <li>Micro Scissors でサイザーを shaft 付着部から切り取り、中耳腔に挿入する</li>
              <li>Head plate を鼓膜・ツチ骨柄側、foot part をアブミ骨側（PORP: 頭部 / TORP: 底板）に位置合わせする</li>
              <li>軟骨補強を使用する場合は軟骨の厚さを考慮して最適な長さを決定する</li>
              <li>プロステーシスを生食で湿らし、Titanium Tweezers で head plate を持って、<span style={{color:'#60b8f8', fontWeight:600}}>目的の長さの溝にシャフトを挿入する</span></li>
              <li>Micro Closing Forceps で head plate を固定する<br/><span style={{color:'#ffd166'}}>（INSIDE 面を head plate 内側に、OUTSIDE 面を外側に合わせて挟む）</span></li>
              <li>Cutting Forceps で外側に突き出たシャフトを切断する<br/><span style={{color:'var(--text-muted)', fontSize:10}}>※ head plate から少しシャフトが飛び出すが、これは軟骨固定に使用する</span></li>
            </ol>
          </div>
        )}

        {/* 推定入力（まだ未回答の場合） */}
        {!submitted ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10 }}>
              あなたの推定サイズを選択してください：
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {lengthOptions.map(l => (
                <button
                  key={l}
                  onClick={() => setEstimated(l)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                    border: `2px solid ${estimated === l ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
                    background: estimated === l ? 'rgba(0,180,216,0.18)' : 'rgba(255,255,255,0.04)',
                    color: estimated === l ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all .15s',
                  }}
                >
                  {l} mm
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={estimated === null}
              style={{ width: '100%', opacity: estimated !== null ? 1 : 0.4 }}
              onClick={() => setSubmitted(true)}
            >
              推定を確定する
            </button>
          </>
        ) : (
          /* 推定後フィードバック */
          <>
            {diff !== null && (() => {
              const grade = getEstimateGrade(diff);
              return (
                <div style={{ padding: '14px 16px', borderRadius: 8, background: `${grade.color}10`, border: `1px solid ${grade.color}40`, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>あなたの推定</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: grade.color }}>{estimated} mm</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>術中実測値（正解）</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80' }}>{recommended} mm</div>
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 999, background: `${grade.color}22`, border: `1px solid ${grade.color}55`, fontSize: 12, fontWeight: 700, color: grade.color }}>
                      {grade.label}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    誤差：<strong style={{ color: grade.color }}>{diff === 0 ? '±0 mm（完全一致）' : `${diff.toFixed(1)} mm`}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {grade.comment}
                  </div>
                </div>
              );
            })()}

            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              💡 実際に選択したサイズ（<strong style={{ color: 'var(--text-secondary)' }}>{selected} mm</strong>）で配置を行います。
              推定と異なる場合は「プロステーシス選択に戻る」で変更できます。
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>← プロステーシス選択に戻る</button>
        {submitted && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>
            配置調整へ →
          </button>
        )}
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

const PF_COLOR: Record<PFLevel, string> = { ok: '#4ade80', warn: '#ffd166', err: '#ff6666' };
const PF_TAG:   Record<PFLevel, string> = { ok: '✓ 適切', warn: '▲ 要調整', err: '✗ 要修正' };

function posHint(latDev: number, antDev: number, vertDev: number): string {
  const la = Math.abs(latDev), aa = Math.abs(antDev), va = Math.abs(vertDev);
  if (la >= aa && la >= va) return latDev > 0 ? '外側方向にずれ / 内側へ移動' : '内側方向にずれ / 外側へ移動';
  if (aa >= va)             return antDev > 0 ? '前方にずれ / 後方へ移動'    : '後方にずれ / 前方へ移動';
  return vertDev > 0 ? '上方にずれ / 下方へ移動' : '下方にずれ / 上方へ移動';
}

function PlacementFeedback({ safeP, sc }: { safeP: SafePlacement; sc: SurgicalCase }) {
  const lengthDiff = safeP.selectedLength - sc.recommendedLength;
  const latDev  = (safeP.lateralOffset + safeP.dragOffsetX) - sc.idealLateralOffset;
  const antDev  = safeP.anteriorOffset + safeP.dragOffsetZ;
  const vertDev = safeP.verticalOffset + safeP.dragOffsetY;
  const posErr  = Math.sqrt(latDev * latDev + antDev * antDev + vertDev * vertDev);
  const aDiff   = Math.abs(safeP.angleTilt - sc.idealAngle);
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

  const tiltFwd = safeP.angleTilt > sc.idealAngle ? '前傾' : '後傾';
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
    <div className="card" style={{ borderColor: PF_COLOR[overall] + '44', background: PF_COLOR[overall] + '08', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '.04em' }}>配置状況</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: PF_COLOR[overall], padding: '3px 10px', borderRadius: 99, background: PF_COLOR[overall] + '18' }}>
          {overallLabel}
        </div>
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: PF_COLOR[row.lv], padding: '1px 7px', borderRadius: 99, background: PF_COLOR[row.lv] + '18' }}>
              {PF_TAG[row.lv]}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{row.detail}</div>
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
  const { selectedCase, selectedProduct, placement, updatePlacement, setSimStep, computeScore } = useSimStore();
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
  const [viewMode, setViewMode] = useState<SimViewMode>('normal');
  const [vis3dOpen, setVis3dOpen] = useState(false);
  const [adjPanelOpen, setAdjPanelOpen] = useState(false);
  const [showCamDebug, setShowCamDebug] = useState(false);
  const [camInfo, setCamInfo] = useState<{pos:[number,number,number];target:[number,number,number]} | null>(null);

  // ── 顕微鏡モード: 視点固定/移動切替（解剖モードと同仕様）────────────
  const [microscopePositionMode, setMicroscopePositionMode] = useState(false);
  // ── 顕微鏡モード: 回転↔平行移動切替（シム専用）─────────────────────
  const [simPanMode, setSimPanMode] = useState(false);

  if (!selectedCase || !selectedProduct) return null;

  const handleConfirm = () => {
    computeScore();
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
            fontFamily: 'monospace', fontSize: 10, color: '#7dd8e8',
            backdropFilter: 'blur(4px)', border: '1px solid rgba(0,180,216,0.35)',
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
          <ContextTagBar
            procedureTags={selectedCase.tags.procedure}
            lesionTags={selectedCase.tags.lesion}
          />
        </div>
        {/* ── ツールバー: top-right（KURZ Design System v1: ToolbarContainer + PillToggleGroup） ── */}
        <ToolbarContainer anchor="top-right" style={{ alignItems: 'flex-end', maxWidth: 'calc(100% - 20px)', padding: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <PillToggleGroup<DragMode>
              ariaLabel="操作モード"
              value={dragMode}
              onChange={setDragMode}
              options={[
                { value: 'move', label: '移動' },
                { value: 'view', label: '視点' },
              ]}
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
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <IconButton
                aria-label="理想配置位置を表示/非表示"
                title="理想配置位置を表示/非表示"
                active={showIdeal}
                onClick={() => setShowIdeal(!showIdeal)}
                style={{ width: 'auto', height: 'auto', whiteSpace: 'nowrap', padding: 'var(--space-1) var(--space-3)', fontSize: 11, fontWeight: 700 }}
              >📍 理想位置</IconButton>
              <IconButton
                aria-label="軟骨スライスを表示/非表示"
                title="軟骨スライスを表示/非表示"
                active={showCartilage}
                onClick={() => setShowCartilage(!showCartilage)}
                style={{ width: 'auto', height: 'auto', whiteSpace: 'nowrap', padding: 'var(--space-1) var(--space-3)', fontSize: 11, fontWeight: 700 }}
              >🩺 軟骨</IconButton>
            </div>
          </div>

          {/* 顕微鏡時のみ — 固定/移動中 + 回転/平行移動 */}
          {viewMode === 'microscope' && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <IconButton
                aria-label={microscopePositionMode ? '移動モード中 — クリックで固定へ' : '固定モード — クリックで移動可へ'}
                title={microscopePositionMode ? '移動モード中 — クリックで固定へ' : '固定モード — クリックで移動可へ'}
                active={microscopePositionMode}
                onClick={() => setMicroscopePositionMode(v => !v)}
                style={{ width: 'auto', height: 'auto', whiteSpace: 'nowrap', padding: 'var(--space-1) var(--space-3)', fontSize: 11, fontWeight: 700 }}
              >
                {microscopePositionMode ? '🔓 移動中' : '🔒 固定'}
              </IconButton>
              {microscopePositionMode && (
                <IconButton
                  aria-label={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
                  title={simPanMode ? '平行移動モード中 — クリックで回転へ' : '回転モード中 — クリックで平行移動へ'}
                  active={simPanMode}
                  onClick={() => setSimPanMode(v => !v)}
                  style={{ width: 'auto', height: 'auto', whiteSpace: 'nowrap', padding: 'var(--space-1) var(--space-3)', fontSize: 11, fontWeight: 700 }}
                >
                  {simPanMode ? '↔↕ 平行移動' : '↺↻ 回転'}
                </IconButton>
              )}
            </div>
          )}
        </ToolbarContainer>
      </div>

      {/* Controls */}
      <div className="sidebar">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{selectedProduct.name}</div>

          {/* ── スナップ + リセット ── */}
          <Button
            variant="primary"
            style={{ width: '100%', marginBottom: 'var(--space-2)', letterSpacing: '.02em' }}
            onClick={() => updatePlacement({
              lateralOffset: selectedCase.idealLateralOffset,
              anteriorOffset: 0, verticalOffset: 0,
              angleTilt: selectedCase.idealAngle, angleTiltZ: 0,
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

          {/* ── 詳細調整（H2-b: 既定折りたたみ。3Dドラッグを一次操作、数値微調整は二次操作として序列化） ── */}
          <div
            onClick={() => setAdjPanelOpen(v => !v)}
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
              if (next >= lengths[0] && next <= lengths[lengths.length - 1])
                updatePlacement({ selectedLength: next });
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
                onStep={(d) => updatePlacement({ [key]: Math.max(-3, Math.min(3, safeP[key] + d)) })}
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
                onStep={(d) => updatePlacement({ [key]: Math.max(-180, Math.min(180, safeP[key] + d)) })}
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

        {/* ── リアルタイム教育フィードバック ── */}
        <PlacementFeedback safeP={safeP} sc={selectedCase} />

        {/* ── 視点プリセット ── */}
        <div className="card" style={{ padding: '10px 12px' }}>
          <div className="section-title" style={{ marginBottom: 8, fontSize: 11 }}>視点プリセット</div>
          <ViewPresetPanel
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

        {/* ── 視点保存 ── */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 4px' }}>
          <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={saveSimCam}>
            視点を保存
          </Button>
          <Button variant="ghost" size="sm" style={{ flex: 1, color: 'var(--color-text-muted)' }} onClick={resetSimCam}>
            視点リセット
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <Button variant="ghost" onClick={() => setSimStep('product-select')}>← 戻る</Button>
          <Button variant="primary" onClick={handleConfirm}>評価する →</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Score ────────────────────────────────────────────────────────
function ScoreStep() {
  const { selectedCase, selectedProduct, placement, scoreResult, judgmentResult, resetSimulation, setSimStep, setScreen } = useSimStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [scoreDetailOpen, setScoreDetailOpen] = useState(false);

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
    } else {
      setHistory(loadHistory());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scoreResult || !selectedCase || !selectedProduct) return null;

  const RANK_COLOR: Record<string, string> = { S: '#ffd700', A: '#00e5ff', B: '#69ff69', C: '#ffaa44', D: '#ff6666' };
  const abg = scoreResult.abgPrediction;
  const ABG_COLOR: Record<string, string> = { excellent: '#4ade80', good: '#60b8e0', fair: '#ffd166', poor: '#ff6666' };
  const abgColor = abg ? ABG_COLOR[abg.successCategory] : '#4ade80';

  const SCORE_ITEMS = [
    { label: 'サイズ選択',  score: scoreResult.sizeScore,      max: 25, color: '#60b8e0' },
    { label: '設置位置',    score: scoreResult.positionScore,  max: 25, color: '#4ade80' },
    { label: '設置角度',    score: scoreResult.angleScore,     max: 25, color: '#ffd166' },
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
                <div style={{ padding: '5px 14px', borderRadius: 999, background: abgColor + '22', border: `1px solid ${abgColor}66`, fontSize: 13, fontWeight: 700, color: abgColor, marginBottom: 8, display: 'inline-block' }}>
                  {{ excellent: '優秀', good: '良好', fair: '可', poor: '要改善' }[abg.successCategory]}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {scoreResult.total}<span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 3 }}>/ 100</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: `${abgColor}10`, borderLeft: `3px solid ${abgColor}88`, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 500 }}>
              {abg.clinicalInterpretation}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
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
        className="card"
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
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: correct ? '#4ade80' : '#ff8080' }}>{correct ? '✅ 正解' : '❌ 不正解'}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>（{answer}）</span>
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
              const tColor = trend > 0 ? '#4ade80' : trend < 0 ? '#ff6666' : 'var(--text-muted)';
              return (
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>前回比</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: tColor }}>
                    {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '→ 変化なし'}
                  </div>
                </div>
              );
            })()}
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>ベスト</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffd700' }}>
                {Math.max(...history.map(h => h.total))}点
              </div>
            </div>
          </div>

          {/* ミニバーチャート（古→新、左→右） */}
          {history.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: 12, padding: '0 2px' }}>
              {[...history.slice(0, 5)].reverse().map((h, i, arr) => {
                const color = RANK_COLOR[h.rank] ?? '#888';
                const isLatest = i === arr.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 8, color: isLatest ? color : 'var(--text-muted)', fontWeight: 700, marginBottom: 1 }}>{h.total}</div>
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
                  <span style={{ color: RANK_COLOR[h.rank] ?? '#aaa', fontWeight: 700, marginRight: 8 }}>{h.rank}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{h.caseTitle.slice(0, 18)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {trend !== null && (
                    <span style={{ fontSize: 10, color: trend > 0 ? '#4ade80' : trend < 0 ? '#ff6666' : 'var(--text-muted)' }}>
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
          nextCase = surgicalCases.find(c => c.difficulty === nextDiff && c.id !== currentId);
          if (!nextCase) nextCase = surgicalCases.find(c => c.id !== currentId);
          reason = score >= 80 && currentDiff !== 'advanced'
            ? `高スコア達成！次の難易度（${nextDiff}）に挑戦`
            : '同難易度の別症例で定着度を確認';
        }

        if (!nextCase) return null;

        const diffColor: Record<string, string> = { beginner: '#06d6a0', intermediate: '#ffd166', advanced: '#ff6b6b' };
        const diffLabel: Record<string, string> = { beginner: '入門', intermediate: '中級', advanced: '上級' };

        return (
          <div style={{
            margin: '0 4px 8px',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(0,80,120,0.18) 0%, rgba(0,40,80,0.12) 100%)',
            border: '1px solid rgba(0,180,216,0.2)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00b4d8', letterSpacing: '.05em', marginBottom: 10 }}>
              次の推奨症例
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>
                  {nextCase.title}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                    background: `${diffColor[nextCase.difficulty] ?? '#888'}20`,
                    border: `1px solid ${diffColor[nextCase.difficulty] ?? '#888'}50`,
                    color: diffColor[nextCase.difficulty] ?? '#888',
                  }}>{diffLabel[nextCase.difficulty] ?? nextCase.difficulty}</span>
                </div>
                <div style={{ fontSize: 11, color: '#4a6a8a', lineHeight: 1.5 }}>{reason}</div>
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
                background: 'rgba(0,180,216,0.18)', color: '#00b4d8',
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.02em',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.30)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.18)'; }}
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
  const { simStep } = useSimStore();
  const [skipQuiz, setSkipQuiz] = useState<boolean>(loadSkipQuiz);
  const handleSkipToggle = () => {
    const next = !skipQuiz;
    setSkipQuiz(next);
    saveSkipQuiz(next);
  };
  const currentIdx = SIM_STEPS.findIndex(s => s.id === simStep);

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
      {/* ── 6ステップ プログレスバー（KURZ Design System v1: 共通StepProgress） ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        height: 36, borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0,
      }}>
        <StepProgress
          items={SIM_STEPS.map((s, i) => ({
            key: s.id,
            label: s.label,
            status: i < currentIdx ? 'done' as const : i === currentIdx ? 'current' as const : 'upcoming' as const,
          }))}
        />
        {skipQuiz && (
          <div
            title="設定でスキップされています。症例選択画面のトグルで解除できます。"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center',
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
