import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--color-primary)', color: 'var(--color-bg-primary)', border: 'none' },
  secondary: { background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-bright)' },
  ghost: { background: 'transparent', color: 'var(--color-text-secondary)', border: 'none' },
  danger: { background: 'var(--color-error)', color: 'var(--color-bg-primary)', border: 'none' },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: 'var(--space-1) var(--space-3)', fontSize: '12px' },
  md: { padding: 'var(--space-2) var(--space-4)', fontSize: '14px' },
};

/** KURZ Design System v1 10節: Primary/Secondary/Ghost/Danger の共通ボタン */
export function Button({ variant = 'primary', size = 'md', style, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={['kz-focusable', `kz-btn-${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        fontFamily: 'var(--font-family)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...rest}
    />
  );
}
