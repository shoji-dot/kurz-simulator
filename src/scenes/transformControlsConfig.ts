// Phase22.2 Priority3: TransformControls改善（Snap＋矢印キー微調整）の定数集約ファイル。
// キーボード操作・将来のボタンUI（X/Y/Z[+][-]、位置調整パネル）の両方から同じ値を
// 参照できるよう、SimScene.tsxから独立したファイルに切り出す
// （visToggleConfig.tsと同じ方針＝共有UI定数は専用ファイルへ）。

/** TransformControlsドラッグ時のスナップ間隔（mm、1 unit = 1mm）。shoji さん確認済み。 */
export const TRANSLATION_SNAP_MM = 0.10;

/** 矢印キー1回押下あたりの移動量（mm）。通常時。 */
export const KEYBOARD_STEP_MM = 0.10;
/** Ctrl+矢印キー押下時の移動量（mm、微細移動）。 */
export const KEYBOARD_STEP_CTRL_MM = 0.02;

// Phase22.2 GUI Follow-up P1: 矢印キーの役割をSTEP6 GUI確認結果を受けて再設計。
// 通常=移動、Shift=回転、Ctrl=微細移動、Ctrl+Shift=微細回転（shojiさん確認済み、
// 旧KEYBOARD_STEP_SHIFT_MM「高速移動0.5mm」は廃止しrotateへ役割変更）。
/** Shift+矢印キー押下時の回転量（度）。angleTilt/angleTiltZを操作する。 */
export const ROTATION_STEP_DEG = 1;
/** Ctrl+Shift+矢印キー押下時の回転量（度、微細回転）。 */
export const ROTATION_STEP_FINE_DEG = 0.2;
