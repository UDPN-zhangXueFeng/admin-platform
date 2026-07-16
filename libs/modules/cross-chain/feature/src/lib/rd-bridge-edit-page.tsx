'use client';

import * as React from 'react';
import {
  Controller,
  useForm,
  type Control,
  type FieldError,
} from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  useEditRdBridgeMutation,
  useRdBridgeAllUserEmailListQuery,
  useRdBridgeBlockchainListQuery,
  useRdBridgeDetailQuery,
  useSaveRdBridgeMutation,
  type RdBridgeDetail,
  type RdBridgeEditForm,
  type RdBridgeEditReq,
  type RdBridgeSaveReq,
} from '@myorg/modules/cross-chain/data-access';

/**
 * isHexPrefixed —— 迁移自 td-manage src/utils/index.ts。
 *
 * 合约地址 / 钱包地址必须以 `0x` 开头（与源码 `/^0x/.test(value)` 一致）。
 * 与 liquidity-pool-action-modal 内联实现保持一致（util 层未导出此工具）。
 */
function isHexPrefixed(value: string): boolean {
  return /^0x/.test(value);
}

/** 地址类字段名（5 个，结构相同，复用 AddressField）。 */
type AddressFieldName =
  | 'endpointContractAddress'
  | 'sendContractAddress'
  | 'receiveContractAddress'
  | 'verifierWalletAddress'
  | 'submitterWalletAddress';

/** 监控值字段名（2 个）。 */
type MonitorFieldName = 'verifierMonitorValue' | 'submitterMonitorValue';

/**
 * RdBridgeEditPage — RD-Bridge 跨链桥配置注册 / 编辑共用页。
 *
 * 迁移自 td-manage src/pages/cross-chain/rd-bridge/edit.tsx（440 行）。
 * antd `Form.useForm` → react-hook-form；`Spin` → 按钮 disabled（mutation.isPending）；
 * 手动 `getBlockChainList`（useEffect + useState）→ useRdBridgeBlockchainListQuery。
 *
 * 结构（三个 Card，对齐源码三个区块）：
 *   1. 链配置：链 Select（编辑态 disabled，新增态默认选首项设 symbol）。
 *   2. Bridge Smart Contracts：endpointId（InputNumber，编辑态 disabled）+ 3 个合约地址
 *      （maxLength=42 + isHexPrefixed 校验）。
 *   3. Bridge Hub：verifier / submitter WalletAddress（hex 校验）+ MonitorValue（InputNumber
 *      带 symbol 后缀）+ notifyEmail（email 批量校验 ≤20 + Checkbox 拉全员邮箱）。
 *
 * 硬约束（cc-11 summary + 迁移文档第 7.16 节 / 第 8 章）：
 * - 新增/编辑共用：query.id 区分（列表跳 `/cross-chain/rd-bridge/edit?id=<id>`）。
 * - 链下拉用 getBlockChainList（{ blockChainId, blockChainName, unit }），与 common/blockchain/list 不同。
 * - 编辑态：链 + endpointId disabled；新增态：自动选首项并设 symbol（unit）。
 * - 3 个合约地址 + 2 个钱包地址：maxLength=42 + isHexPrefixed 校验（源码同款）。
 * - 4 个监控字段：verifier/submitter WalletAddress（必填 hex）/ MonitorValue（InputNumber，
 *   非必填，addonAfter=symbol）。
 * - notifyEmail：逗号分隔 email 批量校验（≤20 + 正则），Checkbox 勾选拉全员邮箱填入。
 * - onFinish 按 query.id 分支：编辑态剔除 endpointId/blockchainId（不可改），新增态全字段透传。
 * - 成功 toast + router.back()。
 */
