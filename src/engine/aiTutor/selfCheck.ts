/**
 * engine/aiTutor/selfCheck.ts ── 開発時セルフチェック (Phase8.4)
 *
 * AI Tutor（Phase8.1〜8.3で確定した公開API）に対する実行時自己診断。
 * engine/caseGenerator/selfCheck.ts（Phase7.3）等と同じ`if (import.meta.env.DEV)`パターンを踏襲する。
 *
 * 【Phase8固有の方針、shojiさん承認済み】実際のLLMは呼ばない。Fake TutorModelClient（固定文字列を
 * 返すだけのモック実装、このファイル内でのみ定義・非export）を使い、`generateTutorReply()`の
 * オーケストレーション（プロンプトの非改変・trim/raw整形・例外伝播）のみを検証する。実際のLLM出力の
 * 品質・内容・日本語表現の自然さ・プロンプトエンジニアリングの妥当性はselfCheckの対象外
 * （評価実験・E2Eテストの領域、Phase8設計書「SelfCheck方針」節参照）。
 *
 * 本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体はどのシーン・App.tsxからも
 * importされていない。`index.ts`からも意図的に未export（Phase3〜7と同じ理由）。
 *
 * 確認する7項目（shojiさんのPhase8.3レビュー所見どおり）:
 *   1. buildTutorContext()が期待どおりのTutorContextを返すこと
 *   2. buildTutorPrompt()が決定論的であること（同一入力→同一出力）
 *   3. generateTutorReply()がPromptを改変せずTutorModelClientに渡すこと
 *   4. generateTutorReply()がtrim()とrawを正しく返すこと
 *   5. Fake Client利用時に期待どおりの結果になること
 *   6. 空文脈でも正常動作すること
 *   7. 例外伝播が維持されること
 */
import { buildTutorContext } from './context';
import { buildTutorPrompt } from './prompt';
import { generateTutorReply } from './generator';
import type { TutorMessage, TutorModelClient } from './types';

// data/cases.tsに実在するid（Case Generator selfCheck.ts・実装レビューでも使用実績あり）。
const KNOWN_CASE_ID = 'case-001';
const UNKNOWN_CASE_ID = '__selfcheck_unknown_case_id__';

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
}

interface FakeClient extends TutorModelClient {
  lastPrompt: string | null;
}

/** テスト用Fake Client。実際のLLMを呼ばず、固定文字列を返す・受け取ったpromptを記録するのみ。 */
function createFakeClient(response: string): FakeClient {
  const client: FakeClient = {
    lastPrompt: null,
    async complete(promptJa: string): Promise<string> {
      client.lastPrompt = promptJa;
      return response;
    },
  };
  return client;
}

function createThrowingClient(message: string): TutorModelClient {
  return {
    async complete(): Promise<string> {
      throw new Error(message);
    },
  };
}

async function checkBuildTutorContextBasics(): Promise<CheckResult> {
  const known = buildTutorContext({ caseId: KNOWN_CASE_ID });
  const unknown = buildTutorContext({ caseId: UNKNOWN_CASE_ID });
  const ok =
    known.bundle !== null &&
    known.bundle.surgicalCase.id === KNOWN_CASE_ID &&
    known.focusedNotes.length === 3 &&
    unknown.bundle === null &&
    unknown.focusedNotes.length === 0;
  return { name: 'buildTutorContext()が期待どおりのTutorContextを返す', ok };
}

function checkBuildTutorPromptDeterministic(): CheckResult {
  const ctx = buildTutorContext({ caseId: KNOWN_CASE_ID });
  const history: readonly TutorMessage[] = [{ role: 'learner', textJa: 'テスト発言' }];
  const p1 = buildTutorPrompt(ctx, history, '質問1');
  const p2 = buildTutorPrompt(ctx, history, '質問1');
  return { name: 'buildTutorPrompt()が決定論的（同一入力→同一出力）', ok: p1 === p2 };
}

async function checkGeneratorDoesNotMutatePrompt(): Promise<CheckResult> {
  const ctx = buildTutorContext({ caseId: KNOWN_CASE_ID });
  const history: readonly TutorMessage[] = [];
  const learnerMessageJa = '質問2';
  const expectedPrompt = buildTutorPrompt(ctx, history, learnerMessageJa);
  const fake = createFakeClient('固定応答');
  await generateTutorReply(fake, ctx, history, learnerMessageJa);
  return {
    name: 'generateTutorReply()がPromptを改変せずTutorModelClientに渡す',
    ok: fake.lastPrompt === expectedPrompt,
  };
}

async function checkReplyTrimAndRaw(): Promise<CheckResult> {
  const ctx = buildTutorContext({});
  const fake = createFakeClient('  前後に空白のある応答  \n');
  const reply = await generateTutorReply(fake, ctx, [], 'こんにちは');
  const ok = reply.textJa === '前後に空白のある応答' && reply.raw === '  前後に空白のある応答  \n';
  return { name: 'generateTutorReply()がtrim()とrawを正しく返す', ok };
}

async function checkFakeClientBasicUsage(): Promise<CheckResult> {
  const ctx = buildTutorContext({ caseId: KNOWN_CASE_ID });
  const fake = createFakeClient('OK');
  const reply = await generateTutorReply(fake, ctx, [], '質問3');
  return { name: 'Fake Client利用時に期待どおりの結果になる', ok: reply.textJa === 'OK' && reply.raw === 'OK' };
}

async function checkEmptyContextWorks(): Promise<CheckResult> {
  const ctx = buildTutorContext({});
  const fake = createFakeClient('空文脈応答');
  const reply = await generateTutorReply(fake, ctx, [], 'テスト');
  const ok = ctx.bundle === null && ctx.focusedNotes.length === 0 && reply.textJa === '空文脈応答';
  return { name: '空文脈でも正常動作する', ok };
}

async function checkExceptionPropagation(): Promise<CheckResult> {
  const ctx = buildTutorContext({});
  const throwing = createThrowingClient('SELFCHECK_FAKE_ERROR');
  let caught: unknown = null;
  try {
    await generateTutorReply(throwing, ctx, [], 'テスト');
  } catch (e) {
    caught = e;
  }
  const ok = caught instanceof Error && caught.message === 'SELFCHECK_FAKE_ERROR';
  return { name: '例外伝播が維持される', ok };
}

if (import.meta.env.DEV) {
  void (async () => {
    const results: readonly CheckResult[] = [
      await checkBuildTutorContextBasics(),
      checkBuildTutorPromptDeterministic(),
      await checkGeneratorDoesNotMutatePrompt(),
      await checkReplyTrimAndRaw(),
      await checkFakeClientBasicUsage(),
      await checkEmptyContextWorks(),
      await checkExceptionPropagation(),
    ];

    for (const r of results) {
      if (!r.ok) {
        console.warn(`[aiTutor] selfCheck FAIL: ${r.name}`);
      }
    }

    console.info(`[aiTutor] selfCheck: ${results.filter((r) => r.ok).length}/${results.length} ok`);
  })();
}
