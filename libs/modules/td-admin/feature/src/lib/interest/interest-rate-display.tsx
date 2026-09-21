/**
 * 利率展示组件。
 *
 * 显示格式：`±annualInterestRate%`，精度可选（默认 2 位小数）。
 * 正利率 → 绿色，负利率 → 红色。
 */
'use client';

export interface InterestRateDisplayProps {
  rate: string;
  /** 是否显示百分号，默认 true */
  showPercent?: boolean;
}

export function InterestRateDisplay({ rate, showPercent = true }: InterestRateDisplayProps) {
  const isNegative = rate.startsWith('-');
  const displayRate = isNegative ? rate.slice(1) : rate;
  const colorClass = isNegative ? 'text-red-500' : 'text-green-600';

  return (
    <span className={colorClass}>
      {isNegative ? '-' : '+'}
      {displayRate}
      {showPercent ? '%' : ''}
    </span>
  );
}
