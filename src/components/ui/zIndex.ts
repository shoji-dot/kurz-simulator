/**
 * KURZ Design System v1 — z-index階層トークン（Phase2 20節と同期）。
 * 3D Viewer上のオーバーレイUIは必ずこの定数のみを使用し、任意の数値指定を禁止する。
 * CSS側の --z-* 変数（index.css）と値を一致させること。
 */
export const Z_INDEX = {
  canvas: 0,
  dim: 9,
  vignette: 5,
  hud: 10,
  overlay: 15,
  toolbar: 20,
  panel: 30,
  modalBackdrop: 90,
  modal: 100,
  toast: 110,
  splash: 200,
} as const;
