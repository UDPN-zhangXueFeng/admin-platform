'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button } from '@myorg/shared/ui';
import { UserWalletDetailHistoryContent } from './user-wallet-detail-history-content';
import { UserWalletDetailViewContent } from './user-wallet-detail-view-content';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * UserWalletDetailPage — 用户钱包详情（双 detail 路由合一）。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/view.tsx`(867) 与 `history.tsx`(299)。
 * 两条 detail 路由在 module-registry 都映射 pageKey=`detail`，由本组件按原始 slug
 * 二次分支（避免给 page.tsx 传 props）：
 *
 *   /wallet/user-wallet/view?walletId=&tab=    → slug=['user-wallet','view']    → view 变体（5 条件 tab）
 *   /wallet/user-wallet/history?walletId=      → slug=['user-wallet','history'] → history 变体（2 tab）
 *
 * 分支键 = `useParams().slug[1]`（slug[0] 恒为 `user-wallet`）。拿不到时默认 view。
 * walletId 从 `useSearchParams().get('walletId')` 取（列表跳转用 walletId 键）。
 * 缺 walletId 时显示兜底提示 + 返回按钮，不崩。
 *
 * view/history 的实际内容拆到 `user-wallet-detail-{view,history}-content.tsx`
 * （仅本文件内部 import，不进 barrel），避免单文件过大 + nx 误报 lazy。
 */
export function UserWalletDetailPage() {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();

  const slug = params.slug ?? [];
  // slug[0]='user-wallet'，分支键在 slug[1]（'view' | 'history'）。
  const variant = slug[1] === 'history' ? 'history' : 'view';
  const walletId = parseId(searchParams.get('walletId'));

  if (!walletId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t('userWallet.invalidId')}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {variant === 'history' ? (
        <UserWalletDetailHistoryContent walletId={walletId} />
      ) : (
        <UserWalletDetailViewContent walletId={walletId} />
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}
