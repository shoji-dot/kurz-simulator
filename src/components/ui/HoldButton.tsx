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
  label, ariaLabel, onTick, onRelease, tone = 'neutral', style, className,
}: {
  label: ReactNode;
  ariaLabel: string;
  onTick: (info: HoldButtonTickInfo) => void;
  /**
   * [M-2、issue③ Depth用に追加] 押下（タップ含む）が終わったとき（pointerup/leave/cancel）に
   * 一度だけ呼ばれる任意コールバック。既存のtranslate/rotate/rotateShaftRollはセッション概念を
   * 持たないため未指定のまま（デフォルトundefined、既存呼び出し元は完全に無変更のまま動作する）。
   * Depthはキーボード操作でもkeyupでendDepthSession(true)を呼ぶセッション終了処理を持つため、
   * タッチ操作でも同じタイミング（指を離した時）でPlacementControls.endDepth()を呼べるようにする。
   */
  onRelease?: () => void;
  tone?: 'pos' | 'neg' | 'neutral';
  style?: CSSProperties;
  /** [M-2 real-device follow-up 3、issue④] モバイル専用の正方形サイズ強制（CSSクラス経由）用。
   *  デスクトップはこのクラスに対応するCSSルールを持たないため無影響。 */
  className?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // タイマーの停止のみを行う（ユーザー向けonReleaseは呼ばない）。start()が新しい押下の開始直前に
  // 前回タイマーを掃除するために使う内部専用ヘルパー——ここでonReleaseを呼ぶと、2回目以降の押下
  // 開始のたびに直前の押下がまだ終わっていないかのような誤ったonRelease発火が起きてしまう。
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ユーザーの指/マウスが実際に離れた（pointerup/leave/cancel）ときのみ呼ぶ。タイマー停止に加えて
  // onReleaseを一度だけ呼ぶ。
  const stop = useCallback(() => {
    clearTimer();
    onRelease?.();
  }, [clearTimer, onRelease]);

  const start = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const info: HoldButtonTickInfo = { fast: e.shiftKey, fine: e.ctrlKey };
    onTick(info);
    clearTimer();
    timerRef.current = setInterval(() => onTick(info), HOLD_REPEAT_INTERVAL_MS);
  }, [onTick, clearTimer]);

  const toneBg = tone === 'pos' ? 'rgba(80,200,120,.12)' : tone === 'neg' ? 'rgba(255,120,80,.12)' : 'rgba(255,255,255,.06)';
  const toneColor = tone === 'pos' ? 'var(--color-success)' : tone === 'neg' ? 'var(--color-error)' : 'var(--color-text-primary)';

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      className={className}
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
        WebkitUserSelect: 'none',
        // [M-2 issue④] user-select:none/touch-action:noneだけではiOS Safariの長押しコールアウト
        // （拡大鏡+コピー等のバブル）は抑制できない（M1投資調査で特定、-webkit-touch-calloutは
        // 標準外の別プロパティ）。長押し継続操作を担うHoldButtonにのみ適用する（グローバル適用は
        // 行わない、指示§7「narrowest appropriate scope」）。
        WebkitTouchCallout: 'none',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Phase22.2 GUI Follow-up 実機レビュー: iPhoneでのタップ領域確保のためApple HIG目安の
        // 44ptに拡大（shojiさん指摘、旧36pxは小さすぎ誤タップの懸念ありとの評価）。
        // [M-2 real-device follow-up 2、issue④] 上記の44pt方針はデスクトップ/既定では維持しつつ、
        // ControlPad展開時にCanvasのほとんどを覆うという新たな実機指摘（shojiさん、2026-08-20）を
        // 受けてモバイルのみ--control-pad-button-sizeで38pxへ縮小する（誤タップ回避の下限として
        // 旧36pxよりは大きい値を維持、44pt原則そのものは変更しない——CSS変数でモバイル限定の
        // 例外を明示的に上書きする形にすることで、両方の実機フィードバックの経緯を残す）。
        minWidth: 'var(--control-pad-button-size, 44px)',
        minHeight: 'var(--control-pad-button-size, 44px)',
        ...style,
      }}
    >
      {label}
    </button>
  );
}
