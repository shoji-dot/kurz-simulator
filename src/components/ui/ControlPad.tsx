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
 *
 * 実機スクリーンショットレビュー（2026-07-22）反映:
 * - ↑↓←→アイコン単体だと「上が画面の上なのか頭側なのか」迷うとの指摘を受け、既存AdjRow/
 *   「あなたの設置」表示と同じ解剖学用語（内/外/上/下）をアイコンに併記。
 * - ボタンはApple HIG目安の44pt（HoldButton側で対応）に合わせ、パネル幅を168pxへ拡大。
 *
 * モバイル重なりバグ修正（2026-07-22、iPhone実機スクリーンショットで発見）:
 * - `.canvas-wrapper`はモバイルで`48dvh`/`min-height:260px`しかなく、ControlPadの展開時高さ
 *   （位置6ボタン+回転4ボタン、実測約320〜340px）がその枠を超えて上部ツールバー（移動/視点等）
 *   と重なっていた。shojiさん指示で「デフォルト折りたたみ＋展開ボタン」方式を採用（ControlPad.tsx
 *   単体の変更のみ、canvas-wrapperの共有CSSは他画面への影響を避けるため触らない）。
 *   折りたたみ時は`詳細調整`パネル（SimulationMode.tsx）と同じ▾矢印回転パターンを踏襲。
 */
import { useState } from 'react';
import { HoldButton } from './HoldButton';
import { useSimStore } from '../../store/useSimStore';
import type { TransportControls } from '../../scenes/transport/ManipulationLayer';
import type { PlacementControls } from '../../scenes/canonicalPose';
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

/** アイコン＋解剖学用語の2段ラベル（内外側/上下は既存AdjRow・「あなたの設置」表示と同じ用語）。 */
function DirLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>{text}</span>
    </span>
  );
}

export interface ControlPadProps {
  /**
   * Phase1-B ControlPad Transport対応: falseの間（Transport段階、Direct Manipulation UX）は
   * Position/Tilt操作をPlacementStateではなくtransportControls経由でtransportPose/
   * transportTiltへ反映する。既定値true（＝従来どおりPlacementStateへ直接反映）のため、
   * このpropを渡さない既存の呼び出し元（StepFlowMode.tsx等）は完全に無変更のまま動作する。
   */
  manipulationCommitted?: boolean;
  /** Transport段階でPosition/Tiltを操作するためのコールバック（SimScene経由）。
   *  manipulationCommitted=falseかつこれが未設定の場合は、既存のPlacementState経路へ
   *  フォールバックする（安全側のデフォルト、クラッシュしない）。 */
  transportControls?: TransportControls | null;
  /**
   * [D-4、Implementation Specification Section 11 Requirement 4] Placement段階（
   * manipulationCommitted=true）でPosition/Rotate/Shaft RollをCollision Candidate評価
   * 経由で操作するためのコールバック（SimScene→DraggableProsthesis経由）。
   * `enforcePlacementCollisionGate`未指定/false時は、未設定の場合に従来通り
   * useSimStore.getState()を直接呼ぶ（transportControlsと同じ安全側フォールバック、
   * クラッシュしない）。`enforcePlacementCollisionGate=true`の呼び出し元では、この
   * フォールバックはno-opへ置き換わる（下記参照）。
   */
  placementControls?: PlacementControls | null;
  /**
   * [D-4 Post-Implementation Review Finding 2、Architect Decision Section 23]
   * true時、Placement段階（manipulationCommitted===true）でplacementControlsが未接続の間、
   * Translation/Rotate/Shaft Roll操作をno-opとする（Collision Candidate評価を経由しない
   * store直接書き込みを禁止する、Requirement 4）。
   *
   * 既定値false（未指定）——`placementControls`が伝播しないままD-4のCollision Candidate
   * 経路を一切知らない既存の呼び出し元（例: StepFlowMode.tsx、D-4 Scope外・変更禁止、
   * Post-Implementation Review Finding 3参照）は、このpropを渡さないことで完全に無変更の
   * まま動作し続ける（`manipulationCommitted && !placementControls`だけでは、
   * 「Placement Collision Candidate経路を持つ呼び出し元のpropagation待ち」と
   * 「そもそもこの経路を持たない呼び出し元」を区別できないため、明示的なopt-inとして
   * 新設した）。
   *
   * `SimulationMode.tsx`のPlacement flow（D-4 Investigation対象、Requirement 4適用対象）
   * からは`true`で呼ぶ。
   */
  enforcePlacementCollisionGate?: boolean;
}

