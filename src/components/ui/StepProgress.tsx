export interface StepProgressItem {
  key: string;
  label: string;
  status: 'done' | 'current' | 'upcoming';
  /** 数字の代わりに表示するアイコン（絵文字等）。未指定時は連番を表示 */
  icon?: string;
  /** クリック可能にする場合のハンドラ（upcoming状態では無効化される） */
  onClick?: () => void;
}

export interface StepProgressProps {
  items: StepProgressItem[];
}

/**
 * KURZ Design System v1 14節: Breadcrumb相当の共通進行状況表示。
 * StepFlowModeのStepProgressBarを昇格し、SimulationModeのステップ表示とも統一する。
 */
export function StepProgress({ items }: StepProgressProps) {
  return (
    <div role="list" aria-label="進行状況" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      {items.map((item, i) => {
        const clickable = item.status !== 'upcoming' && !!item.onClick;
        return (
          <div key={item.key} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              onClick={clickable ? item.onClick : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick?.(); } } : undefined}
              aria-current={item.status === 'current' ? 'step' : undefined}
              className={clickable ? 'kz-focusable' : undefined}
              style={{
                width: 22,
                height: 22,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0,
                cursor: clickable ? 'pointer' : 'default',
                background: item.status === 'current' ? 'var(--color-primary)' : item.status === 'done' ? 'var(--color-success-bg)' : 'transparent',
                color: item.status === 'current' ? 'var(--color-bg-primary)' : item.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)',
                border: item.status === 'upcoming' ? '1px solid var(--color-border-bright)' : 'none',
              }}
            >
              {item.status === 'done' ? '\u2713' : (item.icon ?? i + 1)}
            </div>
            <span style={{ font: 'var(--text-small)', color: item.status === 'upcoming' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {i < items.length - 1 && (
              <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--color-border-bright)', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
