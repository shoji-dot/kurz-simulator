import { useState } from 'react';
import { useSimStore } from './store/useSimStore';
import { HomeScreen } from './components/HomeScreen';
import { LearningMode } from './components/LearningMode';
import { SimulationMode } from './components/SimulationMode';
import { StepFlowMode } from './components/StepFlowMode';
import { InteractiveDrillScene } from './scenes/InteractiveDrillScene';

// ── Feature Flag ──────────────────────────────────────────────────────────────
// Drilling Simulator は VR/WebXR 対応まで無効化。
// 再有効化する場合は FEATURE_DRILL_ENABLED を true に変更する。
const FEATURE_DRILL_ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_LABELS: Record<string, string> = {
  learning:   '解剖学習',
  simulation: 'プロステーシス選択',
  stepflow:   '手術フロー',
  drill:      '削開練習',
};

function AppHeader() {
  const { screen, setScreen, resetSimulation } = useSimStore();

  return (
    <header className="app-header">
      {/* Back to Home */}
      <button
        onClick={() => { setScreen('home'); resetSimulation(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', borderRadius: 6, fontFamily: 'inherit',
          transition: 'color .15s',
          letterSpacing: '-.01em',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
      >
        ← Home
      </button>

      {/* Centered screen title */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
        letterSpacing: '.01em', pointerEvents: 'none',
      }}>
        {SCREEN_LABELS[screen] ?? ''}
      </div>
    </header>
  );
}


// ── 削開練習スクリーン（顕微鏡モード付き）─────────────────────────────
// NOTE: FEATURE_DRILL_ENABLED = false の間はこのコンポーネントはレンダリングされない。
// VR/WebXR 対応時に FEATURE_DRILL_ENABLED = true にして再有効化する。
type DrillViewMode = 'normal' | 'microscope' | 'endoscope';

function DrillPracticeScreen() {
  const [viewMode, setViewMode] = useState<DrillViewMode>('normal');
  const [positionMode, setPositionMode] = useState(false);
  const [drillActive, setDrillActive] = useState(false);

  const handleViewMode = (mode: DrillViewMode) => {
    setViewMode(mode);
    if (mode === 'microscope') setPositionMode(true);
    else setPositionMode(false);
  };

  return (
    <div style={{ position: 'relative', height: 'calc(100dvh - 56px)', overflow: 'hidden' }}>
      <InteractiveDrillScene
        viewMode={viewMode}
        positionMode={positionMode}
        drillActive={drillActive}
        onDrillToggle={() => setDrillActive(v => !v)}
        rightOverlayOffset={110}
      />

      {/* 顕微鏡モードツールバー（右上） */}
      <div style={{
        position: 'absolute', top: 12, right: 16, zIndex: 30,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5,
        pointerEvents: 'none',
      }}>
        {/* ビューモード選択 */}
        <div style={{ display: 'flex', gap: 5, pointerEvents: 'auto' }}>
          {([
            { mode: 'normal'     as DrillViewMode, icon: '👁',  label: '通常'   },
            { mode: 'microscope' as DrillViewMode, icon: '🔬', label: '顕微鏡' },
          ] as { mode: DrillViewMode; icon: string; label: string }[]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => handleViewMode(mode)}
              style={{
                padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                fontSize: 11, fontWeight: viewMode === mode ? 700 : 400,
                border: `1px solid ${viewMode === mode ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.18)'}`,
                background: viewMode === mode ? 'rgba(0,180,216,0.22)' : 'rgba(10,15,26,0.78)',
                color: viewMode === mode ? 'var(--accent)' : '#7a8898',
                backdropFilter: 'blur(6px)', transition: 'all .15s',
              }}
            >{icon} {label}</button>
          ))}
        </div>

        {/* 顕微鏡: 固定/移動中 */}
        {viewMode === 'microscope' && (
          <button
            onClick={() => setPositionMode(v => !v)}
            style={{
              pointerEvents: 'auto',
              padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: positionMode ? 700 : 400,
              border: `1px solid ${positionMode ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.18)'}`,
              background: positionMode ? 'rgba(0,180,216,0.22)' : 'rgba(10,15,26,0.78)',
              color: positionMode ? '#00c4e8' : '#7a8898',
              backdropFilter: 'blur(6px)', transition: 'all .15s',
            }}
          >{positionMode ? '🔓 移動中' : '🔒 固定'}</button>
        )}

        {/* カッターバーサイズ + ドリル開始ボタン */}
        <div style={{ display: 'flex', gap: 3, pointerEvents: 'auto', alignItems: 'center' }}>
          {/* ドリル開始ボタン: 1mmの左 */}
          <button
            onClick={() => setDrillActive(v => !v)}
            style={{
              padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              border: `1px solid ${drillActive ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.18)'}`,
              background: drillActive ? 'rgba(239,68,68,0.22)' : 'rgba(10,15,26,0.78)',
              color: drillActive ? '#fca5a5' : '#7a8898',
              backdropFilter: 'blur(6px)', transition: 'all .15s',
            }}
          >🔴 {drillActive ? '削開中' : 'ドリル開始'}</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { screen, setScreen } = useSimStore();

  // FEATURE_DRILL_ENABLED = false の間、drill スクリーンへの直接遷移をホームへリダイレクト
  if (screen === 'drill' && !FEATURE_DRILL_ENABLED) {
    setScreen('home');
  }

  return (
    <>
      {screen !== 'home' && <AppHeader />}
      {screen === 'home'       && <HomeScreen />}
      {screen === 'learning'   && <LearningMode />}
      {screen === 'simulation' && <SimulationMode />}
      {screen === 'stepflow'   && <StepFlowMode />}
      {/* FEATURE_DRILL_ENABLED が true の場合のみレンダリング（VR/WebXR 対応後に有効化） */}
      {screen === 'drill' && FEATURE_DRILL_ENABLED && <DrillPracticeScreen />}
    </>
  );
}

export default App;
