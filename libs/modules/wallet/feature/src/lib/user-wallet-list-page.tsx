'use client';

import { useTranslations } from 'next-intl';
import { EMPTY_DISPLAY } from '@myorg/modules/wallet/util';

/**
 * UserWalletListPage — 用户钱包列表（Phase 1 桩）。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/index.tsx`（732 行）。
 * Phase 5 实现：筛选 + 冻结/解冻资金/冻结/解冻钱包/改类型 5 弹窗 mutation 工作流。
 * POST `/api/manage/v1/user/wallet/list`。
 */
export function UserWalletListPage() {
  const t = useTranslations('modules.wallet');
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">{t('userWallet.title')}</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('loading')} {EMPTY_DISPLAY}
      </p>
    </div>
  );
}
