/**
 * engine/aiTutor/prompt.ts ─── AI Tutor Prompt層 (Phase8.2)
 *
 * TutorContext + 会話履歴 + 学習者発言から、LLMに渡すプロンプト文字列を組み立てる**完全な
 * 純粋関数のみ**を持つ。shojiさんのPhase8.1レビュー所見「Prompt BuilderはTutorContext→
 * Prompt Stringへの純粋な変換だけにする（APIを呼ばない・LLMを呼ばない・時刻を読まない・
 * Math.randomを使わない）」を遵守する。LLM呼び出しは`generator.ts`（Phase8.3）の責務。
 */
import type { TutorContext, TutorMessage } from './types';

const NO_CASE_TEXT = '（症例は選択されていません。）';
const NO_STRUCTURE_NOTES_TEXT = '（関連する構造物の教育情報はありません。）';

/** CaseTeachingBundleの症例情報を転記のみで文字列化する（新しい教育コンテンツは生成しない）。 */
function formatCaseSection(context: TutorContext): string {
  const bundle = context.bundle;
  if (!bundle) return NO_CASE_TEXT;

  const c = bundle.surgicalCase;
  const teachingPoints = c.teachingPoints.map((p) => `  - ${p}`).join('\n');
  return [
    `症例: ${c.title}（難易度: ${c.difficulty}）`,
    `概要: ${c.description}`,
    `臨床メモ: ${c.clinicalNotes}`,
    `教育ポイント:`,
    teachingPoints,
  ].join('\n');
}

/** 関連構造物のTeachingNoteを転記のみで文字列化する（危険度判定・新規コメント生成はしない）。 */
function formatStructureNotesSection(context: TutorContext): string {
  if (context.focusedNotes.length === 0) return NO_STRUCTURE_NOTES_TEXT;

  return context.focusedNotes
    .map((note) => {
      const comment = note.commentJa ?? '（教育コメント未設定）';
      return `  - ${note.entry.nameJa}（危険度: ${note.dangerLevel}、学習優先度: ${note.learningPriority}）: ${comment}`;
    })
    .join('\n');
}

/** 会話履歴を「学習者:」「チューター:」形式で転記する（内容の要約・改変はしない）。 */
function formatHistorySection(history: readonly TutorMessage[]): string {
  if (history.length === 0) return '（これまでの会話はありません。）';

  return history
    .map((m) => `${m.role === 'learner' ? '学習者' : 'チューター'}: ${m.textJa}`)
    .join('\n');
}

/**
 * TutorContext + 会話履歴 + 学習者発言からプロンプト文字列を組み立てる。
 * 入力が同一であれば常に同一の文字列を返す（Date.now()・Math.random()等、非決定的な要素は
 * 一切使用しない）。API呼び出し・LLM呼び出しも行わない。
 */
export function buildTutorPrompt(
  context: TutorContext,
  history: readonly TutorMessage[],
  learnerMessageJa: string,
): string {
  return [
    'あなたは中耳手術教育シミュレーターのAIチューターです。以下の症例情報・構造物情報・会話履歴を踏まえ、学習者の発言に日本語で応答してください。',
    '',
    '【症例情報】',
    formatCaseSection(context),
    '',
    '【関連する構造物の教育情報】',
    formatStructureNotesSection(context),
    '',
    '【これまでの会話】',
    formatHistorySection(history),
    '',
    `学習者: ${learnerMessageJa}`,
    'チューター:',
  ].join('\n');
}
