import type { ReactNode } from 'react';

export interface PillOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** ホバー時のツールチップ（title属性） */
  title?: string;
}

export interface PillToggleGroupProps<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * KURZ Design System v1 10/20節: 操作モード・視野モード等のピル型トグル群の共通実装。
 * InteractiveDrillScene / SimulationMode / LearningMode 全てで同一コンポーネントを使用することで
 * 画面ごとに異なるツールバー実装が乱立する問題（監査High-3）を解消する。
 */
export function PillToggleGroup<T extends string>({ options, value, onChange, ariaLabel }: PillToggleGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-1)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-full)',
        padding: 'var(--space-1)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            title={opt.title}
            className="kz-focusable"
            onClick={() => !opt.disabled && onChange(opt.value)}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-family)',
              whiteSpace: 'nowrap',
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.4 : 1,
              background: active ? 'var(--color-primary)' : 'transparent',
              color: active ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
              transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
