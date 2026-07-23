'use client';

import { useTranslations } from 'next-intl';

import {
  APPROVAL_STATUS_COLOR,
  EMPTY_FIELD_VALUE,
} from '@myorg/modules/approval-manage/util';

/**
 * Approval status badge — 多族 status（approvalStatus / taskStatus）统一 toneClass badge。
 *
 * 迁移自源 view.tsx / index.tsx 各处 antd `<Tag>` 配色：
 * - approvalStatus（列表 Tab1/2，硬编码 {1:orange,2:error,3:success}）→ 文案 `common_approval_status_${n}`。
 * - taskStatus（列表 Tab3 + 详情 Steps / 审核组件业务状态）→ 色名走 i18n `approval_task_status_color_${n}`（返回 antd 色名），文案 `common_task_status_${n}`。
 *
 * 色名 → Tailwind class 由本地 TONE_CLASS 映射（与 blockchain / wallet status-badge 一致：
 * 各模块自洽定义 TONE_CLASS，不跨模块复用，见 wallet-status-badge 注释）。未知色名回落 default（gray）。
 *
 * 防御：next-intl 对缺失 key 会抛错，故对已知补全的 status 值集合做白名单，
 * 集合外回退占位 EMPTY_FIELD_VALUE（避免 MISSING_MESSAGE 抛错）。白名单照
 * approval-manage.json 已补全词条（approvalStatus {1,2,3}；taskStatus 11 个值）。
 */

/** antd 色名 → Tailwind badge class（唯一取色真源，键覆盖源可能取到的所有色名）。 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

/** tone → Tailwind badge class。未知 tone 回落 default。 */
function resolveToneClass(tone?: string): string {
  return (tone && TONE_CLASS[tone]) || TONE_CLASS.default;
}

/** status 族（决定状态码查找表与 i18n key 前缀）。 */
export type ApprovalStatusFamily = 'approval' | 'task';

/** approvalStatus 已补全词条的值集合（源硬编码 {1,2,3}）。 */
const APPROVAL_STATUS_VALUES = new Set([1, 2, 3]);
/**
 * taskStatus 已补全词条的值集合（照 modules.approval-manage.json common_task_status_*
 * 11 个值）。集合外回退占位，避免 next-intl 缺失 key 抛错。
 */
const TASK_STATUS_VALUES = new Set([
  1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45,
]);

export interface ApprovalStatusBadgeProps {
  /** status 族。approval=列表 Tab1/2 approvalStatus；task=Tab3 + 详情/审核组件 taskStatus。 */
  family: ApprovalStatusFamily;
  /** 后端状态码（数字）。 */
  status?: number | null;
}

/**
 * 渲染审批状态 badge。
 *
 * - family='approval'：色名走 `APPROVAL_STATUS_COLOR` 硬编码（不走 i18n），文案 `common_approval_status_${n}`。
 * - family='task'：色名走 i18n `approval_task_status_color_${n}`（返回 antd 色名），文案 `common_task_status_${n}`。
 */
export function ApprovalStatusBadge({
  family,
  status,
}: ApprovalStatusBadgeProps) {
  const t = useTranslations('modules.approval-manage');

  if (status == null) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }

  if (family === 'approval') {
    const color = APPROVAL_STATUS_COLOR[status];
    // 防御：非预期值回退占位。
    if (!color || !APPROVAL_STATUS_VALUES.has(status)) {
      return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
    }
    const labelKey = `common_approval_status_${status}` as const;
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${resolveToneClass(
          color,
        )}`}
      >
        {t(labelKey)}
      </span>
    );
  }

  // family === 'task'
  if (!TASK_STATUS_VALUES.has(status)) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }
  const colorKey = `approval_task_status_color_${status}` as const;
  const labelKey = `common_task_status_${status}` as const;
  const color = t(colorKey);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${resolveToneClass(
        color,
      )}`}
    >
      {t(labelKey)}
    </span>
  );
}
