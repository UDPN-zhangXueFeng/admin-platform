/**
 * Legacy record view. Record and mint/melt calls retain their upstream contracts.
 * Contract deployment examples are read-only: live deployment and wallet
 * operations belong to the main Token Management overview.
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import {
  useStablecoinInfoQuery,
  useStablecoinListQuery,
} from '@myorg/modules/td-admin/data-access';
import { EMPTY_DISPLAY } from '@myorg/modules/td-admin/data-access';

import { RoleWallets } from './role-wallets';
import { ContractDeploymentTab } from './tokenized-deposit-view/contract-deployment-tab';
import {
  MintMeltModal,
  type MintMeltMode,
  type StablecoinListItem,
} from './tokenized-deposit-view/mint-melt-modal';
import { MintingMeltingTab } from './tokenized-deposit-view/minting-melting-tab';


// ═════════════════════════════════════════════════════════════════════
// 主组件
// ═════════════════════════════════════════════════════════════════════

/**
 * TokenizedDepositViewPage — 单币种详情运营页。
 *
 * 用法：被 module-registry detail page 懒加载。
 * ```tsx
 * <TokenizedDepositViewPage />
 * ```
 */
export function TokenizedDepositViewPage(): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // ── 稳定币列表（取 [0]，提交 Mint/Melt 时用 stablecoinId/name/symbol）──
  const stablecoinListQuery = useStablecoinListQuery();
  const stablecoinList = (stablecoinListQuery.data ?? []) as StablecoinListItem[];
  const currentStablecoin = stablecoinList[0];
  const coinName = currentStablecoin?.name ?? EMPTY_DISPLAY;
  const stablecoinId = currentStablecoin?.stablecoinId;

  // ── 稳定币信息（surplusCount 可销毁余额；源无 body 全局查询，mount 即拉）──
  const stablecoinInfoQuery = useStablecoinInfoQuery();
  const rawSurplusCount = stablecoinInfoQuery.data?.surplusCount;
  const surplusCount = rawSurplusCount == null ? undefined : Number(rawSurplusCount);

  // ── Mint / Melt Modal 状态 ──
  const [mintMeltOpen, setMintMeltOpen] = React.useState(false);
  const [mintMeltMode, setMintMeltMode] = React.useState<MintMeltMode>('Issuance');

  const openMintMelt = React.useCallback((mode: MintMeltMode) => {
    setMintMeltMode(mode);
    setMintMeltOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {stablecoinListQuery.isError && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{t('td_query_load_failed')}</span>
          <Button variant="outline" size="sm" onClick={() => stablecoinListQuery.refetch()}>
            {t('td_retry')}
          </Button>
        </div>
      )}
      <div className="text-base font-medium">{coinName}</div>

      <Tabs defaultValue="1">
        <TabsList>
          <TabsTrigger value="1">{t('tokenized_deposit_0014')}</TabsTrigger>
          <TabsTrigger value="2">{t('Router_047')}</TabsTrigger>
          <TabsTrigger value="3">{t('role_wallets')}</TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="mt-4">
          <MintingMeltingTab
            onOpenMintMelt={openMintMelt}
            canMint={stablecoinId != null && !stablecoinListQuery.isError}
            canMelt={stablecoinId != null && !stablecoinListQuery.isError && Number.isFinite(surplusCount)}
          />
        </TabsContent>

        <TabsContent value="2" className="mt-4">
          <ContractDeploymentTab />
        </TabsContent>

        <TabsContent value="3" className="mt-4">
          <RoleWallets />
        </TabsContent>
      </Tabs>

      {/* Mint / Melt Modal */}
      <MintMeltModal
        open={mintMeltOpen}
        mode={mintMeltMode}
        coinName={coinName}
        surplusCount={surplusCount}
        stablecoin={currentStablecoin}
        onCancel={() => setMintMeltOpen(false)}
        onSuccess={() => setMintMeltOpen(false)}
      />
    </div>
  );
}
