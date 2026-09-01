'use client';

/**
 * 按域刷新按钮（源 `src/components/SyncRefreshButton.vue` 等价，LP/03 §A；
 * f0d5b6f 批 4d27ccf 多域修订）。
 *
 * POST /sync/refresh?domain=X body{} → { domain, applied, failedDomains? }：
 * 数组 join(',') 一次拉齐本页全部依赖域。failedDomains 非空=部分域失败
 * warning toast（成功域照常 applied）；否则成功 toast applied>0 ?
 * `Synced N entries` : 'Already up to date'。随后 onRefreshed() 由父页
 * 重拉当前视图（源 emit('refreshed') 等价）。失败交 lp-client 拦截器统一
 * toast，此处静默不二次提示。
 *
 * 域映射（01 §B，f0d5b6f 按页面依赖域拉齐）：token 页 ['token','bank']、
 * pool 页 ['pool','preauth','topup']、pair 页与 split-settle 卡1
 * ['pair','rate']（复用 pair 域）、settle 单据 'settle_order' 只刷结算单域。
 */
import { RefreshCw } from 'lucide-react';

import { Button, useToast } from '@myorg/shared/ui';

import {
  useSyncRefreshMutation,
  type SyncDomainCode,
} from '@myorg/modules/lp-portal/data-access';

interface SyncRefreshButtonProps {
  /** 同步域（SyncDomainCode 枚举字面量）；f0d5b6f 起可传数组一次拉齐依赖域。 */
  domain: SyncDomainCode | SyncDomainCode[];
  /** 刷新成功后的父页重载回调（源 @refreshed）。 */
  onRefreshed?: () => void;
  className?: string;
}

export function SyncRefreshButton({
  domain,
  onRefreshed,
  className,
}: SyncRefreshButtonProps) {
  const toast = useToast();
  const refresh = useSyncRefreshMutation();

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={refresh.isPending}
      onClick={() =>
        refresh.mutate(domain, {
          onSuccess: (res) => {
            // failedDomains 非空=部分域失败（成功域照常 applied）：
            // warning 分级提示（f0d5b6f 批 4d27ccf），仍通知父页重载。
            if (res.failedDomains) {
              toast.warning(
                `Partial sync failure (${res.failedDomains}) — synced ${res.applied} entries`,
              );
            } else {
              toast.success(
                res.applied > 0
                  ? `Synced ${res.applied} entries`
                  : 'Already up to date',
              );
            }
            onRefreshed?.();
          },
          // 错误链路由 lp-client 拦截器统一提示（源 catch 静默等价）。
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onError: () => {},
        })}
    >
      <RefreshCw
        aria-hidden="true"
        className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`}
      />
      Refresh
    </Button>
  );
}
