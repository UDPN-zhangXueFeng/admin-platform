'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * OperationalWalletDetailPage — 营运钱包详情（Phase 1 桩，slug[0] 分支）。
 *
 * dispatcher 解析 `/wallet/operational-wallet/<slug0>` → realModule=operational-wallet,
 * pageKey=detail。slug[0]=`view`（query id=ruleWalletId）→ 3 tab 详情。
 * 迁移自 td-manage `src/pages/wallet/operational-wallet/view.tsx`（293 行）。Phase 4 实现。
 */
export function OperationalWalletDetailPage() {
  const t = useTranslations('modules.wallet');
  const params = useParams<{ slug?: string[] }>();
  const slug0 = params.slug?.[0];

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">
        {t('operationalWallet.detailTitle')}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        slug0={slug0 ?? '(none)'}
      </p>
    </div>
  );
}
