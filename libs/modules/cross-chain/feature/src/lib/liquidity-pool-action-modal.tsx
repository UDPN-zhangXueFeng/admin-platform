'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import {
  useReauthorizeLiquidityPoolMutation,
  useTransferOutLiquidityPoolMutation,
} from '@myorg/modules/cross-chain/data-access';
import { getEncryptionData } from '@myorg/modules/cross-chain/util';

/**
 * Liquidity-Pool 行动作类型。
 *
 * 与源码一致：列表行「重新授权 / 转出」共用一个动态 Modal，按 status 分支渲染字段。
 * - `Reauthorize`：仅 deductibleAmount（小数位 validator）。
 * - `TransferOut`：receiverWalletAddress（isHexPrefixed 校验）+ amount（小数位 validator +
 *   max=balance）+ keystorePassword（AES 加密）。
 */
export type LiquidityPoolAction = 'Reauthorize' | 'TransferOut';

/**
 * Modal 上下文（由 liquidity-pool-list-page 的行操作 actionClick 填充）。
 *
 * 与源码 modalInfo 字段一一对应（title 不再冗余存储，改由 action 派生 i18n key）。
 */
export interface LiquidityPoolModalInfo {
  /** 行 id（来自 DataTable 契约）。 */
  id?: string;
  /** 流动性池 id（写操作入参）。 */
  liquidityPoolId: number;
  /** 当前动作（决定渲染哪组字段 + 调哪个 mutation）。 */
  action: LiquidityPoolAction;
  /** 钱包余额（amount 上限 + balance 提示文案）。 */
  balance: string;
  /** 币种符号（InputNumber 后缀 + balance 提示文案）。 */
  symbol: string;
  /** 小数位上限（amount / deductibleAmount validator）。 */
  decimalPrecision: number;
  /** 只读回填：代币名称。 */
  tokenName?: string;
  /** 只读回填：区块链。 */
  blockchain?: string;
  /** 只读回填：流动性池钱包地址（TransferOut 时展示余额提示）。 */
  liquidityPoolWalletAddress?: string;
}

/** Reauthorize 表单值（单字段）。 */
interface ReauthorizeFormValues {
  deductibleAmount: string;
}

/** TransferOut 表单值（三字段）。 */
interface TransferOutFormValues {
  receiverWalletAddress: string;
  amount: string;
  keystorePassword: string;
}

export interface LiquidityPoolActionModalProps {
  /** Modal 上下文（action/liquidityPoolId/balance/...）。null 表示关闭态。 */
  modalInfo: LiquidityPoolModalInfo | null;
  /** 打开 / 关闭控制（受控）。 */
  open: boolean;
  /** 关闭回调（取消 / 提交成功 / 透传 onOpenChange=false 时调用）。 */
  onClose: () => void;
}

/**
 * isHexPrefixed —— 迁移自 td-manage src/utils/index.ts:73。
 *
 * 收款地址必须以 `0x` 开头（与源码 `/^0x/.test(value)` 一致，完整搬运勿简化）。
 */
function isHexPrefixed(value: string): boolean {
  return /^0x/.test(value);
}

/**
 * 小数位校验器（amount / deductibleAmount 共用）。
 *
 * 迁移自源码 InputNumber validator：
 * - 空值 → 返回必填错误文案；
 * - 含小数点且小数位 > decimalPrecision → 返回 cross_chain_0028（ICU 插值 decimalPrecision）；
 * - 否则通过。
 *
 * 注：源码用 `value && String(value).split('.')[1]`，此处入参已是 string，
 * 直接 `String(value).split('.')[1]`，行为等价。
 */
function validateDecimal(
  value: string,
  decimalPrecision: number,
  messages: { required: string; tooManyDecimals: string },
): string | true {
  if (!value) {
    return messages.required;
  }
  if (String(value).indexOf('.') > -1) {
    const fraction = String(value).split('.')[1] ?? '';
    if (fraction.length > decimalPrecision) {
      return messages.tooManyDecimals;
    }
  }
  return true;
}

