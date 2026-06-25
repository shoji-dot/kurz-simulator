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
import { SimScene, SIM_DEFAULT_VIS, type DragMode, saveSimCam, resetSimCam, setSimCameraView } from '../scenes/SimScene';
import { ViewPresetPanel } from './ViewPresetPanel';
import { shiftViewForSim } from '../scenes/ViewPresets';
import {
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';

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
function CaseSelect() {
  const { selectedCase, setSelectedCase, setSimStep } = useSimStore();
  const [diffFilter, setDiffFilter] = useState<string>('all');
  const [skipQuiz, setSkipQuiz] = useState<boolean>(loadSkipQuiz);

  const handleSkipToggle = () => {
    const next = !skipQuiz;
    setSkipQuiz(next);
    saveSkipQuiz(next);
  };

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</span>
                <span className={`badge ${diffBadge[c.difficulty]}`}>{diffLabel[c.difficulty]}</span>
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
            onClick={handleSkipToggle}
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

/** recommendedProductId からプロテーゼ種別を導出 */
function deriveProsthesisType(productId: string): string {
  if (productId.includes('torp')) return 'TORP';
  if (productId.includes('soft-clip')) return 'Soft Clip (PISTON)';
  return 'PORP';
}

/** 症例の ossicularStatus から確認すべき解剖構造を導出 */
function deriveFocusStructures(sc: SurgicalCase): { key: string; label: string; reason: string }[] {
  const structures: { key: string; label: string; reason: string }[] = [
    { key: 'facialNerve', label: '顔面神経', reason: 'プロテーゼ設置の最重要危険構造。水平部はアブミ骨直上を走行。' },
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
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
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
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
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

        {/* Q2: プロテーゼ種別 */}
        <div className="card">
          <div className="section-title">Q2. 適切なプロテーゼ種類は？</div>
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
  const ResultBadge = ({ correct, label, answer, correct_answer }: { correct: boolean; label: string; answer: string; correct_answer: string }) => (
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
    </div>
  );

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          {typeCorrect && productCorrect ? '🎉 完全正解！' : typeCorrect || productCorrect ? '⚡ 部分正解' : '📚 要復習'}
        </div>
        <ResultBadge
          correct={typeCorrect}
          label="Q1. 鼓室形成型"
          answer={typeSelected!}
          correct_answer={correctType}
        />
        <ResultBadge
          correct={productCorrect}
          label="Q2. プロテーゼ種別"
          answer={productSelected!}
          correct_answer={correctProduct}
        />
        {/* Teaching point（最初の1件だけ表示） */}
        {selectedCase.teachingPoints[0] && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            💡 {selectedCase.teachingPoints[0]}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('quiz'); setTypeSelected(null); setProductSelected(null); }}>
          やり直す
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>
          プロテーゼ選択へ →
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
          return (
            <div key={p.id}>
              <div
                className={`selectable-card ${isSelected ? 'selected' : ''}`}
                onClick={() => { setSelectedProduct(p); setSelectedLength(placement.selectedLength); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${p.type === 'PORP' ? 'blue' : 'green'}`}>{p.type}</span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text-secondary)' }}>
                      {p.footType}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.description}</p>
              </div>

              {/* Length selector */}
              {isSelected && (
                <div style={{ padding: '12px 14px', background: 'rgba(0,180,216,.08)', border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginTop: -2 }}>
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
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
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
              推定と異なる場合は「プロテーゼ選択に戻る」で変更できます。
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>← プロテーゼ選択に戻る</button>
        {submitted && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>
            配置調整へ →
          </button>
        )}
      </div>
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
  const [vis3dOpen, setVis3dOpen] = useState(false);

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
        <ErrorBoundary>
        <SimScene
          surgicalCase={selectedCase}
          product={selectedProduct}
          placement={safeP}
          showIdeal={showIdeal}
          showCartilage={showCartilage}
          vis={simVis}
          dragMode={dragMode}
          onStructureClick={guardedCycleVis}
        />
        </ErrorBoundary>
        <div className="canvas-overlay top-left">
          <ContextTagBar
            procedureTags={selectedCase.tags.procedure}
            lesionTags={selectedCase.tags.lesion}
          />
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {/* 操作モード切替 */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.65)', padding: '4px 6px', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
            <button
              onClick={() => setDragMode('move')}
              style={{
                padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: dragMode === 'move' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                color: dragMode === 'move' ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}
            >
              移動
            </button>
            <button
              onClick={() => setDragMode('view')}
              style={{
                padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: dragMode === 'view' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                color: dragMode === 'view' ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}
            >
              視点
            </button>
          </div>
          {/* 理想位置トグル */}
          <button
            className={`btn btn-sm ${showIdeal ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowIdeal(!showIdeal)}
          >
            {showIdeal ? '理想位置を非表示' : '理想位置を表示'}
          </button>
          {/* 軟骨スライストグル */}
          <button
            className={`btn btn-sm ${showCartilage ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowCartilage(!showCartilage)}
          >
            {showCartilage ? '軟骨スライスを非表示' : '軟骨スライスを表示'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="sidebar">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{selectedProduct.name}</div>

          {/* ── スナップ + リセット ── */}
          <button
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#0096c7,#0077a8)',
              color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 6, letterSpacing: '.02em',
            }}
            onClick={() => updatePlacement({
              lateralOffset: selectedCase.idealLateralOffset,
              anteriorOffset: 0, verticalOffset: 0,
              angleTilt: selectedCase.idealAngle, angleTiltZ: 0,
              dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
            })}
          >
            理想位置に配置
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginBottom: 12, fontSize: 11 }}
            onClick={() => updatePlacement({
              lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0,
              angleTilt: 0, angleTiltZ: 0,
              dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
            })}
          >
            ↺ すべてリセット
          </button>

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

        {/* ── 視点プリセット ── */}
        <div className="card" style={{ padding: '10px 12px' }}>
          <div className="section-title" style={{ marginBottom: 8, fontSize: 11 }}>視点プリセット</div>
          <ViewPresetPanel onSelectView={v => setSimCameraView(shiftViewForSim(v))} />
        </div>

        {/* ── 視点保存 ── */}
        <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, fontSize: 11 }}
            onClick={saveSimCam}
          >
            視点を保存
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}
            onClick={resetSimCam}
          >
            視点リセット
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <button className="btn btn-ghost" onClick={() => setSimStep('product-select')}>← 戻る</button>
          <button className="btn btn-primary" onClick={handleConfirm}>評価する →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Score ────────────────────────────────────────────────────────
function ScoreStep() {
  const { selectedCase, selectedProduct, placement, scoreResult, judgmentResult, resetSimulation, setSimStep, setScreen } = useSimStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
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
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>ABG改善量</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: abgColor, lineHeight: 1 }}>
                  −{abg.improvementDb}<span style={{ fontSize: 18, marginLeft: 3 }}>dB</span>
                </div>
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
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {abg.clinicalInterpretation}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              ※ {selectedProduct.name} {placement.selectedLength}mm　/ Austin (1994), Merchant (2003) 文献値ベース
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {scoreResult.total}<span style={{ fontSize: 18, color: 'var(--text-muted)', marginLeft: 6 }}>/ 100</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
              {selectedCase.title}　|　{selectedProduct.name} {placement.selectedLength}mm
            </div>
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

      {judgmentResult && (
        <div className="card">
          <div className="section-title">適応判断 結果</div>
          {[
            { label: '鼓室形成型', correct: judgmentResult.typeCorrect, answer: judgmentResult.typeAnswer },
            { label: 'プロテーゼ', correct: judgmentResult.productCorrect, answer: judgmentResult.productAnswer },
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

      <div style={{ display: 'flex', gap: 8, padding: '0 4px 24px' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>← やり直す</button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => resetSimulation()}>別の症例へ</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setScreen('stepflow')}>🎬 手術フローへ</button>
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
  const currentIdx = SIM_STEPS.findIndex(s => s.id === simStep);

  const stepContent = (() => {
    switch (simStep) {
      case 'case-select':     return <CaseSelect />;
      case 'judgment':        return <JudgmentStep />;
      case 'product-select':  return <ProductSelect />;
      case 'shaft-estimate':  return <ShaftEstimateStep />;
      case 'placement':       return <PlacementStep />;
      case 'score':           return <ScoreStep />;
      default:                return <CaseSelect />;
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)' }}>
      {/* ── 6ステップ プログレスバー ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 16px',
        height: 36, borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0,
      }}>
        {SIM_STEPS.map((s, i) => {
          const done   = i < currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                  background: done ? 'var(--accent)' : active ? 'rgba(0,180,216,0.22)' : 'rgba(255,255,255,0.07)',
                  border: active ? '1.5px solid var(--accent)' : 'none',
                  color: done ? '#001a20' : active ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                  transition: 'all .2s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 10, whiteSpace: 'nowrap',
                  color: active ? 'var(--accent)' : done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
                  fontWeight: active ? 700 : 400,
                }}>
                  {s.label}
                </span>
              </div>
              {i < SIM_STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 1, margin: '0 5px',
                  background: i < currentIdx ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                  transition: 'background .3s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* ── ステップコンテンツ ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: simStep === 'placement' ? 'hidden' : 'auto' }}>
        {stepContent}
      </div>
    </div>
  );
}
