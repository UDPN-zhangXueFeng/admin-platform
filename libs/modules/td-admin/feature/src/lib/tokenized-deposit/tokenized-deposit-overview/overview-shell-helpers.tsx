/**
 * overview-shell 辅助组件 / 工具 / 常量。
 *
 * 从 overview-shell.tsx 抽出（td-19），避免单文件 >800 行触发 nx lazy 误报。
 * 纯展示组件 + 纯函数 + 静态常量，无副作用。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { reSet } from '../re-set';
import {
  TokenSelector,
  type TokenSelectorLabels,
  type TokenSelectorMode,
  type TokenSelectorOption,
} from '..';
import {
  APPLY_STATUS,
  TD_PERMISSIONS,
  TD_STATE_ICON_COLOR,
} from '@myorg/modules/td-admin/data-access';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';

/** Tab key（对齐源码 active 字符串 '1'/'2'/'3'/'4'）。 */
export type OverviewTabKey = '1' | '2' | '3' | '4';

/** Tab 列表（顺序固定，对齐源码 getItem 顺序）。Tab1 标签由 tab1LabelKey 按币种分支。 */
export const TAB_DEFS: { key: OverviewTabKey; labelKey: string }[] = [
  { key: '1', labelKey: 'tokenized_deposit_0021' },
  { key: '2', labelKey: 'Router_0003_4' },
  { key: '3', labelKey: 'Router_0003_9' },
  { key: '4', labelKey: 'tokenized_deposit_0055' },
];

/**
 * Tab1 标签按币种形态分支（源 index.tsx:1122-1135 getItem 第一项，review NF-2）：
 * 质铸稳定币（mintMethod===1 && pledgeType===1）→ 0020；
 * MMF（mintMethod===20 && pledgeType===0）→ 0146（Summary）；
 * 其余（SP 记录）→ 0063；未选币同源走 0063。
 */
export function tab1LabelKey(td: ApplyListItem | undefined): string {
  if (td?.mintMethod === 1 && td?.pledgeType === 1) {
    return 'tokenized_deposit_0020';
  }
  if (td?.mintMethod === 20 && td?.pledgeType === 0) {
    return 'tokenized_deposit_0146';
  }
  return 'tokenized_deposit_0063';
}

/** Onboard 路由（对齐 arch §3 manifest create → /tokenized-deposit/onboard）。 */
export const ONBOARD_ROUTE = '/tokenized-deposit/onboard';
/** Edit 路由（arch §3 manifest edit → /tokenized-deposit/edit）。 */
export const EDIT_ROUTE = '/tokenized-deposit/edit';

/**
 * 决定 active Tab（按 state/applyStatus）。
 *
 * 完整搬运源码 getTilteList 内的状态机判断 + CustomTab onClick 内的同款判断。
 */
export function decideActiveTab(td: ApplyListItem | undefined): OverviewTabKey {
  const state = td?.state;
  const applyStatus = td?.applyStatus;
  if (
    state === 0 &&
    (applyStatus === APPLY_STATUS.REVIEWING ||
      applyStatus === APPLY_STATUS.REVIEWING_15)
  ) {
    return '4';
  }
  if (state === 0 && applyStatus === APPLY_STATUS.PENDING_DEPLOY) {
    return '2';
  }
  return '1';
}

/**
 * TD 切换条（自建 CustomTab 等价）。
 *
 * 源 libs/components/CustomTabs.tsx：水平 TD 标签条，每项 = token 图标 + name +
 * 链短名色徽标 + state 图标；右侧 Onboard 按钮（受 ONBOARD_TD/ONBOARD_T_EDIT 控制）。
 *
 * 迁移简化：
 * - token 图标 SVG 资源（/stablecoin/images/token_type_*.svg）缺失 → 改首字母圆形占位。
 * - 链短名色徽标 background 走 i18n `blockchain_code_color_${abbr}`（td i18n 已补 9 色）。
 * - Dropdown（Tabs/Dropdown 列表切换）为辅助功能，本任务不迁移（不影响数据正确性）。
 */
