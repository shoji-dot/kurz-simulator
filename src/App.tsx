import { useState } from 'react';
import { useSimStore } from './store/useSimStore';
import { HomeScreen } from './components/HomeScreen';
import { LearningMode } from './components/LearningMode';
import { SimulationMode } from './components/SimulationMode';
import { StepFlowMode } from './components/StepFlowMode';
import { LearningDashboard } from './components/LearningDashboard';
import { Splash } from './components/Splash';
import { AdminGate } from './components/AdminGate';
import { InteractiveDrillScene } from './scenes/InteractiveDrillScene';
import { processAdminModeUrlParam, isAdminMode } from './utils/adminMode';
import { processDebugModeUrlParam } from './utils/debugMode';

// ── Feature Flag ──────────────────────────────────────────────────────────────
// Drilling Simulator は VR/WebXR 対応まで無効化。
// 再有効化する場合は FEATURE_DRILL_ENABLED を true に変更する。
const FEATURE_DRILL_ENABLED = false;
// 管理者プレビュー: ?admin=1 でアクセスした端末はパスコード入力後に削開練習を利用可能
// （一般利用者には非表示のまま）。真のセキュリティ境界ではない（詳細: src/utils/adminMode.ts）。
const wantsAdminGate = processAdminModeUrlParam();
// 座標Debug Overlay: ?debug=coords でアクセスした端末はセッション中Debug Overlayを表示する
// （詳細: src/utils/debugMode.ts、座標系統合Phase1の一部）。
processDebugModeUrlParam();
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_LABELS: Record<string, string> = {
  learning:   '解剖学習',
  simulation: 'プロステーシス選択',
  stepflow:   '手術フロー',
  drill:      '削開練習',
  dashboard:  '学習ダッシュボード',
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
          color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', borderRadius: 6, fontFamily: 'inherit',
          transition: 'color .15s',
          letterSpacing: '-.01em',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
      >
        ← Home
      </button>

      {/* Centered screen title */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
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
        onPositionModeChange={setPositionMode}
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
  // 起動時のブランド体験（KURZ Design System v1 2節）。マウントごとに一度だけ表示する。
  const [showSplash, setShowSplash] = useState(true);
  // ?admin=1 でアクセスされ、まだ管理者プレビューが未解除の場合にパスコード入力画面を表示する。
  const [adminGateOpen, setAdminGateOpen] = useState(wantsAdminGate);

  // FEATURE_DRILL_ENABLED = false の間、drill スクリーンへの直接遷移をホームへリダイレクト
  // （管理者モード時は例外的に許可）
  if (screen === 'drill' && !FEATURE_DRILL_ENABLED && !isAdminMode()) {
    setScreen('home');
  }

  if (showSplash) {
    return <Splash onComplete={() => setShowSplash(false)} />;
  }

  if (adminGateOpen) {
    return (
      <AdminGate
        onUnlock={() => setAdminGateOpen(false)}
        onCancel={() => setAdminGateOpen(false)}
      />
    );
  }

  return (
    <>
      {screen !== 'home' && <AppHeader />}
      {screen === 'home'       && <HomeScreen />}
      {screen === 'learning'   && <LearningMode />}
      {screen === 'simulation' && <SimulationMode />}
      {screen === 'stepflow'   && <StepFlowMode />}
      {screen === 'dashboard'  && <LearningDashboard />}
      {/* FEATURE_DRILL_ENABLED が true、または管理者モードの場合のみレンダリング */}
      {screen === 'drill' && (FEATURE_DRILL_ENABLED || isAdminMode()) && <DrillPracticeScreen />}
    </>
  );
}

export default App;
