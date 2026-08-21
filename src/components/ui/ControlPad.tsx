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
import { useState, type CSSProperties } from 'react';
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

/** [M-2 real-device follow-up 3、issue④] モバイルでは「全ボタンを上下内外と同じ正方形にし、
 *  コンパクトに保つ」という実機フィードバックを反映するため、セクション背景/paddingと
 *  ラベル表示はCSS変数駆動にする（index.cssのモバイルメディアクエリ側で上書き）。
 *  デスクトップ/既定値はこれまでと完全に同じ（挙動無変更）。 */
const sectionLabelStyle = {
  display: 'var(--cp-label-display, block)',
  fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, textAlign: 'center' as const,
};
/** [M-2 real-device follow-up] 各セクション（位置/回転/シャフト回転/Depth）を囲む箱。
 *  以前は`<hr>`風の区切り線で縦一列に連結していたが、2列reflow時にセクション境界が
 *  わかりやすいよう、薄い背景+角丸で個別の箱として区切る。
 *  [M-2 real-device follow-up 3] モバイルでは背景/paddingを畳んで、縦一列の中で
 *  セクション境界が目立たない（＝1本の連続したボタン列に見える）ようにする。 */
const sectionBoxStyle = {
  background: 'var(--cp-section-bg, rgba(255,255,255,.03))', borderRadius: 8, padding: 'var(--cp-section-pad, 6px 4px)',
};
/** [M-2 real-device follow-up 4、issue④] セクション内部の2ボタングリッド（前後/回転/シャフト回転/
 *  Depth）共通スタイル。real-device follow-up 3ではここをgrid⇄flex column可変にしていたが、
 *  `gridTemplateColumns`を与え忘れており、デスクトップ側が意図せず縦積み（1列4行）に壊れていた
 *  （画面幅にかかわらず2x2/2列で並ぶのが元の設計、real-device follow-up 2以前の挙動）。
 *  今回shojiさんから「2列にすれば（left傾/right傾/シャフト回転ボタンが隠れず）見える」との
 *  指摘を受け、このバグ修正と同時に、常時2列固定（モバイル/デスクトップ問わず）へ単純化する
 *  ——ブレークポイントで値を変える必要自体がなくなったため、CSS変数を廃止し固定値に戻す。 */
const gridSwitchStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 6,
};

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

  // [M-2、M1 Investigation §6/§3③] Depth（camera-relative奥/手前移動）。既存のPageUp/PageDown
  // ハンドラ（SimScene.tsx）が内部で呼ぶperformDepthStep()を、PlacementControls.depthStep経由で
  // 呼ぶだけ——新しいDepth/Collision実装は追加しない。Depthは元々キーボードのみの機能で
  // Transport段階には存在しなかった（DraggableProsthesisはmanipulationCommitted===trueのときのみ
  // マウントされ、Depthハンドラもその内部にしかない）ため、translate/rotate/rotateShaftRollと
  // 異なりTransport段階向けのレガシーfallbackは存在しない——manipulationCommitted===falseまたは
  // placementControls未接続時は無条件でno-op（安全側、書き込みを一切行わない）。
  const depthStep = (sign: 1 | -1) => (info: { fast: boolean; fine: boolean }) => {
    if (manipulationCommitted && placementControls) {
      placementControls.depthStep(sign, info.fine);
    }
  };
  const depthEnd = () => {
    if (manipulationCommitted && placementControls) {
      placementControls.endDepth();
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
          // [M-2 issue②] ホスト側（SimulationMode.tsx等）はこのコンポーネントの外側に
          // pointerEvents:'none'の背の高いラッパーを敷いてCanvasのドラッグ/オービットを塞がない
          // ようにしている（.canvas-overlayと同じ既存パターン）ため、ここで明示的にautoへ戻す。
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 15 }}>🎮</span> 操作パネル
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>▸</span>
      </button>
    );
  }

  return (
    // [M-2 issue②、M1 Investigation §3②] Root Cause: 展開時パネルの実測高さ（位置6+回転4+
    // シャフト回転2ボタン、約320〜340px）がモバイルの.canvas-wrapper（overflow:hidden）より
    // 高くなり得るため、bottom基準で上へ伸びるこのパネルの上端（＝閉じるボタン）が可視範囲外へ
    // クリップされ、開いたまま閉じられなくなっていた（トグル自体は常に正しく動作していた）。
    // ここではトグルロジックには一切触れず、パネル自身にmaxHeight:'100%'（ホスト側で top+bottom
    // 両方を指定した定高さコンテナ内でのみ有効、それ以外のホストでは実質無効化されて従来通り）+
    // overflowY:'auto'を与え、中身が入りきらない場合はパネル内部でスクロールさせることで、
    // パネル自体がホストの外へはみ出さないようにする。閉じるボタンはスクロール領域の外（常に
    // 見える最上部）に固定する。
    <div style={{
      background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', backdropFilter: 'var(--glass-blur)',
      padding: 'var(--cp-panel-padding, 8px)', width: 'var(--control-pad-width, 168px)', maxHeight: '100%',
      display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
    }}>
      {/* ── 閉じるボタン（スクロール領域の外、常に可視） ── */}
      <button
        type="button"
        aria-label="操作パネルを閉じる"
        onClick={() => setExpanded(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'transparent', border: 'none', padding: 'var(--cp-close-btn-pad, 2px 2px 6px)', margin: 0, cursor: 'pointer',
          color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
          flexShrink: 0,
        }}
      >
        {/* [M-2 real-device follow-up 3、issue④] モバイルではパネル幅が正方形ボタン1個分
            （約60px）まで狭まるため、このラベル文字列は表示領域に収まらない。閉じる操作自体は
            ボタン全体のクリック＋aria-labelで引き続き可能なため、視覚的なラベルのみモバイルで
            非表示にする（スクリーンリーダーへの影響なし）。 */}
        <span style={{ display: 'var(--cp-label-display, inline)' }}>操作パネル</span>
        <span style={{ fontSize: 11, display: 'inline-block', transform: 'rotate(180deg)' }}>▸</span>
      </button>

      {/* ── スクロール領域（位置/回転/シャフト回転/Depth） ──
          [M-2 real-device follow-up、issue A] 4セクションを縦一列に積むと、実機（iPhone Safari）で
          「開くとPortrait画面の大部分を占有する」と報告された（overflow自体は既にissue②で解消済み
          だが、正しくスクロール/収まっていても縦に長すぎる）。各セクションを個別の箱
          （sectionBoxStyle）にラップし、外側をCSS Grid `repeat(auto-fit, minmax(148px, 1fr))`に
          することで、パネル幅が狭い場合（デスクトップの既定168px）は従来通り1列積み、幅が
          `--control-pad-width`によって広がるモバイルでは自動的に2列へ折り返す——新しい
          レイアウトエンジンやJSブレークポイント判定を追加せず、CSS Gridの標準的な
          auto-fit/minmaxのみで実現する。ボタン自体のサイズ（44pt touch target）・機能は無変更。 */}
      {/* [M-2 real-device follow-up 3、issue④] 外側コンテナも同じgrid⇄flex column切替
          （--cp-outer-*）。モバイルではセクション自体も1本の縦列の中に積まれる。 */}
      <div style={{
        overflowY: 'auto', minHeight: 0,
        display: 'var(--cp-outer-display, grid)',
        gridTemplateColumns: 'var(--cp-outer-cols, repeat(auto-fit, minmax(148px, 1fr)))',
        flexDirection: 'var(--cp-outer-flexdir, column)' as CSSProperties['flexDirection'],
        alignItems: 'var(--cp-outer-align, stretch)',
        gap: 'var(--cp-outer-gap, 8px)',
      }}>

      {/* ── 位置（左右=lateral、上下=vertical、前後=anterior） ── */}
      <div style={sectionBoxStyle}>
        <div style={sectionLabelStyle}>位置</div>
        {/* [M-2 real-device follow-up 4-2] 従来はここが3列×2行の十字配置（上/内/下/外）で、
            すぐ下の前/後だけ独立した2列グリッドだったため、列幅がセクションごとに異なり
            「前」の位置が上の十字と横方向にずれて見えた（shoji指摘）。指示された表示順
            （上下→内外→前後→前傾後傾→左傾右傾→左回転右回転）に合わせ、十字配置をやめて
            他セクションと完全に同じ「対になる2ボタンをgridSwitchStyleで並べる」パターンへ
            統一し、全セクションの列幅を揃える。DirLabel（アイコン+解剖学用語）自体は
            上/内/下/外の意味の分かりやすさのために引き続き使う。 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={gridSwitchStyle}>
            <HoldButton className="cp-btn" ariaLabel="上へ移動" label={<DirLabel icon="↑" text="上" />} tone="neutral" onTick={translate('y', 1)} />
            <HoldButton className="cp-btn" ariaLabel="下へ移動" label={<DirLabel icon="↓" text="下" />} tone="neutral" onTick={translate('y', -1)} />
          </div>
          <div style={gridSwitchStyle}>
            <HoldButton className="cp-btn" ariaLabel="内側へ移動" label={<DirLabel icon="←" text="内" />} tone="neutral" onTick={translate('x', -1)} />
            <HoldButton className="cp-btn" ariaLabel="外側へ移動" label={<DirLabel icon="→" text="外" />} tone="neutral" onTick={translate('x', 1)} />
          </div>
          <div style={gridSwitchStyle}>
            <HoldButton className="cp-btn" ariaLabel="前方向へ移動" label="前" tone="neutral" onTick={translate('z', 1)} />
            <HoldButton className="cp-btn" ariaLabel="後方向へ移動" label="後" tone="neutral" onTick={translate('z', -1)} />
          </div>
        </div>
      </div>

      {/* ── 回転（前後傾斜=angleTilt、左右傾斜=angleTiltZ） ── */}
      <div style={sectionBoxStyle}>
        <div style={sectionLabelStyle}>回転</div>
        <div style={gridSwitchStyle}>
          <HoldButton className="cp-btn" ariaLabel="前傾（前後傾斜を前方向へ）" label="前傾" tone="neutral" onTick={rotate('tilt', 1)} style={{ fontSize: 12 }} />
          <HoldButton className="cp-btn" ariaLabel="後傾（前後傾斜を後方向へ）" label="後傾" tone="neutral" onTick={rotate('tilt', -1)} style={{ fontSize: 12 }} />
          <HoldButton className="cp-btn" ariaLabel="左傾（左右傾斜を左方向へ）" label="左傾" tone="neutral" onTick={rotate('tiltZ', -1)} style={{ fontSize: 12 }} />
          <HoldButton className="cp-btn" ariaLabel="右傾（左右傾斜を右方向へ）" label="右傾" tone="neutral" onTick={rotate('tiltZ', 1)} style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* ── Shaft Roll（Phase1-B Step4、interactionShaftRollDeg） ── */}
      <div style={sectionBoxStyle}>
        <div style={sectionLabelStyle}>シャフト回転</div>
        <div style={gridSwitchStyle}>
          <HoldButton className="cp-btn" ariaLabel="シャフトを反時計回りに回転" label="↺" tone="neutral" onTick={rotateShaftRoll(-1)} style={{ fontSize: 14 }} />
          <HoldButton className="cp-btn" ariaLabel="シャフトを時計回りに回転" label="↻" tone="neutral" onTick={rotateShaftRoll(1)} style={{ fontSize: 14 }} />
        </div>
      </div>

      {/* [M-2 issue③] Depth（camera-relative奥/手前）: Transport段階（manipulationCommitted===false）
          にはDepth自体が存在しない（既存キーボードPageUp/PageDownもDraggableProsthesis内部
          （＝Placement段階のみ）にしか実装がない）ため、Placement段階でのみ表示する。さらに
          placementControlsが未接続の呼び出し元（StepFlowMode.tsx、D-4 Scope外でPlacementControls
          自体を配線していない）では、押しても何も起きないボタンを表示しないよう、
          placementControls接続済みの場合のみ表示する（depthStep/depthEnd自体は接続有無に関わらず
          no-opで安全だが、UI上は「動くボタンだけを見せる」方が誤解を招かない）。 */}
      {manipulationCommitted && placementControls && (
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>Depth（視点方向）</div>
          <div style={gridSwitchStyle}>
            <HoldButton className="cp-btn" ariaLabel="手前へ移動（Depth、視点に近づく方向）" label="手前" tone="neutral" onTick={depthStep(-1)} onRelease={depthEnd} style={{ fontSize: 12 }} />
            <HoldButton className="cp-btn" ariaLabel="奥へ移動（Depth、視点から離れる方向）" label="奥" tone="neutral" onTick={depthStep(1)} onRelease={depthEnd} style={{ fontSize: 12 }} />
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
