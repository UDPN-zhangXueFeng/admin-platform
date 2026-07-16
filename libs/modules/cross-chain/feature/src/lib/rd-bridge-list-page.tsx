'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  CopyableEllipsisText,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import { CrossChainStatusBadge } from '@myorg/modules/cross-chain/ui';
import {
  useRdBridgeBlockchainListQuery,
  useRdBridgeListQuery,
  useUpdateRdBridgeMutation,
  type RdBridgeItem,
  type RdBridgeListFilters,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  RD_BRIDGE_STATE,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
/** 「全部」占位 value（对齐 fx-rate / cct 列表筛选约定）。 */
const ALL_VALUE = 'all';

/**
 * RdBridgeListPage — RD-Bridge 跨链桥配置列表页。
 *
 * 迁移自 td-manage src/pages/cross-chain/rd-bridge/index.tsx（368 行）。
 * useCustomTable → react-hook-form + DataTable；源码手动 getBlockChainList（useEffect + useState）
 * → useRdBridgeBlockchainListQuery（data-access 已封装，staleTime 5min）。
 *
 * 7 个筛选条件：链（getBlockChainList 下拉，非 common/blockchain/list）/ endpointId /
 * 3 个合约地址（endpointContractAddress/sendContractAddress/receiveContractAddress）/
 * 状态（35/50）/ 创建时间范围。
 *
 * 硬约束（cc-10 summary + 迁移文档第 7.14 节）：
 * - 链下拉用 getBlockChainList（{ blockChainId, blockChainName, unit }），与 common/blockchain/list 不同。
 * - 请求体 pageNum/pageSize（data-access 已封装）。
 * - 顶部「注册」跳 `/cross-chain/rd-bridge/edit`（无参）。
 * - 行操作：查看（跳 `view?id=`）/ 编辑（status===50 可用）/ 禁用（status===35 可用）/ 启用（status===50 可用）。
 * - **Disable 拦截**：isTokenPaired===1 弹 warning AlertDialog 拦截（cross_chain_00142 标题 +
 *   cross_chain_00121 文案，提示先解绑代币对），不进入 Disable/Enable Modal。
 * - 否则共用 Disable/Enable Modal：标题 = `{Action} {cross_chain_00122}`，subTitle =
 *   cross_chain_0039.replace('${status}', Action)；blockchainName / endpointId 只读 + remarks 必填。
 * - 调 update（status: 50(禁用) / 35(启用)），成功 toast + 关闭 Modal（mutation 自动 invalidate 列表）。
 */
interface RdBridgeFilterForm {
  /** 链 ID（blockChainId）。'' 表示全部。 */
  blockchainId: string;
  endpointId: string;
  endpointContractAddress: string;
  sendContractAddress: string;
  receiveContractAddress: string;
  /** 状态：35/50。'' 表示全部。 */
  status: string;
  createStartTime: string;
  createEndTime: string;
}

const EMPTY_FILTER: RdBridgeFilterForm = {
  blockchainId: ALL_VALUE,
  endpointId: '',
  endpointContractAddress: '',
  sendContractAddress: '',
  receiveContractAddress: '',
  status: ALL_VALUE,
  createStartTime: '',
  createEndTime: '',
};

function formToFilters(f: RdBridgeFilterForm): RdBridgeListFilters {
  return {
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    endpointId: f.endpointId || undefined,
    endpointContractAddress: f.endpointContractAddress || undefined,
    sendContractAddress: f.sendContractAddress || undefined,
    receiveContractAddress: f.receiveContractAddress || undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
    createStartTime: f.createStartTime
      ? startOfDay(parseISO(f.createStartTime)).getTime()
      : undefined,
    createEndTime: f.createEndTime
      ? endOfDay(parseISO(f.createEndTime)).getTime()
      : undefined,
  };
}

/** Modal 上下文（由行操作 Disable/Enable 填充）。 */
interface ModalContext {
  crossChainId: number;
  /** 35=启用 / 50=禁用（update 入参语义）。 */
  status: 35 | 50;
  /** 'Disable' | 'Enable'，派生标题 / subTitle / 文案。 */
  action: 'Disable' | 'Enable';
  /** 只读回填：链名。 */
  blockchainName?: string;
  /** 只读回填：endpointId。 */
  endpointId?: number;
}

/** remarks 必填表单值。 */
interface RemarksFormValues {
  remarks: string;
}

export function RdBridgeListPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  const { control, handleSubmit, reset, register } = useForm<RdBridgeFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<RdBridgeFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── 下拉数据源 ──
  // 链：cross/chain/getBlockChainList（{ blockChainId, blockChainName, unit }），
  // 与 common/blockchain/list 不同接口（迁移文档第 8 章硬约束）。
  const blockchainQuery = useRdBridgeBlockchainListQuery();
  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainQuery.data ?? []).map((el) => ({
        value: String(el.blockChainId),
        label: el.blockChainName,
      })),
    ],
    [blockchainQuery.data, t],
  );

  // 状态选项：35 启用 / 50 禁用（源码 options.value 为字符串）。
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: '35', label: t('cross_chain_status_35') },
      { value: '50', label: t('cross_chain_status_50') },
    ],
    [t],
  );

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useRdBridgeListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── Disable/Enable 共用 Modal ──
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalContext, setModalContext] = React.useState<ModalContext | null>(
    null,
  );
  const {
    register: registerRemarks,
    handleSubmit: handleSubmitRemarks,
    reset: resetRemarks,
    formState: { errors: remarksErrors },
  } = useForm<RemarksFormValues>({ defaultValues: { remarks: '' } });

  const updateMutation = useUpdateRdBridgeMutation();

  // 行操作：Disable / Enable（含 isTokenPaired 拦截分支）。
  const openStatusModal = React.useCallback(
    (row: RdBridgeItem, action: 'Disable' | 'Enable') => {
      // Disable 时若已关联代币对（isTokenPaired===1）弹 warning 拦截，不进入 Modal。
      if (action === 'Disable' && row.isTokenPaired === 1) {
        setWarningOpen(true);
        return;
      }
      const status = action === 'Disable' ? RD_BRIDGE_STATE.DISABLE : RD_BRIDGE_STATE.ENABLE;
      setModalContext({
        crossChainId: row.crossChainId ?? 0,
        status,
        action,
        blockchainName: row.blockchainName,
        endpointId: row.endpointId,
      });
      // 源码 setTimeout(() => form1.resetFields() + setFieldsValue)；
      // react-hook-form 直接 reset 清空 remarks。
      resetRemarks({ remarks: '' });
      setModalOpen(true);
    },
    [resetRemarks],
  );

  const onRemarksSubmit = React.useCallback(
    (values: RemarksFormValues) => {
      if (!modalContext) return;
      updateMutation.mutate(
        {
          crossChainId: modalContext.crossChainId,
          status: modalContext.status,
          remarks: values.remarks,
        },
        {
          onSuccess: () => {
            toast.success(t('submitSuccess'));
            resetRemarks({ remarks: '' });
            setModalOpen(false);
            setModalContext(null);
          },
        },
      );
    },
    [modalContext, updateMutation, resetRemarks, t],
  );

  // ── isTokenPaired 拦截 warning AlertDialog ──
  const [warningOpen, setWarningOpen] = React.useState(false);

  // Modal 标题：源码 modalInfo.title + ' ' + cross_chain_00122。
  const modalTitle = modalContext
    ? `${t(modalContext.action === 'Disable' ? 'action.disable' : 'action.enable')} ${t('cross_chain_00122')}`
    : '';
  // Modal subTitle：源码 cross_chain_0039.replace('${status}', Action 文案)。
  const modalSubTitle = modalContext
    ? t('cross_chain_0039', {
        status:
          modalContext.action === 'Disable'
            ? t('action.disable')
            : t('action.enable'),
      })
    : '';

  const columns = React.useMemo<ColumnDef<RdBridgeItem>[]>(
    () => [
      // 索引列（源码 dataIndex='crossChainId' width 5%）。
      {
        id: 'crossChainId',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>{row.original.crossChainId ?? EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('cross_chain_0000'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'endpointId',
        header: t('cross_chain_0001'),
        cell: ({ row }) => (
          <span>{row.original.endpointId ?? EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'endpointContractAddress',
        header: t('cross_chain_0037'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.endpointContractAddress}
            maxWidth={180}
          />
        ),
      },
      {
        accessorKey: 'sendContractAddress',
        header: t('cross_chain_0035'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.sendContractAddress}
            maxWidth={180}
          />
        ),
      },
      {
        accessorKey: 'receiveContractAddress',
        header: t('cross_chain_0036'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.receiveContractAddress}
            maxWidth={180}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('cross_chain_0007'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(Number(row.original.createTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      // 状态列：CrossChainStatusBadge kind="rd-bridge"（RD_BRIDGE_STATUS_COLOR + cross_chain_status_${status}）。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge
            kind="rd-bridge"
            status={row.original.status}
          />
        ),
      },
      // 行操作：查看 / 编辑(status===50) / 禁用(status===35) / 启用(status===50)。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const canEdit = r.status === 50;
          const canDisable = r.status === 35;
          const canEnable = r.status === 50;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.RD_VIEW_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/cross-chain/rd-bridge/view?id=${r.crossChainId ?? ''}`,
                    )
                  }
                >
                  {t('action.view')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.RD_EDIT_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canEdit}
                  onClick={() =>
                    router.push(
                      `/cross-chain/rd-bridge/edit?id=${r.crossChainId ?? ''}`,
                    )
                  }
                >
                  {t('action.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={CROSS_CHAIN_PERMISSIONS.RD_DISABLE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canDisable}
                  onClick={() => openStatusModal(r, 'Disable')}
                >
                  {t('action.disable')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={CROSS_CHAIN_PERMISSIONS.RD_ENABLE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canEnable}
                  onClick={() => openStatusModal(r, 'Enable')}
                >
                  {t('action.enable')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, router, openStatusModal],
  );

  const onSubmit = React.useCallback((f: RdBridgeFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('cross_chain_0000')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormField
            name="endpointId"
            label={t('cross_chain_0001')}
            register={register('endpointId')}
            placeholder={t('cross_chain_0001')}
          />
          <FormField
            name="endpointContractAddress"
            label={t('cross_chain_0037')}
            register={register('endpointContractAddress')}
            placeholder={t('cross_chain_0037')}
          />
          <FormField
            name="sendContractAddress"
            label={t('cross_chain_0035')}
            register={register('sendContractAddress')}
            placeholder={t('cross_chain_0035')}
          />
          <FormField
            name="receiveContractAddress"
            label={t('cross_chain_0036')}
            register={register('receiveContractAddress')}
            placeholder={t('cross_chain_0036')}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('filter.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createStartTime"
            control={control}
            label={t('cross_chain_0005')}
          />
          <FormDatePicker
            name="createEndTime"
            control={control}
            label={t('cross_chain_0005')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('filter.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('cross_chain_0006')}</div>
          <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.RD_ADD_BTN}>
            <Button
              size="sm"
              onClick={() => router.push('/cross-chain/rd-bridge/edit')}
            >
              {t('action.add')}
            </Button>
          </PermissionGuard>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (p) =>
                setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>

      {/* ── Disable/Enable 共用 Modal ── */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            resetRemarks({ remarks: '' });
            setModalContext(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            {modalSubTitle ? (
              <p className="text-sm text-muted-foreground">{modalSubTitle}</p>
            ) : null}
          </DialogHeader>
          <form onSubmit={handleSubmitRemarks(onRemarksSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="rd-bridge-blockchainName" className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0000')}
              </Label>
              <Input
                id="rd-bridge-blockchainName"
                value={modalContext?.blockchainName ?? ''}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="rd-bridge-endpointId" className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0001')}
              </Label>
              <Input
                id="rd-bridge-endpointId"
                value={
                  modalContext?.endpointId != null
                    ? String(modalContext.endpointId)
                    : ''
                }
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="rd-bridge-remarks" className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0030')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
              </Label>
              <textarea
                id="rd-bridge-remarks"
                {...registerRemarks('remarks', { required: true })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t('cross_chain_0030')}
              />
              {remarksErrors.remarks ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {t('fieldRequired', { field: t('cross_chain_0030') })}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  resetRemarks({ remarks: '' });
                  setModalContext(null);
                }}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {t('action.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── isTokenPaired===1 拦截 warning ── */}
      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cross_chain_00142')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cross_chain_00121')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end">
            <AlertDialogAction onClick={() => setWarningOpen(false)}>
              {t('action.submit')}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
