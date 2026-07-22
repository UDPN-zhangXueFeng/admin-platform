'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  useStablecoinsQuery,
  useWalletTypeCardsQuery,
} from '@myorg/modules/wallet/data-access';

import { WalletTypeCardGrid } from './wallet-type-card-grid';
import { WalletTypeTableSection } from './wallet-type-table-section';
import {
  WalletTypeEarningsDialog,
  type WalletTypeEarningsTarget,
} from './wallet-type-earnings-dialog';

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
  const t = useTranslations('modules.wallet');

  const stablecoinsResult = useStablecoinsQuery();
  const stablecoins = stablecoinsResult.data ?? [];

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
      {/* 顶部 stablecoin tab 选择（源 CustomTab tdSymbol） */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        {stablecoinsResult.isLoading ? (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-8 w-28 animate-pulse rounded bg-muted/40"
              />
            ))}
          </div>
        ) : stablecoins.length === 0 ? (
          <div className="py-2 text-center text-sm text-muted-foreground">
            {t('common.noData')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stablecoins.map((coin, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={String(coin.stablecoinId ?? idx)}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {coin.name ?? coin.symbol ?? String(coin.stablecoinId)}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
