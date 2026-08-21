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
        // [M-2 real-device follow-up 2、issue①] このコンポーネントがnowrap+overflowXなflex行の
        // 中に置かれた場合（SimulationMode.tsxの右上ツールバー、1行化対応）、既定のflex-shrink:1
        // により祖先から圧縮され、上のflexWrap:'wrap'が自分自身の内部で誤発火し、ボタンが
        // 縦に折り返って異常に背が高くなる不具合が実機で発生した。flexShrink:0でこの祖先からの
        // 圧縮を防ぐ——単独で使われる場合（他のflex文脈）には影響しない安全な既定値。
        flexShrink: 0,
        gap: 'var(--toolbar-pill-gap, var(--space-1))',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-full)',
        padding: 'var(--toolbar-pill-py, var(--space-1))',
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
              padding: 'var(--toolbar-pill-py, var(--space-1)) var(--toolbar-pill-px, var(--space-3))',
              fontSize: 'var(--toolbar-pill-fs, 11px)',
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
