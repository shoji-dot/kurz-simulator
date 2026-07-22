// Phase22.2 Priority3: TransformControls改善（Snap＋矢印キー微調整）の定数集約ファイル。
// キーボード操作・将来のボタンUI（X/Y/Z[+][-]、位置調整パネル）の両方から同じ値を
// 参照できるよう、SimScene.tsxから独立したファイルに切り出す
// （visToggleConfig.tsと同じ方針＝共有UI定数は専用ファイルへ）。

/** TransformControlsドラッグ時のスナップ間隔（mm、1 unit = 1mm）。shoji さん確認済み。 */
export const TRANSLATION_SNAP_MM = 0.10;

/** 矢印キー1回押下あたりの移動量（mm）。通常時。 */
export const KEYBOARD_STEP_MM = 0.10;
/** Shift+矢印キー押下時の移動量（mm）。 */
export const KEYBOARD_STEP_SHIFT_MM = 0.50;
/** Ctrl+矢印キー押下時の移動量（mm）。 */
export const KEYBOARD_STEP_CTRL_MM = 0.02;
