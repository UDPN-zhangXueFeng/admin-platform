'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  useCurrencyOptionsQuery,
  useSmartContractOptionsQuery,
  useTokenTypeOptionsQuery,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.queries';
import { useBlockchainOptionsQuery, useReserveListQuery } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.queries';
import { MINT_METHOD } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import type {
  TDEditDetail,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';

import { useKeyService } from './use-key-service';

/**
 * 表单数据内核：form watch + 桥接本地 state + 声明式 query + keyService + G6 储备默认。
 * 源: tokenized-deposit-form-content.tsx 147-228、600-622（纯代码搬移）。
 */
export interface UseTdFormDataParams {
  form: UseFormReturn<TDEditFormValues>;
  mode: 'add' | 'edit';
  hasCode: boolean;
}

export function useTdFormData({ form, mode, hasCode }: UseTdFormDataParams) {
  // ── form watch（驱动联动 + 传 sections）──
  const nameValue = form.watch('name') as string | undefined;
  const symbol = form.watch('symbol') as string | undefined;
  const currency = form.watch('currencySymbol') as string | undefined;
  const blockchain = form.watch('blockchainId') as string | undefined;
  const mintMethod = form.watch('mintMethod') as number | undefined;
  const reserveAccountId = form.watch('reserveAccountId') as
    | string
    | number
    | undefined;
  const keyServiceName = form.watch('keyServiceName') as string | undefined;
  const reserveReconValue = form.watch('enableReserveAssetReconciliation') as
    | number
    | undefined;
  // 派生 header 进度 / summary 用 watch（不改业务逻辑，纯展示）
  const smartContractPackageId = form.watch('smartContractPackageId') as
    | string
    | undefined;
  const ownerWalletAddr = form.watch(
    'walletAddressContractOwner' as keyof TDEditFormValues,
  ) as string | undefined;
  const gasWalletAddr = form.watch(
    'walletAddressPaymentOfGasFee' as keyof TDEditFormValues,
  ) as string | undefined;
  const mgmtWalletAddr = form.watch(
    'walletAddressManagementWallet' as keyof TDEditFormValues,
  ) as string | undefined;
  const formValues = form.watch();

  // ── edit 页本地 state（命令式↔声明式桥接用）──
  const [detailInfo, setDetailInfo] = React.useState<TDEditDetail>({});
  const [flag, setFlag] = React.useState(false);
  const [contractLanguage, setContractLanguage] = React.useState('');
  const [chainType, setChainType] = React.useState('evm');
  const [tokenType, setTokenTypeId] = React.useState<number>(
    MINT_METHOD.STABLECOIN,
  );
  // currencySymbol 桥接 state：getReserveList 回调 set 它，useReserveListQuery 监听它。
  const [reserveCurrency, setReserveCurrency] = React.useState<
    string | undefined
  >(undefined);

  /** 草稿恢复时跳过一次 keyService 默认选首项（保护恢复值）。 */
  const suppressSelectFirstOnceRef = React.useRef(false);

  // ── 3 公共下拉（声明式）──
  const { data: blockchainList } = useBlockchainOptionsQuery();
  const { data: currencyList } = useCurrencyOptionsQuery();
  const { data: tokenTypeOptions } = useTokenTypeOptionsQuery();

  // ── reserveList / smartContractNameList（声明式 query，桥接源本地 state）──
  const { data: reserveList, isError: reserveQueryError } =
    useReserveListQuery(reserveCurrency);
  const { data: smartContractNameList, isError: contractQueryError } =
    useSmartContractOptionsQuery({
      contractLanguage,
      tokenType,
    });

  // ── keyService（声明式监听 blockchainId）──
  const { keyServiceList, isError: keyServiceError } = useKeyService({
    form,
    blockchainId: blockchain,
    shouldSelectFirst: !hasCode,
    suppressSelectFirstOnceRef,
  });

  // ── G6：Stablecoin 下 Reserve 自动选首项（add only；TanStack Query 已无竞态）──
  React.useEffect(() => {
    if (mode !== 'add') return;
    if (mintMethod !== MINT_METHOD.STABLECOIN) return;
    // 当用户在 effect 提交前切换类型时，过期闭包不能把 Reserve 写回新类型。
    if (form.getValues('mintMethod') !== MINT_METHOD.STABLECOIN) return;
    const current = form.getValues('reserveAccountId');
    if (!reserveList || reserveList.length === 0) {
      if (current !== undefined && current !== null) {
        form.setValue('reserveAccountId', undefined);
      }
      return;
    }
    const exists = reserveList.some(
      (r) => String(r.reserveAccountId) === String(current),
    );
    if (!exists) {
      form.setValue(
        'reserveAccountId',
        reserveList[0].reserveAccountId as number,
      );
    }
  }, [mode, mintMethod, reserveList, form]);

  return {
    formValues,
    nameValue,
    symbol,
    currency,
    blockchain,
    mintMethod,
    reserveAccountId,
    keyServiceName,
    reserveReconValue,
    smartContractPackageId,
    ownerWalletAddr,
    gasWalletAddr,
    mgmtWalletAddr,
    detailInfo,
    setDetailInfo,
    flag,
    setFlag,
    contractLanguage,
    setContractLanguage,
    chainType,
    setChainType,
    tokenType,
    setTokenTypeId,
    reserveCurrency,
    setReserveCurrency,
    suppressSelectFirstOnceRef,
    blockchainList,
    currencyList,
    tokenTypeOptions,
    reserveList,
    smartContractNameList,
    keyServiceList,
    keyServiceError,
    reserveQueryError,
    contractQueryError,
  };
}

/** useTdFormData 返回去掉 reserveQueryError/contractQueryError 后的切片（对齐 composer
 * 透传面；两个 error 标志仅由 useTdQueryErrorToast 直接消费，同 TdCoaSlice 的 Omit 惯例）。 */
export type TdFormDataSlice = Omit<
  ReturnType<typeof useTdFormData>,
  'reserveQueryError' | 'contractQueryError'
>;
