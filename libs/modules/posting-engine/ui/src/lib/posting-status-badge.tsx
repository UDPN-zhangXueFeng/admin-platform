'use client';

import { useTranslations } from 'next-intl';
import {
  postingStatusToneClass,
  resolvePostingStatusMeta,
} from '@myorg/modules/posting-engine/util';

/**
 * Posting Engine 状态 badge。
 *
 * 由 util 的 `resolvePostingStatusMeta` 解析语义色调 + i18n key，再由
 * `postingStatusToneClass` 映射 Tailwind class，与具体 Badge 组件解耦。
 */
export function PostingStatusBadge({
  status,
  statusName,
}: {
  status?: number;
  statusName?: string;
}) {
  const t = useTranslations('modules.posting-engine');
  const meta = resolvePostingStatusMeta(status, statusName);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${postingStatusToneClass(
        meta.tone
      )}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}
