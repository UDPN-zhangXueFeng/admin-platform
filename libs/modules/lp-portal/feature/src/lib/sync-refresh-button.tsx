'use client';

/**
 * 按域刷新按钮（源 `src/components/SyncRefreshButton.vue` 1:1 等价，LP/03 §A）。
 *
 * POST /sync/refresh?domain=X body{} → { domain, applied }：成功 toast
 * applied>0 ? `Synced N entries` : 'Already up to date'，随后 onRefreshed()
 * 由父页重拉当前视图（源 emit('refreshed') 等价）。失败交 lp-client 拦截器
 * 统一 toast，此处静默不二次提示。
 *
 * 域映射陷阱（01 §B）：split 用 'pair'（复用 pair 域）；settle 单据刷
 * 'settle_order' 只刷结算单域不刷 settle_record。SyncDomainCode 枚举：
 * token|bank|rate|pool|topup|preauth|pair|tx_flow|settle_record|settle_order。
 */
import { RefreshCw } from 'lucide-react';

import { Button, useToast } from '@myorg/shared/ui';

import {
  useSyncRefreshMutation,
  type SyncDomainCode,
} from '@myorg/modules/lp-portal/data-access';

export interface SyncRefreshButtonProps {
  /** 同步域（SyncDomainCode 枚举字面量）。 */
  domain: SyncDomainCode;
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
            toast.success(
              res.applied > 0
                ? `Synced ${res.applied} entries`
                : 'Already up to date',
            );
            onRefreshed?.();
          },
          // 错误链路由 lp-client 拦截器统一提示（源 catch 静默等价）。
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onError: () => {},
        })
      }
    >
      <RefreshCw
        aria-hidden="true"
        className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`}
      />
      Refresh
    </Button>
  );
}
