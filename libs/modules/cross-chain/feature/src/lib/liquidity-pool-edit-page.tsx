'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  useEditLiquidityPoolMutation,
  useLiquidityPoolDetailsQuery,
  useLiquidityPoolEmailListQuery,
  useLiquidityPoolTokenListQuery,
  useSaveLiquidityPoolMutation,
  type LiquidityPoolEditDetail,
  type LiquidityPoolEditForm,
} from '@myorg/modules/cross-chain/data-access';
import { getEncryptionData } from '@myorg/modules/cross-chain/util';
import { useGenerateWallet } from './use-generate-wallet';

/**
 * isHexPrefixed —— 迁移自 td-manage src/utils/index.ts。
 *
 * 钱包地址必须以 `0x` 开头（与源码 `/^0x/.test(value)` 一致）。
 * 与 rd-bridge-edit-page / liquidity-pool-action-modal 内联实现保持一致。
 */
function isHexPrefixed(value: string): boolean {
  return /^0x/.test(value);
}

/**
 * 小数位校验器（deductibleAmount 共用）。
 *
 * 迁移自源码 InputNumber validator：
 * - 空值 → 必填错误；
 * - 含小数点且小数位 > decimalPrecision → cross_chain_0028（ICU 插值 decimalPrecision）；
 * - 否则通过。
 */
function validateDecimal(
  value: string,
  decimalPrecision: number,
  messages: { required: string; tooManyDecimals: string },
): string | true {
  if (!value) return messages.required;
  if (String(value).indexOf('.') > -1) {
    const fraction = String(value).split('.')[1] ?? '';
    if (fraction.length > decimalPrecision) return messages.tooManyDecimals;
  }
  return true;
}

/**
 * LiquidityPoolEditPage —— 流动性池「新增 / 编辑」共用页（最复杂页面之一）。
 *
 * 迁移自 td-manage src/pages/cross-chain/liquidity-pool/edit.tsx（531 行）。
 * antd `Form.useForm` → react-hook-form；`Spin` → 按钮 disabled（mutation.isPending）；
 * `modal.confirm`（覆盖警告）→ AlertDialog；生成钱包 `CustomModal + CustomForms` →
 * Dialog + 原生 Input.Password；useSWR（tokenList）→ useLiquidityPoolTokenListQuery。
 * 生成钱包含「校验 → 覆盖确认 → Modal password → AES → wallet/keystore → 回填」
 * 整条时序抽到 {@link useGenerateWallet} hook（避免单文件过大触发 nx lazy 误报）。
 *
 * 结构（两个 Card，对齐源码两个区块）：
 *   1. 钱包配置：tokenId Select（新增态 onChange 设 symbol/decimalPrecision/blockName；
 *      编辑态 disabled）+ liquidityPoolWalletAddress（Input + 生成钱包入口，isHexPrefixed
 *      校验）+ deductibleAmount（InputNumber 小数位 validator）+ keystore（TextArea）+
 *      keystorePassword（Password）。
 *   2. 告警配置：threshold（InputNumber addonAfter=symbol）+ emailRecipients（email
 *      批量校验 ≤20 + Checkbox 拉全员邮箱）。
 *
 * 硬约束（cc-15 summary + 迁移文档第 7 章 / 第 8 章）：
 * - 新增/编辑共用：query.id 区分（列表跳 `/cross-chain/liquidity-pool/edit?id=<id>`）。
 * - tokenId：新增态从 new/tokenList 选，onChange 设 symbol/decimalPrecision/blockName；
 *   默认选中首项；编辑态 disabled（回填 tokenName）。
 * - liquidityPoolWalletAddress：isHexPrefixed 校验 + maxLength=42 + 生成钱包入口。
 * - deductibleAmount：小数位 validator 按 token decimalPrecision（动态）。
 * - keystore：TextArea 必填。
 * - keystorePassword：Password 必填；提交时 AES 加密；编辑态未改则原样传（用 details 原值比对）。
 * - threshold：InputNumber addonAfter=symbol（非必填）。
 * - emailRecipients：逗号分隔 email 批量校验 ≤20；Checkbox 勾选拉 new/emailList 填入。
 * - 生成钱包：校验地址 → 有值弹覆盖确认 → Modal password → AES → wallet/keystore
 *   （chainType 按 blockName 是否 Aptos 决定 aptos/evm）→ 回填 keystore/keystorePassword/
 *   liquidityPoolWalletAddress。
 * - onFinish 按 query.id 分支：编辑态剔除 tokenId（不可改）+ keystorePassword 未改原样传；
 *   新增态 keystorePassword AES 加密 + select（Checkbox）。成功 toast + router.back()。
 */
