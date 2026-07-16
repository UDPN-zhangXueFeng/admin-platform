'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * WalletTypeFormPage — 钱包类型表单（Phase 1 桩，slug[0] 分支）。
 *
 * slug[0]=`edit`（query type=add|edit, id?, stablecoinId, ...）→ 常规类型条件表单；
 * slug[0]=`mff-add`（query type=add|edit, ...）→ MMF 类型表单 + 生成钱包弹窗。
 * 迁移自 td-manage `src/pages/wallet/wallet-type/edit.tsx`(1242) 与 `mff/mff-add.tsx`(531)。Phase 7 实现。
 */
export function WalletTypeFormPage() {
  const t = useTranslations('modules.wallet');
  const params = useParams<{ slug?: string[] }>();
  const slug0 = params.slug?.[0];

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="text-lg font-semibold">
        {slug0 === 'mff-add'
          ? t('walletType.mffFormTitle')
          : t('walletType.formTitle')}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        slug0={slug0 ?? '(none)'}
      </p>
    </div>
  );
}
