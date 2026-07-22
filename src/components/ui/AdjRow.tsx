/**
 * AdjRow.tsx — 数値微調整用の汎用行コンポーネント（ラベル＋現在値＋ステップボタン群）。
 *
 * Phase22.2 GUI Follow-up P1: 元々 SimulationMode.tsx にのみ存在した非exportコンポーネントを、
 * StepFlowMode（STEP6）からも再利用するため ui/ 配下へ切り出した（shojiさん指定の
 * 「AdjRowを共通コンポーネント化してSTEP6へ再利用」方針、SafetyScoreCard/visToggleConfigと
 * 同じexport+importパターン）。ロジック・見た目は移動前と完全に同一。
 */
import type { CSSProperties } from 'react';

export function AdjRow({
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
    color: i < steps.length / 2 ? 'var(--color-error)' : 'var(--color-success)',
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
