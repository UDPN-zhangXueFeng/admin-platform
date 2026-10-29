/**
 * OverviewShell 的 9 操作按钮分发 hook（OverviewActionButtons onAction）：
 * Mint/Melt 资产快照、Tab/路由跳转、Disable/Enable/Delete 二次确认打开。
 * 源: overview-shell.tsx 285-360
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  TD_STATE,
  type ApplyListItem,
} from '@myorg/modules/td-admin/data-access';
import type { OverviewActionButtonKey } from './overview-action-buttons';
import type { MintMeltType } from './mint-melt-modal';
import { EDIT_ROUTE, type OverviewTabKey } from './overview-shell-helpers';
import type { MintMeltAssetSnapshot } from './use-overview-mint-melt';
import type {
  OverviewDeleteConfirm,
  OverviewStatusConfirm,
} from './use-overview-confirm';

export interface UseOverviewActionParams {
  currentTd: ApplyListItem | undefined;
  setActive: React.Dispatch<React.SetStateAction<OverviewTabKey>>;
  setMintMeltType: React.Dispatch<React.SetStateAction<MintMeltType>>;
  setMintMeltAsset: React.Dispatch<
    React.SetStateAction<MintMeltAssetSnapshot | null>
  >;
  setStatusConfirm: React.Dispatch<
    React.SetStateAction<OverviewStatusConfirm | null>
  >;
  setDeleteConfirm: React.Dispatch<
    React.SetStateAction<OverviewDeleteConfirm | null>
  >;
}

/** 运营总览页主壳的 9 按钮分发。 */
export function useOverviewAction({
  currentTd,
  setActive,
  setMintMeltType,
  setMintMeltAsset,
  setStatusConfirm,
  setDeleteConfirm,
}: UseOverviewActionParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  // ── 9 按钮分发（OverviewActionButtons onAction）──
  const handleAction = React.useCallback(
    (key: OverviewActionButtonKey) => {
      switch (key) {
        case 'Mint':
        case 'Melt': {
          // 触发 useReserveBalanceQuery（按需拉余额，effect 内组装 modalInfo 开 Modal）。
          // 资产三元组在点击时快照：余额请求与 Modal 展示均用快照，防切换 TD/refetch
          // 后错资产提交（源在点击闭包内捕获 getUsablePrice，等价）。
          const type: MintMeltType = key === 'Mint' ? 1 : 2;
          const code = currentTd?.code ?? '';
          setMintMeltType(type);
          setMintMeltAsset({
            code,
            symbol: currentTd?.symbol ?? '',
            tokenTypeLabel:
              currentTd?.mintMethod == null
                ? ''
                : t(`token_type_${currentTd.mintMethod}`),
          });
          break;
        }
        case 'Contracts':
          setActive('2');
          break;
        case 'Edit':
          router.push(`${EDIT_ROUTE}?code=${currentTd?.code ?? ''}`);
          break;
        case 'Transactions':
          router.push(
            `/transaction-flow?stablecoinId=${currentTd?.stablecoinId ?? ''}`,
          );
          break;
        case 'Wallets':
          router.push(
            `/wallet/user-wallet?stablecoinId=${
              currentTd?.stablecoinId ?? ''
            }`,
          );
          break;
        case 'Disable':
        case 'Enable': {
          // 源 confirm：title=state===1?Router_036:Router_0003_6，
          // content=state===1?0044:0045（replace name），enable=state===1?0:1。
          // code 快照：提交作用于确认时的目标 TD。
          const isEnabled = currentTd?.state === TD_STATE.ENABLED;
          const name = currentTd?.name ?? '';
          setStatusConfirm({
            open: true,
            code: currentTd?.code ?? '',
            enable: isEnabled ? 0 : 1,
            title: isEnabled ? t('Router_036') : t('Router_0003_6'),
            content: (isEnabled
              ? t('tokenized_deposit_0044')
              : t('tokenized_deposit_0045')
            ).replace('****', name),
            toastWord: t('PUB_Submit'),
          });
          break;
        }
        case 'Delete': {
          // 源 confirm：title=PUB_Delete，content=0046（replace name）。
          const name = currentTd?.name ?? '';
          setDeleteConfirm({
            open: true,
            code: currentTd?.code ?? '',
            content: t('tokenized_deposit_0046').replace('****', name),
          });
          break;
        }
        default:
          break;
      }
    },
    [router, currentTd, t],
  );

  return handleAction;
}