/**
 * LiquidityPoolActionModal —— 流动性池「重新授权 / 转出」共用动态 Modal。
 *
 * 迁移自 td-manage src/pages/cross-chain/liquidity-pool/index.tsx 的 CustomModal +
 * onFinish + custmFormItems 动态表单（cc-7）。
 *
 * 业务规则（完整搬运，勿简化）：
 * - 按 modalInfo.action 分支渲染：
 *   - `Reauthorize`：3 个只读字段（tokenName / blockchain /
 *     liquidityPoolWalletAddress，后者带 balance 提示 extra）+ deductibleAmount
 *     （cross_chain_0050），调 `useReauthorizeLiquidityPoolMutation`。
 *   - `TransferOut`：3 个只读字段 + receiverWalletAddress（cross_chain_0074，isHexPrefixed
 *     校验）+ amount（cross_chain_0075，小数位 validator + max=balance）+
 *     keystorePassword（cross_chain_0053，type=password，AES 加密后提交），调
 *     `useTransferOutLiquidityPoolMutation`。
 * - keystorePassword 提交前经 `getEncryptionData`（AES-CBC）加密。
 * - 提交成功 → `toast.success` + reset + onClose（mutation onSuccess 已 invalidate
 *   liquidity-pool 列表缓存，列表自动刷新）。
 * - 提交中禁止关闭（对齐 mmf/statements/node-delete Modal 模式）。
 *
 * 校验文案 i18n 规范化（对齐 node-delete-modal 的 next-intl 插值策略）：
 * - 源码 `t('PUB_Pleased').replace('****', field)` → `t('fieldRequired', { field })`；
 * - 源码 `t('PUB_Invalid').replace('****', field)` → `t('fieldInvalid', { field })`；
 * - 源码 `t('cross_chain_0028').replace('${decimalPrecision}', n)` →
 *   `t('cross_chain_0028', { decimalPrecision: n })`（key 已含 ${decimalPrecision} 占位）。
 *
 * > 该组件放在 feature 层而非 plan 所述 ui 层：依赖 react-hook-form +
 * > data-access mutation + sonner，ui 层为纯展示层无这些依赖；与同构组件
 * > blockchain/node-delete-modal（feature 层）保持一致。
 */