export function TdSwitcher({
  tdList,
  activeKey,
  onSelect,
  onOnboard,
}: {
  tdList: ApplyListItem[];
  activeKey: number;
  onSelect: (index: number) => void;
  onOnboard: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const [mode, setMode] = React.useState<TokenSelectorMode>('tabs');
  const options = React.useMemo<TokenSelectorOption[]>(
    () =>
      tdList.map((item, index) => ({
        id: item.id || item.code || String(index),
        name: item.name ?? item.symbol ?? '--',
        symbol: item.symbol,
        network: item.blockchainNameAbbreviation,
        // Number-safe：mintMethod 线上可为 numeric string（10=RetailCBDC/15=WholesaleCBDC）。
        type:
          Number(item.mintMethod) === 20
            ? 'M'
            : Number(item.mintMethod) === 5
              ? 'TD'
              : Number(item.mintMethod) === 10
                ? 'R-CBDC'
                : Number(item.mintMethod) === 15
                  ? 'W-CBDC'
                  : 'S',
        status:
          item.state === 1
            ? 'active'
            : item.state === 0
              ? 'pending'
              : 'inactive',
      })),
    [tdList],
  );
  const labels = React.useMemo<TokenSelectorLabels>(
    () => ({
      title: t('selector_title'),
      count: (count) => t('selector_count', { count }),
      search: t('selector_search'),
      clearSearch: t('selector_clear_search'),
      allTokenTypes: t('selector_all_token_types'),
      stablecoin: t('selector_stablecoin'),
      tokenizedDeposit: t('selector_tokenized_deposit'),
      tokenizedMmf: t('selector_tokenized_mmf'),
      retailCbdc: t('selector_retail_cbdc'),
      wholesaleCbdc: t('selector_wholesale_cbdc'),
      allNetworks: t('selector_all_networks'),
      tabView: t('selector_tab_view'),
      dropdownView: t('selector_dropdown_view'),
      contexts: t('selector_contexts'),
      loading: t('selector_loading'),
      empty: t('empty'),
      noMatch: t('selector_no_match'),
      expand: (count) => t('selector_expand', { count }),
      collapse: t('selector_collapse'),
      select: t('selector_select'),
      active: t('selector_active'),
      pending: t('selector_pending'),
      inactive: t('selector_inactive'),
    }),
    [t],
  );
  const value = options[activeKey]?.id ?? null;

  return (
    <div className="mb-6 w-full">
      <TokenSelector
        options={options}
        value={value}
        mode={mode}
        labels={labels}
        onModeChange={setMode}
        onValueChange={(id) => {
          const index = options.findIndex((option) => option.id === id);
          if (index >= 0) onSelect(index);
        }}
        action={
          <PermissionGuard permission={TD_PERMISSIONS.ONBOARD_TD}>
            <Button size="sm" onClick={onOnboard}>
              {t('Router_0003_1')}
            </Button>
          </PermissionGuard>
        }
      />
    </div>
  );
}

/** TD 切换条每项的 state 小图标（复用 TD_STATE_ICON_COLOR 配色）。 */
export function StateBadge({ state }: { state: number }): React.JSX.Element {
  const color = TD_STATE_ICON_COLOR[state] ?? '#666666';
  const icon =
    state === 0 ? (
      // ClockIcon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 h-4 w-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ) : state === 1 ? (
      // CheckCircleIcon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 h-4 w-4"
        aria-hidden="true"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ) : (
      // NoSymbolIcon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 h-4 w-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      </svg>
    );
  return icon;
}

/**
 * Empty 空页（源 src/pages/empty.tsx 等价）。
 *
 * applyList 无数据时渲染：占位图 + 文案 + Onboard 按钮（受 ONBOARD_TD 控制）。
 */
export function OverviewEmpty({
  onOnboard,
}: {
  onOnboard: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  return (
    <div className="mx-auto my-40 flex w-8/12 flex-col items-center">
      <div className="h-28 w-28 rounded-full bg-muted" />
      <div className="my-10 text-center text-lg">
        {t('tokenized_deposit_0083')}
      </div>
      <PermissionGuard permission={TD_PERMISSIONS.ONBOARD_TD}>
        <Button onClick={onOnboard}>{t('PUB_Onboard')}</Button>
      </PermissionGuard>
    </div>
  );
}

/**
 * 金额千分位格式化——代理模块级 `reSet`（源 libs/utils 变体逐分支等价：
 * undefined/负数→'--'，四舍五入 2 位小数 + 千分位）。
 *
 * 上游 Mint/Melt 弹窗余额/可销毁串即用 reSet（index.tsx 1720/1731/1735），
 * 不得以 Intl 等价实现替代（ISSUE-3 同类残留，2026-10-28 修正）。
 */
export function formatBalance(
  value: number | string | undefined | null,
): string {
  return reSet(value);
}