export function RdBridgeEditPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/rd-bridge/edit?id=<id>（编辑）/ edit（新增，无参）。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const crossChainId = idStr !== '' ? Number(idStr) : undefined;
  const isEdit = crossChainId != null && !Number.isNaN(crossChainId);

  // symbol（unit）：MonitorValue 后缀。新增态默认取链下拉首项 unit；链 onChange 时更新。
  // 编辑态 Select disabled，symbol 仅用于 MonitorValue 展示后缀（详情无 unit 字段，回落 '')。
  const [symbol, setSymbol] = React.useState<string>('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RdBridgeEditForm>({
    defaultValues: {},
  });

  // ── 链下拉（getBlockChainList）──
  const blockchainQuery = useRdBridgeBlockchainListQuery();
  const blockchainList = blockchainQuery.data ?? [];

  // ── 编辑态详情回填（getCrossChainDetail）──
  const detailResult = useRdBridgeDetailQuery(crossChainId, isEdit);
  const detail = detailResult.data;

  // 详情返回后回填表单（源码 getCrossChainDetail → form.setFieldsValue）。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset(mapDetailToForm(detail));
  }, [isEdit, detail, reset]);

  // 新增态：链下拉就绪后自动选首项并设 symbol（源码 getBlockChainList 内
  // `if (!query.id && data.length) { setSymbol(data[0].unit); form.setFieldValue('blockchainId', data[0].blockChainId) }`）。
  React.useEffect(() => {
    if (isEdit) return;
    if (blockchainList.length === 0) return;
    const first = blockchainList[0];
    setSymbol(first.unit ?? '');
    setValue('blockchainId', first.blockChainId, { shouldValidate: false });
  }, [isEdit, blockchainList, setValue]);

  // ── 全员邮箱（getAllUserEmailList）──
  const emailQuery = useRdBridgeAllUserEmailListQuery();
  const [checked, setChecked] = React.useState(false);

  const onSaveSuccess = React.useCallback(() => {
    toast.success(t('submitSuccess'));
    router.back();
  }, [t, router]);

  const saveMutation = useSaveRdBridgeMutation();
  const editMutation = useEditRdBridgeMutation();
  const isPending = saveMutation.isPending || editMutation.isPending;

  const onSubmit = React.useCallback(
    (values: RdBridgeEditForm) => {
      if (isEdit) {
        // 编辑态：剔除 endpointId / blockchainId（不可改），带 crossChainId。
        const dto: RdBridgeEditReq = {
          crossChainId: crossChainId as number,
          endpointContractAddress: values.endpointContractAddress ?? '',
          sendContractAddress: values.sendContractAddress ?? '',
          receiveContractAddress: values.receiveContractAddress ?? '',
          verifierWalletAddress: values.verifierWalletAddress ?? '',
          submitterWalletAddress: values.submitterWalletAddress ?? '',
          verifierMonitorValue: values.verifierMonitorValue,
          submitterMonitorValue: values.submitterMonitorValue,
          notifyEmail: values.notifyEmail,
        };
        editMutation.mutate(dto, { onSuccess: onSaveSuccess });
      } else {
        // 新增态：全字段透传。
        const dto: RdBridgeSaveReq = {
          blockchainId: values.blockchainId as number,
          endpointId: values.endpointId as number,
          endpointContractAddress: values.endpointContractAddress ?? '',
          sendContractAddress: values.sendContractAddress ?? '',
          receiveContractAddress: values.receiveContractAddress ?? '',
          verifierWalletAddress: values.verifierWalletAddress ?? '',
          submitterWalletAddress: values.submitterWalletAddress ?? '',
          verifierMonitorValue: values.verifierMonitorValue,
          submitterMonitorValue: values.submitterMonitorValue,
          notifyEmail: values.notifyEmail,
        };
        saveMutation.mutate(dto, { onSuccess: onSaveSuccess });
      }
    },
    [isEdit, crossChainId, editMutation, saveMutation, onSaveSuccess],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Card 1：链配置 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('cross_chain_0008')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('cross_chain_0009')}
        </p>
        <Controller
          control={control}
          name="blockchainId"
          rules={{ required: true }}
          render={({ field }) => (
            <div className="w-[23%] min-w-[200px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0000')}
              </Label>
              <Select
                value={field.value != null ? String(field.value) : undefined}
                onValueChange={(v) => {
                  const id = Number(v);
                  field.onChange(id);
                  // 源码 onChange 取 options.symbol(unit) 设 symbol。
                  const matched = blockchainList.find(
                    (el) => el.blockChainId === id,
                  );
                  setSymbol(matched?.unit ?? '');
                }}
                disabled={isEdit}
              >
                <SelectTrigger aria-invalid={!!errors.blockchainId}>
                  <SelectValue placeholder={t('cross_chain_0008')} />
                </SelectTrigger>
                <SelectContent>
                  {blockchainList.map((el) => (
                    <SelectItem key={el.blockChainId} value={String(el.blockChainId)}>
                      {el.blockChainName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.blockchainId ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {t('fieldRequired', { field: t('cross_chain_0000') })}
                </p>
              ) : null}
            </div>
          )}
        />
      </section>

      {/* ── Card 2：Bridge Smart Contracts Configuration ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="mb-4 border-0 border-b border-solid border-slate-200 pb-2">
          {t('cross_chain_0010')}
        </h4>
        <div className="flex flex-wrap justify-between gap-4">
          {/* endpointId（InputNumber；编辑态 disabled）*/}
          <Controller
            control={control}
            name="endpointId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[23%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('cross_chain_0001')}
                </Label>
                <Input
                  type="number"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? undefined : Number(v));
                  }}
                  disabled={isEdit}
                  placeholder={t('cross_chain_0026')}
                />
                {errors.endpointId ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('fieldRequired', { field: t('cross_chain_0001') })}
                  </p>
                ) : null}
              </div>
            )}
          />
          {/* endpoint 合约地址 */}
          <AddressField
            control={control}
            name="endpointContractAddress"
            label={t('cross_chain_0037')}
            placeholder={`${t('cross_chain_0027')}${t('cross_chain_0028')}`}
            error={errors.endpointContractAddress}
            t={t}
          />
          {/* send 合约地址 */}
          <AddressField
            control={control}
            name="sendContractAddress"
            label={t('cross_chain_0035')}
            placeholder={`${t('cross_chain_0027')} ${t('cross_chain_0028')}`}
            error={errors.sendContractAddress}
            t={t}
          />
          {/* receive 合约地址 */}
          <AddressField
            control={control}
            name="receiveContractAddress"
            label={t('cross_chain_0036')}
            placeholder={`${t('cross_chain_0027')}${t('cross_chain_0028')}`}
            error={errors.receiveContractAddress}
            t={t}
          />
        </div>
      </section>

      {/* ── Card 3：Bridge Hub Configuration ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="mb-4 border-0 border-b border-solid border-slate-200 pb-2">
          {t('cross_chain_0011')}
        </h4>

        <div className="flex w-1/2 min-w-[400px] flex-wrap justify-between gap-4">
          {/* verifier WalletAddress（hex 校验）*/}
          <AddressField
            control={control}
            name="verifierWalletAddress"
            label={t('cross_chain_0012')}
            placeholder={`${t('cross_chain_0027')}${t('cross_chain_0028')}`}
            error={errors.verifierWalletAddress}
            t={t}
            className="w-[47%] min-w-[200px]"
          />
          {/* verifier MonitorValue（InputNumber addonAfter=symbol）*/}
          <MonitorField
            control={control}
            name="verifierMonitorValue"
            label={t('cross_chain_0013')}
            symbol={symbol}
          />
          {/* submitter WalletAddress（hex 校验）*/}
          <AddressField
            control={control}
            name="submitterWalletAddress"
            label={t('cross_chain_0014')}
            placeholder={`${t('cross_chain_0027')}${t('cross_chain_0028')}`}
            error={errors.submitterWalletAddress}
            t={t}
            className="w-[47%] min-w-[200px]"
          />
          {/* submitter MonitorValue（InputNumber addonAfter=symbol）*/}
          <MonitorField
            control={control}
            name="submitterMonitorValue"
            label={t('cross_chain_0015')}
            symbol={symbol}
          />
        </div>

        {/* notifyEmail（email 批量校验 ≤20）*/}
        <Controller
          control={control}
          name="notifyEmail"
          rules={{
            validate: (value) => {
              if (!value) return true;
              // 源码同款正则 + ≤20 校验。
              const reg = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
              const emails = value.split(',');
              if (emails.length > 20) {
                return t('cross_chain_0099');
              }
              const allValid = emails.every((el: string) => reg.test(el));
              return allValid || t('cross_chain_0098');
            },
          }}
          render={({ field }) => (
            <div className="mt-4 w-1/2 min-w-[400px]">
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
              />
              {errors.notifyEmail ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.notifyEmail.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* Checkbox：拉全员邮箱（getAllUserEmailList）*/}
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                const next = v === true;
                setChecked(next);
                if (next) {
                  // 源码：勾选时调 getAllUserEmailList → setFieldValue('notifyEmail', join(','))。
                  // 用既有 query（staleTime 5min）；refetch 拿最新数据后填入。
                  emailQuery.refetch().then((res) => {
                    const list = res.data ?? [];
                    setValue('notifyEmail', list.join(','), {
                      shouldValidate: true,
                    });
                  });
                } else {
                  setValue('notifyEmail', '', { shouldValidate: true });
                }
              }}
            />
            <span>{t('cross_chain_0017')}</span>
          </label>
        </div>

        {/* 提示文案（InfoCircleOutlined + cross_chain_0018）*/}
        <div className="py-4 text-primary">
          <span>{t('cross_chain_0018')}</span>
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
    </form>
  );
}

