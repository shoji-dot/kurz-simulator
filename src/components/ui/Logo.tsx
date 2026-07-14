import type { CSSProperties } from 'react';

export type LogoTone = 'primary' | 'inverse';

export interface LogoMarkProps {
  /** マークの一辺（px）。ブランド規定の最小サイズは24px */
  size?: number;
  /** primary=既定（--color-primary）、inverse=明るい背景上での反転版（--color-bg-primary） */
  tone?: LogoTone;
  className?: string;
}

const TONE_COLOR: Record<LogoTone, string> = {
  primary: 'var(--color-primary)',
  inverse: 'var(--color-bg-primary)',
};

// 「KURZ」ワードマーク文字色: マーク（アイコン）は常にDesign System 2節の単色（--color-primary）
// を守るが、ワードマークの文字自体はHomeScreenヘッダーの既存表記（--color-text-primary）に
// 合わせ白系にする（2026-07-14 shojiさんフィードバック: 青字より白字の方が良い、との判断）。
const WORDMARK_TEXT_COLOR: Record<LogoTone, string> = {
  primary: 'var(--color-text-primary)',
  inverse: 'var(--color-bg-primary)',
};

/**
 * KURZ Design System v1 2節: 耳小骨（アブミ骨）のシルエットを抽象化した幾何マーク。
 * 単色ラインのみ・グラデーション不使用。影・グロー・回転・彩色バリエーションは禁止。
 * アブミ骨の卵円窓底板（footplate）を下端の弧、頭部（caput）〜脚（crura）を
 * 弓状の2本線で表現する。
 */
export function KurzLogoMark({ size = 32, tone = 'primary', className }: LogoMarkProps) {
  const color = TONE_COLOR[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* footplate（卵円窓底板） */}
      <ellipse cx="12" cy="18.2" rx="5" ry="1.9" />
      {/* 前脚（anterior crus） */}
      <path d="M8.1 17.4C7.7 13, 9 9, 11.1 6.9" />
      {/* 後脚（posterior crus） */}
      <path d="M15.9 17.4C16.3 13, 15 9, 12.9 6.9" />
      {/* 頭部（caput stapedis） */}
      <circle cx="12" cy="6" r="1.55" fill={color} stroke="none" />
    </svg>
  );
}

export interface LogoLockupProps extends LogoMarkProps {
  /** "Otology Education Simulator" サブタイトルを併記するか */
  subtitle?: boolean;
  style?: CSSProperties;
}

/**
 * マーク＋「KURZ」ワードマークのロックアップ。Splash Screen・HomeScreenヘッダー等で使用。
 * ブランド規定の最小サイズ: マーク＋ワードマークは96px幅相当を目安に。
 */
export function KurzWordmark({ size = 32, tone = 'primary', className, subtitle = false, style }: LogoLockupProps) {
  const textColor = WORDMARK_TEXT_COLOR[tone];
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', ...style }}
    >
      <KurzLogoMark size={size} tone={tone} />
      <div>
        <div style={{ font: 'var(--text-subtitle)', letterSpacing: '.08em', color: textColor, lineHeight: 1.2 }}>
          KURZ
        </div>
        {subtitle && (
          <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '.04em', marginTop: 2 }}>
            Otology Education Simulator
          </div>
        )}
      </div>
    </div>
  );
}
