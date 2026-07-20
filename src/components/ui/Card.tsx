import type { HTMLAttributes, CSSProperties } from 'react';

export type CardState = 'normal' | 'selected' | 'disabled';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  state?: CardState;
  interactive?: boolean;
}

const stateStyles: Record<CardState, CSSProperties> = {
  normal: { background: 'var(--color-surface)', border: '1px solid var(--color-border)' },
  selected: { background: 'var(--color-surface-selected)', border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-glow-primary)' },
  disabled: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', opacity: 0.5 },
};

/** KURZ Design System v1 11節: Normal/Selected/Disabled の共通カード */
export function Card({ state = 'normal', interactive = false, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        cursor: interactive && state !== 'disabled' ? 'pointer' : undefined,
        transition: 'border-color var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-standard)',
        ...stateStyles[state],
        ...style,
      }}
      {...rest}
    />
  );
}
