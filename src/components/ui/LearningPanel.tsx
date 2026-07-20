import type { ReactNode } from 'react';

export interface LearningPanelProps {
  title: string;
  children: ReactNode;
}

/** teachingPoints/clinicalNotes等の教育コンテンツ表示に使う共通カード（KURZ Design System v1 19節） */
export function LearningPanel({ title, children }: LearningPanelProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ font: 'var(--text-subtitle)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
