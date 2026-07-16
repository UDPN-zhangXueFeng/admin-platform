'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * WalletTypeDetailPage — 钱包类型详情（Phase 1 桩，slug[0] 分支）。
 *
 * slug[0]=`view`（query id=ruleId）→ 常规类型 Descriptions 多块；
 * slug[0]=`mff-view`（query id）→ MMF 类型 2 tab + 股息抽屉。
 * 迁移自 td-manage `src/pages/wallet/wallet-type/view.tsx`(511) 与 `mff/view.tsx`(509)。Phase 8 实现。
 */
export function WalletTypeDetailPage() {
  const t = useTranslations('modules.wallet');
  const params = useParams<{ slug?: string[] }>();
  const slug0 = params.slug?.[0];

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">
        {slug0 === 'mff-view'
          ? t('walletType.mffDetailTitle')
          : t('walletType.detailTitle')}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        slug0={slug0 ?? '(none)'}
      </p>
    </div>
  );
}
