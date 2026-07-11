/**
 * adminMode.ts ─ 管理者プレビューモード（クライアント側の簡易フラグ）
 *
 * 目的: 開発中の機能（例: 削開練習）を一般利用者からは "Coming Soon" のまま隠しつつ、
 * 管理者（shojiさん）だけはURLに ?admin=1 を付けてアクセスすれば利用できるようにする。
 *
 * 【重要】これは真のセキュリティ境界ではない。localStorageとURLパラメータによる
 * クライアント側フラグに過ぎず、devtoolsを開けば誰でも解除できる。あくまで
 * 「一般利用者の目に触れないようにする」ためのUI制御であり、機密情報の保護には使わないこと。
 *
 * 使い方:
 *   - https://.../?admin=1 にアクセス → 管理者モードON（localStorageに保存、以後のアクセスでも維持）
 *   - https://.../?admin=0 にアクセス → 管理者モードOFF（localStorageから削除）
 *   - processAdminModeUrlParam() をアプリ起動時に一度だけ呼び、isAdminMode() で判定する。
 */

const ADMIN_MODE_KEY = 'kurz_admin_mode';

/**
 * processAdminModeUrlParam(): URLクエリパラメータ ?admin=1/0 を処理してlocalStorageへ反映し、
 * 処理後はURLからパラメータを取り除く（履歴・共有リンクに残さないため）。
 * App.tsx のモジュール読み込み時に一度だけ呼び出す想定（コンポーネントのrender中ではない）。
 */
export function processAdminModeUrlParam(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('admin')) return;

  const value = params.get('admin');
  try {
    if (value === '1') {
      localStorage.setItem(ADMIN_MODE_KEY, '1');
    } else if (value === '0') {
      localStorage.removeItem(ADMIN_MODE_KEY);
    }
  } catch {
    // localStorage不可の環境（プライベートブラウズ等）では静かに失敗させる
  }

  params.delete('admin');
  const newSearch = params.toString();
  const newUrl =
    window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

/** isAdminMode(): 管理者モードが有効かどうかを返す（クライアント側の簡易フラグ）。 */
export function isAdminMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ADMIN_MODE_KEY) === '1';
  } catch {
    return false;
  }
}
