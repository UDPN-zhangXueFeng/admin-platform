'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  useStablecoinsQuery,
  useWalletTypeCardsQuery,
} from '@myorg/modules/td-admin/data-access';

import {
  TokenSelector,
  type TokenSelectorLabels,
  type TokenSelectorMode,
  type TokenSelectorOption,
} from '../tokenized-deposit/token-selector';
import { WalletTypeCardGrid } from './wallet-type-card-grid';
import { WalletTypeTableSection } from './wallet-type-table-section';
import {
  WalletTypeEarningsDialog,
  type WalletTypeEarningsTarget,
} from './wallet-type-earnings-dialog';

function toTokenSelectorType(
  issueType?: number,
): TokenSelectorOption['type'] {
  switch (Number(issueType)) {
    case 20:
      return 'M';
    case 5:
      return 'TD';
    case 10:
      return 'R-CBDC';
    case 15:
      return 'W-CBDC';
    default:
      return 'S';
  }
}

/**
 * WalletTypeListPage — 钱包类型仪表盘（整个 wallet 模块最复杂的页面）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx`（1177 行，业务热点 #1 全量）。
 *
 * 三层结构（页面极大，拆子组件，仅内部 import，不进 barrel——参考 journal-entries-detail-content
 * 拆分模式）：
 * - 顶部 stablecoin tab 选择（`useStablecoinsQuery`），选中 stablecoinId 驱动卡片网格 + 两张表。
 * - `WalletTypeCardGrid`：accountType 分组卡片网格（getGroup 三三分组）+ 启用/禁用 +
 *   issueType===20 卡片的收益派发入口。
 * - `WalletTypeTableSection`：两张表（常规/MMF 按 issueType 切换列），服务端分页。
 * - `WalletTypeEarningsDialog`：收益派发三段流弹窗（balance calc → earnings calc → send）。
 *
 * stablecoin 未选时：卡片/表均不请求（hook enabled 由子组件按 stablecoinId 控制）。
 */
export function WalletTypeListPage() {
  const selectorT = useTranslations('modules.tokenized-deposit');
  const [selectorMode, setSelectorMode] =
    React.useState<TokenSelectorMode>('tabs');

  const selectorLabels = React.useMemo<TokenSelectorLabels>(
    () => ({
      title: selectorT('selector_title'),
      count: (count) => selectorT('selector_count', { count }),
      search: selectorT('selector_search'),
      clearSearch: selectorT('selector_clear_search'),
      allTokenTypes: selectorT('selector_all_token_types'),
      stablecoin: selectorT('selector_stablecoin'),
      tokenizedDeposit: selectorT('selector_tokenized_deposit'),
      tokenizedMmf: selectorT('selector_tokenized_mmf'),
      retailCbdc: selectorT('selector_retail_cbdc'),
      wholesaleCbdc: selectorT('selector_wholesale_cbdc'),
      allNetworks: selectorT('selector_all_networks'),
      tabView: selectorT('selector_tab_view'),
      dropdownView: selectorT('selector_dropdown_view'),
      contexts: selectorT('selector_contexts'),
      loading: selectorT('selector_loading'),
      empty: selectorT('empty'),
      noMatch: selectorT('selector_no_match'),
      expand: (count) => selectorT('selector_expand', { count }),
      collapse: selectorT('selector_collapse'),
      select: selectorT('selector_select'),
      active: selectorT('selector_active'),
      pending: selectorT('selector_pending'),
      inactive: selectorT('selector_inactive'),
    }),
    [selectorT],
  );

  const stablecoinsResult = useStablecoinsQuery();
  const stablecoins = stablecoinsResult.data ?? [];
  const selectorOptions = React.useMemo<TokenSelectorOption[]>(
    () =>
      stablecoins.map((coin) => ({
        id: String(coin.stablecoinId),
        name: coin.name ?? coin.symbol ?? String(coin.stablecoinId),
        symbol: coin.symbol,
        network: coin.blockchainNameAbbreviation,
        type: toTokenSelectorType(coin.issueType),
        status: coin.state === 2 ? 'inactive' : 'active',
      })),
    [stablecoins],
  );

  // 默认选中第一个稳定币（源 useEffect coinData[0]）。activeKey 用 index 对齐源 ativeKey。
  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => {
    if (stablecoins.length > 0 && activeIndex >= stablecoins.length) {
      setActiveIndex(0);
    }
  }, [stablecoins.length, activeIndex]);
  const activeStablecoin = stablecoins[activeIndex];
  const activeStablecoinId = activeStablecoin?.stablecoinId;

  // 卡片网格数据（源 getTilteList → getWalletTypeList，扁平数组，未分页；内部分组）。
  const cardsResult = useWalletTypeCardsQuery(activeStablecoinId);
  const cards = cardsResult.data ?? [];
  const cardsLoading = cardsResult.isLoading || cardsResult.isFetching;

  // 卡片网格外层分页（每页 1 组 3 卡片，源 Pagination defaultPageSize=1）。
  // stablecoin 切换时重置到第 1 页。
  const [cardPage, setCardPage] = React.useState(1);
  React.useEffect(() => {
    setCardPage(1);
  }, [activeStablecoin?.stablecoinId]);

  // 收益派发弹窗上下文。
  const [earningsOpen, setEarningsOpen] = React.useState(false);
  const [earningsTarget, setEarningsTarget] =
    React.useState<WalletTypeEarningsTarget | null>(null);
  const openEarnings = React.useCallback((target: WalletTypeEarningsTarget) => {
    setEarningsTarget(target);
    setEarningsOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* stablecoin 选择器：复用 Token Management 的卡片式筛选与展示。 */}
      <TokenSelector
        options={selectorOptions}
        value={
          activeStablecoin ? String(activeStablecoin.stablecoinId) : null
        }
        mode={selectorMode}
        labels={selectorLabels}
        loading={stablecoinsResult.isLoading}
        onModeChange={setSelectorMode}
        onValueChange={(id) => {
          const nextIndex = selectorOptions.findIndex(
            (option) => option.id === id,
          );
          if (nextIndex >= 0) setActiveIndex(nextIndex);
        }}
      />

      {/* 卡片网格 */}
      <WalletTypeCardGrid
        stablecoin={activeStablecoin}
        cards={cards}
        isLoading={cardsLoading}
        page={cardPage}
        onPageChange={setCardPage}
        onOpenEarnings={openEarnings}
      />

      {/* 两张表 */}
      <WalletTypeTableSection stablecoin={activeStablecoin} />

      {/* 收益派发弹窗 */}
      <WalletTypeEarningsDialog
        open={earningsOpen}
        target={earningsTarget}
        onClose={() => setEarningsOpen(false)}
      />
    </div>
  );
}
