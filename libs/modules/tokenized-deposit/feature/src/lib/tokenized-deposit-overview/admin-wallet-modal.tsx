/**
 * AdminWalletModal — 管理员钱包 Modal（4 态：Update / Approval / Details / History）。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的管理钱包 CustomModal
 * （源 2256-2472）+ onFinishAdminWallet（源 1092-1117）+ adminDetialCustomTable /
 * adminHistoryCustomTable（源 959-1091）。
 *
 * ## 4 态（源 adminWalletModalInfo.type）
 *
 * - **Update**：钱包更新表单（walletType/walletAddress disabled + 生成钱包入口 +
 *   chainAccountAddress/privateKey/password）。提交 useUpdateAdminWalletMutation
 *   （password AES 加密 via getEncryptionData）。
 * - **Approval**：钱包审批表单（walletType/originalWalletAddress/walletAddress disabled
 *   + status + state Radio[Approve=20/Reject=15] + remark）。提交
 *   useApprovalAdminWalletMutation（recordId/remark/state）。
 * - **Details**：钱包详情（walletType/walletAddress 静态展示 + 详情表
 *   useWalletDetailListQuery）。
 * - **History**：钱包历史表（useWalletHistoryListQuery）。
 *
 * ## 生成钱包入口（Update 态，源 2339-2422）
 *
 * storageType==='key_keystore' 时显示 keystore 路径（chainAccountAddress 可编辑 +
 * privateKey + password + "Generate Wallet" 入口）；否则 rigsec 路径
 * （chainAccountAddress disabled + "Generate Wallet" 入口）。点击入口回调 props
 * onGenerateWallet（Shell 打开 GenerateWalletModal/RigsecWalletModal，生成后回填）。
 *
 * ## AES password（与 td-11 设计一致）
 *
 * - generateWalletKeystore：API 内部 AES 加密（password 传明文）。
 * - updateAdminWallet：调用方（本组件）在提交前 AES 加密 password（getEncryptionData）。
 *
 * ## 与源差异
 *
 * - antd CustomModal + Form → shared/ui Dialog + react-hook-form。
 * - antd Radio.Group → shared/ui RadioGroup（Approve='20' / Reject='15'）。
 * - antd Table → shared/ui DataTable（详情/历史表）。
 * - adminWalletModalInfo 源在 index 内联组装，这里 props.ctx + props.row 透传。
 * - getEncryptionData（td-4 util）用于 updateAdminWallet 提交前 AES 加密 password。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/tokenized-deposit/util';
import { getEncryptionData } from '@myorg/modules/tokenized-deposit/util';
import {
  useApprovalAdminWalletMutation,
  useUpdateAdminWalletMutation,
  useWalletDetailListQuery,
  useWalletHistoryListQuery,
  type WalletDetailItem,
} from '@myorg/modules/tokenized-deposit/data-access';

/** Modal 态（源 adminWalletModalInfo.type）。 */
export type AdminWalletModalCtx = 'Update' | 'Approval' | 'Details' | 'History';

/** 调用方组装的上下文信息（源 adminWalletModalInfo）。 */
export interface AdminWalletCtx {
  /** Modal 态。 */
  type: AdminWalletModalCtx;
  /** Modal 标题。 */
  title: string;
  /** 钱包记录 ID（Update=accountId / Approval=recordId）。 */
  id: number | string;
  /** 钱包类型展示文案（源 t(`admin_wallet_type_${type}`)）。 */
  walletType: string;
  /** 钱包类型编码（详情/历史表查询参数 accountType）。 */
  accountType?: number;
  /** 稳定币 ID（详情/历史表查询参数 stablecoinId）。 */
  stablecoinId?: number | string;
  /** 钱包地址（Update/Approval/Details 展示）。 */
  walletAddress?: string;
  /** 原钱包地址（Approval 展示）。 */
  originalWalletAddress?: string;
  /** 状态文案（Approval 展示）。 */
  status?: string;
  /** storageType（决定 keystore / rigsec 路径）。 */
  storageType?: string;
}