export function LiquidityPoolActionModal({
  modalInfo,
  open,
  onClose,
}: LiquidityPoolActionModalProps): React.JSX.Element | null {
  const t = useTranslations('modules.cross-chain');
  const reauthMutation = useReauthorizeLiquidityPoolMutation();
  const transferMutation = useTransferOutLiquidityPoolMutation();

  const isReauthorize = modalInfo?.action === 'Reauthorize';

  // ── Reauthorize form（单字段）──
  const reauthForm = useForm<ReauthorizeFormValues>({
    defaultValues: { deductibleAmount: '' },
  });

  // ── TransferOut form（三字段）──
  const transferForm = useForm<TransferOutFormValues>({
    defaultValues: {
      receiverWalletAddress: '',
      amount: '',
      keystorePassword: '',
    },
  });

  // 打开 / 切换行时重置表单（对齐源码 destroyOnClose + setTimeout resetFields）。
  React.useEffect(() => {
    if (open && modalInfo) {
      reauthForm.reset({ deductibleAmount: '' });
      transferForm.reset({
        receiverWalletAddress: '',
        amount: '',
        keystorePassword: '',
      });
    }
  }, [open, modalInfo?.id, modalInfo?.action, reauthForm, transferForm]);

  // 切换 action 时清除残留错误（避免 Reauthorize→TransferOut 错误态串台）。
  React.useEffect(() => {
    if (open) {
      reauthForm.clearErrors();
      transferForm.clearErrors();
    }
  }, [modalInfo?.action, open, reauthForm, transferForm]);

  if (!modalInfo) {
    return null;
  }

  const spinning =
    (isReauthorize && reauthMutation.isPending) ||
    (!isReauthorize && transferMutation.isPending);

  const decimalPrecision = modalInfo.decimalPrecision ?? 0;

  // ── Reauthorize 提交 ──
  const onReauthorizeValid = (values: ReauthorizeFormValues) => {
    reauthMutation.mutate(
      {
        liquidityPoolId: modalInfo.liquidityPoolId,
        deductibleAmount: values.deductibleAmount,
      },
      {
        onSuccess: () => {
          toast.success(t('submitSuccess'));
          reauthForm.reset({ deductibleAmount: '' });
          onClose();
        },
      },
    );
  };

  // ── TransferOut 提交（keystorePassword AES 加密）──
  const onTransferValid = (values: TransferOutFormValues) => {
    transferMutation.mutate(
      {
        liquidityPoolId: modalInfo.liquidityPoolId,
        amount: values.amount,
        receiverWalletAddress: values.receiverWalletAddress,
        keystorePassword: getEncryptionData(values.keystorePassword),
      },
      {
        onSuccess: () => {
          toast.success(t('submitSuccess'));
          transferForm.reset({
            receiverWalletAddress: '',
            amount: '',
            keystorePassword: '',
          });
          onClose();
        },
      },
    );
  };

  // 提交中禁止关闭（对齐 mmf/statements/node-delete Modal 模式）。
  const handleOpenChange = (next: boolean) => {
    if (spinning) return;
    if (!next) {
      reauthForm.reset({ deductibleAmount: '' });
      transferForm.reset({
        receiverWalletAddress: '',
        amount: '',
        keystorePassword: '',
      });
      onClose();
    }
  };

  const handleCancel = () => {
    if (spinning) return;
    reauthForm.reset({ deductibleAmount: '' });
    transferForm.reset({
      receiverWalletAddress: '',
      amount: '',
      keystorePassword: '',
    });
    onClose();
  };

  // 标题：Reauthorize → cross_chain_0072，TransferOut → cross_chain_0073。
  // 源码用 router 命名空间的 t('Router_0014_2_5'/'Router_0014_2_6')
  // （en-US 值为 "Reauthorize"/"Transfer out"）；admin-platform 无 router.json，
  // 改用 cross-chain.json 内语义/文案完全一致的 cross_chain_0072/0073
  // （en-US/zh-CN 值同为 Reauthorize/Transfer out），与同 Modal 内其余
  // cross_chain_xxxx 标题 key 命名风格统一。
  const titleKey =
    modalInfo.action === 'Reauthorize' ? 'cross_chain_0072' : 'cross_chain_0073';

  // 余额提示文案：源码 extra = cross_chain_0047 + ': ' + balance + ' ' + symbol。
  const balanceHint = `${t('cross_chain_0047')}: ${modalInfo.balance ?? ''} ${
    modalInfo.symbol ?? ''
  }`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[44rem] min-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>

        <div className={spinning ? 'pointer-events-none opacity-60' : ''}>
          {isReauthorize ? (
            <form
              onSubmit={reauthForm.handleSubmit(onReauthorizeValid)}
              noValidate
              className="space-y-4"
            >
              {/* 只读回填：tokenName / blockchain / liquidityPoolWalletAddress（带 balance extra）*/}
              <ReadonlyField
                label={t('cross_chain_0044')}
                value={modalInfo.tokenName ?? ''}
              />
              <ReadonlyField
                label={t('cross_chain_0000')}
                value={modalInfo.blockchain ?? ''}
              />
              <ReadonlyField
                label={t('cross_chain_0045')}
                value={modalInfo.liquidityPoolWalletAddress ?? ''}
                hint={balanceHint}
              />

              {/* deductibleAmount（cross_chain_0050）—— 小数位 validator */}
              <div className="space-y-1.5">
                <Label htmlFor="lp-deductibleAmount">
                  {t('cross_chain_0050')}
                </Label>
                <div className="flex">
                  <Input
                    id="lp-deductibleAmount"
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    className="rounded-r-none"
                    aria-invalid={!!reauthForm.formState.errors.deductibleAmount}
                    {...reauthForm.register('deductibleAmount', {
                      validate: (value) =>
                        validateDecimal(
                          value ?? '',
                          decimalPrecision,
                          {
                            required: t('fieldRequired', {
                              field: t('cross_chain_0050'),
                            }),
                            tooManyDecimals: t('cross_chain_0028', {
                              decimalPrecision,
                            }),
                          },
                        ),
                    })}
                  />
                  <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {modalInfo.symbol}
                  </span>
                </div>
                {reauthForm.formState.errors.deductibleAmount ? (
                  <p className="text-xs text-red-600">
                    {reauthForm.formState.errors.deductibleAmount.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={spinning}
                >
                  {t('action.cancel')}
                </Button>
                <Button type="submit" disabled={spinning}>
                  {t('action.submit')}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              onSubmit={transferForm.handleSubmit(onTransferValid)}
              noValidate
              className="space-y-4"
            >
              {/* 只读回填 */}
              <ReadonlyField
                label={t('cross_chain_0044')}
                value={modalInfo.tokenName ?? ''}
              />
              <ReadonlyField
                label={t('cross_chain_0000')}
                value={modalInfo.blockchain ?? ''}
              />
              <ReadonlyField
                label={t('cross_chain_0045')}
                value={modalInfo.liquidityPoolWalletAddress ?? ''}
                hint={balanceHint}
              />

              {/* receiverWalletAddress（cross_chain_0074）—— isHexPrefixed 校验 */}
              <div className="space-y-1.5">
                <Label htmlFor="lp-receiverWalletAddress">
                  {t('cross_chain_0074')}
                </Label>
                <Input
                  id="lp-receiverWalletAddress"
                  autoComplete="off"
                  aria-invalid={
                    !!transferForm.formState.errors.receiverWalletAddress
                  }
                  {...transferForm.register('receiverWalletAddress', {
                    validate: (value) => {
                      const v = value ?? '';
                      if (!v) {
                        return t('fieldRequired', {
                          field: t('cross_chain_0074'),
                        });
                      }
                      if (!isHexPrefixed(v)) {
                        return t('fieldInvalid', {
                          field: t('cross_chain_0074'),
                        });
                      }
                      return true;
                    },
                  })}
                />
                {transferForm.formState.errors.receiverWalletAddress ? (
                  <p className="text-xs text-red-600">
                    {transferForm.formState.errors.receiverWalletAddress.message}
                  </p>
                ) : null}
              </div>

              {/* amount（cross_chain_0075）—— 小数位 validator + max=balance */}
              <div className="space-y-1.5">
                <Label htmlFor="lp-amount">{t('cross_chain_0075')}</Label>
                <div className="flex">
                  <Input
                    id="lp-amount"
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    className="rounded-r-none"
                    max={modalInfo.balance}
                    aria-invalid={!!transferForm.formState.errors.amount}
                    {...transferForm.register('amount', {
                      validate: (value) =>
                        validateDecimal(value ?? '', decimalPrecision, {
                          required: t('fieldRequired', {
                            field: t('cross_chain_0075'),
                          }),
                          tooManyDecimals: t('cross_chain_0028', {
                            decimalPrecision,
                          }),
                        }),
                    })}
                  />
                  <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {modalInfo.symbol}
                  </span>
                </div>
                {transferForm.formState.errors.amount ? (
                  <p className="text-xs text-red-600">
                    {transferForm.formState.errors.amount.message}
                  </p>
                ) : null}
              </div>

              {/* keystorePassword（cross_chain_0053）—— type=password，AES 加密后提交 */}
              <div className="space-y-1.5">
                <Label htmlFor="lp-keystorePassword">
                  {t('cross_chain_0053')}
                </Label>
                <Input
                  id="lp-keystorePassword"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={
                    !!transferForm.formState.errors.keystorePassword
                  }
                  {...transferForm.register('keystorePassword', {
                    required: t('fieldRequired', {
                      field: t('cross_chain_0053'),
                    }),
                  })}
                />
                {transferForm.formState.errors.keystorePassword ? (
                  <p className="text-xs text-red-600">
                    {transferForm.formState.errors.keystorePassword.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={spinning}
                >
                  {t('action.cancel')}
                </Button>
                <Button type="submit" disabled={spinning}>
                  {t('action.submit')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 只读回填字段（tokenName / blockchain / liquidityPoolWalletAddress）。
 *
 * 对齐源码 disabled Input + label + optional extra（balance 提示文案）。
 * 拆为子组件避免两个 form 分支内重复三段相同的只读字段 JSX。
 */
function ReadonlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} readOnly disabled className="bg-muted/50" />
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
