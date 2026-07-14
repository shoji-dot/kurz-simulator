import type { ReactNode, CSSProperties } from 'react';
import { Z_INDEX } from './zIndex';

export type ToolbarAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';

export interface ToolbarContainerProps {
  anchor: ToolbarAnchor;
  children: ReactNode;
  style?: CSSProperties;
}

const anchorStyles: Record<ToolbarAnchor, CSSProperties> = {
  'top-left': { top: 'var(--space-3)', left: 'var(--space-3)' },
  'top-right': { top: 'var(--space-3)', right: 'var(--space-3)' },
  'bottom-left': { bottom: 'var(--space-3)', left: 'var(--space-3)' },
  'bottom-right': { bottom: 'var(--space-3)', right: 'var(--space-3)' },
  'bottom-center': { bottom: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)' },
};

/**
 * 3D Viewer上に浮かぶツールバー/HUDパネルの共通コンテナ（KURZ Design System v1 9/20節）。
 * ルール: 画面の各辺（top-left/top-right/bottom-left/bottom-right/bottom-center）につき
 * ToolbarContainerは1つまで。複数機能をまとめる場合は内部でflex-direction:columnにしてgapで並べる
 * （個別にposition:absoluteブロックをマジックナンバーで積み重ねるのは禁止）。
 */
export function ToolbarContainer({ anchor, children, style }: ToolbarContainerProps) {
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: Z_INDEX.toolbar,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        background: 'var(--glass-bg)',
        border: 'var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        ...anchorStyles[anchor],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
