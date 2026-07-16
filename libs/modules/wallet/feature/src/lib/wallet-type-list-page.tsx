'use client';

import { useTranslations } from 'next-intl';
import { EMPTY_DISPLAY } from '@myorg/modules/wallet/util';

/**
 * WalletTypeListPage — 钱包类型仪表盘（Phase 1 桩）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx`（1177 行，最复杂列表页）。
 * Phase 6 实现：stablecoin tab 选择 + accountType 分组卡片网格 + 启用/禁用 + 两张表 +
 * 收益弹窗三段流（balance/calculate → earnings/calculate → earnings/send）+ PDF 下载。
 */
export function WalletTypeListPage() {
  const t = useTranslations('modules.wallet');
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">{t('walletType.title')}</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('loading')} {EMPTY_DISPLAY}
      </p>
    </div>
  );
}
