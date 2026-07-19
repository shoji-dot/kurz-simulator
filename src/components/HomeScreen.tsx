import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { isAdminMode } from '../utils/adminMode';
import { Badge, Button, Alert, KurzLogoMark, Z_INDEX } from './ui';

const VERSION = 'v0.3.0';

export function HomeScreen() {
  const { setScreen, resetSimulation } = useSimStore();
  const [activeTab, setActiveTab] = useState<'modules' | 'about'>('modules');
  const [drillTooltipVisible, setDrillTooltipVisible] = useState(false);
  // 管理者プレビュー: ?admin=1 でアクセスした端末のみ削開練習カードを有効化する（詳細: utils/adminMode.ts）
  const adminMode = isAdminMode();

  const modules = [
    {
      id: 'anatomy' as const,
      step: 1,
      icon: '🔬',
      title: '解剖学習',
      desc: '耳科3D解剖・危険部位・空間認識',
      isPro: false,
      comingSoon: false,
      onClick: () => setScreen('learning'),
    },
    {
      id: 'simulation' as const,
      step: 2,
      icon: '🎯',
      title: 'プロステーシス選択',
      desc: '症例別PORP/TORP選択・3D配置・スコアリング',
      isPro: false,
      comingSoon: false,
      onClick: () => { resetSimulation(); setScreen('simulation'); },
    },
    {
      id: 'stepflow' as const,
      step: 3,
      icon: '🎬',
      title: '手術フロー',
      desc: '鼓室形成術の手順をステップ別3Dで習得',
      isPro: false,
      comingSoon: false,
      onClick: () => setScreen('stepflow'),
    },
    {
      id: 'drill' as const,
      step: 4,
      icon: '💿',
      title: '削開練習',
      // FEATURE_DRILL_ENABLED = false: 一般利用者には Coming Soon として無効化中。
      // adminMode時のみ例外的に有効化（管理者プレビュー、詳細: utils/adminMode.ts）。
      // VR/WebXR 対応後に comingSoon: false, isPro: true へ正式移行する。
      desc: 'インタラクティブ乳突削開シミュレーター',
      isPro: false,
      comingSoon: !adminMode,
      onClick: adminMode ? () => setScreen('drill') : () => {},
    },
    {
      // Phase14: Application Integration Layer。プロステーシス選択(症例完了)を起点に蓄積された
      // 学習履歴(engine/applicationIntegration→useLearningHistoryStore)から、優先教材・反復練習
      // 教材・推奨症例を表示する(Phase13 Learner Application Layerの表示のみ、新しい判断はしない)。
      id: 'dashboard' as const,
      step: 5,
      icon: '📊',
      title: '学習ダッシュボード',
      desc: '完了した症例からの学習状況・推奨教材を確認',
      isPro: false,
      comingSoon: false,
      onClick: () => setScreen('dashboard'),
    },
  ];

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg-primary)',
      overflow: 'hidden',
    }}>

      {/* ── Header（KURZ Design System v1 14節） ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        flexShrink: 0,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KurzLogoMark size={30} />
          <div>
            <div style={{ font: 'var(--text-subtitle)', letterSpacing: '.02em', lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
              KURZ Otology
            </div>
            <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '.04em' }}>
              Otology Simulator
            </div>
          </div>
        </div>
        <div style={{
          font: 'var(--text-caption)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)',
          padding: '3px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
        }}>{VERSION}</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex',
        padding: '0 20px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {([
          { key: 'modules', label: 'Training Modules' },
          { key: 'about',   label: 'About' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="kz-focusable"
            style={{
              padding: '10px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family)',
              color: activeTab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'color var(--duration-fast) var(--ease-standard)',
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
              background: 'var(--color-primary-tint)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              flexShrink: 0,
            }}>
              <div style={{ font: 'var(--text-caption)', color: 'var(--color-primary)', letterSpacing: '.06em', marginBottom: 8 }}>
                推奨学習フロー
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { num: '①', label: '解剖学習' },
                  { num: '→', label: '' },
                  { num: '②', label: 'プロステーシス選択' },
                  { num: '→', label: '' },
                  { num: '③', label: '手術フロー' },
                ].map((item, i) => (
                  item.label
                    ? <span key={i} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{item.num} {item.label}</span>
                    : <span key={i} style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.num}</span>
                ))}
              </div>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => setScreen('learning')}>
                ① 解剖学習から始める →
              </Button>
            </div>

            {/* ── 2×2 Module Grid（KURZ Design System v1 22節: 全カード共通アイコンチップ+単一アクセント） ── */}
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
                      className="kz-focusable kz-module-card"
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 5,
                        position: 'relative',
                        overflow: 'hidden',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        transition: 'border-color var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard)',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                    >
                      {/* Badge */}
                      <Badge
                        tone={isDisabled ? 'neutral' : mod.isPro ? 'warning' : 'primary'}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      >
                        {isDisabled ? 'Coming Soon' : mod.isPro ? 'PRO' : `Step ${mod.step}`}
                      </Badge>

                      {/* Icon chip */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                        background: 'var(--color-primary-tint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, filter: isDisabled ? 'grayscale(1)' : 'none',
                      }}>
                        {mod.icon}
                      </div>

                      {/* Title */}
                      <div style={{ font: 'var(--text-subtitle)', color: isDisabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)', lineHeight: 1.2 }}>
                        {mod.title}
                      </div>

                      {/* Description */}
                      <div style={{ font: 'var(--text-small)', color: 'var(--color-text-secondary)', lineHeight: 1.5, flex: 1 }}>
                        {isDisabled ? 'VR / WebXR 対応予定' : mod.desc}
                      </div>

                      {/* Bottom accent bar */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                        background: 'var(--color-primary)',
                        opacity: isDisabled ? 0.12 : 0.35,
                      }} />
                    </button>

                    {/* Tooltip（drillのみ表示） */}
                    {isDisabled && drillTooltipVisible && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-bright)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 13px',
                        font: 'var(--text-small)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.6,
                        zIndex: Z_INDEX.modal,
                        width: 200,
                        textAlign: 'left',
                        pointerEvents: 'none',
                        boxShadow: 'var(--shadow-lg)',
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4, fontSize: 12 }}>
                          🥽 VR / WebXR 対応予定
                        </div>
                        ブラウザ操作では奥行き感の再現が困難なため、削開練習はVR対応まで提供を見送っています。
                        <div style={{
                          position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                          width: 10, height: 10,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-bright)',
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
            <div style={{ color: 'var(--color-text-primary)', font: 'var(--text-title)' }}>
              KURZ 耳科教育シミュレーター
            </div>
            <p style={{ color: 'var(--color-text-secondary)', font: 'var(--text-body-lg)', lineHeight: 1.7, margin: 0 }}>
              チタン製人工耳小骨再建術の選択・配置技術をインタラクティブ3Dで習得する耳科教育プラットフォーム。
              KURZ 3Dプリント側頭骨モデルの「デジタルコンパニオン」として設計。
            </p>
            <p style={{ color: 'var(--color-text-secondary)', font: 'var(--text-body)', lineHeight: 1.7, margin: 0 }}>
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
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 10px',
                  textAlign: 'center',
                }}>
                  <div style={{ font: 'var(--text-display)', color: 'var(--color-primary)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>{u}</div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Specs */}
            <div style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', border: '1px solid var(--color-border)',
            }}>
              <div style={{
                font: 'var(--text-caption)', color: 'var(--color-text-muted)',
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
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 12,
                }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--color-text-secondary)', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Roadmap: VR/WebXR */}
            <Alert tone="info">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🥽 将来ロードマップ</div>
                <div style={{ font: 'var(--text-small)', lineHeight: 1.6 }}>
                  削開練習モードは <strong>VR / WebXR</strong> 対応後に提供予定。
                  ブラウザ操作では奥行きの再現が困難なため、現バージョンでは無効化しています。
                </div>
              </div>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
