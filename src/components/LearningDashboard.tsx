/**
 * components/LearningDashboard.tsx ─── 学習ダッシュボード画面 (Phase14.4)
 *
 * `Phase14_ApplicationIntegrationLayer_API設計_v1.0.md`（shojiさん承認済み）§4の実装。
 * `useLearningHistoryStore`（Phase14.3、Runtime保持のみ）が持つ`LearningHistory`を、
 * `deriveAdaptivePlan()`（Phase14.3、Phase12公開APIへの橋渡し）→
 * `deriveLearnerApplicationView()`（Phase13公開API）の順に渡し、結果をそのまま表示するのみ。
 *
 * 【本ファイルが追加しないもの】新しい推薦判断・優先順位付け・表示件数の絞り込みは行わない。
 * `LearnerApplicationView`の3項目をそのまま表示するのみ。
 *
 * 【空状態の扱い（Phase14.3実装レビューでのshojiさん所見）】
 * `AdaptiveLearningPlan`の3項目が空であることは、Issue-022（`teachingNoteIds`の意味づけ検討）が
 * 未解決の現時点では正常な状態であり、エラーではない。「おすすめ教材なし→エラー表示」ではなく
 * 「現在の学習履歴から追加推奨はありません」という正常な空状態として表示する。
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLearningHistoryStore } from '../store/useLearningHistoryStore';
import { deriveAdaptivePlan } from '../engine/applicationIntegration';
import { deriveLearnerApplicationView } from '../engine/learnerApplication';
import type { TeachingNoteActionView, CaseActionView } from '../engine/learnerApplication';
import { Card, Badge, Alert } from './ui';
import type { BadgeTone } from './ui';

const DANGER_TONE: Record<TeachingNoteActionView['dangerLevel'], BadgeTone> = {
  safe: 'success',
  caution: 'warning',
  critical: 'error',
};

const DIFFICULTY_LABEL: Record<CaseActionView['difficulty'], string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

const EMPTY_SECTION_MESSAGE = '現在の学習履歴から追加推奨はありません。';

function TeachingNoteCard({ note }: { note: TeachingNoteActionView }) {
  return (
    <Card style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ font: 'var(--text-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {note.titleJa}
        </div>
        <Badge tone={DANGER_TONE[note.dangerLevel]}>{note.dangerLevel}</Badge>
      </div>
      {note.descriptionJa && (
        <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
          {note.descriptionJa}
        </div>
      )}
    </Card>
  );
}

function CaseActionCard({ item }: { item: CaseActionView }) {
  return (
    <Card style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ font: 'var(--text-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {item.titleJa}
        </div>
        <Badge tone="neutral">{DIFFICULTY_LABEL[item.difficulty]}</Badge>
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
        {item.descriptionJa}
      </div>
    </Card>
  );
}

function Section({ title, isEmpty, children }: { title: string; isEmpty: boolean; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ font: 'var(--text-subtitle)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
        {title}
      </div>
      {isEmpty ? <Alert tone="info">{EMPTY_SECTION_MESSAGE}</Alert> : children}
    </div>
  );
}

export function LearningDashboard() {
  const history = useLearningHistoryStore((s) => s.history);

  // deriveAdaptivePlan()/deriveLearnerApplicationView()いずれも純粋関数(Phase12/13公開API)。
  // historyが変わるたびに再計算するのみで、結果をstoreへキャッシュ・保存しない
  // (Adaptive Learning Layerの設計方針「Planは毎回Historyから導出するSnapshot」を継承)。
  const view = useMemo(() => deriveLearnerApplicationView(deriveAdaptivePlan(history)), [history]);

  if (history.length === 0) {
    return (
      <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
        <Alert tone="info">
          まだ完了した症例がありません。プロステーシス選択を完了すると、ここに学習状況が表示されます。
        </Alert>
      </div>
    );
  }

  return (
    <div className="sidebar" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
        完了した症例: {history.length}件
      </div>

      <Section title="優先教材" isEmpty={view.priorityTeachingNotes.length === 0}>
        {view.priorityTeachingNotes.map((n) => <TeachingNoteCard key={n.id} note={n} />)}
      </Section>

      <Section title="反復練習教材" isEmpty={view.repeatPracticeNotes.length === 0}>
        {view.repeatPracticeNotes.map((n) => <TeachingNoteCard key={n.id} note={n} />)}
      </Section>

      <Section title="推奨症例" isEmpty={view.recommendedCases.length === 0}>
        {view.recommendedCases.map((c) => <CaseActionCard key={c.id} item={c} />)}
      </Section>
    </div>
  );
}
