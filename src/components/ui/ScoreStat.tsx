export interface ScoreStatProps {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  size?: 'display' | 'hero';
  color?: string;
}

/** KURZ Design System v1 19節Assessment: ABG改善量・総合スコア等のHero数値表示 */
export function ScoreStat({ label, value, unit, caption, size = 'hero', color = 'var(--color-text-primary)' }: ScoreStatProps) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div style={{ font: size === 'hero' ? 'var(--text-hero)' : 'var(--text-display)', color }}>
        {value}
        {unit && <span style={{ font: 'var(--text-body)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-1)' }}>{unit}</span>}
      </div>
      {caption && (
        <div style={{ font: 'var(--text-small)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{caption}</div>
      )}
    </div>
  );
}
