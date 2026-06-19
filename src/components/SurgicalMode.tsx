/**
 * SurgicalMode.tsx  ── 手術シミュレーションモード UI
 *
 * 経外耳道アプローチ（Phase 1）の 6 ステップアニメーション
 * Phase 2（乳突削開）は将来拡張として UI 上にプレースホルダーを配置
 */

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSimStore } from '../store/useSimStore';
import { DRILL_STEPS, SurgicalSceneContent } from '../scenes/SurgicalScene';
import type { DrillStep } from '../scenes/SurgicalScene';
import { kurzProducts } from '../data/products';

// PORP デフォルト製品（ステップ 5 でプロテーゼ表示用）
const DEFAULT_PORP = kurzProducts.find(p => p.footType === 'BELL')!;

// ══════════════════════════════════════════════════════════════════
// ステップインジケーター
// ══════════════════════════════════════════════════════════════════
function StepIndicator({ current, steps, onChange }: {
  current: number;
  steps: DrillStep[];
  onChange: (n: number) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '8px 12px', background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      {steps.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          title={s.title}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            border: 'none',
            cursor: 'pointer',
            background: s.id <= current ? 'var(--accent)' : 'var(--border)',
            transition: 'background .3s',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 教育ノートパネル
// ══════════════════════════════════════════════════════════════════
function EduPanel({ step }: { step: DrillStep }) {
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '10px 16px',
      background: 'var(--bg)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      fontSize: 12,
    }}>
      {/* 手術説明 */}
      <div>
        <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 4, fontSize: 11 }}>
          🔪 手術操作
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {step.description}
        </div>
      </div>
      {/* 教育ポイント */}
      <div>
        <div style={{ color: '#f0c040', fontWeight: 700, marginBottom: 4, fontSize: 11 }}>
          📖 教育ポイント
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {step.eduNote}
        </div>
        {step.anatomy && (
          <div style={{
            marginTop: 6, padding: '4px 8px',
            background: 'rgba(0,180,216,.1)', borderRadius: 4,
            color: 'var(--accent)', fontSize: 11,
          }}>
            🔍 {step.anatomy}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ナビゲーションバー
// ══════════════════════════════════════════════════════════════════
function NavBar({
  current, total, onPrev, onNext, onToSim,
}: {
  current: number; total: number;
  onPrev: () => void; onNext: () => void; onToSim: () => void;
}) {
  const isLast = current >= total - 1;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <button
        className="btn btn-sm btn-ghost"
        onClick={onPrev}
        disabled={current === 0}
        style={{ opacity: current === 0 ? 0.4 : 1 }}
      >
        ← 前へ
      </button>

      <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        STEP {current + 1} / {total}　—　経外耳道アプローチ
      </div>

      {isLast ? (
        <button className="btn btn-sm btn-primary" onClick={onToSim}>
          🎯 シミュレーション練習へ →
        </button>
      ) : (
        <button className="btn btn-sm btn-primary" onClick={onNext}>
          次へ →
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Phase 2 プレースホルダー
// ══════════════════════════════════════════════════════════════════
function Phase2Badge() {
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      background: 'rgba(30,40,80,.85)',
      border: '1px dashed var(--border)',
      borderRadius: 6, padding: '6px 10px',
      fontSize: 10, color: 'var(--text-muted)',
      pointerEvents: 'none',
    }}>
      🔨 Phase 2: 乳突削開 — 近日実装
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ドリルステップ見出し（ステップタイトルとアプローチ表示）
// ══════════════════════════════════════════════════════════════════
function StepHeader({ step }: { step: DrillStep }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* フェーズバッジ */}
      <span style={{
        fontSize: 10, fontWeight: 700,
        background: 'rgba(0,180,216,.18)',
        color: 'var(--accent)',
        borderRadius: 3, padding: '2px 6px',
        letterSpacing: 0.5,
      }}>
        経外耳道法
      </span>

      {/* ドリルアイコン */}
      {step.drillSpinning && (
        <span style={{ color: '#f0c040', animation: 'spin 0.3s linear infinite', display: 'inline-block' }}>
          ⚙
        </span>
      )}

      {/* ステップタイトル */}
      <div style={{ fontWeight: 600, fontSize: 13 }}>
        STEP {step.id + 1}: {step.title}
      </div>

      {/* ドリル状態ラベル */}
      {step.drillVisible && (
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: step.drillSpinning ? '#f0c040' : 'var(--text-muted)',
          background: step.drillSpinning ? 'rgba(240,192,64,.15)' : 'transparent',
          borderRadius: 3, padding: '2px 6px',
        }}>
          {step.drillSpinning ? '● PRIMADO 2 切削中' : '◦ PRIMADO 2 待機中'}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SurgicalMode  ── メインコンポーネント
// ══════════════════════════════════════════════════════════════════
export function SurgicalMode() {
  const { setScreen, resetSimulation } = useSimStore();
  const [stepIdx, setStepIdx] = useState(0);

  const step = DRILL_STEPS[stepIdx];

  const handleNext = () => setStepIdx(i => Math.min(i + 1, DRILL_STEPS.length - 1));
  const handlePrev = () => setStepIdx(i => Math.max(i - 1, 0));

  const handleToSim = () => {
    resetSimulation();
    setScreen('simulation');
  };

  // カメラ位置: ステップが進むにつれ鼓室内に寄る
  const camZ = 22 - stepIdx * 2.5;
  const camY = 8 - stepIdx * 0.8;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg)',
    }}>
      {/* ステップヘッダー */}
      <StepHeader step={step} />

      {/* 3D シーン */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <Canvas
          camera={{ position: [5, camY, camZ], fov: 40 }}
          gl={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#060c18']} />
          <Suspense fallback={null}>
            <SurgicalSceneContent
              step={step}
              product={step.showProsthesis ? DEFAULT_PORP : undefined}
            />
          </Suspense>
          <OrbitControls
            target={step.cameraHint as [number, number, number]}
            enablePan
            minDistance={8}
            maxDistance={40}
          />
        </Canvas>

        {/* Phase 2 バッジ */}
        <Phase2Badge />

        {/* 操作ヒント */}
        <div style={{
          position: 'absolute', bottom: 8, left: 12,
          fontSize: 10, color: 'rgba(255,255,255,.35)',
          pointerEvents: 'none',
        }}>
          ドラッグ: 回転 / スクロール: ズーム
        </div>
      </div>

      {/* ステップインジケーター */}
      <StepIndicator
        current={stepIdx}
        steps={DRILL_STEPS}
        onChange={setStepIdx}
      />

      {/* ナビゲーション */}
      <NavBar
        current={stepIdx}
        total={DRILL_STEPS.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onToSim={handleToSim}
      />

      {/* 教育ノート */}
      <EduPanel step={step} />

      {/* スピンアニメーション用スタイル */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
