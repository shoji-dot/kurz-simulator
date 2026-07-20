import type { HTMLAttributes, CSSProperties } from 'react';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, CSSProperties> = {
  primary: { background: 'var(--color-primary-tint)', color: 'var(--color-primary)' },
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  error: { background: 'var(--color-error-bg)', color: 'var(--color-error)' },
  neutral: { background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' },
};

/** KURZ Design System v1 コンポーネント一覧: 推奨バッジ・状態タグ等の共通Badge */
export function Badge({ tone = 'neutral', style, ...rest }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px var(--space-3)',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '.05em',
        ...toneStyles[tone],
        ...style,
      }}
      {...rest}
    />
  );
}
