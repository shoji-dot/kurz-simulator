/**
 * debugMode.ts ── 座標Debug Overlay 表示ゲート（Phase1）
 *
 * 既存の adminMode.ts（?admin=1 パスコードゲート）と同じ運用方式を踏襲する:
 *   - ?debug=coords または ?debug=1 でアクセス → セッション中Debug Overlayを表示
 *   - ?debug=0 でアクセス → 非表示に戻す
 * パスコードのような保護は不要（表示するのは座標値のみで機密情報ではない）ため、
 * sessionStorageにフラグを保存するだけの単純なゲートとする。
 */

const COORD_DEBUG_KEY = 'kurz_debug_coords';

/**
 * URLクエリパラメータ ?debug=... を処理し、処理後はURLからパラメータを取り除く。
 * App.tsx のモジュール読み込み時に一度だけ呼び出す想定（adminModeと同様）。
 */
export function processDebugModeUrlParam(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('debug')) return;

  const value = params.get('debug');
  try {
    if (value === 'coords' || value === '1') {
      sessionStorage.setItem(COORD_DEBUG_KEY, '1');
    } else if (value === '0') {
      sessionStorage.removeItem(COORD_DEBUG_KEY);
    }
  } catch {
    // sessionStorage不可の環境（プライベートブラウズ等）では静かに失敗させる
  }

  params.delete('debug');
  const newSearch = params.toString();
  const newUrl =
    window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

/** isCoordDebugMode(): 座標Debug Overlayを表示すべきかどうかを返す。 */
export function isCoordDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(COORD_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}
