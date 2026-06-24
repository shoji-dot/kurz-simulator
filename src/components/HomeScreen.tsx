import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';

const VERSION = 'v0.3.0';

export function HomeScreen() {
  const { setScreen, resetSimulation } = useSimStore();
  const [activeTab, setActiveTab] = useState<'modules' | 'about'>('modules');

  const modules = [
    {
      id: 'anatomy' as const,
      icon: '🔬',
      title: '解剖学習',
      titleEn: '3D Anatomy',
      desc: '耳科3D解剖・危険部位・削開シナリオ予習',
      isPro: false,
      grad: 'linear-gradient(145deg, #0a2a4a 0%, #0d1520 100%)',
      accent: '#00b4d8',
      onClick: () => setScreen('learning'),
    },
    {
      id: 'simulation' as const,
      icon: '🎯',
      title: 'プロテーゼ選択',
      titleEn: 'Prosthesis Sim',
      desc: '症例別PORP/TORP選択・3D配置・スコアリング',
      isPro: false,
      grad: 'linear-gradient(145deg, #0a3a2a 0%, #0d1a14 100%)',
      accent: '#06d6a0',
      onClick: () => { resetSimulation(); setScreen('simulation'); },
    },
    {
      id: 'stepflow' as const,
      icon: '🎬',
      title: '手術フロー',
      titleEn: 'Surgical Flow',
      desc: '鼓室形成術の手順をステップ別3Dで習得',
      isPro: false,
      grad: 'linear-gradient(145deg, #1a0a4a 0%, #120d20 100%)',
      accent: '#a78bfa',
      onClick: () => setScreen('stepflow'),
    },
    {
      id: 'drill' as const,
      icon: '💿',
      title: '削開練習',
      titleEn: 'Drill Training',
      desc: 'インタラクティブ乳突削開・乳突洞開放シミュレーター',
      isPro: true,
      grad: 'linear-gradient(145deg, #2a1a0a 0%, #1a1208 100%)',
      accent: '#f59e0b',
      onClick: () => setScreen('drill'),
    },
  ];

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f1117',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #00b4d8 0%, #005f80 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, flexShrink: 0,
          }}>⚕</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.02em', lineHeight: 1.2, color: '#e8eaf0' }}>
              KURZ Otology
            </div>
            <div style={{ fontSize: 10, color: '#3a4a6a', letterSpacing: '.08em' }}>
              SURGICAL TRAINING SIMULATOR
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 11, color: '#3a4a6a',
          background: 'rgba(255,255,255,.04)',
          padding: '3px 10px', borderRadius: 6,
          border: '1px solid rgba(255,255,255,.07)',
        }}>{VERSION}</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        flexShrink: 0,
      }}>
        {([
          { key: 'modules', label: 'Training Modules' },
          { key: 'about',   label: 'About' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              color: activeTab === key ? '#00b4d8' : '#3a4a6a',
              borderBottom: activeTab === key ? '2px solid #00b4d8' : '2px solid transparent',
              marginBottom: -1, transition: 'color .15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1, padding: '12px 14px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {activeTab === 'modules' ? (

          /* 2×2 Module Grid — centered, PC対応 */
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            width: '100%',
            maxWidth: 480,
          }}>
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={mod.onClick}
                style={{
                  aspectRatio: '4 / 3',
                  background: mod.grad,
                  border: `1px solid ${mod.accent}1a`,
                  borderRadius: 14,
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'border-color .2s, transform .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = mod.accent + '55';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = mod.accent + '1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Badge */}
                {mod.isPro ? (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(245,158,11,.14)',
                    border: '1px solid rgba(245,158,11,.32)',
                    borderRadius: 5, padding: '2px 7px',
                    fontSize: 10, fontWeight: 700, color: '#f59e0b',
                    letterSpacing: '.07em',
                  }}>🔒 PRO</div>
                ) : (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(6,214,160,.10)',
                    border: '1px solid rgba(6,214,160,.25)',
                    borderRadius: 5, padding: '2px 7px',
                    fontSize: 10, fontWeight: 700, color: '#06d6a0',
                    letterSpacing: '.07em',
                  }}>FREE</div>
                )}

                {/* Icon */}
                <div style={{ fontSize: 26, lineHeight: 1 }}>{mod.icon}</div>

                {/* Title */}
                <div>
                  <div style={{
                    fontWeight: 800, fontSize: 15, color: '#e8eaf0', lineHeight: 1.2,
                  }}>{mod.title}</div>
                  <div style={{
                    fontSize: 10, color: mod.accent,
                    letterSpacing: '.07em', fontWeight: 700, marginTop: 2,
                  }}>{mod.titleEn}</div>
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 11, color: '#4a5a7a', lineHeight: 1.5, flex: 1,
                }}>{mod.desc}</div>

                {/* Bottom accent bar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${mod.accent} 0%, transparent 70%)`,
                  opacity: 0.45,
                }} />
              </button>
            ))}
          </div>
          </div>

        ) : (

          /* About tab */
          <div style={{
            flex: 1, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 14,
            paddingRight: 2,
          }}>
            <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 15 }}>
              KURZ 耳科教育シミュレーター
            </div>
            <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              チタン製人工耳小骨再建術の選択・配置技術をインタラクティブ3Dで習得する耳科教育プラットフォーム。
              KURZ 3Dプリント側頭骨モデルの「デジタルコンパニオン」として設計。
            </p>
            <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              物理モデルで削開練習を行う前に危険部位・プロテーゼ選択・設置位置をデジタルで予習することで学習効果を最大化します。
            </p>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              {[
                ['11', '症例', '難易度別'],
                ['5', '製品', 'KURZシリーズ'],
                ['4', '指標', 'スコアリング'],
              ].map(([v, u, l]) => (
                <div key={u} style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 10, padding: '12px 10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#00b4d8' }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#00b4d8', fontWeight: 700 }}>{u}</div>
                  <div style={{ fontSize: 10, color: '#3a4a6a', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Specs */}
            <div style={{
              background: 'rgba(255,255,255,.03)', borderRadius: 10,
              padding: '12px 14px', border: '1px solid rgba(255,255,255,.07)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#3a4a6a',
                letterSpacing: '.1em', marginBottom: 8,
              }}>PRODUCT SPECIFICATIONS</div>
              {[
                ['対象製品', 'KURZ チタン PORP / TORP'],
                ['MRI安全性', '7.0T対応 (Grade 1 Ti)'],
                ['重量', '約 4mg（超軽量）'],
                ['技術基盤', 'React 19 + Three.js / WebGL'],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  fontSize: 12,
                }}>
                  <span style={{ color: '#5a6a8a' }}>{k}</span>
                  <span style={{ color: '#8899bb', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ fontSize: 11, color: '#2a3a5a', paddingBottom: 8 }}>
              © KURZ MEDICAL — For training purposes only. Not a clinical decision support tool.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
