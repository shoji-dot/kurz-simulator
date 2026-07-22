// Phase22.2 Priority3: TransformControls改善（Snap＋矢印キー微調整）の定数集約ファイル。
// キーボード操作・将来のボタンUI（X/Y/Z[+][-]、位置調整パネル）の両方から同じ値を
// 参照できるよう、SimScene.tsxから独立したファイルに切り出す
// （visToggleConfig.tsと同じ方針＝共有UI定数は専用ファイルへ）。

/** TransformControlsドラッグ時のスナップ間隔（mm、1 unit = 1mm）。shoji さん確認済み。 */
export const TRANSLATION_SNAP_MM = 0.10;

/** 矢印キー1回押下あたりの移動量（mm）。通常時。ControlPadのHoldButton通常速度とも共用。 */
export const KEYBOARD_STEP_MM = 0.10;
/** Ctrl+矢印キー押下時の移動量（mm、微細移動）。ControlPadのHoldButton Ctrl押下時とも共用。 */
export const KEYBOARD_STEP_CTRL_MM = 0.02;

// Phase22.2 GUI Follow-up P1: 矢印キーの役割をSTEP6 GUI確認結果を受けて再設計。
// 通常=移動、Shift=回転、Ctrl=微細移動、Ctrl+Shift=微細回転（shojiさん確認済み、
// 旧KEYBOARD_STEP_SHIFT_MM「高速移動0.5mm」は廃止しrotateへ役割変更）。
/** Shift+矢印キー押下時の回転量（度）。angleTilt/angleTiltZを操作する。ControlPadの
 *  HoldButton通常速度とも共用。 */
export const ROTATION_STEP_DEG = 1;
/** Ctrl+Shift+矢印キー押下時の回転量（度、微細回転）。ControlPadのHoldButton Ctrl押下時とも共用。 */
export const ROTATION_STEP_FINE_DEG = 0.2;

// Phase22.2 GUI Follow-up P2（操作パネル方針転換）: PC/iPhone/iPad共通の「押しっぱなしで連続実行」
// ControlPad用の速度定数。矢印キーのShift（=回転モード切替）とは意味が異なり、ここでのShiftは
// 「同じ軸の操作を速くする」という意味（shojiさん提案のPC「マウス長押し＋Shift=高速」に対応）。
// タッチ操作にはShift/Ctrlという概念がないため、既定速度(KEYBOARD_STEP_MM/ROTATION_STEP_DEG)の
// みが使われる（PointerEventのshiftKey/ctrlKeyはタッチでは常にfalseになるため自然に成立する）。
/** ControlPadのHoldButtonをShiftキーと同時に押し続けた場合の移動量（mm、高速）。 */
export const HOLD_STEP_FAST_MM = 0.50;
/** ControlPadのHoldButtonをShiftキーと同時に押し続けた場合の回転量（度、高速）。
 *  旧SimulationMode AdjRowの±5°ステップと同じ値（実績のある値を踏襲）。 */
export const ROTATION_STEP_FAST_DEG = 5;
/** ControlPadのHoldButton押しっぱなし時の反復間隔（ミリ秒）。 */
export const HOLD_REPEAT_INTERVAL_MS = 90;
