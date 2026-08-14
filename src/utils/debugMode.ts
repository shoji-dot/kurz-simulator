/**
 * debugMode.ts ── 座標Debug Overlay 表示ゲート（Phase1）
 *
 * 既存の adminMode.ts（?admin=1 パスコードゲート）と同じ運用方式を踏襲する:
 *   - ?debug=coords または ?debug=1 でアクセス → セッション中Debug Overlayを表示
 *   - ?debug=0 でアクセス → 非表示に戻す
 * パスコードのような保護は不要（表示するのは座標値のみで機密情報ではない）ため、
 * sessionStorageにフラグを保存するだけの単純なゲートとする。
 *
 * 2026-08-14追加（Prosthesis–Anatomy Occlusion原因診断、Runtime Instrumentation）:
 *   - ?debug=scenedump でアクセス → Scene Traverse Diagnostic Overlay（別ゲート、coordsとは独立）
 *   - カンマ区切りで併用可: ?debug=coords,scenedump
 *   既存のcoords用ゲート方式（sessionStorage、パスコード不要）をそのまま踏襲するだけで、
 *   新しいゲート機構やクエリパラメータ規約は追加していない。
 *
 * 2026-08-14追加（Prosthesis-Anatomy Collision Constraint Phase C-1、単独検証ハーネス）:
 *   - ?debug=collision でアクセス → Collision Engine単独検証Overlay（別ゲート、他とは独立）
 *   同じ方式のさらなる横展開。Manipulation Layerには一切接続しない、Collision Engine
 *   （anatomyCollisionIndex/prosthesisCollisionGeometry/collisionTest）単体の動作確認専用。
 */

const COORD_DEBUG_KEY      = 'kurz_debug_coords';
const SCENE_DUMP_DEBUG_KEY = 'kurz_debug_scenedump';
const COLLISION_DEBUG_KEY  = 'kurz_debug_collision';

/**
 * URLクエリパラメータ ?debug=... を処理し、処理後はURLからパラメータを取り除く。
 * App.tsx のモジュール読み込み時に一度だけ呼び出す想定（adminModeと同様）。
 * カンマ区切りで複数トークンを指定可能（例: ?debug=coords,scenedump）。
 */
export function processDebugModeUrlParam(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('debug')) return;

  const value = params.get('debug') ?? '';
  const tokens = value.split(',').map((t) => t.trim()).filter(Boolean);
  try {
    if (tokens.includes('0')) {
      sessionStorage.removeItem(COORD_DEBUG_KEY);
      sessionStorage.removeItem(SCENE_DUMP_DEBUG_KEY);
      sessionStorage.removeItem(COLLISION_DEBUG_KEY);
    } else {
      if (tokens.includes('coords') || tokens.includes('1')) {
        sessionStorage.setItem(COORD_DEBUG_KEY, '1');
      }
      if (tokens.includes('scenedump')) {
        sessionStorage.setItem(SCENE_DUMP_DEBUG_KEY, '1');
      }
      if (tokens.includes('collision')) {
        sessionStorage.setItem(COLLISION_DEBUG_KEY, '1');
      }
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

/**
 * isSceneDumpDebugMode(): Scene Traverse Diagnostic Overlay（原因診断用、一時計装）を
 * 表示すべきかどうかを返す。isCoordDebugMode()と同じsessionStorageゲート方式・完全に
 * 独立したフラグ（coordsとscenedumpは併用可、どちらか一方のみでも可）。
 */
export function isSceneDumpDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SCENE_DUMP_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * isCollisionVerifyDebugMode(): Collision Engine単独検証Overlay（Phase C-1、一時計装）を
 * 表示すべきかどうかを返す。他のフラグと完全に独立、併用可。
 */
export function isCollisionVerifyDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(COLLISION_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}
