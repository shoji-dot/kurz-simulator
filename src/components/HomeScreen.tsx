import { useSimStore } from '../store/useSimStore';

const features = [
  { icon: '🔬', title: '解剖学習モード', desc: '鼓室解剖・耳小骨連鎖・製品ラインナップをインタラクティブ3Dで学習' },
  { icon: '🎯', title: 'シミュレーションモード', desc: '実症例に基づく人工耳小骨選択・配置・スコアリングを実践トレーニング' },
  { icon: '📊', title: '多指標スコアリング', desc: 'サイズ・位置・角度・安定性の4指標100点評価でS〜Dランク判定' },
];

const specs = [
  ['対象製品', 'KURZ チタン製人工耳小骨 PORP/TORP/ピストン'],
  ['MRI安全性', '7.0T 対応（Grade 1 チタン）'],
  ['重量', '約4mg（超軽量設計）'],
  ['技術基盤', 'React + Three.js / WebGL'],
];

export function HomeScreen() {
  const setScreen = useSimStore((s) => s.setScreen);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', background: 'radial-gradient(ellipse at 50% 0%, #0d1f3c 0%, #0a0e1a 60%)' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 700, marginBottom: 60 }}>
        <div style={{ display: 'inline-block', background: 'rgba(0,180,216,.1)', border: '1px solid rgba(0,180,216,.3)', borderRadius: 999, padding: '4px 16px', fontSize: 12, color: 'var(--accent)', fontWeight: 700, letterSpacing: '.1em', marginBottom: 20 }}>
          KURZ TITANIUM OSSICULAR PROSTHESES
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>
          耳科教育<br />
          <span style={{ color: 'var(--accent)' }}>シミュレーター</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
          チタン製人工耳小骨再建術の選択・配置技術を、<br />
          インタラクティブ3Dシミュレーションで習得する教育プラットフォーム
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => setScreen('simulation')}>
            🎯 シミュレーション開始
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => setScreen('learning')}>
            🔬 学習モード
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, width: '100%', maxWidth: 900, marginBottom: 48 }}>
        {features.map((f) => (
          <div key={f.title} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>{f.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Specs table */}
      <div className="card" style={{ maxWidth: 600, width: '100%' }}>
        <div className="section-title" style={{ marginBottom: 12 }}>製品仕様</div>
        {specs.map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="label">{k}</span>
            <span className="value" style={{ fontSize: 12, textAlign: 'right', maxWidth: 320 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 40, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        本ツールは医療教育目的のシミュレーターです。実際の手術の代替ではありません。
      </p>
    </div>
  );
}
