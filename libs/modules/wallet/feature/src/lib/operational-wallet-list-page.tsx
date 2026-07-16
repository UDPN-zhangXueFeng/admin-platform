'use client';

import { useTranslations } from 'next-intl';
import { EMPTY_DISPLAY } from '@myorg/modules/wallet/util';

/**
 * OperationalWalletListPage — 营运钱包列表（Phase 1 桩）。
 *
 * 迁移自 td-manage `src/pages/wallet/operational-wallet/index.tsx`（250 行）。
 * Phase 4 实现：筛选（stablecoin/blockchain/accountType/feeType/state）+ 服务端分页 +
 * Detail 操作。POST `/api/manage/v1/operational/wallet/list`。
 */
export function OperationalWalletListPage() {
  const t = useTranslations('modules.wallet');
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">{t('operationalWallet.title')}</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('loading')} {EMPTY_DISPLAY}
      </p>
    </div>
  );
}