export function ControlPad({
  manipulationCommitted = true, transportControls, placementControls,
  enforcePlacementCollisionGate = false,
}: ControlPadProps = {}) {
  const [expanded, setExpanded] = useState(false);

  const translate = (axis: 'x' | 'y' | 'z', sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    const deltaMm = sign * moveStepMm(info.fast, info.fine);
    if (!manipulationCommitted && transportControls) {
      transportControls.translate(axis, deltaMm);
    } else if (manipulationCommitted && placementControls) {
      placementControls.translate(axis, deltaMm);
    } else if (manipulationCommitted && enforcePlacementCollisionGate) {
      // [D-4 Post-Implementation Review Finding 2、Architect Decision Section 23]
      // Placement段階でplacementControlsが未接続の間はno-opとする（Collision Candidate
      // 評価を経由しないstore直接書き込みを禁止する、Requirement 4）。
      // enforcePlacementCollisionGate=falseの呼び出し元（StepFlowMode.tsx等、D-4 Scope外）
      // には適用しない——下のelse節（既存fallback）が引き続き使われる。
    } else {
      useSimStore.getState().translateSelectedObject(axis, deltaMm);
    }
  };
  const rotate = (axis: 'tilt' | 'tiltZ', sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    const deltaDeg = sign * rotateStepDeg(info.fast, info.fine);
    if (!manipulationCommitted && transportControls) {
      transportControls.rotate(axis, deltaDeg);
    } else if (manipulationCommitted && placementControls) {
      placementControls.rotate(axis, deltaDeg);
    } else if (manipulationCommitted && enforcePlacementCollisionGate) {
      // [D-4 Post-Implementation Review Finding 2] translateと同じno-op（上記コメント参照）。
    } else {
      useSimStore.getState().rotateSelectedObject(axis, deltaDeg);
    }
  };
  // Phase1-B Step4: shaft roll（interactionShaftRollDeg、PlacementStateの外側）。
  // 既存のROTATION_STEP_DEG/FINE/FAST定数をそのまま再利用する。
  // [D-4] Placement段階かつplacementControls利用可能時はCollision Candidate評価を経由する
  // （Requirement 4、従来Shaft RollはCollision評価を一切経由していなかった）。
  // [D-4 Post-Implementation Review Finding 2] translate/rotateと同じ規約
  // （enforcePlacementCollisionGate=true時のみno-op、false時は既存store直接呼び出しを維持）。
  const rotateShaftRoll = (sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    const deltaDeg = sign * rotateStepDeg(info.fast, info.fine);
    if (manipulationCommitted && placementControls) {
      placementControls.rotateShaftRoll(deltaDeg);
    } else if (manipulationCommitted && enforcePlacementCollisionGate) {
      // no-op（translate/rotateと同じ理由、上記コメント参照）。
    } else {
      useSimStore.getState().rotateShaftRoll(deltaDeg);
    }
  };

  // 折りたたみ時: 小さな展開チップのみ表示（3Dビューを塞がない）
  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="操作パネルを開く（位置・回転の微調整）"
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', backdropFilter: 'var(--glass-blur)',
          border: 'none', padding: '8px 12px', minHeight: 44,
          color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 15 }}>🎮</span> 操作パネル
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>▸</span>
      </button>
    );
  }

  return (
    <div style={{ background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', backdropFilter: 'var(--glass-blur)', padding: 8, width: 168 }}>
      {/* ── 折りたたみボタン（開いている時のみ表示） ── */}
      <button
        type="button"
        aria-label="操作パネルを閉じる"
        onClick={() => setExpanded(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'transparent', border: 'none', padding: '2px 2px 6px', margin: 0, cursor: 'pointer',
          color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
        }}
      >
        <span>操作パネル</span>
        <span style={{ fontSize: 11, display: 'inline-block', transform: 'rotate(180deg)' }}>▸</span>
      </button>

      {/* ── 位置（左右=lateral、上下=vertical、前後=anterior） ── */}
      <div style={sectionLabelStyle}>位置</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
        <div />
        <HoldButton ariaLabel="上へ移動" label={<DirLabel icon="↑" text="上" />} tone="neutral" onTick={translate('y', 1)} style={{ gridColumn: 2, gridRow: 1 }} />
        <div />
        <HoldButton ariaLabel="内側へ移動" label={<DirLabel icon="←" text="内" />} tone="neutral" onTick={translate('x', -1)} style={{ gridColumn: 1, gridRow: 2 }} />
        <HoldButton ariaLabel="下へ移動" label={<DirLabel icon="↓" text="下" />} tone="neutral" onTick={translate('y', -1)} style={{ gridColumn: 2, gridRow: 2 }} />
        <HoldButton ariaLabel="外側へ移動" label={<DirLabel icon="→" text="外" />} tone="neutral" onTick={translate('x', 1)} style={{ gridColumn: 3, gridRow: 2 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
        <HoldButton ariaLabel="前方向へ移動" label="前" tone="neutral" onTick={translate('z', 1)} />
        <HoldButton ariaLabel="後方向へ移動" label="後" tone="neutral" onTick={translate('z', -1)} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', margin: '4px 0 8px' }} />

      {/* ── 回転（前後傾斜=angleTilt、左右傾斜=angleTiltZ） ── */}
      <div style={sectionLabelStyle}>回転</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        <HoldButton ariaLabel="前傾（前後傾斜を前方向へ）" label="前傾" tone="neutral" onTick={rotate('tilt', 1)} style={{ fontSize: 12 }} />
        <HoldButton ariaLabel="後傾（前後傾斜を後方向へ）" label="後傾" tone="neutral" onTick={rotate('tilt', -1)} style={{ fontSize: 12 }} />
        <HoldButton ariaLabel="左傾（左右傾斜を左方向へ）" label="左傾" tone="neutral" onTick={rotate('tiltZ', -1)} style={{ fontSize: 12 }} />
        <HoldButton ariaLabel="右傾（左右傾斜を右方向へ）" label="右傾" tone="neutral" onTick={rotate('tiltZ', 1)} style={{ fontSize: 12 }} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', margin: '8px 0 4px' }} />

      {/* ── Shaft Roll（Phase1-B Step4、interactionShaftRollDeg） ── */}
      <div style={sectionLabelStyle}>シャフト回転</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        <HoldButton ariaLabel="シャフトを反時計回りに回転" label="↺" tone="neutral" onTick={rotateShaftRoll(-1)} style={{ fontSize: 14 }} />
        <HoldButton ariaLabel="シャフトを時計回りに回転" label="↻" tone="neutral" onTick={rotateShaftRoll(1)} style={{ fontSize: 14 }} />
      </div>
    </div>
  );
}
