export type FeedbackTone = 'positive' | 'improvement';

export interface FeedbackItem {
  tone: FeedbackTone;
  text: string;
}

export interface FeedbackProps {
  items: FeedbackItem[];
}

/** KURZ Design System v1 19節: 良かった点/次回意識するポイントの共通リスト表示 */
export function Feedback({ items }: FeedbackProps) {
  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 0, padding: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              marginTop: 2,
              fontSize: '13px',
              fontWeight: 700,
              color: item.tone === 'positive' ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {item.tone === 'positive' ? '\u2713' : '\u2191'}
          </span>
          <span style={{ font: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
