/**
 * adminMode.ts ─ 管理者プレビューモード（クライアント側パスコードによる簡易ゲート）
 *
 * 目的: 開発中の機能（例: 削開練習）を一般利用者からは "Coming Soon" のまま隠しつつ、
 * 許可された人だけがパスコードを入力すれば利用できるようにする。
 *
 * 【重要】これは真のセキュリティ境界ではない。パスコードはSHA-256ハッシュ化した上で
 * クライアント側JSバンドルに埋め込んでいるため、devtoolsでソースを解析すれば理論上は
 * 突破されうる（総当たり等）。あくまで「一般利用者が誤って/偶然に到達しない」ための
 * 実用的なゲートであり、機密情報の保護や真の認証が必要な用途には使わないこと。
 * 本格的な認証が必要になった場合はVercelのDeployment Protectionやサーバーサイド認証の
 * 導入を検討する。
 *
 * 使い方:
 *   - https://.../?admin=1 にアクセス → パスコード入力画面を表示（App.tsxが処理）。
 *     正しいパスコードが入力されるとlocalStorageにフラグを保存し、以後のアクセスでも維持。
 *   - https://.../?admin=0 にアクセス → 管理者モードOFF（localStorageから削除、パスコード不要）。
 *   - processAdminModeUrlParam() をアプリ起動時に一度だけ呼び、戻り値でゲート表示要否を判定する。
 *   - isAdminMode() で「既に解除済みか」を判定する。
 *
 * パスコードの変更方法:
 *   1. ブラウザのdevtoolsコンソール等で以下を実行し、新しいパスコードのSHA-256ハッシュを取得する:
 *        await crypto.subtle.digest('SHA-256', new TextEncoder().encode('新しいパスコード'))
 *          .then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''))
 *   2. 得られた64文字の16進文字列で下記 ADMIN_PASSCODE_HASH を置き換える。
  */

const ADMIN_MODE_KEY = 'kurz_admin_mode';

/** 現在のパスコードのSHA-256ハッシュ（2026-07-14設定済み）。変更する場合は上記コメントの手順で置き換える。 */
const ADMIN_PASSCODE_HASH = '9c53b547052910c425ae2c321f46062da60b2229ffd82da214ad20bd56492d38';

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * processAdminModeUrlParam(): URLクエリパラメータ ?admin=1/0 を処理し、処理後は
 * URLからパラメータを取り除く（履歴・共有リンクに残さないため）。
 * App.tsx のモジュール読み込み時に一度だけ呼び出す想定（コンポーネントのrender中ではない）。
 *
 * @returns ?admin=1 が指定されており、かつまだ解除済みでない場合は true
 *          （＝呼び出し側はパスコード入力ゲートを表示すべき）。それ以外は false。
 */
export function processAdminModeUrlParam(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('admin')) return false;

  const value = params.get('admin');
  let wantsGate = false;
  try {
    if (value === '1') {
      wantsGate = localStorage.getItem(ADMIN_MODE_KEY) !== '1';
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

  return wantsGate;
}

/** isAdminMode(): 管理者モードが既に解除済みかどうかを返す（クライアント側の簡易フラグ）。 */
export function isAdminMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ADMIN_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

/** verifyAdminPasscode(): 入力されたパスコードが正しいか検証する（SHA-256ハッシュ比較）。 */
export async function verifyAdminPasscode(input: string): Promise<boolean> {
  if (!input) return false;
  const hash = await sha256Hex(input);
  return hash === ADMIN_PASSCODE_HASH;
}

/** unlockAdminMode(): パスコード検証成功後に呼び出し、管理者モードをlocalStorageへ保存する。 */
export function unlockAdminMode(): void {
  try {
    localStorage.setItem(ADMIN_MODE_KEY, '1');
  } catch {
    // localStorage不可の環境では静かに失敗させる
  }
}
