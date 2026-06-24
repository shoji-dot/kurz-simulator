import { useSimStore } from './store/useSimStore';
import { HomeScreen } from './components/HomeScreen';
import { LearningMode } from './components/LearningMode';
import { SimulationMode } from './components/SimulationMode';
import { StepFlowMode } from './components/StepFlowMode';
import { InteractiveDrillScene } from './scenes/InteractiveDrillScene';

const SCREEN_LABELS: Record<string, string> = {
  learning:   '解剖学習',
  simulation: 'プロテーゼ選択',
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

function App() {
  const screen = useSimStore((s) => s.screen);

  return (
    <>
      {screen !== 'home' && <AppHeader />}
      {screen === 'home'       && <HomeScreen />}
      {screen === 'learning'   && <LearningMode />}
      {screen === 'simulation' && <SimulationMode />}
      {screen === 'stepflow'   && <StepFlowMode />}
      {screen === 'drill'      && (
        <div style={{ height: 'calc(100dvh - 56px)', overflow: 'hidden' }}>
          <InteractiveDrillScene />
        </div>
      )}
    </>
  );
}

export default App;
