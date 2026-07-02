import { useState } from 'react';
import type React from 'react';
import { useSimStore } from '../store/useSimStore';

const VERSION = 'v0.3.0';

export function HomeScreen() {
  const { setScreen, resetSimulation } = useSimStore();
  const [activeTab, setActiveTab] = useState<'modules' | 'about'>('modules');
  const [drillTooltipVisible, setDrillTooltipVisible] = useState(false);

  const modules = [
    {
      id: 'anatomy' as const,
      step: 1,
      icon: '🔬',
      title: '解剖学習',
      titleEn: '3D Anatomy',
      desc: '耳科3D解剖・危険部位・空間認識',
      isPro: false,
      comingSoon: false,
      grad: 'linear-gradient(145deg, #0a2a4a 0%, #0d1520 100%)',
      accent: '#00b4d8',
      onClick: () => setScreen('learning'),
    },
    {
      id: 'simulation' as const,
      step: 2,
      icon: '🎯',
      title: 'プロステーシス選択',
      titleEn: 'Prosthesis Sim',
      desc: '症例別PORP/TORP選択・3D配置・スコアリング',
      isPro: false,
      comingSoon: false,
      grad: 'linear-gradient(145deg, #0a3a2a 0%, #0d1a14 100%)',
      accent: '#06d6a0',
      onClick: () => { resetSimulation(); setScreen('simulation'); },
    },
    {
      id: 'stepflow' as const,
      step: 3,
      icon: '🎬',
      title: '手術フロー',
      titleEn: 'Surgical Flow',
      desc: '鼓室形成術の手順をステップ別3Dで習得',
      isPro: false,
      comingSoon: false,
      grad: 'linear-gradient(145deg, #1a0a4a 0%, #120d20 100%)',
      accent: '#a78bfa',
      onClick: () => setScreen('stepflow'),
    },
    {
      id: 'drill' as const,
      step: 4,
      icon: '💿',
      title: '削開練習',
      titleEn: 'Drill Training',
      // FEATURE_DRILL_ENABLED = false: ボタンは Coming Soon として無効化中
      // VR/WebXR 対応後に comingSoon: false, isPro: true に戻す
      desc: 'インタラクティブ乳突削開シミュレーター',
      isPro: false,
      comingSoon: true,
      grad: 'linear-gradient(145deg, #1a1a1a 0%, #111111 100%)',
      accent: '#4a5568',
      onClick: () => {},
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
            <div style={{ fontSize: 11, color: '#3a4a6a', letterSpacing: '.04em' }}>
              Otology Simulator
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
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {activeTab === 'modules' ? (
          <>
            {/* ── はじめての方へ ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,100,140,0.18) 0%, rgba(0,60,100,0.12) 100%)',
              border: '1px solid rgba(0,180,216,0.25)',
              borderRadius: 12,
              padding: '12px 16px',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00b4d8', letterSpacing: '.06em', marginBottom: 8 }}>
                推奨学習フロー
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { num: '①', label: '解剖学習', color: '#00b4d8' },
                  { num: '→', label: '', color: '#3a4a6a' },
                  { num: '②', label: 'プロステーシス選択', color: '#06d6a0' },
                  { num: '→', label: '', color: '#3a4a6a' },
                  { num: '③', label: '手術フロー', color: '#a78bfa' },
                ].map((item, i) => (
                  item.label
                    ? <span key={i} style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.num} {item.label}</span>
                    : <span key={i} style={{ fontSize: 11, color: item.color }}>{item.num}</span>
                ))}
              </div>
              <button
                onClick={() => setScreen('learning')}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(0,180,216,0.18)', color: '#00b4d8',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  letterSpacing: '.02em',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.28)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.18)'; }}
              >
                ① 解剖学習から始める →
              </button>
            </div>

            {/* ── 2×2 Module Grid ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              {modules.map(mod => {
                const isDisabled = mod.comingSoon;
                return (
                  <div key={mod.id} style={{ position: 'relative' }}>
                    <button
                      disabled={isDisabled}
                      onClick={isDisabled ? undefined : mod.onClick}
                      onMouseEnter={() => { if (isDisabled) setDrillTooltipVisible(true); }}
                      onMouseLeave={() => { if (isDisabled) setDrillTooltipVisible(false); }}
                      onTouchStart={() => { if (isDisabled) setDrillTooltipVisible(true); }}
                      onTouchEnd={() => { if (isDisabled) setTimeout(() => setDrillTooltipVisible(false), 2000); }}
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        background: mod.grad,
                        border: `1px solid ${mod.accent}1a`,
                        borderRadius: 14,
                        padding: '14px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 5,
                        position: 'relative',
                        overflow: 'hidden',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'border-color .2s, transform .15s',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                      onMouseOver={isDisabled ? undefined : (e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.borderColor = mod.accent + '55';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={isDisabled ? undefined : (e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.borderColor = mod.accent + '1a';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Badge */}
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: isDisabled
                          ? 'rgba(100,100,120,0.22)'
                          : mod.isPro ? 'rgba(245,158,11,.14)' : `${mod.accent}18`,
                        border: `1px solid ${isDisabled
                          ? 'rgba(100,100,120,0.35)'
                          : mod.isPro ? 'rgba(245,158,11,.32)' : mod.accent + '35'}`,
                        borderRadius: 5, padding: '2px 7px',
                        fontSize: 10, fontWeight: 700,
                        color: isDisabled ? '#5a6070' : mod.isPro ? '#f59e0b' : mod.accent,
                        letterSpacing: '.04em',
                      }}>
                        {isDisabled ? 'Coming Soon' : mod.isPro ? 'PRO' : `Step ${mod.step}`}
                      </div>

                      {/* Icon */}
                      <div style={{ fontSize: 24, lineHeight: 1, filter: isDisabled ? 'grayscale(1)' : 'none' }}>
                        {mod.icon}
                      </div>

                      {/* Title */}
                      <div style={{ fontWeight: 800, fontSize: 14, color: isDisabled ? '#4a5568' : '#e8eaf0', lineHeight: 1.2 }}>
                        {mod.title}
                      </div>

                      {/* Description */}
                      <div style={{ fontSize: 10, color: '#4a5a7a', lineHeight: 1.5, flex: 1 }}>
                        {isDisabled ? 'VR / WebXR 対応予定' : mod.desc}
                      </div>

                      {/* Bottom accent bar */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                        background: `linear-gradient(90deg, ${mod.accent} 0%, transparent 70%)`,
                        opacity: isDisabled ? 0.15 : 0.45,
                      }} />
                    </button>

                    {/* Tooltip（drillのみ表示） */}
                    {isDisabled && drillTooltipVisible && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(15,18,30,0.97)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 9,
                        padding: '10px 13px',
                        fontSize: 11,
                        color: '#a0aec0',
                        lineHeight: 1.6,
                        zIndex: 100,
                        width: 200,
                        textAlign: 'left',
                        pointerEvents: 'none',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                      }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4, fontSize: 12 }}>
                          🥽 VR / WebXR 対応予定
                        </div>
                        ブラウザ操作では奥行き感の再現が困難なため、削開練習はVR対応まで提供を見送っています。
                        <div style={{
                          position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                          width: 10, height: 10,
                          background: 'rgba(15,18,30,0.97)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderBottom: 'none', borderRight: 'none',
                          rotate: '225deg',
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>

        ) : (

          /* About tab */
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 15 }}>
              KURZ 耳科教育シミュレーター
            </div>
            <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              チタン製人工耳小骨再建術の選択・配置技術をインタラクティブ3Dで習得する耳科教育プラットフォーム。
              KURZ 3Dプリント側頭骨モデルの「デジタルコンパニオン」として設計。
            </p>
            <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              物理モデルで削開練習を行う前に危険部位・プロステーシス選択・設置位置をデジタルで予習することで学習効果を最大化します。
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                ['15', '症例', '難易度別'],
                ['3', '製品', 'KURZシリーズ'],
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
                  <div style={{ fontSize: 11, color: '#3a4a6a', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Specs */}
            <div style={{
              background: 'rgba(255,255,255,.03)', borderRadius: 10,
              padding: '12px 14px', border: '1px solid rgba(255,255,255,.07)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#3a4a6a',
                letterSpacing: '.06em', marginBottom: 8,
              }}>製品仕様</div>
              {[
                ['対象製品', 'KURZ チタン PORP / TORP / Soft Clip'],
                ['MRI安全性', '7.0T対応 (Grade 1 Ti)'],
                ['重量', '約 1〜5mg（超軽量）'],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  fontSize: 12,
                }}>
                  <span style={{ color: '#3a4a6a' }}>{k}</span>
                  <span style={{ color: '#6a7a9a', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Roadmap: VR/WebXR */}
            <div style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.18)',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '.06em', marginBottom: 6 }}>
                🥽 将来ロードマップ
              </div>
              <p style={{ color: '#6a7a9a', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                削開練習モードは <strong style={{ color: '#818cf8' }}>VR / WebXR</strong> 対応後に提供予定。
                ブラウザ操作では奥行きの再現が困難なため、現バージョンでは無効化しています。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
