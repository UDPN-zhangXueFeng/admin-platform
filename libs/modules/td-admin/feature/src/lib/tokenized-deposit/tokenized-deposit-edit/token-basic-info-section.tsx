'use client';

import * as React from 'react';
import { type Control } from 'react-hook-form';
import { FieldGroup } from '@myorg/shared/ui';

import type {
  BlockchainOption,
  CurrencyOption,
  ReserveAccountOption,
  SmartContractOption,
  TDEditDetail,
  TDEditFormValues,
  TokenTypeOption,
} from '@myorg/modules/td-admin/data-access';
import { MINT_METHOD } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import { NetworkContractFields } from './network-contract-fields';
import { ThresholdFields } from './threshold-fields';
import { TokenClassificationField } from './token-classification-field';
import { TokenCoreAttributeFields } from './token-core-attribute-fields';
import { TokenPricingReserveFields } from './token-pricing-reserve-fields';

/**
 * TokenBasicInfoSection — 代币基本信息区（edit 最大组件）。
 *
 * 迁移自 td-manage `edit/TokenBasicInfoSection.tsx`（406 行）。重设计后拆为两张卡：
 * 「Token details」（mintMethod/name/symbol/decimals/currency/usPrice/reserve）+
 * 「Network & contract」（blockchain/contract/meta/whitelist）。字段与逻辑不变。
 *
 * ## 只读
 *
 * `isReadonly = !!code && applyStatus===35`（贯穿 Select/Input/Radio disabled）。
 *
 * ## 联动回调（来自 td-13 edit 页壳 / td-11 hooks）
 *
 * - onTokenTypeChange(value) —— mintMethod Select onChange（→ setTokenTypeId）。
 * - onBlockchainChange(value) —— blockchain Select onChange（→ useBlockchainEffect）。
 * - onCurrencyChange(value) —— currency Select onChange（→ getReserveList）。
 */

export interface TokenBasicInfoSectionProps {
  control: Control<TDEditFormValues>;
  hasCode: boolean;
  detailInfo: TDEditDetail;
  flag: boolean;
  chainType: string;
  mintMethod?: number;
  symbol?: string;
  currency?: string;
  reserveList?: ReserveAccountOption[];
  blockchainList?: BlockchainOption[];
  currencyList?: CurrencyOption[];
  smartContractNameList?: SmartContractOption[];
  /** Smart Contract 查询失败标志（inline 错误反馈，文档 14.5）。 */
  smartContractError?: boolean;
  /** Reserve 查询失败标志（inline 错误反馈，文档 14.5）。 */
  reserveError?: boolean;
  tokenTypeOptions: TokenTypeOption[];
  onBlockchainChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onTokenTypeChange: (value: number) => void;
}

export function TokenBasicInfoSection({
  control,
  hasCode,
  detailInfo,
  flag,
  chainType,
  mintMethod,
  symbol,
  currency,
  reserveList,
  blockchainList,
  currencyList,
  smartContractNameList,
  tokenTypeOptions,
  onBlockchainChange,
  onCurrencyChange,
  onTokenTypeChange,
}: TokenBasicInfoSectionProps): React.JSX.Element {
  const isReadonly = hasCode && detailInfo.applyStatus === 35;
  // 与源一致：TD(flag) 与 MMF(20) 之外均显示储备账户（Stablecoin + CBDC 10/15）。
  const showReserveAccount =
    !flag && mintMethod !== MINT_METHOD.MMF && mintMethod !== undefined;

  return (
    <div className="flex flex-col gap-9">
      <section>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <TokenClassificationField
            control={control}
            isReadonly={isReadonly}
            tokenTypeOptions={tokenTypeOptions}
            onTokenTypeChange={onTokenTypeChange}
          />
          <TokenCoreAttributeFields control={control} isReadonly={isReadonly} />
          <TokenPricingReserveFields
            control={control}
            isReadonly={isReadonly}
            showReserveAccount={showReserveAccount}
            symbol={symbol}
            currency={currency}
            reserveList={reserveList}
            currencyList={currencyList}
            onCurrencyChange={onCurrencyChange}
          />
        </FieldGroup>
        {mintMethod === MINT_METHOD.STABLECOIN ? (
          <ThresholdFields control={control} symbol={symbol} />
        ) : null}
      </section>
      <NetworkContractFields
        control={control}
        isReadonly={isReadonly}
        chainType={chainType}
        blockchainList={blockchainList}
        smartContractNameList={smartContractNameList}
        onBlockchainChange={onBlockchainChange}
      />
    </div>
  );
}
