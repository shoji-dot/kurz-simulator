export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  'aria-label': string;
  disabled?: boolean;
}

/** KURZ Design System v1 14節: オン/オフ切替の共通トグルスイッチ */
export function Toggle({ checked, onChange, disabled = false, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="kz-focusable"
      style={{
        width: 36,
        height: 20,
        borderRadius: 'var(--radius-full)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        border: 'none',
        padding: 0,
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-hover)',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--duration-fast) var(--ease-standard)',
      }}
      {...rest}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--color-text-primary)',
          transition: 'left var(--duration-fast) var(--ease-standard)',
        }}
      />
    </button>
  );
}
