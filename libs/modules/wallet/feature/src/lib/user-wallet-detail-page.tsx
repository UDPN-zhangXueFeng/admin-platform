'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * UserWalletDetailPage — 用户钱包详情（Phase 1 桩，slug[0] 分支）。
 *
 * slug[0]=`view`（query walletId, tab）→ 5 条件 tab 详情；
 * slug[0]=`history`（query walletId）→ 2 tab 授权历史。
 * 迁移自 td-manage `src/pages/wallet/user-wallet/view.tsx`(867) 与 `history.tsx`(299)。Phase 5 实现。
 */
export function UserWalletDetailPage() {
  const t = useTranslations('modules.wallet');
  const params = useParams<{ slug?: string[] }>();
  const slug0 = params.slug?.[0];

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">
        {slug0 === 'history'
          ? t('userWallet.historyTitle')
          : t('userWallet.detailTitle')}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        slug0={slug0 ?? '(none)'}
      </p>
    </div>
  );
}
