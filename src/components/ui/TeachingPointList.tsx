export interface TeachingPointListProps {
  points: string[];
}

/** KURZ Design System v1 19節: 番号付きTeaching Point表示 */
export function TeachingPointList({ points }: TeachingPointListProps) {
  return (
    <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', margin: 0, padding: 0 }}>
      {points.map((point, i) => (
        <li key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary-tint)',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i + 1}
          </span>
          <span style={{ font: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>{point}</span>
        </li>
      ))}
    </ol>
  );
}
