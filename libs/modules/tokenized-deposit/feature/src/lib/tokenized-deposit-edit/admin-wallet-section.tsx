'use client';

import * as React from 'react';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Circle,
  Info,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';

import type { TDEditFormValues } from '@myorg/modules/tokenized-deposit/data-access';

import { WalletFieldGroup, type WalletRoleType } from './wallet-field-group';
import { SectionHeading } from './ui/section-card';

/**
 * AdminWalletSection — 管理员钱包区（3 角色 + 提示框）。
 *
 * 迁移自 td-manage `edit/AdminWalletSection.tsx`（132 行）。委托 WalletFieldGroup 渲染
 * 3 角色钱包字段。重设计后：每个角色一张子卡片（编号 + 标题 + 就绪标记 + footer 生成按钮）。
 *
 * ## 3 角色
 *
 * | roleType | 角色 | 地址字段 |
 * |----------|------|---------|
 * | 1 | Contract Owner | walletAddressContractOwner |
 * | 2 | Gas Payment | walletAddressPaymentOfGasFee |
 * | 3 | Management | walletAddressManagementWallet |
 *
 * ## 显隐规则（严格保留源逻辑）
 *
 * - `showGenerateAction = applyStatus !== 35 && !shouldHideGenerateWalletAction`。
 * - `showKeystoreAndPassword = !((code && applyStatus===35) || shouldHideKeystoreAndPassword)`。
 * - 提示框：`applyStatus !== 35 && !shouldHideKeystoreAndPassword` 时渲染。
 */
export interface AdminWalletSectionProps {
  control: Control<TDEditFormValues>;
  hasCode: boolean;
  applyStatus?: number;
  shouldHideKeystoreAndPassword: boolean;
  shouldHideGenerateWalletAction: boolean;
  isAdminWalletDisabled: boolean;
  onGenerateWallet: (roleType: WalletRoleType) => void;
  embedded?: boolean;
}

/** 3 角色钱包字段配置（roleType / fieldNames / labelKeys）。 */
const walletFieldGroups: Array<{
  roleType: WalletRoleType;
  fieldNames: {
    walletAddress: string;
    keyStore: string;
    password: string;
  };
  labelKeys: {
    walletAddress: string;
    keyStore: string;
    password: string;
  };
}> = [
  {
    roleType: 1,
    fieldNames: {
      walletAddress: 'walletAddressContractOwner',
      keyStore: 'keyStoreContractOwner',
      password: 'passWordContractOwner',
    },
    labelKeys: {
      walletAddress: 'tokenized_deposit_0112',
      keyStore: 'tokenized_deposit_0079',
      password: 'tokenized_deposit_0080',
    },
  },
  {
    roleType: 2,
    fieldNames: {
      walletAddress: 'walletAddressPaymentOfGasFee',
      keyStore: 'keyStorePaymentOfGasFee',
      password: 'passWordPaymentOfGasFee',
    },
    labelKeys: {
      walletAddress: 'tokenized_deposit_0113',
      keyStore: 'tokenized_deposit_0079',
      password: 'tokenized_deposit_0080',
    },
  },
  {
    roleType: 3,
    fieldNames: {
      walletAddress: 'walletAddressManagementWallet',
      keyStore: 'keyStoreManagementWallet',
      password: 'passWordManagementWallet',
    },
    labelKeys: {
      walletAddress: 'tokenized_deposit_0114',
      keyStore: 'tokenized_deposit_0079',
      password: 'tokenized_deposit_0080',
    },
  },
];

export function AdminWalletSection({
  control,
  hasCode,
  applyStatus,
  shouldHideKeystoreAndPassword,
  shouldHideGenerateWalletAction,
  isAdminWalletDisabled,
  onGenerateWallet,
  embedded = false,
}: AdminWalletSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // 各角色钱包地址（驱动「就绪」标记 + section 徽标 n/3）。
  const ownerAddr = useWatch({
    control,
    name: 'walletAddressContractOwner' as keyof TDEditFormValues,
  }) as string | undefined;
  const gasAddr = useWatch({
    control,
    name: 'walletAddressPaymentOfGasFee' as keyof TDEditFormValues,
  }) as string | undefined;
  const mgmtAddr = useWatch({
    control,
    name: 'walletAddressManagementWallet' as keyof TDEditFormValues,
  }) as string | undefined;
  const addrByRole: Record<number, string | undefined> = {
    1: ownerAddr,
    2: gasAddr,
    3: mgmtAddr,
  };
  const completedWallets = [ownerAddr, gasAddr, mgmtAddr].filter(
    Boolean,
  ).length;

  // 生成按钮显隐：applyStatus!==35 且非 Ethereum Sepolia+Huawei KMS 特殊隐藏。
  const showGenerateAction =
    applyStatus !== 35 && !shouldHideGenerateWalletAction;
  // keyStore/password 显隐：非编辑只读 且 非 rigsec/fireblocks 隐藏。
  const showKeystoreAndPassword = !(
    (hasCode && applyStatus === 35) ||
    shouldHideKeystoreAndPassword
  );
  const isSecureReadonly = hasCode && applyStatus === 35;
  // 提示框显隐：applyStatus!==35 且 keyStore/password 可见。
  const showTip = applyStatus !== 35 && !shouldHideKeystoreAndPassword;

  return (
    <Card
      className={
        embedded
          ? 'rounded-none border-x-0 border-b-0 border-t pt-7 shadow-none'
          : undefined
      }
    >
      <SectionHeading
        icon={WalletCards}
        title={t('tokenized_deposit_0111')}
        description={t('td_section_admin_wallets_desc')}
        badge={t('td_section_admin_wallets_badge', { count: completedWallets })}
        embedded={embedded}
      />
      <CardContent className={embedded ? 'px-0 py-0' : 'py-6'}>
        <div className="grid gap-4 lg:grid-cols-3">
          {walletFieldGroups.map((group, index) => {
            const ready = !!addrByRole[group.roleType];
            return (
              <Card key={group.roleType} className="bg-muted/20">
                <CardHeader className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <CardTitle className="text-sm">
                      {t(group.labelKeys.walletAddress)}
                    </CardTitle>
                  </div>
                  <CardAction>
                    {ready ? (
                      <CheckCircle2
                        className="size-5 text-primary"
                        aria-label="Ready"
                      />
                    ) : (
                      <Circle
                        className="size-5 text-muted-foreground"
                        aria-label="Not ready"
                      />
                    )}
                  </CardAction>
                </CardHeader>
                <CardContent className="pb-5">
                  <WalletFieldGroup
                    control={control}
                    fieldNames={group.fieldNames}
                    labelKeys={group.labelKeys}
                    disabled={isAdminWalletDisabled}
                    secureFieldDisabled={isSecureReadonly}
                    showKeystoreAndPassword={showKeystoreAndPassword}
                  />
                </CardContent>
                {showGenerateAction ? (
                  <CardFooter>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => onGenerateWallet(group.roleType)}
                    >
                      <Sparkles className="size-4" />
                      {t('PUB_Generate_Wallet')}
                    </Button>
                  </CardFooter>
                ) : null}
              </Card>
            );
          })}
        </div>

        {showTip ? (
          <Alert className="mt-5">
            <Info className="size-4" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <AlertTitle className="text-primary">
                {t('tokenized_deposit_0142')}
              </AlertTitle>
              <AlertDescription>{t('tokenized_deposit_0141')}</AlertDescription>
            </div>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
