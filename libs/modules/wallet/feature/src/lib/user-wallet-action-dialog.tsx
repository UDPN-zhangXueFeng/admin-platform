'use client';

import * as React from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@myorg/shared/ui';
import {
  useAvailableWalletTypesQuery,
  useChangeWalletTypeMutation,
  useFundsOperateMutation,
  useWalletOperateMutation,
} from '@myorg/modules/wallet/data-access';
import type { AvailableWalletType } from '@myorg/modules/wallet/data-access';
import type { UserWalletAction, UserWalletModalInfo } from './user-wallet-list-page';

/**
 * UserWalletActionDialog — 用户钱包「冻结/解冻资金 / 冻结/解冻钱包 / 改类型」共用动态弹窗。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/index.tsx` 的 CustomModal +
 * onFinish + custmFormItems 动态表单（业务热点 #5）。
 *
 * 5 种操作按 `modalInfo.action` 分支渲染字段 + 调对应 mutation：
 * - `FreezeFunds`：stablecoinCount（金额，>0 且 ≤6 位小数）+ remarks →
 *   `useFundsOperateMutation`，`type=6`。
 * - `UnfreezeFunds`：stablecoinCount + remarks → `useFundsOperateMutation`，`type=7`。
 * - `FreezeWallet`：remarks → `useWalletOperateMutation`，`type=2`。
 * - `UnfreezeWallet`：remarks → `useWalletOperateMutation`，`type=3`。
 * - `ChangeWalletType`：只读 tdName + newRuleId（来自 `useAvailableWalletTypesQuery`，
 *   弹窗打开时按 walletId 加载）+ remarks(reason) → `useChangeWalletTypeMutation`。
 *
 * 提交成功 → `toast.success` + reset + onClose（mutation onSuccess 已 invalidate
 * wallet.all 缓存，列表自动刷新）。
 *
 * > 该组件放在 feature 层而非 ui 层：依赖 react-hook-form + data-access mutation +
 * > sonner，ui 层为纯展示层无这些依赖（与 cross-chain liquidity-pool-action-modal
 * > 保持一致）。
 */
export interface UserWalletActionDialogProps {
  /** 弹窗上下文（action/walletId/...）。null 表示关闭态。 */
  modalInfo: UserWalletModalInfo | null;
  /** 打开 / 关闭控制（受控）。 */
  open: boolean;
  /** 关闭回调（取消 / 提交成功 / 透传 onOpenChange=false 时调用）。 */
  onClose: () => void;
}

/** 资金操作表单（冻结/解冻资金）。 */
interface FundsFormValues {
  stablecoinCount: string;
  remarks: string;
}

/** 钱包操作表单（冻结/解冻钱包，仅 remarks）。 */
interface WalletFormValues {
  remarks: string;
}

/** 改类型表单（newRuleId + reason，tdName 只读回填不入提交体）。 */
interface ChangeTypeFormValues {
  newRuleId: string;
  remarks: string;
}

