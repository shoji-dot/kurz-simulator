import { useSimStore } from './store/useSimStore';
import { HomeScreen } from './components/HomeScreen';
import { LearningMode } from './components/LearningMode';
import { SimulationMode } from './components/SimulationMode';

function AppHeader() {
  const { screen, setScreen, resetSimulation } = useSimStore();

  return (
    <header className="app-header">
      <button
        onClick={() => { setScreen('home'); resetSimulation(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div className="logo">
          ⚕ KURZ Simulator
          <span>耳科教育プラットフォーム</span>
        </div>
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button
          className={`btn btn-sm ${screen === 'learning' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setScreen('learning')}
        >
          🔬 学習
        </button>
        <button
          className={`btn btn-sm ${screen === 'simulation' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { if (screen !== 'simulation') { resetSimulation(); setScreen('simulation'); } }}
        >
          🎯 シミュレーション
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
        v0.1.0 プロトタイプ
      </div>
    </header>
  );
}

function App() {
  const screen = useSimStore((s) => s.screen);

  return (
    <>
      {screen !== 'home' && <AppHeader />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'learning' && <LearningMode />}
      {screen === 'simulation' && <SimulationMode />}
    </>
  );
}

export default App;
