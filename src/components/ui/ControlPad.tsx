/**
 * ControlPad.tsx — PC/iPhone/iPad共通の「プロステーシス操作パネル」（位置＋回転）。
 *
 * Phase22.2 GUI Follow-up（操作パネル方針転換）: TransformControls（ドラッグ）は粗調整専用、
 * 本パネルが精密調整の主役という役割分担（shojiさん確定方針）。内部では
 * useSimStore.getState().translateSelectedObject()/rotateSelectedObject() を呼ぶのみで、
 * 矢印キー・将来の他画面展開とも完全に同じAPIを共有する（座標計算はstore側に閉じる設計を維持）。
 *
 * 今回のスコープは位置＋回転のみ（倍率・リセットは次回増分、shojiさん確認済み）。
 * STEP6（StepFlowMode）限定、SimulationModeへの展開は別途判断。
 */
import { HoldButton } from './HoldButton';
import { useSimStore } from '../../store/useSimStore';
import {
  KEYBOARD_STEP_MM, KEYBOARD_STEP_CTRL_MM, HOLD_STEP_FAST_MM,
  ROTATION_STEP_DEG, ROTATION_STEP_FINE_DEG, ROTATION_STEP_FAST_DEG,
} from '../../scenes/transformControlsConfig';

function moveStepMm(fast: boolean, fine: boolean): number {
  return fast ? HOLD_STEP_FAST_MM : fine ? KEYBOARD_STEP_CTRL_MM : KEYBOARD_STEP_MM;
}
function rotateStepDeg(fast: boolean, fine: boolean): number {
  return fast ? ROTATION_STEP_FAST_DEG : fine ? ROTATION_STEP_FINE_DEG : ROTATION_STEP_DEG;
}

const sectionLabelStyle = { fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, textAlign: 'center' as const };

export function ControlPad() {
  const translate = (axis: 'x' | 'y' | 'z', sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    useSimStore.getState().translateSelectedObject(axis, sign * moveStepMm(info.fast, info.fine));
  };
  const rotate = (axis: 'tilt' | 'tiltZ', sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    useSimStore.getState().rotateSelectedObject(axis, sign * rotateStepDeg(info.fast, info.fine));
  };

  return (
    <div style={{ background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', backdropFilter: 'var(--glass-blur)', padding: 8, width: 132 }}>
      {/* ── 位置（左右=lateral、上下=vertical、前後=anterior） ── */}
      <div style={sectionLabelStyle}>位置</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 4, marginBottom: 6 }}>
        <div />
        <HoldButton ariaLabel="上へ移動" label="↑" tone="neutral" onTick={translate('y', 1)} style={{ gridColumn: 2, gridRow: 1 }} />
        <div />
        <HoldButton ariaLabel="左へ移動" label="←" tone="neutral" onTick={translate('x', -1)} style={{ gridColumn: 1, gridRow: 2 }} />
        <HoldButton ariaLabel="下へ移動" label="↓" tone="neutral" onTick={translate('y', -1)} style={{ gridColumn: 2, gridRow: 2 }} />
        <HoldButton ariaLabel="右へ移動" label="→" tone="neutral" onTick={translate('x', 1)} style={{ gridColumn: 3, gridRow: 2 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 8 }}>
        <HoldButton ariaLabel="前方向へ移動" label="前" tone="neutral" onTick={translate('z', 1)} />
        <HoldButton ariaLabel="後方向へ移動" label="後" tone="neutral" onTick={translate('z', -1)} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', margin: '4px 0 6px' }} />

      {/* ── 回転（前後傾斜=angleTilt、左右傾斜=angleTiltZ） ── */}
      <div style={sectionLabelStyle}>回転</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
        <HoldButton ariaLabel="前傾（前後傾斜を前方向へ）" label="前傾" tone="neutral" onTick={rotate('tilt', 1)} style={{ fontSize: 11 }} />
        <HoldButton ariaLabel="後傾（前後傾斜を後方向へ）" label="後傾" tone="neutral" onTick={rotate('tilt', -1)} style={{ fontSize: 11 }} />
        <HoldButton ariaLabel="左傾（左右傾斜を左方向へ）" label="左傾" tone="neutral" onTick={rotate('tiltZ', -1)} style={{ fontSize: 11 }} />
        <HoldButton ariaLabel="右傾（左右傾斜を右方向へ）" label="右傾" tone="neutral" onTick={rotate('tiltZ', 1)} style={{ fontSize: 11 }} />
      </div>
    </div>
  );
}
