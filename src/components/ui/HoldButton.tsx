/**
 * HoldButton.tsx — PC/iPhone/iPad共通の「クリック=1ステップ、押しっぱなし=連続実行」ボタン。
 *
 * Phase22.2 GUI Follow-up（操作パネル方針転換）: 矢印キー/Shift/Ctrlはキーボードの存在を前提と
 * するためタッチデバイスに対応できない、というshojiさんの指摘を受けて新設。Pointer Events
 * （onPointerDown/Up/Leave/Cancel）はマウス・タッチ・ペンを同一コードパスで扱えるため、
 * デバイスによらず同じ挙動になる。
 *
 * - onClick: 1ステップだけ実行（onPointerDownで反復が始まる前にすぐ離した場合はこちらのみ発火）。
 * - onPointerDown 継続: HOLD_REPEAT_INTERVAL_MSごとに反復実行。
 * - fast/fine判定: PointerEventのshiftKey/ctrlKeyを押下開始時点で読み取り、保持中は固定する
 *   （タッチ操作ではshiftKey/ctrlKeyは常にfalseになるため、自動的に既定速度のみになる）。
 *
 * ボタンの見た目（角丸・配色）はcomponents/SimulationMode.tsxのAdjRow内部ボタンスタイルを踏襲
 * （shojiさん指定「既存デザイン資産を活かす」方針）。
 */
import { useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import { HOLD_REPEAT_INTERVAL_MS } from '../../scenes/transformControlsConfig';

export interface HoldButtonTickInfo {
  /** Shiftキー押下中（高速）。タッチ操作では常にfalse。 */
  fast: boolean;
  /** Ctrlキー押下中（微細）。タッチ操作では常にfalse。 */
  fine: boolean;
}

export function HoldButton({
  label, ariaLabel, onTick, tone = 'neutral', style,
}: {
  label: ReactNode;
  ariaLabel: string;
  onTick: (info: HoldButtonTickInfo) => void;
  tone?: 'pos' | 'neg' | 'neutral';
  style?: CSSProperties;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const info: HoldButtonTickInfo = { fast: e.shiftKey, fine: e.ctrlKey };
    onTick(info);
    stop();
    timerRef.current = setInterval(() => onTick(info), HOLD_REPEAT_INTERVAL_MS);
  }, [onTick, stop]);

  const toneBg = tone === 'pos' ? 'rgba(80,200,120,.12)' : tone === 'neg' ? 'rgba(255,120,80,.12)' : 'rgba(255,255,255,.06)';
  const toneColor = tone === 'pos' ? 'var(--color-success)' : tone === 'neg' ? 'var(--color-error)' : 'var(--color-text-primary)';

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 8,
        background: toneBg,
        color: toneColor,
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 36,
        minHeight: 36,
        ...style,
      }}
    >
      {label}
    </button>
  );
}
