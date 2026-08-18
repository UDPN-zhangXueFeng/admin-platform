'use client';

/**
 * 页面级降级条（源 `src/components/ServiceDownAlert.vue` 1:1 等价，A7）。
 *
 * kissen-api 不可用（降级码 `MSG_23_0024`，lp-client 的 isServiceDown 判定）
 * 时由调用方渲染本条：警告样式、不可关闭、无全局 toast（lp-client 拦截器
 * 已豁免 0024）、页面保留已有数据不清空。
 *
 * 渲染/清除条件由调用方承担（与源一致）：
 * - 请求失败且 isServiceDown(err) → 渲染本组件（traceId 取 err.traceId）
 * - 非 0024 失败 → 清除降级条（旧数据保留）
 *
 * 文案与源逐字一致。
 */
import { CloudOff } from 'lucide-react';

import { Alert } from '@myorg/shared/ui';

export interface ServiceDownAlertProps {
  /** 排障追踪号（可选，取降级错误的 err.traceId）。 */
  traceId?: string;
}

export function ServiceDownAlert({ traceId }: ServiceDownAlertProps) {
  return (
    <Alert
      role="alert"
      className="border-amber-300 bg-amber-50 text-amber-900"
    >
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium leading-snug">
          Kissen 服务暂不可用,请稍后重试
        </p>
        <p className="text-sm text-amber-800">
          数据加载失败,已展示的内容不受影响,请稍后重试。
          {traceId && (
            <span className="ml-1 font-mono text-xs text-amber-700">
              ({traceId})
            </span>
          )}
        </p>
      </div>
    </Alert>
  );
}
