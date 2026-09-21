/**
 * Blockchain Status Badge — 区块链模块状态标签（node 列表 / deployment 列表 + 详情三处共用）。
 *
 * 迁移自源的 antd `<Tag color={...}>` 渲染，两种模式：
 *
 * 1. **node 状态（node/index 列表行）**—— 色值走 i18n key 动态拼接：
 *      色值：`common_task_status_color_${status}`（i18n 返回 antd 色名 success/gray）
 *      文案：`node_status_${status}`
 *    status 取值 1（启用）/ 2（禁用）；i18n 返回的 antd 色名再经本地 TONE_CLASS
 *    映射到 Tailwind badge class（与 mmf-status-badge 同模式，不依赖
 *    @myorg/shared/ui Badge —— 该库未导出 Badge，也不跨模块 import mmf util）。
 *
 * 2. **deployment 状态（deployment/index 列表 + deployment/view 详情两处）**
 *    —— **写死单态**：不论真实 status 值，永远显示 success 色 + `token_task_status_10`
 *    文案。源码两处均为 `render: () => <Tag color={'success'}>{t('token_task_status_10')}</Tag>`，
 *    照搬写死（见 blockchain.md 第8章风险点 / 第9章验收）。
 *
 * key 命名空间：色值 / 文案 key 均为 `modules.blockchain` 下的**扁平 key**
 * （`common_task_status_color_1` / `node_status_1` / `token_task_status_10`），
 * 非嵌套，故 useTranslations('modules.blockchain')。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';

/**
 * antd 色名 → Tailwind badge class（本模块唯一取色真源）。
 *
 * 键覆盖 `common_task_status_color_*` 可能返回的 antd 内置状态色名（success）
 * 与具体色名（gray / red / orange / blue / green）；命中失败回落 default（gray）。
 * 与 mmf-status-badge 的本地 TONE_CLASS 同结构、不跨模块复用（各模块自洽）。
 */
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

/**
 * tone → Tailwind badge class。未知 tone 回落 default（gray）。
 */
function toneClass(tone: string): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.default;
}

/** Badge 业务类型，决定取色与取文案的方式。 */
export type BlockchainBadgeKind = 'node' | 'deployment';

export interface BlockchainStatusBadgeProps {
  /**
   * 业务类型：
   * - `'node'`：色值与文案均走 i18n 动态拼接（`common_task_status_color_${status}` / `node_status_${status}`）。
   * - `'deployment'`：写死 success 色 + `token_task_status_10` 文案（忽略 status）。
   */
  kind: BlockchainBadgeKind;
  /**
   * 后端状态码。
   * - node：1（启用）/ 2（禁用）。
   * - deployment：实际值忽略（始终 success）。
   * 传 null/undefined 时回退 fallback。
   */
  status?: number | null;
  /** 空值占位文案，默认 '--'。 */
  fallback?: React.ReactNode;
}

/**
 * 渲染单个 blockchain 状态标签。
 *
 * 用法：
 * ```tsx
 * // node 列表行：动态取色 + 取文案
 * <BlockchainStatusBadge kind="node" status={row.status} />
 *
 * // deployment 列表 / 详情：写死 success
 * <BlockchainStatusBadge kind="deployment" />
 * <BlockchainStatusBadge kind="deployment" status={row.status} />
 * ```
 *
 * status 缺失时回退 fallback（纯文案，不挂 tone class）。
 */
export function BlockchainStatusBadge({
  kind,
  status,
  fallback = '--',
}: BlockchainStatusBadgeProps) {
  const t = useTranslations('modules.blockchain');

  // deployment 写死单态：始终 success 色 + token_task_status_10 文案。
  if (kind === 'deployment') {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
          'success',
        )}`}
      >
        {t('token_task_status_10')}
      </span>
    );
  }

  // node：色值与文案均走 i18n key 动态拼接。
  if (status == null) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  // i18n 返回 antd 色名（success / gray / ...），再经 toneClass 映射到 Tailwind class。
  const tone = t(`common_task_status_color_${status}`);
  const label = t(`node_status_${status}`);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
        tone,
      )}`}
    >
      {label}
    </span>
  );
}
