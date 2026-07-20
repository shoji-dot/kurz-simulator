import type { ReactNode } from 'react';

export type AlertTone = 'success' | 'warning' | 'error' | 'info';

const toneMap: Record<AlertTone, { bg: string; fg: string; border: string }> = {
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
  error: { bg: 'var(--color-error-bg)', fg: 'var(--color-error)', border: 'var(--color-error)' },
  info: { bg: 'var(--color-primary-tint)', fg: 'var(--color-primary)', border: 'var(--color-primary)' },
};

export interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

/** 危険部位警告・製品誤選択警告等に使う共通インラインバナー（KURZ Design System v1 18節） */
export function Alert({ tone, children }: AlertProps) {
  const t = toneMap[tone];
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'flex-start',
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        color: t.fg,
        font: 'var(--text-body)',
      }}
    >
      {children}
    </div>
  );
}