export function LiquidityPoolEditPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/liquidity-pool/edit?id=<id>（编辑）/ edit（新增，无参）。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const liquidityPoolId = idStr !== '' ? Number(idStr) : undefined;
  const isEdit = liquidityPoolId != null && !Number.isNaN(liquidityPoolId);

  // symbol / decimalPrecision / blockName：tokenId Select onChange 时联动更新
  // （deductibleAmount validator 按 decimalPrecision 动态校验；symbol 作 InputNumber 后缀；
  // blockName 决定生成钱包 chainType）。
  const [symbol, setSymbol] = React.useState('');
  const [decimalPrecision, setDecimalPrecision] = React.useState(0);
  const [blockName, setBlockName] = React.useState('');

  // 编辑态详情原值（用于 keystorePassword 未改判断 —— details.keystorePassword === 输入值则原样传）。
  const [detailPassword, setDetailPassword] = React.useState<string | undefined>(undefined);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<LiquidityPoolEditForm>({
    defaultValues: {},
  });

  // ── tokenList 下拉（new/tokenList，新增态 tokenId Select）──
  const tokenListQuery = useLiquidityPoolTokenListQuery();
  const tokenList = tokenListQuery.data ?? [];

  // ── 全员邮箱（new/emailList，Checkbox 拉取）──
  const emailQuery = useLiquidityPoolEmailListQuery();
  const [checked, setChecked] = React.useState(false);

  // ── 编辑态详情回填（details 接口）──
  const detailResult = useLiquidityPoolDetailsQuery(liquidityPoolId, isEdit);
  const detail = detailResult.data;

  // 详情返回后回填表单 + symbol/decimalPrecision + 原密码（源码 getLiquidityPoolDetails）。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset(mapDetailToForm(detail));
    setSymbol(detail.symbol ?? '');
    setDecimalPrecision(detail.decimalPrecision ?? 0);
    // 缓存原密码（keystorePassword 未改判断基准）。
    setDetailPassword(detail.keystorePassword);
  }, [isEdit, detail, reset]);

  // 新增态：tokenList 就绪后自动选首项并联动 symbol/decimalPrecision/blockName
  // （源码 useEffect：TDListData[0] 设默认）。
  React.useEffect(() => {
    if (isEdit) return;
    if (tokenList.length === 0) return;
    const first = tokenList[0];
    setSymbol(first.symbol);
    setDecimalPrecision(first.decimalPrecision);
    setBlockName(first.blockName);
    setValue('tokenId', first.tokenId, { shouldValidate: false });
  }, [isEdit, tokenList, setValue]);

  // ── 生成钱包逻辑（抽到 useGenerateWallet hook）──
  // useForm 返回的 trigger/getValues/setValue 在 hook 内部按需调用。
  const wallet = useGenerateWallet<LiquidityPoolEditForm>({
    form: { trigger, getValues, setValue },
    blockName,
  });

  const onSaveSuccess = React.useCallback(() => {
    toast.success(t('submitSuccess'));
    router.back();
  }, [t, router]);

  const saveMutation = useSaveLiquidityPoolMutation();
  const editMutation = useEditLiquidityPoolMutation();
  const isPending = saveMutation.isPending || editMutation.isPending;

  // onFinish（源码 onFinish，按 query.id 分支 save/edit）。
  const onSubmit = React.useCallback(
    (values: LiquidityPoolEditForm) => {
      if (isEdit) {
        // 编辑态：剔除 tokenId（不可改）；keystorePassword 未改原样传，否则 AES 加密。
        const keystorePasswordRaw = values.keystorePassword ?? '';
        const keystorePassword =
          detailPassword === keystorePasswordRaw
            ? keystorePasswordRaw
            : getEncryptionData(keystorePasswordRaw);
        editMutation.mutate(
          {
            liquidityPoolId: liquidityPoolId as number,
            liquidityPoolWalletAddress: values.liquidityPoolWalletAddress ?? '',
            deductibleAmount: values.deductibleAmount ?? '',
            keystore: values.keystore ?? '',
            keystorePassword,
            threshold: values.threshold,
            emailRecipients: values.emailRecipients,
            select: checked,
          },
          { onSuccess: onSaveSuccess },
        );
      } else {
        // 新增态：全字段透传，keystorePassword AES 加密。
        saveMutation.mutate(
          {
            tokenId: values.tokenId as number,
            liquidityPoolWalletAddress: values.liquidityPoolWalletAddress ?? '',
            deductibleAmount: values.deductibleAmount ?? '',
            keystore: values.keystore ?? '',
            keystorePassword: getEncryptionData(values.keystorePassword ?? ''),
            threshold: values.threshold,
            emailRecipients: values.emailRecipients,
            select: checked,
          },
          { onSuccess: onSaveSuccess },
        );
      }
    },
    [isEdit, liquidityPoolId, detailPassword, checked, editMutation, saveMutation, onSaveSuccess],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Card 1：Liquidity Pool Wallet Configuration ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="mb-4 border-0 border-b border-solid border-slate-200 pb-2">
          {t('cross_chain_0049')}
        </h4>
        <div className="flex flex-wrap justify-between gap-4">
          {/* tokenId（新增态 Select onChange 联动；编辑态 disabled Input 回填 tokenName）*/}
          <Controller
            control={control}
            name="tokenId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[31%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('cross_chain_0044')}
                </Label>
                {isEdit ? (
                  // 编辑态：disabled Input 回填 tokenName（详情无 tokenName 字段时回落 '')。
                  <Input
                    value={detail?.tokenName ?? ''}
                    readOnly
                    disabled
                    aria-invalid={!!errors.tokenId}
                  />
                ) : (
                  <Select
                    value={field.value != null ? String(field.value) : undefined}
                    onValueChange={(v) => {
                      const id = Number(v);
                      field.onChange(id);
                      // 源码 onChange：取 option.item 设 symbol/decimalPrecision/blockName。
                      const matched = tokenList.find((el) => el.tokenId === id);
                      if (matched) {
                        setSymbol(matched.symbol);
                        setDecimalPrecision(matched.decimalPrecision);
                        setBlockName(matched.blockName);
                      }
                    }}
                  >
                    <SelectTrigger aria-invalid={!!errors.tokenId}>
                      <SelectValue placeholder={t('cross_chain_0044')} />
                    </SelectTrigger>
                    <SelectContent>
                      {tokenList.map((el) => (
                        <SelectItem key={el.tokenId} value={String(el.tokenId)}>
                          {el.tokenName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.tokenId ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('fieldRequired', { field: t('cross_chain_0044') })}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* liquidityPoolWalletAddress（Input + 生成钱包入口，isHexPrefixed 校验）*/}
          <Controller
            control={control}
            name="liquidityPoolWalletAddress"
            rules={{
              validate: (value) => {
                const v = value ?? '';
                if (!v) {
                  return t('fieldRequired', { field: t('cross_chain_0045') });
                }
                if (!isHexPrefixed(v)) {
                  return t('fieldInvalid', { field: t('cross_chain_0045') });
                }
                return true;
              },
            }}
            render={({ field }) => (
              <div className="w-[31%] min-w-[200px]">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="block text-sm font-medium">
                    {t('cross_chain_0045')}
                  </Label>
                  {/* 生成钱包入口（源码 PUB_Generate_Wallet → cross_chain_00139）*/}
                  <button
                    type="button"
                    onClick={() => void wallet.handleGenerateWallet()}
                    className="cursor-pointer text-sm font-extrabold text-primary"
                  >
                    {t('cross_chain_00139')}
                  </button>
                </div>
                <Input
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  maxLength={42}
                  placeholder={`${t('cross_chain_0027')}${t('cross_chain_0028')}`}
                  aria-invalid={!!errors.liquidityPoolWalletAddress}
                />
                {errors.liquidityPoolWalletAddress ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.liquidityPoolWalletAddress.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* deductibleAmount（InputNumber 小数位 validator + symbol 后缀 + Tooltip）*/}
          <div className="w-[31%] min-w-[200px]">
            <div className="mb-1.5 flex items-center gap-2">
              <Label className="block text-sm font-medium">
                {t('cross_chain_0050')}
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-primary"
                      aria-label={t('cross_chain_0051')}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        className="h-4 w-4 fill-current"
                      >
                        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 7.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('cross_chain_0051')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Controller
              control={control}
              name="deductibleAmount"
              rules={{
                required: t('fieldRequired', { field: t('cross_chain_0050') }),
                validate: (value) =>
                  validateDecimal(value ?? '', decimalPrecision, {
                    required: t('fieldRequired', { field: t('cross_chain_0050') }),
                    tooManyDecimals: t('cross_chain_0028', { decimalPrecision }),
                  }),
              }}
              render={({ field }) => (
                <>
                  <div className="flex">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="rounded-r-none"
                      aria-invalid={!!errors.deductibleAmount}
                    />
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                      {symbol}
                    </span>
                  </div>
                  {errors.deductibleAmount ? (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {String(errors.deductibleAmount.message ?? '')}
                    </p>
                  ) : null}
                </>
              )}
            />
          </div>
        </div>

        {/* keystore（TextArea 必填）*/}
        <Controller
          control={control}
          name="keystore"
          rules={{ required: t('fieldRequired', { field: t('cross_chain_0052') }) }}
          render={({ field }) => (
            <div className="mt-4 w-[65.5%] min-w-[300px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0052')}
              </Label>
              <textarea
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-invalid={!!errors.keystore}
              />
              {errors.keystore ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.keystore.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* keystorePassword（Password 必填）*/}
        <Controller
          control={control}
          name="keystorePassword"
          rules={{ required: t('fieldRequired', { field: t('cross_chain_0053') }) }}
          render={({ field }) => (
            <div className="mt-4 w-[31%] min-w-[200px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0053')}
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                aria-invalid={!!errors.keystorePassword}
              />
              {errors.keystorePassword ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.keystorePassword.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* 提示横幅（源码 indigo 提示框 cross_chain_00139/00140）*/}
        <div className="mt-4 w-full max-h-52 rounded-md border border-solid border-indigo-300 bg-[#CAC9FF] p-4 pr-0">
          <div className="-ml-2 mb-2 flex items-center text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              className="mr-2 h-5 w-5 fill-current"
            >
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-base">{t('cross_chain_00139')}</span>
          </div>
          <div>{t('cross_chain_00140')}</div>
        </div>
      </section>

      {/* ── Card 2：Alert Configurations ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="mb-4 border-0 border-b border-solid border-slate-200 pb-2">
          {t('cross_chain_0054')}
        </h4>

        {/* threshold（InputNumber addonAfter=symbol，非必填）*/}
        <Controller
          control={control}
          name="threshold"
          render={({ field }) => (
            <div className="w-[31%] min-w-[200px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0055')}
              </Label>
              <div className="flex items-stretch">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  className="rounded-r-none"
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  {symbol}
                </span>
              </div>
            </div>
          )}
        />

        {/* threshold 说明文案（cross_chain_0056）*/}
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          {t('cross_chain_0056')}
        </p>

        {/* emailRecipients（email 批量校验 ≤20）*/}
        <Controller
          control={control}
          name="emailRecipients"
          rules={{
            validate: (value) => {
              if (!value) return true;
              const reg =
                /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
              const emails = value.split(',');
              if (emails.length > 20) return t('cross_chain_0099');
              const allValid = emails.every((el: string) => reg.test(el));
              return allValid || t('cross_chain_0098');
            },
          }}
          render={({ field }) => (
            <div className="w-[65.5%] min-w-[300px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0016')}
              </Label>
              <textarea
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t('cross_chain_00130')}
                aria-invalid={!!errors.emailRecipients}
              />
              {errors.emailRecipients ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.emailRecipients.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* Checkbox：拉全员邮箱（new/emailList）*/}
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                const next = v === true;
                setChecked(next);
                if (next) {
                  // 源码：勾选时调 getLiquidityPoolEmailList → setFieldValue join(',')。
                  emailQuery.refetch().then((res) => {
                    const list = res.data ?? [];
                    setValue('emailRecipients', list.join(','), {
                      shouldValidate: true,
                    });
                  });
                } else {
                  setValue('emailRecipients', '', { shouldValidate: true });
                }
              }}
            />
            <span>{t('cross_chain_0057')}</span>
          </label>
        </div>
      </section>

      {/* ── 底部操作 ── */}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t('action.submit')}
        </Button>
      </div>

      {/* ── 生成钱包 Modal（password → AES → wallet/keystore → 回填）── */}
      <Dialog open={wallet.isModalOpen} onOpenChange={(open) => { if (!open) wallet.closeModal(); }}>
        <DialogContent className="max-w-[30rem] min-w-[320px]">
          <DialogHeader>
            <DialogTitle>{t('cross_chain_00139')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('cross_chain_00136')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void wallet.handleConfirmGenerate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="lp-gen-password">{t('cross_chain_00137')}</Label>
              <Input
                id="lp-gen-password"
                type="password"
                maxLength={50}
                autoComplete="new-password"
                value={wallet.password}
                onChange={(e) => wallet.setPassword(e.target.value)}
                required
              />
              <div className="flex items-center text-sm text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  className="mr-2 h-5 w-5 fill-current"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t('cross_chain_00138')}</span>
              </div>
            </div>
            <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={wallet.closeModal}
                disabled={wallet.isPending}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" disabled={wallet.isPending || !wallet.password}>
                {t('action.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 覆盖确认 AlertDialog（已有 walletAddress/keystore 时弹）── */}
      <AlertDialog open={wallet.confirmOpen} onOpenChange={(open) => { if (!open) wallet.closeConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cross_chain_00134')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div>
                <div>{t('cross_chain_00135')}</div>
                <div>{t('cross_chain_00143')}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end">
            <AlertDialogAction onClick={wallet.confirmOverwrite}>
              {t('action.submit')}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

/**
 * 详情 → 表单值映射（编辑态回填）。
 *
 * 完整搬运源码 getLiquidityPoolDetails 的 setFieldsValue 字段集（6 个）。
 * symbol / decimalPrecision / keystorePassword 在主组件 useEffect 单独处理
 * （symbol/decimalPrecision 联动后缀与校验；keystorePassword 缓存原值用于未改判断）。
 */
function mapDetailToForm(d: LiquidityPoolEditDetail): LiquidityPoolEditForm {
  return {
    tokenId: undefined,
    liquidityPoolWalletAddress: d.liquidityPoolWalletAddress,
    deductibleAmount: d.deductibleAmount,
    keystore: d.keystore,
    keystorePassword: d.keystorePassword,
    threshold: d.threshold,
    emailRecipients: d.emailRecipients,
  };
}
