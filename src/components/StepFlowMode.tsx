/**
 * StepFlowMode.tsx — 8ステップ鼓室形成術フロー
 *
 * UpSurgeOn型の「1/8 → 8/8」進行管理を KURZ 版として実装。
 * 学習モード（解剖確認〜評価）をひとつのシナリオフローで統合。
 */

import { useState, useMemo } from 'react';
import { useSimStore, ALL_PATIENT_IDS } from '../store/useSimStore';
import { surgicalCases } from '../data/cases';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import { SimScene } from '../scenes/SimScene';
import type { VisibilityMap } from '../scenes/models/RealAnatomyModels';
import type { SurgicalCase } from '../data/cases';
import type { KurzProduct } from '../data/products';

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
}

const STEPS: StepDef[] = [
  {
    id: 1,
    icon: '🦴',
    title: '解剖確認',
    subtitle: '側頭骨・耳小骨の解剖を確認',
    guide: '鼓膜を透かして中耳腔の全体像を把握します。側頭骨（半透明）の中に耳小骨連鎖（ツチ骨・キヌタ骨・アブミ骨）が連続していることを確認してください。',
    clinicalNote: '手術開始前の解剖確認が合併症予防の第一歩。特に顔面神経と耳小骨の位置関係を術前CTで把握しておく。',
    vis: { bone: 'ghost', tympanic: 'solid', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'solid', eac: 'ghost', roundWindow: 'solid' },
  },
  {
    id: 2,
    icon: '🔼',
    title: '鼓膜挙上',
    subtitle: '外耳道後壁を切開し鼓膜フラップを挙上',
    guide: '外耳道皮膚切開を行い、鼓膜を挙上して鼓室内を露出します。鼓膜を半透明表示に切り替えて中耳の様子を確認してください。',
    clinicalNote: 'フラップの挙上はツチ骨付着部から慎重に剥離。鼓索神経（黄色）は温存。過剰な牽引は鼓索神経麻痺の原因となる。',
    vis: { bone: 'ghost', tympanic: 'ghost', malleus: 'solid', incus: 'solid', stapes: 'solid', facialNerve: 'solid', chordaTympani: 'solid', eac: 'ghost', roundWindow: 'solid' },
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
    title: 'プロテーゼ設置',
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

// ── 進行バー ──────────────────────────────────────────────────────
function StepProgressBar({ currentStep, totalSteps, onStepClick }: { currentStep: number; totalSteps: number; onStepClick?: (i: number) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '10px 16px', borderBottom: '1px solid var(--border)',
      background: 'rgba(6,10,26,0.9)',
      overflowX: 'auto',
    }}>
      {STEPS.map((step, i) => {
        const done    = i + 1 < currentStep;
        const active  = i + 1 === currentStep;
        const locked  = i + 1 > currentStep;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <div
              onClick={() => !locked && onStepClick?.(i + 1)}
              title={step.title}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: locked ? 'default' : 'pointer',
                opacity: locked ? 0.35 : 1,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--accent)' : active ? 'rgba(0,180,216,0.25)' : 'rgba(255,255,255,0.06)',
                border: active ? '2px solid var(--accent)' : done ? 'none' : '1px solid rgba(255,255,255,0.12)',
                fontSize: done ? 12 : 13,
                fontWeight: 700,
                color: done ? '#001a20' : active ? 'var(--accent)' : '#555',
                transition: 'all .2s',
              }}>
                {done ? '✓' : step.icon}
              </div>
              <span style={{
                fontSize: 9, fontWeight: active ? 700 : 400,
                color: active ? 'var(--accent)' : done ? 'var(--text-secondary)' : '#444',
                whiteSpace: 'nowrap',
              }}>
                {step.id}. {step.title}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div style={{
                width: 18, height: 1, flexShrink: 0, marginBottom: 12,
                background: done ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                transition: 'background .2s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── コンテキストタグバー（症例情報） ─────────────────────────────
function CaseTagBar({ surgicalCase }: { surgicalCase: SurgicalCase }) {
  const diffColor: Record<string, string> = {
    beginner: '#4ade80', intermediate: '#ffd166', advanced: '#f87171',
  };
  const diffLabel: Record<string, string> = {
    beginner: '初級', intermediate: '中級', advanced: '上級',
  };
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {surgicalCase.tags.procedure.map(t => (
        <span key={t} style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(0,180,216,0.15)', color: '#7dd8e8',
          border: '1px solid rgba(0,180,216,0.3)',
        }}>{t}</span>
      ))}
      {surgicalCase.tags.lesion.map(t => (
        <span key={t} style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(255,209,102,0.12)', color: '#ffd166',
          border: '1px solid rgba(255,209,102,0.3)',
        }}>{t}</span>
      ))}
      <span style={{
        padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
        background: `${diffColor[surgicalCase.difficulty]}18`,
        color: diffColor[surgicalCase.difficulty],
        border: `1px solid ${diffColor[surgicalCase.difficulty]}44`,
      }}>{diffLabel[surgicalCase.difficulty]}</span>
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
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            選択製品: <strong style={{ color: 'var(--accent)' }}>{product.name}</strong>
            {' / '}シャフト長: <strong style={{ color: 'var(--accent)' }}>{surgicalCase.recommendedLength} mm</strong>
          </div>
        )}
      </div>

      {/* ステップガイド */}
      <div className="card" style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{step.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>
              STEP {step.id} / {totalSteps} — {step.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{step.subtitle}</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
          {step.guide}
        </p>

        {step.clinicalNote && (
          <div style={{
            background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.22)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
              💡 臨床メモ
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {step.clinicalNote}
            </div>
          </div>
        )}

        {/* ティーチングポイント（step 4,5,6 で表示） */}
        {[4, 5, 6].includes(step.id) && (
          <div style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>ティーチングポイント</div>
            {surgicalCase.teachingPoints.slice(0, 2).map((tp, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                paddingLeft: 10, borderLeft: '2px solid var(--border-bright)',
                marginBottom: 6,
              }}>
                {tp}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={onPrev}
          disabled={currentStepIndex === 0}
        >
          ← 前へ
        </button>
        <button
          className={`btn ${isLast ? 'btn-secondary' : 'btn-primary'}`}
          style={{ flex: 2 }}
          onClick={onNext}
        >
          {isLast ? '↺ 最初から' : `次へ: STEP ${step.id + 1} →`}
        </button>
      </div>
    </div>
  );
}

// ── スコア表示（Step 7） ─────────────────────────────────────────
function ScorePanel({ surgicalCase }: { surgicalCase: SurgicalCase }) {
  const { scoreResult, computeScore, placement } = useSimStore();

  if (!scoreResult) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          STEP 6 でプロテーゼを設置してからスコアを計算してください。
        </p>
        <button className="btn btn-primary" onClick={computeScore}>
          📊 スコアを計算
        </button>
      </div>
    );
  }

  const { sizeScore, positionScore, angleScore, stabilityScore, total, rank, feedback } = scoreResult;
  const rankColor: Record<string, string> = { S: '#f0c040', A: '#4ade80', B: '#60b8e0', C: '#ffd166', D: '#f87171' };
  const subScores = [
    { label: 'サイズ', score: sizeScore, color: '#00b4d8' },
    { label: '位置', score: positionScore, color: '#06d6a0' },
    { label: '角度', score: angleScore, color: '#ffd166' },
    { label: '安定性', score: stabilityScore, color: '#c77dff' },
  ];

  return (
    <div className="sidebar" style={{ overflowY: 'auto' }}>
      {/* 症例情報 */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{surgicalCase.title}</div>
        <CaseTagBar surgicalCase={surgicalCase} />
      </div>

      {/* スコアリング */}
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div className={`score-ring rank-${rank}`}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{total}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>/ 100</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>
            ランク {rank}
          </div>
        </div>

        <div className="section-title" style={{ marginBottom: 10 }}>詳細スコア</div>
        {subScores.map(({ label, score, color }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
              <span>{label}</span>
              <strong style={{ color }}>{score} / 25</strong>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill" style={{ width: `${(score / 25) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* あなたの設置 */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>あなたの設置</div>
        {[
          ['シャフト長', `${placement.selectedLength} mm`, `（推奨: ${surgicalCase.recommendedLength} mm）`],
          ['内外側', `${(placement.lateralOffset + placement.dragOffsetX).toFixed(2)} mm`, '（理想: 0mm）'],
          ['前後', `${(placement.anteriorOffset + placement.dragOffsetZ).toFixed(2)} mm`, '（理想: 0mm）'],
          ['傾斜角', `${placement.angleTilt}°`, '（理想: 0°）'],
        ].map(([k, v, hint]) => (
          <div key={k} className="info-row">
            <span className="label">{k}</span>
            <span className="value" style={{ fontSize: 11 }}>{v} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span></span>
          </div>
        ))}
      </div>

      {/* フィードバック */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>フィードバック</div>
        {feedback.map((f, i) => (
          <div key={i} style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
            marginBottom: 6, paddingLeft: 10,
            borderLeft: `2px solid ${total >= 75 ? 'var(--green)' : 'var(--yellow)'}`,
          }}>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── サマリービュー（Step 8） ──────────────────────────────────────
function SummaryPanel({
  surgicalCase, onRestart, onHome,
}: {
  surgicalCase: SurgicalCase;
  onRestart: () => void;
  onHome: () => void;
}) {
  const { scoreResult } = useSimStore();
  const rankColor: Record<string, string> = { S: '#f0c040', A: '#4ade80', B: '#60b8e0', C: '#ffd166', D: '#f87171' };
  const ABG_COLOR: Record<string, string> = { excellent: '#4ade80', good: '#60b8e0', fair: '#ffd166', poor: '#ff6666' };
  const abg = scoreResult?.abgPrediction;
  const abgColor = abg ? ABG_COLOR[abg.successCategory] : '#4ade80';

  return (
    <div className="sidebar" style={{ overflowY: 'auto' }}>
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>シミュレーション完了</div>
        <CaseTagBar surgicalCase={surgicalCase} />
      </div>

      {scoreResult && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>{scoreResult.rank === 'S' ? '🏆' : scoreResult.rank === 'A' ? '⭐' : '✓'}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: rankColor[scoreResult.rank] ?? '#fff', margin: '8px 0' }}>
            ランク {scoreResult.rank} — {scoreResult.total}点
          </div>
          {abg && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: `${abgColor}12`, border: `1px solid ${abgColor}40`, borderRadius: 8, textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: abgColor, fontWeight: 700, marginBottom: 4 }}>📈 術後ABG改善予測</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>改善: <strong style={{ color: abgColor }}>+{abg.improvementDb} dB</strong></span>
                <span style={{ fontSize: 13 }}>術後ABG目安: <strong style={{ color: abgColor }}>{abg.postOpAbg} dB</strong></span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{abg.clinicalInterpretation}</div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title" style={{ marginBottom: 10 }}>今回の学習ポイント</div>
        {surgicalCase.teachingPoints.map((tp, i) => (
          <div key={i} style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65,
            paddingLeft: 10, borderLeft: '2px solid var(--accent)',
            marginBottom: 8,
          }}>
            {tp}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onRestart}>
          ↺ 同症例で再挑戦
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onHome}>
          🏠 ホームへ
        </button>
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

  const diffColor: Record<string, string> = { beginner: '#4ade80', intermediate: '#ffd166', advanced: '#f87171' };
  const diffLabel: Record<string, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, height: '100%', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: 4, fontSize: 20 }}>🎬 手術フロー — 症例・製品選択</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        8ステップで鼓室形成術の全工程をシミュレーションします。症例と使用製品を選択してください。
      </p>

      <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>Step 1 — 症例を選択</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {surgicalCases.map(c => (
          <div
            key={c.id}
            className={`selectable-card ${selectedCaseId === c.id ? 'selected' : ''}`}
            onClick={() => { setSelectedCaseId(c.id); setSelectedProductId(c.recommendedProductId); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.title}</span>
              <span style={{
                padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: `${diffColor[c.difficulty]}15`, color: diffColor[c.difficulty],
                border: `1px solid ${diffColor[c.difficulty]}44`,
              }}>{diffLabel[c.difficulty]}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {c.tags.procedure.map(t => (
                <span key={t} style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(0,180,216,0.12)', color: '#7dd8e8', border: '1px solid rgba(0,180,216,0.25)' }}>{t}</span>
              ))}
              {c.tags.lesion.map(t => (
                <span key={t} style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(255,209,102,0.1)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.25)' }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.description}</p>
          </div>
        ))}
      </div>

      {selectedCase && (
        <>
          <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>Step 2 — 製品を確認</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {kurzProducts.map(p => (
              <div
                key={p.id}
                className={`selectable-card ${selectedProductId === p.id ? 'selected' : ''}`}
                onClick={() => setSelectedProductId(p.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                  <span className={`badge badge-${p.type === 'PORP' ? 'blue' : 'green'}`}>{p.type}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{p.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        className="btn btn-primary"
        style={{ width: '100%', fontSize: 15, padding: '14px 0' }}
        disabled={!selectedCase || !selectedProduct}
        onClick={() => selectedCase && selectedProduct && onStart(selectedCase, selectedProduct)}
      >
        🎬 フローを開始 →
      </button>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────
export function StepFlowMode() {
  const { setScreen, resetSimulation, updatePlacement, computeScore, placement, selectedPatientId, setSelectedPatientId } = useSimStore();

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
      // Step 6 → 7 に進む際にスコアを計算
      if (step.id === 6) computeScore();
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

  // AnatomyScene の vis 設定
  const visForScene: VisibilityMap = useMemo(
    () => step.vis ?? { bone: 'ghost', tympanic: 'solid', malleus: 'solid', incus: 'solid', stapes: 'solid' },
    [step]
  );

  if (phase === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
        <FlowSetup onStart={handleStart} />
      </div>
    );
  }

  if (!flowCase || !flowProduct) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* 患者プロファイル選択バー */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>👤 患者</span>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {ALL_PATIENT_IDS.map(id => (
            <button
              key={id}
              onClick={() => setSelectedPatientId(id)}
              style={{
                width: 24, height: 24, borderRadius: 5, fontSize: 11, fontWeight: selectedPatientId === id ? 700 : 400,
                border: `1px solid ${selectedPatientId === id ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
                background: selectedPatientId === id ? 'rgba(0,180,216,0.22)' : 'rgba(255,255,255,0.04)',
                color: selectedPatientId === id ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all .12s',
              }}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

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
              showIdeal={true}
              vis={{ bone: 'ghost', tympanic: 'hidden', malleus: 'ghost', incus: 'ghost', stapes: 'solid', eac: 'ghost' }}
            />
          ) : step.useScoreView || step.useSummaryView ? (
            // スコア/サマリーはサイドパネルで表示、メインは解剖ビュー
            <AnatomyScene
              vis={{ bone: 'ghost', tympanic: 'hidden', malleus: 'ghost', incus: 'ghost', stapes: 'solid', innerEar: 'ghost' }}
              highlightedKey="stapes"
              patientId={selectedPatientId}
            />
          ) : (
            <AnatomyScene
              vis={visForScene}
              highlightedKey={step.highlightedKey}
              patientId={selectedPatientId}
            />
          )}

          {/* キャンバスオーバーレイ: コンテキストタグ */}
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 15, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {flowCase.tags.procedure.map(t => (
              <span key={t} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.7)', color: '#7dd8e8', border: '1px solid rgba(0,180,216,0.4)', backdropFilter: 'blur(4px)' }}>{t}</span>
            ))}
            {flowCase.tags.lesion.map(t => (
              <span key={t} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.7)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.4)', backdropFilter: 'blur(4px)' }}>{t}</span>
            ))}
          </div>

          {/* 操作ヒント */}
          <div className="canvas-overlay bottom-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '5px 9px', borderRadius: 6, backdropFilter: 'blur(4px)', fontSize: 11 }}>
              {step.useSimScene
                ? '🖱 矢印ハンドル: ドラッグ配置 ｜ ハンドル外: 視点回転'
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