export function UserWalletActionDialog({
  modalInfo,
  open,
  onClose,
}: UserWalletActionDialogProps): React.JSX.Element | null {
  const t = useTranslations('modules.wallet');
  const fundsMutation = useFundsOperateMutation();
  const walletMutation = useWalletOperateMutation();
  const changeMutation = useChangeWalletTypeMutation();

  const action = modalInfo?.action;
  const isFunds = action === 'FreezeFunds' || action === 'UnfreezeFunds';
  const isWallet =
    action === 'FreezeWallet' || action === 'UnfreezeWallet';
  const isChangeType = action === 'ChangeWalletType';

  // ── 三组 form（按 action 切换，避免字段类型串台）──
  const fundsForm = useForm<FundsFormValues>({
    defaultValues: { stablecoinCount: '', remarks: '' },
  });
  const walletForm = useForm<WalletFormValues>({
    defaultValues: { remarks: '' },
  });
  const changeForm = useForm<ChangeTypeFormValues>({
    defaultValues: { newRuleId: '', remarks: '' },
  });

  // 可用钱包类型（改类型弹窗打开时按 walletId 加载）。
  const availableResult = useAvailableWalletTypesQuery(
    modalInfo?.walletId,
    Boolean(modalInfo?.walletId) && open && isChangeType
  );
  const availableList = availableResult.data ?? [];
  const availableLoading = availableResult.isLoading;

  // 打开 / 切换行时重置表单（对齐源 destroyOnClose + form.resetFields）。
  React.useEffect(() => {
    if (open && modalInfo) {
      fundsForm.reset({ stablecoinCount: '', remarks: '' });
      walletForm.reset({ remarks: '' });
      changeForm.reset({ newRuleId: '', remarks: '' });
    }
  }, [open, modalInfo?.id, modalInfo?.action, fundsForm, walletForm, changeForm, modalInfo]);

  if (!modalInfo) {
    return null;
  }

  const spinning =
    fundsMutation.isPending ||
    walletMutation.isPending ||
    changeMutation.isPending;

  // ── 提交处理 ──
  const onFundsValid = (values: FundsFormValues) => {
    fundsMutation.mutate(
      {
        type: action === 'FreezeFunds' ? 6 : 7,
        stablecoinCount: values.stablecoinCount,
        remarks: values.remarks,
        walletId: modalInfo.walletId,
      },
      {
        onSuccess: () => {
          toast.success(t('userWallet.modal.submitSuccess'));
          fundsForm.reset({ stablecoinCount: '', remarks: '' });
          onClose();
        },
      }
    );
  };

  const onWalletValid = (values: WalletFormValues) => {
    walletMutation.mutate(
      {
        type: action === 'UnfreezeWallet' ? 3 : 2,
        remarks: values.remarks,
        walletId: modalInfo.walletId,
      },
      {
        onSuccess: () => {
          toast.success(t('userWallet.modal.submitSuccess'));
          walletForm.reset({ remarks: '' });
          onClose();
        },
      }
    );
  };

  const onChangeValid = (values: ChangeTypeFormValues) => {
    changeMutation.mutate(
      {
        reason: values.remarks,
        newRuleId: Number(values.newRuleId),
        walletId: modalInfo.walletId,
      },
      {
        onSuccess: () => {
          toast.success(t('userWallet.modal.submitSuccess'));
          changeForm.reset({ newRuleId: '', remarks: '' });
          onClose();
        },
      }
    );
  };

  // 提交中禁止关闭（对齐 liquidity-pool-action-modal 模式）。
  const handleOpenChange = (next: boolean) => {
    if (spinning) return;
    if (!next) onClose();
  };

  const handleCancel = () => {
    if (spinning) return;
    onClose();
  };

  const titleKey = modalTitleKey(action);
  const subTitleKey = modalSubTitleKey(action);
  // 备注 label：冻结类（资金冻结/钱包冻结）用 userWallet.modal.reasonFreeze，其余用 reasonUnfreeze。
  const isFreezeAction = action === 'FreezeFunds' || action === 'FreezeWallet';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[44rem] min-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t(subTitleKey)}</p>
        </DialogHeader>

        <div className={spinning ? 'pointer-events-none opacity-60' : ''}>
          {isFunds ? (
            <FundsFields
              form={fundsForm}
              modalInfo={modalInfo}
              isFreeze={action === 'FreezeFunds'}
              onSubmit={onFundsValid}
              onCancel={handleCancel}
              spinning={spinning}
              isFreezeAction={isFreezeAction}
            />
          ) : null}
          {isWallet ? (
            <WalletFields
              form={walletForm}
              modalInfo={modalInfo}
              onSubmit={onWalletValid}
              onCancel={handleCancel}
              spinning={spinning}
              isFreezeAction={isFreezeAction}
            />
          ) : null}
          {isChangeType ? (
            <ChangeTypeFields
              form={changeForm}
              modalInfo={modalInfo}
              availableList={availableList}
              availableLoading={availableLoading}
              onSubmit={onChangeValid}
              onCancel={handleCancel}
              spinning={spinning}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 弹窗标题 i18n key（按 action 派生，对齐源 modalInfo.title 的 Router_011_*）。 */
function modalTitleKey(action?: UserWalletAction): string {
  switch (action) {
    case 'FreezeWallet':
      return 'userWallet.modal.freezeWalletTitle';
    case 'UnfreezeWallet':
      return 'userWallet.modal.unfreezeWalletTitle';
    case 'FreezeFunds':
      return 'userWallet.modal.freezeFundsTitle';
    case 'UnfreezeFunds':
      return 'userWallet.modal.unfreezeFundsTitle';
    case 'ChangeWalletType':
      return 'userWallet.modal.changeWalletTypeTitle';
    default:
      return 'userWallet.modal.freezeWalletTitle';
  }
}

/** 弹窗副标题 i18n key（按 action 派生，对齐源 modalInfo.subTitle 的 user_wallet_011/013/015/018/067）。 */
function modalSubTitleKey(action?: UserWalletAction): string {
  switch (action) {
    case 'FreezeWallet':
      return 'userWallet.modal.freezeWalletSubTitle';
    case 'UnfreezeWallet':
      return 'userWallet.modal.unfreezeWalletSubTitle';
    case 'FreezeFunds':
      return 'userWallet.modal.freezeFundsSubTitle';
    case 'UnfreezeFunds':
      return 'userWallet.modal.unfreezeFundsSubTitle';
    case 'ChangeWalletType':
      return 'userWallet.modal.changeWalletTypeSubTitle';
    default:
      return 'userWallet.modal.freezeWalletSubTitle';
  }
}

// ── 资金操作字段（冻结/解冻资金）──

interface FundsFieldsProps {
  form: ReturnType<typeof useForm<FundsFormValues>>;
  modalInfo: UserWalletModalInfo;
  isFreeze: boolean;
  onSubmit: (values: FundsFormValues) => void;
  onCancel: () => void;
  spinning: boolean;
  isFreezeAction: boolean;
}

function FundsFields({
  form,
  modalInfo,
  isFreeze,
  onSubmit,
  onCancel,
  spinning,
  isFreezeAction,
}: FundsFieldsProps) {
  const t = useTranslations('modules.wallet');
  const amountLabel = t('userWallet.modal.amount');
  // tips 文案：冻结显示「可用余额：X」，解冻显示「冻结余额：X」。
  const balanceValue = isFreeze ? modalInfo.usableCount : modalInfo.freezeCount;
  const tips = `${t(
    isFreeze
      ? 'userWallet.modal.availableBalance'
      : 'userWallet.modal.frozenBalance'
  )}${balanceValue}`;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* 金额（源 stablecoinCount，>0 且 ≤6 位小数 validator）*/}
      <div className="space-y-1.5">
        <Label htmlFor="uw-funds-amount">{amountLabel}</Label>
        <Input
          id="uw-funds-amount"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          autoComplete="off"
          aria-invalid={!!form.formState.errors.stablecoinCount}
          {...form.register('stablecoinCount', {
            validate: (value) => {
              const v = value ?? '';
              if (!v) {
                return t('userWallet.modal.fieldRequired', {
                  field: amountLabel,
                });
              }
              const num = Number(v);
              if (!Number.isFinite(num) || num <= 0) {
                return t('userWallet.modal.fieldRequired', { field: amountLabel });
              }
              if (!/^[0-9]+(.[0-9]{1,6})?$/.test(v)) {
                return t('userWallet.modal.amountPrecision');
              }
              return true;
            },
          })}
        />
        {form.formState.errors.stablecoinCount ? (
          <p className="text-xs text-red-600">
            {form.formState.errors.stablecoinCount.message}
          </p>
        ) : null}
        {/* tips：余额提示（源 extra = tips）*/}
        <p className="text-xs text-muted-foreground">{tips}</p>
      </div>

      <RemarksField
        register={form.register}
        rules={{
          required: t('userWallet.modal.fieldRequired', {
            field: t(
              isFreezeAction
                ? 'userWallet.modal.reasonFreeze'
                : 'userWallet.modal.reasonUnfreeze'
            ),
          }),
          maxLength: {
            value: 200,
            message: t('userWallet.modal.remarksMaxLength'),
          },
        }}
        error={form.formState.errors.remarks?.message}
        label={t(
          isFreezeAction
            ? 'userWallet.modal.reasonFreeze'
            : 'userWallet.modal.reasonUnfreeze'
        )}
        tipss={modalTipss(modalInfo.action, t)}
      />

      <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
        <Button type="button" variant="outline" onClick={onCancel} disabled={spinning}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={spinning}>
          {t('common.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── 钱包操作字段（冻结/解冻钱包，仅 remarks）──

interface WalletFieldsProps {
  form: ReturnType<typeof useForm<WalletFormValues>>;
  modalInfo: UserWalletModalInfo;
  onSubmit: (values: WalletFormValues) => void;
  onCancel: () => void;
  spinning: boolean;
  isFreezeAction: boolean;
}

function WalletFields({
  form,
  modalInfo,
  onSubmit,
  onCancel,
  spinning,
  isFreezeAction,
}: WalletFieldsProps) {
  const t = useTranslations('modules.wallet');
  const reasonLabel = t(
    isFreezeAction
      ? 'userWallet.modal.reasonFreeze'
      : 'userWallet.modal.reasonUnfreeze'
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <RemarksField
        register={form.register}
        rules={{
          required: t('userWallet.modal.fieldRequired', { field: reasonLabel }),
          maxLength: {
            value: 200,
            message: t('userWallet.modal.remarksMaxLength'),
          },
        }}
        error={form.formState.errors.remarks?.message}
        label={reasonLabel}
        tipss={modalTipss(modalInfo.action, t)}
      />

      <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
        <Button type="button" variant="outline" onClick={onCancel} disabled={spinning}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={spinning}>
          {t('common.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── 改类型字段（只读 tdName + newRuleId 下拉 + reason）──

interface ChangeTypeFieldsProps {
  form: ReturnType<typeof useForm<ChangeTypeFormValues>>;
  modalInfo: UserWalletModalInfo;
  availableList: AvailableWalletType[];
  availableLoading: boolean;
  onSubmit: (values: ChangeTypeFormValues) => void;
  onCancel: () => void;
  spinning: boolean;
}

function ChangeTypeFields({
  form,
  modalInfo,
  availableList,
  availableLoading,
  onSubmit,
  onCancel,
  spinning,
}: ChangeTypeFieldsProps) {
  const t = useTranslations('modules.wallet');

  // 数据未到时 loading 态（运行时坑：弹窗内 Select 数据未到时 loading）。
  if (availableLoading && availableList.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('userWallet.modal.loadingAvailableTypes')}
        </p>
        <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={spinning}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled>
            {t('common.submit')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* 只读回填：代币名称（源 tdName）*/}
      <div className="space-y-1.5">
        <Label htmlFor="uw-change-tdName">
          {t('userWallet.modal.tokenName')}
        </Label>
        <Input
          id="uw-change-tdName"
          value={modalInfo.tdName}
          readOnly
          disabled
          className="bg-muted/50"
        />
      </div>

      {/* 新钱包类型（源 newRuleId，来自 getAvailableWalletTypeList）*/}
      <div className="space-y-1.5">
        <Label htmlFor="uw-change-newRuleId">
          {t('userWallet.modal.walletType')}
        </Label>
        <ControllerSelect
          value={form.watch('newRuleId')}
          onChange={(value) => form.setValue('newRuleId', value)}
          options={availableList
            .filter((item) => item.ruleId != null)
            .map((item) => ({
              value: String(item.ruleId),
              label: item.walletType ?? String(item.ruleId),
            }))}
          placeholder={t('userWallet.modal.selectWalletType')}
          ariaInvalid={!!form.formState.errors.newRuleId}
        />
        {form.formState.errors.newRuleId ? (
          <p className="text-xs text-red-600">
            {form.formState.errors.newRuleId.message}
          </p>
        ) : null}
      </div>

      <RemarksField
        register={form.register}
        rules={{
          required: t('userWallet.modal.fieldRequired', {
            field: t('userWallet.modal.reasonChange'),
          }),
          maxLength: {
            value: 200,
            message: t('userWallet.modal.remarksMaxLength'),
          },
        }}
        error={form.formState.errors.remarks?.message}
        label={t('userWallet.modal.reasonChange')}
        tipss={undefined}
      />

      <DialogFooter className="mt-2 flex-row justify-center gap-4 sm:justify-center">
        <Button type="button" variant="outline" onClick={onCancel} disabled={spinning}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={spinning}>
          {t('common.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── 共用：备注字段（textarea + 警示 tipss）──

interface RemarksFieldProps {
  /** react-hook-form register 函数（已绑定具体 form 实例）。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  /** 字段名（默认 'remarks'，三个 form 均为 remarks，保留以备扩展）。 */
  name?: 'remarks';
  /** RHF 校验规则（required / maxLength 等）。 */
  rules?: Parameters<UseFormRegister<{ remarks: string }>>[1];
  error?: string;
  label: string;
  /** 源 tipss：警示提示文案（冻结/解冻操作的后果说明）。 */
  tipss?: string;
}

function RemarksField({
  register,
  name = 'remarks',
  rules,
  error,
  label,
  tipss,
}: RemarksFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="uw-remarks">{label}</Label>
      <Textarea
        id="uw-remarks"
        rows={5}
        maxLength={200}
        aria-invalid={!!error}
        {...register(name, rules)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {tipss ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <span aria-hidden>⚠</span>
          <span>{tipss}</span>
        </p>
      ) : null}
    </div>
  );
}

/** 控制式 Select（Radix Select 不接原生 onChange，封装一层）。 */
function ControllerSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  ariaInvalid: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-invalid={ariaInvalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 派生 tipss 文案（源 modalInfo.tipss，按 action 固定文案）。
 *
 * 忠实搬运源 setModalInfo 内各 action 的 tipss 字段（冻结/解冻操作的后果提示）。
 */
function modalTipss(
  action: UserWalletAction,
  t: (key: string) => string
): string | undefined {
  switch (action) {
    case 'FreezeWallet':
      return t('userWallet.modal.freezeWalletTip');
    case 'UnfreezeWallet':
      return t('userWallet.modal.unfreezeWalletTip');
    case 'FreezeFunds':
      return t('userWallet.modal.freezeFundsTip');
    case 'UnfreezeFunds':
      return t('userWallet.modal.unfreezeFundsTip');
    default:
      return undefined;
  }
}
