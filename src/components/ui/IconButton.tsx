import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  active?: boolean;
  children: ReactNode;
}

/** ツールバー内のトグル用アイコンボタン（KURZ Design System v1 10節Ghostバリアント相当） */
export function IconButton({ active = false, className, style, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={['kz-focusable', className].filter(Boolean).join(' ')}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
        ...style,
      }}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}