export interface AdminWalletModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** 4 态上下文（源 adminWalletModalInfo）。 */
  ctx: AdminWalletCtx;
  /** 取消回调。 */
  onCancel: () => void;
  /** 生成钱包入口回调（Update 态，Shell 打开 GenerateWallet/RigsecWallet Modal）。 */
  onGenerateWallet?: () => void;
  /** 当前表单中的 chainAccountAddress/privateKey（用于判断是否已有钱包，决定是否确认覆盖）。 */
  currentWallet?: { chainAccountAddress?: string; privateKey?: string };
}

/** Update 表单值。 */
interface UpdateFormValues {
  chainAccountAddress?: string;
  privateKey?: string;
  password?: string;
}

/** Approval 表单值。 */
interface ApprovalFormValues {
  state: string;
  remark?: string;
}

/** 详情/历史表时间戳格式。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 详情/历史表列定义（源 959-1091，逐列）。 */
function useWalletDetailColumns(withStatus: boolean): ColumnDef<WalletDetailItem>[] {
  const t = useTranslations('modules.tokenized-deposit');
  return React.useMemo(
    () => [
      {
        // tokenized_deposit_0081：originalWalletAddress
        accessorKey: 'originalWalletAddress',
        header: t('tokenized_deposit_0081'),
        cell: ({ row }) => (
          <span>{row.original.originalWalletAddress || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0053：walletAddress
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0053'),
        cell: ({ row }) => (
          <span>{row.original.walletAddress || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0075：type → admin_wallet_type_${type}
        accessorKey: 'type',
        header: t('tokenized_deposit_0075'),
        cell: ({ row }) => {
          const type = row.original.type;
          return <span>{type == null ? '' : t(`admin_wallet_type_${type}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0057：createTime → formatDate
        accessorKey: 'createTime',
        header: t('tokenized_deposit_0057'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        // tokenized_deposit_0056：createUser
        accessorKey: 'createUser',
        header: t('tokenized_deposit_0056'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      ...(withStatus
        ? [
            {
              // PUB_Status：status → common_task_status_${status}
              id: 'status',
              accessorKey: 'status' as keyof WalletDetailItem,
              header: t('PUB_Status'),
              cell: ({ row }: { row: { original: WalletDetailItem } }) => {
                const status = row.original.status;
                return (
                  <span>
                    {status == null ? '' : t(`common_task_status_${status}`)}
                  </span>
                );
              },
            } as ColumnDef<WalletDetailItem>,
          ]
        : []),
    ],
    [t, withStatus],
  );
}

/**
 * 管理员钱包 Modal（4 态）。
 *
 * 用法：
 * ```tsx
 * <AdminWalletModal
 *   open={adminWalletModalOpen}
 *   ctx={adminWalletCtx}
 *   onCancel={() => setAdminWalletModalOpen(false)}
 *   onGenerateWallet={handleGenerateWallet}
 * />
 * ```
 */
export function AdminWalletModal({
  open,
  ctx,
  onCancel,
  onGenerateWallet,
}: AdminWalletModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync: updateAsync, isPending: updatePending } =
    useUpdateAdminWalletMutation();
  const { mutateAsync: approvalAsync, isPending: approvalPending } =
    useApprovalAdminWalletMutation();

  const isForm = ctx.type === 'Update' || ctx.type === 'Approval';
  const isKeystore = ctx.storageType === 'key_keystore';

  // ── Update 表单 ──
  const updateForm = useForm<UpdateFormValues>({});
  // ── Approval 表单 ──
  const approvalForm = useForm<ApprovalFormValues>({
    defaultValues: { state: '20', remark: '' },
  });

  // 打开时重置表单（对齐源 destroyOnClose + setFieldsValue）。
  // 仅依赖 open/type，form.reset 引用 stable 不纳入依赖。
  React.useEffect(() => {
    if (!open) return;
    if (ctx.type === 'Approval') {
      approvalForm.reset({ state: '20', remark: '' });
    } else if (ctx.type === 'Update') {
      updateForm.reset({});
    }
  }, [open, ctx.type]);

  // Update 提交（源 1096-1102）：password AES 加密后提交。
  const onUpdateSubmit = async (values: UpdateFormValues) => {
    try {
      await updateAsync({
        accountId: ctx.id,
        chainAccountAddress: values.chainAccountAddress,
        password: values.password ? getEncryptionData(values.password) : '',
        privateKey: values.privateKey,
      });
      toast.success(t('PUB_Success').replace('****', t('PUB_Save')));
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  // Approval 提交（源 1104-1108）。
  const onApprovalSubmit = async (values: ApprovalFormValues) => {
    try {
      await approvalAsync({
        recordId: ctx.id,
        remark: values.remark,
        state: values.state,
      });
      toast.success(t('PUB_Success').replace('****', t('PUB_Submit')));
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  // 宽度（源 2267-2271）：Update/Approval 30%，Details/History 60%。
  const maxWidth = isForm ? 'max-w-[480px]' : 'max-w-[900px]';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <DialogTitle>{ctx.title}</DialogTitle>
          <DialogDescription className="sr-only">{ctx.title}</DialogDescription>
        </DialogHeader>

        {/* ── Update / Approval 表单 ── */}
        {isForm ? (
          ctx.type === 'Update' ? (
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} noValidate>
              {/* walletType disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('tokenized_deposit_0075')}
                </Label>
                <Input value={ctx.walletType ?? ''} disabled readOnly />
              </div>
              {/* walletAddress disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('tokenized_deposit_0053')}
                </Label>
                <Input value={ctx.walletAddress ?? ''} disabled readOnly />
              </div>

              {/* chainAccountAddress + 生成钱包入口（源 2339-2392） */}
              <div className="mb-4">
                <div className="mb-1.5 flex w-full items-center justify-between">
                  <Label className="block text-sm font-medium">
                    {t('tokenized_deposit_0078')}
                  </Label>
                  <button
                    type="button"
                    className="cursor-pointer text-sm text-primary underline"
                    onClick={onGenerateWallet}
                  >
                    {t('PUB_Generate_Wallet')}
                  </button>
                </div>
                <Input
                  disabled={!isKeystore}
                  aria-invalid={!!updateForm.formState.errors.chainAccountAddress}
                  {...updateForm.register('chainAccountAddress', { required: true })}
                />
              </div>

              {/* keystore 路径才显示 privateKey + password（源 2395-2418） */}
              {isKeystore ? (
                <>
                  <div className="mb-4">
                    <Label className="mb-1.5 block text-sm font-medium">
                      {t('tokenized_deposit_0079')}
                    </Label>
                    <Controller
                      control={updateForm.control}
                      name="privateKey"
                      rules={{ required: true }}
                      render={({ field, fieldState }) => (
                        <textarea
                          value={(field.value as string) ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          rows={3}
                          aria-invalid={!!fieldState.error}
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      )}
                    />
                  </div>
                  <div className="mb-4">
                    <Label className="mb-1.5 block text-sm font-medium">
                      {t('tokenized_deposit_0080')}
                    </Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={!!updateForm.formState.errors.password}
                      {...updateForm.register('password', { required: true })}
                    />
                  </div>
                </>
              ) : null}

              <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t('PUB_Cancel')}
                </Button>
                <Button type="submit" disabled={updatePending}>
                  {t('PUB_Save')}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              onSubmit={approvalForm.handleSubmit(onApprovalSubmit)}
              noValidate
            >
              {/* walletType disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('tokenized_deposit_0075')}
                </Label>
                <Input value={ctx.walletType ?? ''} disabled readOnly />
              </div>
              {/* originalWalletAddress disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('tokenized_deposit_0081')}
                </Label>
                <Input
                  value={ctx.originalWalletAddress ?? ''}
                  disabled
                  readOnly
                />
              </div>
              {/* walletAddress disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('tokenized_deposit_0053')}
                </Label>
                <Input value={ctx.walletAddress ?? ''} disabled readOnly />
              </div>
              {/* status disabled */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('PUB_Status')}
                </Label>
                <Input value={ctx.status ?? ''} disabled readOnly />
              </div>
              {/* state Radio Approve/Reject（Radix RadioGroup 用 value/onValueChange，需 Controller） */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('PUB_Examine')}
                </Label>
                <Controller
                  control={approvalForm.control}
                  name="state"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <RadioGroup
                      value={(field.value as string) ?? '20'}
                      onValueChange={field.onChange}
                      className="flex"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="20" />
                        {t('PUB_Approve')}
                      </label>
                      <label className="ml-4 flex items-center gap-2 text-sm">
                        <RadioGroupItem value="15" />
                        {t('PUB_Reject')}
                      </label>
                    </RadioGroup>
                  )}
                />
              </div>
              {/* remark */}
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('PUB_Comment')}
                </Label>
                <Controller
                  control={approvalForm.control}
                  name="remark"
                  rules={{ required: true }}
                  render={({ field, fieldState }) => (
                    <textarea
                      value={(field.value as string) ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      rows={3}
                      aria-invalid={!!fieldState.error}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  )}
                />
              </div>

              <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t('PUB_Cancel')}
                </Button>
                <Button type="submit" disabled={approvalPending}>
                  {t('PUB_Submit')}
                </Button>
              </DialogFooter>
            </form>
          )
        ) : (
          <DetailsOrHistoryBody ctx={ctx} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Details 静态展示 + 详情表 / History 表。 */
function DetailsOrHistoryBody({
  ctx,
}: {
  ctx: AdminWalletCtx;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // 分页（源 initialValues accountType/stablecoinId + useCustomTable 默认分页）。
  const [pageNum, setPageNum] = React.useState(1);
  const params = React.useMemo(
    () => ({
      pageNum,
      pageSize: DEFAULT_PAGE_SIZE,
      accountType: ctx.accountType,
      stablecoinId:
        ctx.stablecoinId != null ? Number(ctx.stablecoinId) : undefined,
    }),
    [pageNum, ctx.accountType, ctx.stablecoinId],
  );

  const detailQuery = useWalletDetailListQuery(params);
  const historyQuery = useWalletHistoryListQuery(params);

  if (ctx.type === 'Details') {
    const detailCols = useWalletDetailColumns(true);
    const detailRows = (detailQuery.data?.rows ?? []) as WalletDetailItem[];
    const total = detailQuery.data?.page?.total ?? 0;
    return (
      <div className="px-2 py-2">
        <div className="mb-4 flex flex-col">
          <span>{t('tokenized_deposit_0075')}</span>
          <span>{ctx.walletType ?? '--'}</span>
        </div>
        <div className="mb-8 flex flex-col">
          <span>{t('tokenized_deposit_0053')}</span>
          <span>{ctx.walletAddress ?? '--'}</span>
        </div>
        <DataTable
          columns={detailCols}
          data={detailRows}
          isLoading={detailQuery.isLoading}
          pagination={{
            page: pageNum,
            pageSize: DEFAULT_PAGE_SIZE,
            total,
            onPageChange: setPageNum,
          }}
        />
      </div>
    );
  }

  // History
  const historyCols = useWalletDetailColumns(false);
  const historyRows = (historyQuery.data?.rows ?? []) as WalletDetailItem[];
  const historyTotal = historyQuery.data?.page?.total ?? 0;
  return (
    <div className="px-2 py-2">
      <DataTable
        columns={historyCols}
        data={historyRows}
        isLoading={historyQuery.isLoading}
        pagination={{
          page: pageNum,
          pageSize: DEFAULT_PAGE_SIZE,
          total: historyTotal,
          onPageChange: setPageNum,
        }}
      />
    </div>
  );
}
