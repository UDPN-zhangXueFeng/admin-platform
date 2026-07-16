'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  CrossChainStatusBadge,
} from '@myorg/modules/cross-chain/ui';
import {
  useBlockchainEnableListQuery,
  useStablecoinSearchesQuery,
  useTokenPairListQuery,
  useUpdateTokenPairMutation,
  type TokenPairItem,
  type TokenPairListFilters,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  TOKEN_PAIR_UPDATE_STATE,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
/** 「全部」占位 value（对齐 rd-bridge / fx-rate 列表筛选约定）。 */
const ALL_VALUE = 'all';

/**
 * TokenPairListPage — 代币对列表页。
 *
 * 迁移自 td-manage src/pages/cross-chain/token-pair/index.tsx（454 行）。
 * useCustomTable → react-hook-form + DataTable；useSWR 下拉 → TanStack Query hooks。
 *
 * 6 个筛选条件：send token / receive token（stablecoin searches 下拉）/
 * send 链（enableList 下拉）/ receive 链 / 状态（1/3/5/10）/ 更新时间范围。
 *
 * 硬约束（cc-12 summary + 迁移文档第 7.17 节）：
 * - send/receive 链下拉用 common/blockchain/enableList（{ key, value }，仅启用链），
 *   与 common/blockchain/list 不同接口。
 * - 请求体 pageNum/pageSize（data-access 已封装）。
 * - 方向列含色块 blockchain_code_color_${shortName} + ArrowRightCircle + 货币符号-pegged。
 * - crossChainFee 走 reSet 格式化 + ' ' + cross_chain_0090（Gas 单位文案）。
 * - 状态列走 CrossChainStatusBadge kind="token-pair"（TOKEN_PAIR_STATUS_COLOR + token_pair_status_）。
 * - 顶部「新增」跳 `/cross-chain/token-pair/edit`（无参）。
 * - 行操作：查看（跳 view?id=）/ 编辑（status∈{3,5,10} 可用）/ 禁用（status===5 可用）/ 启用（status===10 可用）。
 * - Disable/Enable 共用 Modal：方向信息只读展示（send token+色块 → receive token+色块）+ remarks 必填。
 * - 调 update（status: 50(禁用) / 35(启用)，TOKEN_PAIR_UPDATE_STATE），与列表显示 1/3/5/10 不同语义。
 *   成功 toast + 关闭 Modal（mutation 自动 invalidate 列表）。
 */
interface TokenPairFilterForm {
  sendTokenId: string;
  receiveTokenId: string;
  sendBlockchainId: string;
  receiveBlockchainId: string;
  /** 状态：1/3/5/10。'' 表示全部。 */
  status: string;
  updateStartTime: string;
  updateEndTime: string;
}

const EMPTY_FILTER: TokenPairFilterForm = {
  sendTokenId: ALL_VALUE,
  receiveTokenId: ALL_VALUE,
  sendBlockchainId: ALL_VALUE,
  receiveBlockchainId: ALL_VALUE,
  status: ALL_VALUE,
  updateStartTime: '',
  updateEndTime: '',
};

function formToFilters(f: TokenPairFilterForm): TokenPairListFilters {
  return {
    sendTokenId: f.sendTokenId !== ALL_VALUE ? f.sendTokenId : undefined,
    receiveTokenId: f.receiveTokenId !== ALL_VALUE ? f.receiveTokenId : undefined,
    sendBlockchainId:
      f.sendBlockchainId !== ALL_VALUE ? f.sendBlockchainId : undefined,
    receiveBlockchainId:
      f.receiveBlockchainId !== ALL_VALUE ? f.receiveBlockchainId : undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
    updateStartTime: f.updateStartTime
      ? startOfDay(parseISO(f.updateStartTime)).getTime()
      : undefined,
    updateEndTime: f.updateEndTime
      ? endOfDay(parseISO(f.updateEndTime)).getTime()
      : undefined,
  };
}

/** Modal 上下文（由行操作 Disable/Enable 填充）。 */
interface ModalContext {
  tokenCrossChainId: number;
  /** 35=启用 / 50=禁用（update 入参语义）。 */
  status: 35 | 50;
  /** 'Disable' | 'Enable'，派生标题 / subTitle / 文案。 */
  action: 'Disable' | 'Enable';
  /** 方向信息只读回填。 */
  sendTokenName?: string;
  sendBlockchainShortName?: string;
  sendTokenCurrencySymbol?: string;
  receiveTokenName?: string;
  receiveBlockchainShortName?: string;
  receiveTokenCurrencySymbol?: string;
}

/** remarks 必填表单值。 */
interface RemarksFormValues {
  remarks: string;
}

export function TokenPairListPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<TokenPairFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<TokenPairFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── 下拉数据源 ──
  // 链：common/blockchain/enableList（仅启用链，与 common/blockchain/list 不同接口）。
  const blockchainQuery = useBlockchainEnableListQuery();
  // Token：common/stablecoin/enabled/searches。
  const tokenQuery = useStablecoinSearchesQuery();

  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainQuery.data ?? []).map((el) => ({
        value: el.key,
        label: el.value,
      })),
    ],
    [blockchainQuery.data, t],
  );

  const tokenOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(tokenQuery.data ?? []).map((el) => ({
        value: el.stablecoinId,
        label: el.name,
      })),
    ],
    [tokenQuery.data, t],
  );

  // 状态选项：1/3/5/10（源码 options.value 为字符串）。
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: '1', label: t('token_pair_status_1') },
      { value: '3', label: t('token_pair_status_3') },
      { value: '5', label: t('token_pair_status_5') },
      { value: '10', label: t('token_pair_status_10') },
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
  const listResult = useTokenPairListQuery(params);
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

  const updateMutation = useUpdateTokenPairMutation();

  // 行操作：Disable / Enable（token-pair 无 isTokenPaired 拦截，与 rd-bridge 不同）。
  const openStatusModal = React.useCallback(
    (row: TokenPairItem, action: 'Disable' | 'Enable') => {
      const status =
        action === 'Disable'
          ? TOKEN_PAIR_UPDATE_STATE.DISABLE
          : TOKEN_PAIR_UPDATE_STATE.ENABLE;
      setModalContext({
        tokenCrossChainId: row.tokenCrossChainId ?? 0,
        status,
        action,
        sendTokenName: row.sendTokenName,
        sendBlockchainShortName: row.sendBlockchainShortName,
        sendTokenCurrencySymbol: row.sendTokenCurrencySymbol,
        receiveTokenName: row.receiveTokenName,
        receiveBlockchainShortName: row.receiveBlockchainShortName,
        receiveTokenCurrencySymbol: row.receiveTokenCurrencySymbol,
      });
      // 源码 setTimeout(() => form1.resetFields())；react-hook-form 直接 reset 清空 remarks。
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
          tokenCrossChainId: modalContext.tokenCrossChainId,
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

  // Modal 标题：源码 modalInfo.title（Disable=Router_0010_4_5 禁用 / Enable=Router_0010_4_4 启用）。
  const modalTitle = modalContext
    ? t(
        modalContext.action === 'Disable'
          ? 'action.disable'
          : 'action.enable',
      )
    : '';
  // Modal subTitle：源码 modalInfo.subTitle（Disable=cross_chain_0087 / Enable=cross_chain_0086）。
  const modalSubTitle = modalContext
    ? t(modalContext.action === 'Disable' ? 'cross_chain_0087' : 'cross_chain_0086')
    : '';

  const columns = React.useMemo<ColumnDef<TokenPairItem>[]>(
    () => [
      // 索引列（源码 dataIndex='tokenCrossChainId' width 5%）。
      {
        id: 'tokenCrossChainId',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>{row.original.tokenCrossChainId ?? EMPTY_DISPLAY}</span>
        ),
      },
      // 方向列（源码 dataIndex='sendTokenName' render）：send token+色块 + 货币符号-pegged
      //   → ArrowRightCircle → receive token+色块 + 货币符号-pegged。
      {
        id: 'direction',
        header: t('cross_chain_0083'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-start">
              <div>
                <div>
                  <span>{r.sendTokenName}</span>
                  <BlockchainCodeChip
                    name={r.sendBlockchainShortName}
                    color={tCommon(
                      `blockchain_code_color_${r.sendBlockchainShortName ?? ''}`,
                    )}
                  />
                </div>
                <div className="text-xs">{`${
                  r.sendTokenCurrencySymbol ?? ''
                }-${t('cross_chain_00104')}`}</div>
              </div>
              <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div>
                  <span>{r.receiveTokenName}</span>
                  <BlockchainCodeChip
                    name={r.receiveBlockchainShortName}
                    color={tCommon(
                      `blockchain_code_color_${r.receiveBlockchainShortName ?? ''}`,
                    )}
                  />
                </div>
                <div className="text-xs">{`${
                  r.receiveTokenCurrencySymbol ?? ''
                }-${t('cross_chain_00104')}`}</div>
              </div>
            </div>
          );
        },
      },
      // crossChainFee（源码 reSet 格式化 + ' ' + cross_chain_0090）。
      {
        accessorKey: 'crossChainFee',
        header: t('cross_chain_0084'),
        cell: ({ row }) => (
          <span>{`${reSet(row.original.crossChainFee)} ${t(
            'cross_chain_0090',
          )}`}</span>
        ),
      },
      // 更新时间。
      {
        accessorKey: 'updateTime',
        header: t('field.updateOn'),
        cell: ({ row }) => (
          <span>
            {row.original.updateTime
              ? formatDate(Number(row.original.updateTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      // 状态列：CrossChainStatusBadge kind="token-pair"。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge kind="token-pair" status={row.original.status} />
        ),
      },
      // 行操作：查看 / 编辑(status∈{3,5,10}) / 禁用(status===5) / 启用(status===10)。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const canEdit = r.status === 10 || r.status === 5 || r.status === 3;
          const canDisable = r.status === 5;
          const canEnable = r.status === 10;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.TP_VIEW_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/cross-chain/token-pair/view?id=${
                        r.tokenCrossChainId ?? ''
                      }`,
                    )
                  }
                >
                  {t('action.view')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.TP_EDIT_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canEdit}
                  onClick={() =>
                    router.push(
                      `/cross-chain/token-pair/edit?id=${
                        r.tokenCrossChainId ?? ''
                      }`,
                    )
                  }
                >
                  {t('action.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={CROSS_CHAIN_PERMISSIONS.TP_DISABLE_BTN}
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
                permission={CROSS_CHAIN_PERMISSIONS.TP_ENABLE_BTN}
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
    [t, tCommon, router, openStatusModal],
  );

  const onSubmit = React.useCallback((f: TokenPairFilterForm) => {
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
            name="sendTokenId"
            control={control}
            label={t('cross_chain_0078')}
            options={tokenOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="sendBlockchainId"
            control={control}
            label={t('cross_chain_0079')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="receiveTokenId"
            control={control}
            label={t('cross_chain_0080')}
            options={tokenOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="receiveBlockchainId"
            control={control}
            label={t('cross_chain_0081')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('filter.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="updateStartTime"
            control={control}
            label={t('cross_chain_0025')}
          />
          <FormDatePicker
            name="updateEndTime"
            control={control}
            label={t('cross_chain_0025')}
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
          <div className="text-sm font-semibold">{t('cross_chain_0082')}</div>
          <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.TP_ADD_BTN}>
            <Button
              size="sm"
              onClick={() => router.push('/cross-chain/token-pair/edit')}
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

      {/* ── Disable/Enable 共用 Modal（方向信息只读 + remarks 必填）── */}
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
          <form
            onSubmit={handleSubmitRemarks(onRemarksSubmit)}
            className="space-y-4"
          >
            {/* 方向信息只读展示（源码 CustomForms 第一个 formItem，name='' 纯展示） */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                {t('cross_chain_0083')}
              </Label>
              <div className="flex items-start rounded-md border border-input bg-muted/30 px-3 py-2">
                <div>
                  <div>
                    <span>{modalContext?.sendTokenName}</span>
                    <BlockchainCodeChip
                      name={modalContext?.sendBlockchainShortName}
                      color={tCommon(
                        `blockchain_code_color_${
                          modalContext?.sendBlockchainShortName ?? ''
                        }`,
                      )}
                    />
                  </div>
                  <div className="text-xs">{`${
                    modalContext?.sendTokenCurrencySymbol ?? ''
                  }-${t('cross_chain_00104')}`}</div>
                </div>
                <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div>
                    <span>{modalContext?.receiveTokenName}</span>
                    <BlockchainCodeChip
                      name={modalContext?.receiveBlockchainShortName}
                      color={tCommon(
                        `blockchain_code_color_${
                          modalContext?.receiveBlockchainShortName ?? ''
                        }`,
                      )}
                    />
                  </div>
                  <div className="text-xs">{`${
                    modalContext?.receiveTokenCurrencySymbol ?? ''
                  }-${t('cross_chain_00104')}`}</div>
                </div>
              </div>
            </div>
            <div>
              <Label
                htmlFor="token-pair-remarks"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('cross_chain_0030')}
                <span
                  className="ml-0.5 text-destructive"
                  aria-hidden="true"
                >
                  *
                </span>
              </Label>
              <textarea
                id="token-pair-remarks"
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
    </div>
  );
}

/**
 * 区块链色块（迁移自源码 `<span style={{background: t('blockchain_code_color_${name}')}}>`）。
 *
 * blockchain_code_color_* 走 common/blockchain 全局命名空间（i18n 已有）。
 * 与 cross-chain-transactions-detail 的 BlockchainCodeChip 同款实现。
 */
function BlockchainCodeChip({
  name,
  color,
}: {
  name?: string;
  color?: string;
}): React.JSX.Element | null {
  if (!name) return null;
  return (
    <span
      className="ml-2 rounded-sm px-1 text-xs text-white"
      style={{ background: color || 'transparent' }}
    >
      {name}
    </span>
  );
}

/**
 * reSet 的本地等价（迁移自源 libs/utils/index.ts:46 `reSet(value, len=2)`）。
 *
 * 源签名 value:any → value>=0 时 Number(value).toFixed(2).replace(千分位)，
 * 否则 '--'。crossChainFee 为字符串金额，沿用原行为。
 *
 * 与 rd-bridge-detail-page 的本地 reSet 同款语义，本页独立实现避免跨页面耦合。
 */
function reSet(value: number | string | undefined | null): string {
  if (value == null || value === '') return EMPTY_DISPLAY;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return EMPTY_DISPLAY;
  return num.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}
