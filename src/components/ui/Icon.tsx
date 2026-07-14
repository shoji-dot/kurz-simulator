import type { SVGProps } from 'react';

export interface IconProps {
  size?: 16 | 20 | 24;
  color?: string;
  className?: string;
}

function svgBase(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function resolve(props: IconProps) {
  const { size = 20, color = 'currentColor', className } = props;
  return { size, color, className };
}

/** チェック（成功・完了） */
export function IconCheck(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/** 警告（危険部位接近・改善点） */
export function IconWarning(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <path d="M12 3.5L21 19.5H3L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 情報（教育コンテンツ・注釈） */
export function IconInfo(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 開閉シェブロン（アコーディオン） */
export function IconChevronDown(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

/** 閉じる */
export function IconClose(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** 改善ポイント（上向き矢印） */
export function IconArrowUp(props: IconProps) {
  const { size, color, className } = resolve(props);
  return (
    <svg {...svgBase(size)} style={{ color }} className={className} aria-hidden="true">
      <path d="M12 19V6M6 11l6-6 6 6" />
    </svg>
  );
}
