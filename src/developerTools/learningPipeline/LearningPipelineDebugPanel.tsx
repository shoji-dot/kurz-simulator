/**
 * developerTools/learningPipeline/LearningPipelineDebugPanel.tsx
 *   ── Learning Pipeline Debug Panel UI (Phase19.2)
 *
 * shojiさんPhase19.1レビュー承認時に指定された構成・依存関係に基づく。Evidence→Assessment→
 * Skill→Recommendationの順に縦表示するだけの、完全Read Onlyな開発者向けパネル
 * （`developerTools/learning/LearningEvidenceDebugBadge.tsx`と同じ「表示専用・判断ロジックなし」
 * の制約に従う）。
 *
 * 【Provider経由のみ・個別Store/Engine直接参照禁止（shojiさんPhase19.1レビュー指摘）】
 * 本コンポーネントは`collectLearningPipelineDebugData()`（Phase19.1）のみに依存し、
 * `useLearningHistoryStore`/`useLearningEvidenceStore`/`engine/skillTracking`等の個別実装には
 * 一切依存しない。依存関係は常に以下の一方向のみ:
 *   Debug Panel → collectLearningPipelineDebugData() → Phase15/Phase14/Phase18
 *
 * 【Known Limitation（shojiさんPhase19.2レビュー指摘、据え置き）】
 * Debug Panel currently refreshes by polling every second because the provider is
 * intentionally stateless. Reactive updates are out of scope for Phase19.
 * pollingの実装自体はPhase19.3で`useLearningPipelineDebugData()`（共有Hook）へ集約し、
 * `LearningPipelineTimeline`（Phase19.3）との重複を排除した（表示内容・挙動は無変更）。
 *
 * 【完全Read Only（shojiさん指定）】state変更・アクション実行は一切行わない。表示のみ。
 */
import type { CSSProperties, ReactNode } from 'react';
import { useLearningPipelineDebugData } from './useLearningPipelineDebugData';
import { Z_INDEX } from '../../components/ui';

const panelStyle: CSSProperties = {
  position: 'fixed', top: 64, right: 8, zIndex: Z_INDEX.modal,
  width: 300, maxHeight: '70vh', overflowY: 'auto',
  background: 'rgba(0,0,0,0.82)', color: '#7fffb2',
  fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
  borderRadius: 6, lineHeight: 1.5,
  border: '1px solid rgba(127,255,178,0.3)',
};

const sectionTitleStyle: CSSProperties = {
  color: '#aaa', fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 2,
  borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 2,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

/**
 * `useLearningPipelineDebugData()`（Phase19.3、内部でPhase19.1 Providerをpollingする共有Hook）
 * を経由して取得したデータを、Evidence→Assessment→Skill→Recommendationの順に表示する。
 * 完全Read Only、状態変更は一切行わない。
 */
export function LearningPipelineDebugPanel() {
  const data = useLearningPipelineDebugData();
  const allSkills = [...data.skillProfile.technical, ...data.skillProfile.knowledge];

  return (
    <div style={panelStyle}>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
        [DEV] Learning Pipeline Debug Panel
      </div>

      <Section title={`Evidence (${data.evidence.length})`}>
        {data.evidence.length > 0 ? data.evidence.join(', ') : '(空)'}
      </Section>

      <Section title="Assessment">
        {data.assessment
          ? `session=${data.assessment.sessionId} case=${data.assessment.caseId ?? '(null)'}\n` +
            `masteryLevel=${data.assessment.masteryLevel}\n` +
            `strengths=[${data.assessment.strengths.join(', ')}]\n` +
            `weaknesses=[${data.assessment.weaknesses.join(', ')}]`
          : '(履歴なし)'}
      </Section>

      <Section title="Skill">
        {allSkills.length > 0
          ? allSkills.map((s) => `${s.id}: ${s.value.toFixed(1)} (n=${s.sampleSize})`).join('\n')
          : '(履歴なし)'}
      </Section>

      <Section title="Recommendation">
        {data.recommendation
          ? `recommendedTeachingNoteIds=[${data.recommendation.recommendedTeachingNoteIds.join(', ')}]\n` +
            `recommendedCaseIds=[${data.recommendation.recommendedCaseIds.join(', ')}]\n` +
            `reasons=${data.recommendation.reasons.length}件`
          : '(履歴なし)'}
      </Section>
    </div>
  );
}
