import { useEffect, useState } from 'react';
import { KurzWordmark, Z_INDEX } from './ui';

export interface SplashProps {
  onComplete: () => void;
}

// KURZ Design System v1 2節「スプラッシュ画面」仕様（2026-07-14 shojiさんフィードバックにより2回調整）:
// 当初案（ロゴ320msフェード→150ms遅延→合計900〜1200ms→280msクロスフェード）は
// 「始まりと終わりがぶつ切りな印象」との指摘を受け各フェーズを引き伸ばし、
// さらに「ロゴが消えてから黒背景の時間をもう少し残してからホーム画面へ切り替わってほしい」
// との指摘を受け、退出フェーズを「①ロゴ・文字が先に消える → ②黒背景のみを一呼吸保持
// → ③ホーム画面へ切り替え」の3段階に分割した（フェードのみ、バウンド等は禁止のまま）。
const LOGO_FADE_IN_MS = 700;          // ロゴが黒背景から浮かび上がるフェードイン
const SUBTITLE_DELAY_MS = 400;        // ロゴがある程度見え始めてからサブタイトルを開始
const SUBTITLE_FADE_IN_MS = 600;
const HOLD_VISIBLE_MS = 900;          // ロゴ・サブタイトルが読める状態を保持する時間
const CONTENT_FADE_OUT_MS = 450;      // ロゴ・サブタイトルが消えるフェードアウト
const BLACK_HOLD_MS = 500;            // 何も表示されない黒背景のみの間（ここを追加）
const CONTAINER_EXIT_MS = 300;        // HomeScreenへの最終切り替え

const CONTENT_EXIT_START_MS = SUBTITLE_DELAY_MS + SUBTITLE_FADE_IN_MS + HOLD_VISIBLE_MS;
const BLACK_HOLD_START_MS = CONTENT_EXIT_START_MS + CONTENT_FADE_OUT_MS;
const CONTAINER_EXIT_START_MS = BLACK_HOLD_START_MS + BLACK_HOLD_MS;

/**
 * 起動時のブランド体験。App.tsx初回マウント時にのみ表示する。
 * モーションはフェードのみ（バウンド・回転・パーティクル演出は禁止、Design System 2節）。
 */
export function Splash({ onComplete }: SplashProps) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  // 'in' の間は decelerate（ゆっくり現れる）、'out' の間は accelerate（すっと消える）を使う
  const [contentPhase, setContentPhase] = useState<'in' | 'out'>('in');
  const [containerExiting, setContainerExiting] = useState(false);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const raf = requestAnimationFrame(() => setLogoVisible(true));

    timers.push(setTimeout(() => setSubtitleVisible(true), SUBTITLE_DELAY_MS));

    // ① ロゴ・サブタイトルを先に消す（黒背景はまだそのまま）
    timers.push(setTimeout(() => {
      setContentPhase('out');
      setLogoVisible(false);
      setSubtitleVisible(false);
    }, CONTENT_EXIT_START_MS));

    // ② 何も見えない黒背景のみの状態を一呼吸保持
    // （③ コンテナのフェードはこの保持が終わったタイミングで開始する）
    timers.push(setTimeout(() => setContainerExiting(true), CONTAINER_EXIT_START_MS));
    timers.push(setTimeout(onComplete, CONTAINER_EXIT_START_MS + CONTAINER_EXIT_MS));

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    onComplete();
  }

  const contentTransition = (durationIn: number, durationOut: number) =>
    contentPhase === 'in'
      ? `opacity ${durationIn}ms var(--ease-decelerate)`
      : `opacity ${durationOut}ms var(--ease-accelerate)`;

  return (
    <div
      onClick={skip}
      role="button"
      aria-label="スプラッシュ画面をスキップ"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.splash,
        background: 'var(--color-bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        cursor: 'pointer',
        opacity: containerExiting ? 0 : 1,
        transition: `opacity ${CONTAINER_EXIT_MS}ms var(--ease-accelerate)`,
      }}
    >
      <div style={{ opacity: logoVisible ? 1 : 0, transition: contentTransition(LOGO_FADE_IN_MS, CONTENT_FADE_OUT_MS) }}>
        <KurzWordmark size={64} style={{ flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }} />
      </div>
      <div
        style={{
          opacity: subtitleVisible ? 1 : 0,
          transition: contentTransition(SUBTITLE_FADE_IN_MS, CONTENT_FADE_OUT_MS),
          font: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
        }}
      >
        Otology Education Simulator
      </div>
    </div>
  );
}
