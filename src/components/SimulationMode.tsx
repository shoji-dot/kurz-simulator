import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { surgicalCases } from '../data/cases';
import { kurzProducts } from '../data/products';
import { SimScene, SIM_DEFAULT_VIS } from '../scenes/SimScene';
import {
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';

// ── シミュレーション用表示切替アイテム ─────────────────────────────
const SIM_VIS_ITEMS: { key: StructureKey; label: string; color: string }[] = [
  { key: 'bone',          label: '側頭骨',    color: '#f2ead8' },
  { key: 'tympanic',      label: '鼓膜',      color: '#f8d8c0' },
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

// ─── Step 1: Case selection ───────────────────────────────────────────────
function CaseSelect() {
  const { selectedCase, setSelectedCase, setSimStep } = useSimStore();
  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>症例選択</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        練習する手術症例を選んでください。実際の耳小骨連鎖の状態が3Dで示されます。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {surgicalCases.map((c) => (
          <div
            key={c.id}
            className={`selectable-card ${selectedCase?.id === c.id ? 'selected' : ''}`}
            onClick={() => setSelectedCase(c)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</span>
              <span className={`badge ${diffBadge[c.difficulty]}`}>{diffLabel[c.difficulty]}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{c.description}</p>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>ツチ骨: {ossicleLabel[c.ossicularStatus.malleus] ?? c.ossicularStatus.malleus}</span>
              <span>｜</span>
              <span>キヌタ骨: {ossicleLabel[c.ossicularStatus.incus] ?? c.ossicularStatus.incus}</span>
              <span>｜</span>
              <span>アブミ骨: {ossicleLabel[c.ossicularStatus.stapes] ?? c.ossicularStatus.stapes}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          disabled={!selectedCase}
          onClick={() => setSimStep('product-select')}
        >
          次へ: 製品選択 →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Product selection ─────────────────────────────────────────────
function ProductSelect() {
  const { selectedCase, selectedProduct, setSelectedProduct, setSimStep } = useSimStore();
  const [selectedLength, setSelectedLength] = useState<number | null>(null);


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
                onClick={() => { setSelectedProduct(p); setSelectedLength(null); }}
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
                        onClick={(e) => { e.stopPropagation(); setSelectedLength(l); useSimStore.getState().updatePlacement({ selectedLength: l }); }}
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
          onClick={() => setSimStep('placement')}
        >
          次へ: 配置調整 →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Placement ─────────────────────────────────────────────────────
function PlacementStep() {
  const { selectedCase, selectedProduct, placement, updatePlacement, setSimStep, computeScore } = useSimStore();
  const [showIdeal, setShowIdeal] = useState(false);
  const [simVis, setSimVis] = useState<VisibilityMap>({});

  if (!selectedCase || !selectedProduct) return null;

  const handleConfirm = () => {
    computeScore();
    setSimStep('score');
  };

  const cycleVis = (key: StructureKey) => {
    const current: OpacityMode = simVis[key] ?? (SIM_DEFAULT_VIS[key] ?? 'solid');
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setSimVis((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="layout-split">
      {/* 3D Scene */}
      <div className="canvas-wrapper">
        <SimScene
          surgicalCase={selectedCase}
          product={selectedProduct}
          placement={placement}
          showIdeal={showIdeal}
          vis={simVis}
        />
        <div className="canvas-overlay top-left">
          <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>ドラッグ: 視点回転 ｜ ホイール: ズーム</div>
            <div style={{ color: 'var(--accent)', fontSize: 10 }}>青い十字: 目標位置</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button
            className={`btn btn-sm ${showIdeal ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowIdeal(!showIdeal)}
          >
            {showIdeal ? '👻 理想位置を非表示' : '👻 理想位置を表示'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="sidebar">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{selectedProduct.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            シャフト長: <strong style={{ color: 'var(--accent)' }}>{placement.selectedLength} mm</strong>
          </div>

          {/* Length slider */}
          <div className="slider-group" style={{ marginBottom: 14 }}>
            <div className="slider-label">
              <span>シャフト長</span>
              <strong>{placement.selectedLength.toFixed(1)} mm</strong>
            </div>
            <input
              type="range"
              min={selectedProduct.shaftLengths[0]}
              max={selectedProduct.shaftLengths[selectedProduct.shaftLengths.length - 1]}
              step={0.5}
              value={placement.selectedLength}
              onChange={(e) => updatePlacement({ selectedLength: parseFloat(e.target.value) })}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{selectedProduct.shaftLengths[0]}mm</span>
              <span>{selectedProduct.shaftLengths[selectedProduct.shaftLengths.length - 1]}mm</span>
            </div>
          </div>

          {/* Lateral offset */}
          <div className="slider-group" style={{ marginBottom: 14 }}>
            <div className="slider-label">
              <span>内外側 (Lateral)</span>
              <strong>{placement.lateralOffset > 0 ? `外側 ${(placement.lateralOffset * 100).toFixed(0)}%` : placement.lateralOffset < 0 ? `内側 ${(-placement.lateralOffset * 100).toFixed(0)}%` : '中央'}</strong>
            </div>
            <input
              type="range" min={-1} max={1} step={0.05}
              value={placement.lateralOffset}
              onChange={(e) => updatePlacement({ lateralOffset: parseFloat(e.target.value) })}
            />
          </div>

          {/* Anterior offset */}
          <div className="slider-group" style={{ marginBottom: 14 }}>
            <div className="slider-label">
              <span>前後 (Anterior)</span>
              <strong>{placement.anteriorOffset > 0 ? `前方 ${(placement.anteriorOffset * 100).toFixed(0)}%` : placement.anteriorOffset < 0 ? `後方 ${(-placement.anteriorOffset * 100).toFixed(0)}%` : '中央'}</strong>
            </div>
            <input
              type="range" min={-1} max={1} step={0.05}
              value={placement.anteriorOffset}
              onChange={(e) => updatePlacement({ anteriorOffset: parseFloat(e.target.value) })}
            />
          </div>

          {/* Angle tilt */}
          <div className="slider-group" style={{ marginBottom: 16 }}>
            <div className="slider-label">
              <span>傾斜角 (Tilt)</span>
              <strong>{placement.angleTilt > 0 ? `+${placement.angleTilt}°` : `${placement.angleTilt}°`}</strong>
            </div>
            <input
              type="range" min={-15} max={15} step={1}
              value={placement.angleTilt}
              onChange={(e) => updatePlacement({ angleTilt: parseInt(e.target.value) })}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
              <span>-15°</span>
              <span>0° (垂直)</span>
              <span>+15°</span>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginBottom: 8 }}
            onClick={() => updatePlacement({ lateralOffset: 0, anteriorOffset: 0, angleTilt: 0 })}>
            ↺ リセット
          </button>
        </div>

        {/* Teaching points */}
        <div className="card">
          <div className="section-title">ティーチングポイント</div>
          {selectedCase.teachingPoints.map((tp, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 12, borderLeft: '2px solid var(--border-bright)', marginBottom: 8 }}>
              {tp}
            </div>
          ))}
        </div>

        {/* 3D 表示切替 */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>3D 表示切替</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {SIM_VIS_ITEMS.map(({ key, label, color }) => {
              const current: OpacityMode = simVis[key] ?? (SIM_DEFAULT_VIS[key] ?? 'solid');
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </div>
                  <button
                    onClick={() => cycleVis(key)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: 5,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      background: MODE_BG[current],
                      color: MODE_FG[current],
                      minWidth: 52,
                      textAlign: 'center',
                    }}
                  >
                    {MODE_LABEL[current]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('product-select')}>← 戻る</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleConfirm}>
            ✓ 設置を確定してスコア確認
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Score ────────────────────────────────────────────────────────
function ScoreStep() {
  const { scoreResult, selectedCase, placement, resetSimulation, setSimStep, setScreen } = useSimStore();
  if (!scoreResult || !selectedCase) return null;

  const { sizeScore, positionScore, angleScore, stabilityScore, total, rank, feedback } = scoreResult;
  const subScores = [
    { label: 'サイズ', score: sizeScore, color: '#00b4d8' },
    { label: '位置', score: positionScore, color: '#06d6a0' },
    { label: '角度', score: angleScore, color: '#ffd166' },
    { label: '安定性', score: stabilityScore, color: '#c77dff' },
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginBottom: 4, fontSize: 20 }}>評価結果</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>{selectedCase.title}</p>

      {/* Main score ring */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className={`score-ring rank-${rank}`}>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{total}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>/ 100</div>
        </div>
        <div style={{ marginTop: 10, fontSize: 32, fontWeight: 900 }}>
          {rank === 'S' && '🏆 '}
          {rank === 'A' && '⭐ '}
          {rank === 'B' && '✓ '}
          {rank === 'C' && '△ '}
          {rank === 'D' && '× '}
          ランク {rank}
        </div>
      </div>

      {/* Sub scores */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>詳細スコア</div>
        {subScores.map(({ label, score, color }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
              <span>{label}</span>
              <strong style={{ color }}>{score} / 25</strong>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill" style={{ width: `${(score / 25) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Placement summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>あなたの設置</div>
        {[
          ['シャフト長', `${placement.selectedLength} mm`, `（推奨: ${selectedCase.recommendedLength} mm）`],
          ['側方オフセット', `${(placement.lateralOffset * 100).toFixed(0)}%`, '（理想: 0%）'],
          ['前後オフセット', `${(placement.anteriorOffset * 100).toFixed(0)}%`, '（理想: 0%）'],
          ['傾斜角', `${placement.angleTilt}°`, '（理想: 0°）'],
        ].map(([k, v, hint]) => (
          <div key={k} className="info-row">
            <span className="label">{k}</span>
            <span className="value" style={{ fontSize: 12 }}>{v} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span></span>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>フィードバック</div>
        {feedback.map((f, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${total >= 75 ? 'var(--green)' : 'var(--yellow)'}` }}>
            {f}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSimStep('placement')}>
          ← 再調整
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetSimulation}>
          ↺ 別の症例へ
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setScreen('home')}>
          🏠 ホーム
        </button>
      </div>
    </div>
  );
}

// ─── Main SimulationMode ──────────────────────────────────────────────────
export function SimulationMode() {
  const { simStep } = useSimStore();

  const steps = [
    { id: 'case-select', label: '症例選択' },
    { id: 'product-select', label: '製品選択' },
    { id: 'placement', label: '配置調整' },
    { id: 'score', label: '評価' },
  ];
  const stepIndex = steps.findIndex((s) => s.id === simStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Progress bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: i < stepIndex ? 'var(--accent)' : i === stepIndex ? 'var(--accent)' : 'var(--bg-card)',
              color: i <= stepIndex ? '#fff' : 'var(--text-muted)',
              border: i === stepIndex ? '2px solid #fff' : 'none',
              opacity: i > stepIndex ? 0.5 : 1,
            }}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, color: i === stepIndex ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === stepIndex ? 700 : 400 }}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--border)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {simStep === 'case-select' && <CaseSelect />}
        {simStep === 'product-select' && <ProductSelect />}
        {simStep === 'placement' && <PlacementStep />}
        {simStep === 'score' && <ScoreStep />}
      </div>
    </div>
  );
}
