/**
 * 分段利率展示表格（detail 页用）。
 *
 * 渲染 saveDetails 数组：每行显示余额区间 + 利率。
 * 含 `calculateDayMonth` 序数词后缀逻辑。
 */
'use client';

import { useTranslations } from 'next-intl';
import type { SaveDetailItem } from '@myorg/modules/interest/data-access';
import { InterestRateDisplay } from './interest-rate-display';

export interface InterestTierTableProps {
  saveDetails: SaveDetailItem[];
  calculateDayMonth?: number;
}

function getOrdinalSuffix(day: number, t: (key: string) => string): string {
  const lastDigit = day % 10;
  const lastTwo = day % 100;
  if (lastTwo === 11 || lastTwo === 12 || lastTwo === 13) return t('interest_00131'); // th
  if (lastDigit === 1) return t('interest_00128'); // st
  if (lastDigit === 2) return t('interest_00129'); // nd
  if (lastDigit === 3) return t('interest_00130'); // rd
  return t('interest_00131'); // th
}

export function InterestTierTable({ saveDetails, calculateDayMonth }: InterestTierTableProps) {
  const t = useTranslations('modules.interest');

  if (!saveDetails || saveDetails.length === 0) return null;

  return (
    <div className="flex flex-col space-y-1">
      {saveDetails.map((item, index) => (
        <div key={index} className="flex items-center text-sm">
          <span className="text-muted-foreground">
            {item.minValue} - {item.maxValue}
            {t('interest_00126')}
          </span>
          <InterestRateDisplay rate={item.interestRate} />
        </div>
      ))}
      {calculateDayMonth != null && (
        <div className="text-xs text-muted-foreground mt-1">
          {t('interest_00115')}: {calculateDayMonth}
          {getOrdinalSuffix(calculateDayMonth, t)} {t('interest_00127')}
        </div>
      )}
    </div>
  );
}