/**
 * 详情 → 表单值映射（编辑态回填）。
 *
 * 完整搬运源码 getCrossChainDetail 的 setFieldsValue 字段集（10 个）。
 */
function mapDetailToForm(d: RdBridgeDetail): RdBridgeEditForm {
  return {
    blockchainId: d.blockchainId,
    endpointId: d.endpointId,
    endpointContractAddress: d.endpointContractAddress,
    sendContractAddress: d.sendContractAddress,
    receiveContractAddress: d.receiveContractAddress,
    verifierWalletAddress: d.verifierWalletAddress,
    verifierMonitorValue: d.verifierMonitorValue,
    submitterWalletAddress: d.submitterWalletAddress,
    submitterMonitorValue: d.submitterMonitorValue,
    notifyEmail: d.notifyEmail,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 子字段组件（避免主组件过大，与源码 Form.Item 结构 1:1）
// ═══════════════════════════════════════════════════════════════════

/**
 * 合约地址 / 钱包地址字段（Input maxLength=42 + isHexPrefixed 校验）。
 *
 * 源码同款 validator：空 → PUB_Pleased.replace('****', label)；非 0x 开头 → PUB_Invalid。
 * 5 个地址字段（3 合约地址 + verifier/submitter WalletAddress）必填。
 * error 由主组件传入（主组件已订阅 formState.errors，传递安全不 stale）。
 */
function AddressField({
  control,
  name,
  label,
  placeholder,
  error,
  t,
  className = 'w-[23%] min-w-[200px]',
}: {
  control: Control<RdBridgeEditForm>;
  name: AddressFieldName;
  label: string;
  placeholder: string;
  error: FieldError | undefined;
  t: ReturnType<typeof useTranslations>;
  className?: string;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: t('fieldRequired', { field: label }),
        validate: (value) => {
          const v = (value ?? '').trim();
          if (!v) return t('fieldRequired', { field: label });
          // 源码 PUB_Invalid.replace('****', label)。
          if (!isHexPrefixed(v)) {
            return t('fieldInvalid', { field: label });
          }
          return true;
        },
      }}
      render={({ field }) => (
        <div className={className}>
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <Input
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            maxLength={42}
            placeholder={placeholder}
            aria-invalid={!!error}
          />
          {error ? (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {String(error.message ?? '')}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}

/**
 * 监控值字段（InputNumber，非必填，addonAfter=symbol）。
 *
 * 源码 verifierMonitorValue / submitterMonitorValue：InputNumber addonAfter={symbol}。
 * 用 type=number Input + 后缀 span 模拟 addonAfter（无 FormNumberField 包装）。
 */
function MonitorField({
  control,
  name,
  label,
  symbol,
}: {
  control: Control<RdBridgeEditForm>;
  name: MonitorFieldName;
  label: string;
  symbol: string;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="w-[47%] min-w-[200px]">
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <div className="flex items-stretch">
            <Input
              type="number"
              value={field.value ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(v === '' ? undefined : v);
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              className="rounded-r-none"
            />
            {symbol ? (
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                {symbol}
              </span>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
