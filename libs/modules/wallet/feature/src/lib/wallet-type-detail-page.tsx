'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button } from '@myorg/shared/ui';
import { useWalletTypeDetailQuery } from '@myorg/modules/wallet/data-access';
import { WalletTypeDetailViewContent } from './wallet-type-detail-view-content';
import { WalletTypeMffViewContent } from './wallet-type-mff-view-content';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * WalletTypeDetailPage — 钱包类型详情（view + mff-view 两变体，slug 分支）。
 *
 * 迁移自 td-manage：
 * - `src/pages/wallet/wallet-type/view.tsx`（511 行）—— slug[1]=`view`，Descriptions 多块；
 * - `src/pages/wallet/wallet-type/mff/view.tsx`（509 行）—— slug[1]=`mff`，2 tab + 累计收益 + 股息抽屉。
 *
 * wallet 分组路由下原始 `slug`：`['wallet-type','view']`（常规）或
 * `['wallet-type','mff','view']`（MMF）。分支键 = `slug[1]`：`mff` → MMF 变体；其余 → 常规。
 * id/ruleId 由 `useSearchParams().get('id')` 解析（两源 view 均用 query.id 作为 ruleId）。
 *
 * 路由：
 * - `/wallet/wallet-type/view?id=` → 常规详情；
 * - `/wallet/wallet-type/mff/view?id=` → MMF 详情。
 */
export function WalletTypeDetailPage() {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();

  const slug = params.slug ?? [];
  const variant = slug[1] === 'mff' ? 'mff' : 'view';
  const ruleId = parseId(searchParams.get('id'));

  // 详情两变体共用；id 缺失时 hook 不发起请求。
  const detailQuery = useWalletTypeDetailQuery(ruleId);
  const detail = detailQuery.data;

  return (
    <div className="space-y-4">
      {variant === 'mff' ? (
        <WalletTypeMffViewContent
          ruleId={ruleId}
          detail={detail}
          isLoading={detailQuery.isLoading}
        />
      ) : (
        <WalletTypeDetailViewContent detail={detail} />
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
      </div>

      {!ruleId ? (
        <p className="text-center text-sm text-muted-foreground">
          {t('walletType.invalidId')}
        </p>
      ) : null}
    </div>
  );
}
