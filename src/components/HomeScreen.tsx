import { useSimStore } from '../store/useSimStore';

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
    desc: '鼓室解剖・耳小骨連鎖・危険部位を3Dインタラクティブで確認。削開アニメーションで手順を予習。',
    action: 'learning' as const,
    actionLabel: '学習を開始',
  },
  {
    icon: '🎯',
    title: 'シミュレーションモード',
    desc: '実症例に基づく PORP/TORP 選択・配置・スコアリング。サイズ・位置・角度・安定性の4指標評価。',
    action: 'simulation' as const,
    actionLabel: 'シミュレーション開始',
  },
];

const specs = [
  ['対象製品', 'KURZ チタン製人工耳小骨 PORP / TORP / ピストン'],
  ['MRI 安全性', '7.0T 対応（Grade 1 チタン）'],
  ['重量', '約 4 mg（超軽量設計）'],
  ['技術基盤', 'React + Three.js / WebGL'],
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
          display: 'inline-block',
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
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>
          耳科教育<br />
          <span style={{ color: 'var(--accent)' }}>シミュレーター</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.75, marginBottom: 32 }}>
          チタン製人工耳小骨再建術の選択・配置技術を<br />
          インタラクティブ 3D シミュレーションで習得する教育プラットフォーム
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
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.12em',
            color: '#f0c040', marginBottom: 8,
          }}>
            🦴 KURZ 3D プリント側頭骨モデル との連携
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>
            デジタル予習 × 物理練習の<br />
            <span style={{ color: 'var(--accent)' }}>ハイブリッド学習</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
            KURZ JAPAN の 3D プリント側頭骨モデルと組み合わせることで、<br />
            削開から人工耳小骨設置まで、術前シミュレーションと実践練習を統合。
          </div>
        </div>
        <div style={{
          background: 'rgba(240,192,64,.1)',
          border: '1px solid rgba(240,192,64,.25)',
          borderRadius: 10,
          padding: '12px 18px',
          textAlign: 'center',
          minWidth: 120,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 11, color: '#f0c040', fontWeight: 700 }}>KURZ JAPAN</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            3D プリント<br />側頭骨モデル
          </div>
        </div>
      </div>

      {/* ── 学習ワークフロー ── */}
      <div style={{ width: '100%', maxWidth: 900, marginBottom: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.08em' }}>
            推奨トレーニングフロー
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 0,
          position: 'relative',
        }}>
          {WORKFLOW_STEPS.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              <div className="card" style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: '50%',
                  background: `${s.color}22`,
                  border: `2px solid ${s.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px',
                  fontSize: 16,
                }}>
                  {s.icon}
                </div>
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  fontSize: 9, fontWeight: 800,
                  color: s.color, letterSpacing: '.06em',
                }}>
                  STEP {s.num}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{s.label}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 4px',
                  color: 'var(--text-muted)', fontSize: 18,
                }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 機能カード ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        width: '100%',
        maxWidth: 900,
        marginBottom: 48,
      }}>
        {SIMULATOR_FEATURES.map((f) => (
          <div key={f.title} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{f.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65, flex: 1 }}>
              {f.desc}
            </div>
            <button
              className="btn btn-sm btn-primary"
              style={{ marginTop: 16, alignSelf: 'flex-start' }}
              onClick={f.action === 'simulation' ? goSim : goLearn}
            >
              {f.actionLabel} →
            </button>
          </div>
        ))}
      </div>

      {/* ── 製品仕様 ── */}
      <div className="card" style={{ maxWidth: 600, width: '100%' }}>
        <div className="section-title" style={{ marginBottom: 12 }}>製品仕様</div>
        {specs.map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="label">{k}</span>
            <span className="value" style={{ fontSize: 12, textAlign: 'right', maxWidth: 340 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* ── フッター ── */}
      <p style={{ marginTop: 40, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        本ツールは医療教育目的のシミュレーターです。実際の手術の代替ではありません。
      </p>
    </div>
  );
}
