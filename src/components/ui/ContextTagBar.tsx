import type { CSSProperties, ReactNode } from 'react';
import { Badge } from './Badge';

/**
 * Clinical Tag表示基盤(Commit2、2026-08-06)。
 *
 * SimulationMode.tsx(旧ローカル`ContextTagBar`、独自span実装)とStepFlowMode.tsx
 * (旧`CaseTagBar`+2箇所のインライン実装、共有`Badge`使用)で重複していた
 * procedure/lesionタグ描画ロジックを1箇所に統合したもの。
 *
 * 両モードの既存CSSは統合前から異なっていた(pill=独自span/10px/border付、
 * badge=Badgeコンポーネント/11px/borderなし)ため、`variant`で描画方式を切り替え、
 * 各呼び出し元の既存の見た目を1px単位で変更しない方針とする
 * (`Priority3_UI_Design_Review_v1.0.md` §5 Must、shoji指定Option C)。
 */
export type ContextTagBarVariant = 'pill' | 'badge';

export interface ContextTagBarProps {
  procedureTags: string[];
  lesionTags: string[];
  /** 'pill': SimulationMode系の独自span実装(既定)。'badge': StepFlowMode系の共有Badge実装。 */
  variant?: ContextTagBarVariant;
  /**
   * falseの場合、ラップ用divを描画せずタグ本体(Fragment)のみ返す。
   * 呼び出し元が既存の独自コンテナ(他の要素と同じflex行に混在させる等)へ
   * そのまま組み込みたい場合に使用する。既定はtrue。
   */
  wrap?: boolean;
  /** ラップ用divのstyle(`wrap=false`の場合は無視される) */
  style?: CSSProperties;
  /** badge variantで各タグに追加styleを与えたい場合(例: canvas overlayの半透明背景) */
  tagStyle?: CSSProperties;
}

function renderTags(
  procedureTags: string[],
  lesionTags: string[],
  variant: ContextTagBarVariant,
  tagStyle?: CSSProperties,
): ReactNode {
  if (variant === 'badge') {
    return (
      <>
        {procedureTags.map(t => (
          <Badge key={t} tone="primary" style={tagStyle}>{t}</Badge>
        ))}
        {lesionTags.map(t => (
          <Badge key={t} tone="warning" style={tagStyle}>{t}</Badge>
        ))}
      </>
    );
  }
  return (
    <>
      {procedureTags.map(t => (
        <span key={t} style={{
          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(var(--color-primary-rgb),0.18)', color: 'var(--color-primary)',
          border: '1px solid rgba(var(--color-primary-rgb),0.35)', letterSpacing: '.02em',
        }}>{t}</span>
      ))}
      {lesionTags.map(t => (
        <span key={t} style={{
          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: 'rgba(var(--color-warning-rgb),0.15)', color: 'var(--color-warning)',
          border: '1px solid rgba(var(--color-warning-rgb),0.35)', letterSpacing: '.02em',
        }}>{t}</span>
      ))}
    </>
  );
}

export function ContextTagBar({
  procedureTags, lesionTags, variant = 'pill', wrap = true, style, tagStyle,
}: ContextTagBarProps) {
  const content = renderTags(procedureTags, lesionTags, variant, tagStyle);
  if (!wrap) return <>{content}</>;

  const defaultContainerStyle: CSSProperties = variant === 'badge'
    ? { display: 'flex', gap: 5, flexWrap: 'wrap' }
    : { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' };

  return (
    <div style={{ ...defaultContainerStyle, ...style }}>
      {content}
    </div>
  );
}
