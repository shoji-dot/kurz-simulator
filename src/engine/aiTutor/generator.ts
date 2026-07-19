/**
 * engine/aiTutor/generator.ts ─── AI Tutor Generator層 (Phase8.3)
 *
 * TutorModelClientへの委譲のみを行うオーケストレーション層。プロンプト構築は`prompt.ts`の
 * `buildTutorPrompt()`（Phase8.2、無変更）を呼ぶだけで自前実装しない。
 *
 * 【責務（shojiさんのPhase8.2レビュー所見どおり）】
 * やってよいこと: プロンプト生成の呼び出し・Client呼び出し・Reply整形・エラーの伝播。
 * やってはいけないこと: プロンプト編集・教育文章生成・教育ロジック追加・scoring利用・
 * Case検索・TeachingNote検索・特定ベンダーSDK（OpenAI/Claude等）への直接依存。
 * 本ファイルはいずれも行わない（`TutorModelClient`インターフェース以外のLLM関連コードを持たない）。
 */
import { buildTutorPrompt } from './prompt';
import type { TutorContext, TutorMessage, TutorModelClient, TutorReply } from './types';

/**
 * TutorContext + 会話履歴 + 学習者発言から`buildTutorPrompt()`でプロンプトを組み立て、
 * `client.complete()`（呼び出し側が注入した`TutorModelClient`実装）へそのまま渡し、応答を
 * `TutorReply`へ整形する。`textJa`は前後の空白を除去した表示用テキスト、`raw`はLLMの生出力
 * （整形前）をそのまま保持する。
 *
 * `client.complete()`が投げた例外はキャッチせず、そのまま呼び出し側へ伝播させる
 * （設計書のCompatibility Policyどおり。LLM呼び出しはネットワークI/Oのため、Phase1〜7の
 * 「例外を投げない」方針をここでは適用しない）。
 */
export async function generateTutorReply(
  client: TutorModelClient,
  context: TutorContext,
  history: readonly TutorMessage[],
  learnerMessageJa: string,
): Promise<TutorReply> {
  const promptJa = buildTutorPrompt(context, history, learnerMessageJa);
  const raw = await client.complete(promptJa);
  return { textJa: raw.trim(), raw };
}
