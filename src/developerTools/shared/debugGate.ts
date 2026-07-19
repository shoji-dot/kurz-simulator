/**
 * developerTools/shared/debugGate.ts ── Developer Tools Layer 系統A ゲート判定（Phase16.1）
 *
 * Phase16設計書 v1.0 §5.3で確定した「2系統ルール」のうち、系統A（通常Developer Tool）を
 * 判定する薄いヘルパー。`import.meta.env.DEV`による判定のみを行い、本番ビルドには一切含まれない
 * （Viteのビルド時に静的評価され、`false`の分岐はdead code eliminationで除去される）。
 *
 * 系統B（Runtime Debug Tool、`?debug=`系URL + sessionStorage）は既存の`utils/debugMode.ts`が
 * 引き続き独立して担当する（座標確認等、実機・本番相当環境での再現確認が必要なツール向け。
 * 本ファイルでは扱わない）。
 *
 * 判断ロジック・状態変更は持たない。可視化専用ツールが「表示してよいか」を判定するだけの
 * 薄い関数（Developer Tools Layer全体の責務「可視化のみ、状態変更・評価・判断を行わない」と
 * 同じ制約に従う）。
 */
export function isDevToolEnabled(): boolean {
  return import.meta.env.DEV;
}
