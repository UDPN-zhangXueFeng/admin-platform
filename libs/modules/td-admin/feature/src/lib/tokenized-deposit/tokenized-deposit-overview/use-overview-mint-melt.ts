/**
 * OverviewShell 的 Mint/Melt 流程 hook：Modal 开关/上下文/类型/资产快照 state、
 * 储备余额按需查询（useReserveBalanceQuery）、modalInfo 组装 effect 与关闭回调。
 * 源: overview-shell.tsx 132-146、249-397
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useReserveBalanceQuery } from '@myorg/modules/td-admin/data-access';
import { formatBalance } from './overview-shell-helpers';
import {
  type MintMeltModalInfo,
  type MintMeltType,
} from './mint-melt-modal';

/** Mint/Melt 点击时的资产快照（code/symbol/tokenTypeLabel）。 */
export interface MintMeltAssetSnapshot {
  code: string;
  symbol: string;
  tokenTypeLabel: string;
}

/** 运营总览页主壳的 Mint/Melt Modal 流程。 */
export function useOverviewMintMelt() {
  const t = useTranslations('modules.tokenized-deposit');

  // ── 5 Modal open state 聚合（源分散 5 个 useState，这里集中）──
  // Mint/Melt（已接线，td-18）。
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  // MintMeltModal 上下文（源 modalInfo，getReservBalance 组装后写入）。
  const [mintMeltInfo, setMintMeltInfo] =
    React.useState<MintMeltModalInfo | null>(null);
  // Mint=1 / Melt=2（源 modalInfo.key）。
  const [mintMeltType, setMintMeltType] = React.useState<MintMeltType>(1);
  // Mint/Melt 点击时的资产快照（code/symbol/tokenTypeLabel）：余额请求与 Modal
  // 展示一律用快照，切换 TD/refetch 不会污染打开中的 Modal（防错资产提交）。
  const [mintMeltAsset, setMintMeltAsset] =
    React.useState<MintMeltAssetSnapshot | null>(null);

  // ── Mint/Melt 储备余额（点 Mint/Melt 按钮时按需拉，组装 modalInfo）──
  // mintMeltAsset 非空时启用 useReserveBalanceQuery（code-only body）。
  // 源 getReservBalance(code, el)：拉余额 → setModalInfo → setIsModalOpen(true)。
  const reserveParams = React.useMemo(() => {
    if (!mintMeltAsset?.code) return undefined;
    return { stablecoinCode: mintMeltAsset.code };
  }, [mintMeltAsset?.code]);
  const { data: reserveBalance } = useReserveBalanceQuery(reserveParams);

  // ── Mint/Melt modalInfo 组装（reserveBalance 回来后，源 getReservBalance 1713-1734）──
  // 余额响应对应 mintMeltAsset.code 快照；symbol 优先取快照（点击行），响应兜底。
  React.useEffect(() => {
    if (!mintMeltAsset?.code || !reserveBalance) return;
    const {
      reserveBalance: rb,
      currencySymbol,
      availableBalance,
      symbol,
      surplusCount,
    } = reserveBalance;
    const isMint = mintMeltType === 1;
    const limit = isMint ? Number(availableBalance) : Number(surplusCount);
    const balanceStr = isMint
      ? `${formatBalance(availableBalance)} ${symbol ?? ''}`
      : `${formatBalance(surplusCount)} ${symbol ?? ''}`;
    setMintMeltInfo({
      title: t(isMint ? 'Router_0003_2' : 'Router_0003_3'),
      availableBalance: limit,
      reserveBalance: `${t('tokenized_deposit_0072')}: ${formatBalance(rb)} ${
        currencySymbol ?? ''
      }`,
      tips: (isMint
        ? t('tokenized_deposit_0073')
        : t('tokenized_deposit_0074')
      ).replace('****', balanceStr),
    });
    setIsModalOpen(true);
  }, [mintMeltAsset, reserveBalance, mintMeltType, t]);

  // Mint/Melt Modal 关闭：清快照 + 上下文（下次点击重新组装）。
  const handleMintMeltClose = React.useCallback(() => {
    setIsModalOpen(false);
    setMintMeltInfo(null);
    setMintMeltAsset(null);
  }, []);

  return {
    isModalOpen,
    mintMeltInfo,
    mintMeltType,
    mintMeltAsset,
    setMintMeltType,
    setMintMeltAsset,
    handleMintMeltClose,
  };
}
