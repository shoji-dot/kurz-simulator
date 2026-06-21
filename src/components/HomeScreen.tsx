import { useSimStore } from '../store/useSimStore';

const VERSION = 'v0.2.0';

const WORKFLOW_STEPS = [
  {
    num: '1',
    icon: '📖',
    label: 'デジタル予習',
    desc: 'シミュレーターで解剖・術式・プロテーゼ選択を学習',
    color: 'var(--accent)',
  },
  {
    num: '2',
    icon: '🦴',
    label: '側頭骨モデル練習',
    desc: 'KURZ 3D プリント側頭骨モデルで実際に削開・設置を体験',
    color: '#f0c040',
  },
  {
    num: '3',
    icon: '🏥',
    label: '臨床へ',
    desc: '習得した技術を実際の症例に応用',
    color: '#4ade80',
  },
];

const SIMULATOR_FEATURES = [
  {
    icon: '🔬',
    title: '解剖学習モード',
    desc: '鼓室解剖・耳小骨連鎖・危険部位を3Dインタラクティブで確認。削開シナリオで手順を予習。',
    action: 'learning' as const,
    actionLabel: '学習を開始',
  },
  {
    icon: '🎯',
    title: 'シミュレーションモード',
    desc: '実症例10種に基づく PORP/TORP 選択・3D配置・スコアリング。サイズ・位置・角度・安定性の4指標評価。',
    action: 'simulation' as const,
    actionLabel: 'シミュレーション開始',
  },
];

const STATS = [
  { value: '10', unit: '症例', label: '難易度別シナリオ' },
  { value: '20', unit: '患者', label: '実スキャン耳介バリエーション' },
  { value: '4', unit: '指標', label: 'スコアリング評価軸' },
  { value: 'ABG', unit: '予測', label: '術後気骨導差改善予測' },
];

const specs = [
  ['対象製品', 'KURZ チタン製人工耳小骨 PORP / TORP / ピストン'],
  ['MRI 安全性', '7.0T 対応（Grade 1 チタン）'],
  ['重量', '約 4 mg（超軽量設計）'],
  ['技術基盤', 'React 19 + Three.js / WebGL'],
];

export function HomeScreen() {
  const { setScreen, resetSimulation } = useSimStore();

  const goSim = () => { resetSimulation(); setScreen('simulation'); };
  const goLearn = () => setScreen('learning');

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '60px 20px 80px',
      background: 'radial-gradient(ellipse at 50% 0%, #0d1f3c 0%, #0a0e1a 60%)',
    }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', maxWidth: 720, marginBottom: 56 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(0,180,216,.1)',
          border: '1px solid rgba(0,180,216,.3)',
          borderRadius: 999,
          padding: '4px 16px',
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 700,
          letterSpacing: '.1em',
          marginBottom: 20,
        }}>
          KURZ TITANIUM OSSICULAR PROSTHESES
          <span style={{
            background: 'rgba(0,180,216,.2)',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10,
          }}>{VERSION}</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>
          耳科教育<br />
          <span style={{ color: 'var(--accent)' }}>シミュレーター</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.75, marginBottom: 32 }}>
          チタン製人工耳小骨再建術の選択・配置技術を<br />
          インタラクティブ 3D シミュレーションで習得する耳科教育プラットフォーム
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={goSim}>
            🎯 シミュレーション開始
          </button>
          <button className="btn btn-secondary btn-lg" onClick={goLearn}>
            🔬 学習モード
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 16,
        marginBottom: 48,
      }}>
        {STATS.map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 12,
            padding: '20px 16px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)' }}>{s.value}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── デジタルコンパニオン バナー ── */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        marginBottom: 48,
        background: 'linear-gradient(135deg, rgba(0,180,216,.12) 0%, rgba(240,192,64,.08) 100%)',
        border: '1px solid rgba(0,180,216,.25)',
        borderRadius: 16,
        padding: '28px 32px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: '#f0c040', marginBottom: 8 }}>
            DIGITAL COMPANION CONCEPT
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            物理モデルとデジタルの融合学習
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            このシミュレーターは KURZ 3D プリント側頭骨モデルの「デジタルコンパニオン」です。
            物理モデルで削開練習を行う<strong style={{ color: 'var(--text)' }}>前に</strong>、
            危険部位・プロテーゼ選択・設置位置をデジタルで予習することで学習効果を最大化します。
          </p>
        </div>
        <div style={{ fontSize: 48, opacity: .8 }}>🦴</div>
      </div>

      {/* ── Workflow ── */}
      <div style={{ width: '100%', maxWidth: 900, marginBottom: 56 }}>
        <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 32, color: 'var(--text-secondary)' }}>
          推奨学習フロー
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.num} style={{
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${step.color}33`,
              borderRadius: 16,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              position: 'relative',
            }}>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div style={{
                  position: 'absolute',
                  right: -24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                  color: 'rgba(255,255,255,.2)',
                  zIndex: 1,
                  display: 'none',
                }} className="workflow-arrow">→</div>
              )}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `${step.color}22`,
                border: `2px solid ${step.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 14,
                color: step.color,
              }}>
                {step.num}
              </div>
              <div style={{ fontSize: 22 }}>{step.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: step.color }}>{step.label}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature Cards ── */}
      <div style={{ width: '100%', maxWidth: 900, marginBottom: 56 }}>
        <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 32, color: 'var(--text-secondary)' }}>
          学習コンテンツ
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {SIMULATOR_FEATURES.map(feat => {
            const isMain = feat.action === 'simulation';
            return (
              <div key={feat.title} style={{
                background: isMain
                  ? 'linear-gradient(135deg, rgba(0,180,216,.15) 0%, rgba(0,180,216,.05) 100%)'
                  : 'rgba(255,255,255,.04)',
                border: `1px solid ${isMain ? 'rgba(0,180,216,.4)' : 'rgba(255,255,255,.1)'}`,
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ fontSize: 36 }}>{feat.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{feat.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, flex: 1 }}>{feat.desc}</div>
                <button
                  className={isMain ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={feat.action === 'simulation' ? goSim : goLearn}
                >
                  {feat.actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Product Specs ── */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 32,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.1em', color: 'var(--text-secondary)', marginBottom: 16 }}>
          PRODUCT SPECIFICATIONS
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '10px 40px',
        }}>
          {specs.map(([label, value]) => (
            <div key={label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              gap: 16,
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        color: 'rgba(255,255,255,.25)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 1.8,
      }}>
        <div>KURZ 耳科教育シミュレーター {VERSION}</div>
        <div>Powered by React 19 + Three.js · Educational use only</div>
        <div style={{ marginTop: 4, fontSize: 11 }}>
          © KURZ MEDICAL — For training purposes only. Not a clinical decision support tool.
        </div>
      </div>

    </div>
  );
}
