'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
} from '@myorg/shared/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useBlockchainListQuery,
  useNodeListQuery,
  useNodeLocationListQuery,
  useUpdateNodeStateMutation,
  type NodeItem,
  type NodeListFilters,
} from '@myorg/modules/blockchain/data-access';
import { BlockchainStatusBadge } from '@myorg/modules/blockchain/ui';
import {
  ALL_VALUE,
  BLOCKCHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  NODE_STATE,
  NODE_STATUS_OPTIONS,
} from '@myorg/modules/blockchain/util';
import { NodeDeleteModal } from './node-delete-modal';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 删除确认 Modal 所需上下文（由 bc-10 的 NodeDeleteModal 消费）。
 *
 * `url` 为节点 URL 数组拼接后的字符串（用作 Modal 输入校验基准 + 占位）。
 * `blockchainId` / `nodeLocationId` 用于 updateState(state:3) 调用。
 * `open` 控制挂载点 Modal 显隐。
 */
export interface NodeModalInfo {
  open: boolean;
  url: string;
  blockchainId: string;
  nodeLocationId: string;
}

const INITIAL_MODAL_INFO: NodeModalInfo = {
  open: false,
  url: '',
  blockchainId: '',
  nodeLocationId: '',
};

interface NodeFilterForm {
  /** 链 ID（chainId）。空串 = 全部；status!==1 的链选项 disabled。 */
  chainId: string;
  /** 节点位置 ID。空串 = 全部。 */
  nodeLocationId: string;
  /** 创建时间起。 */
  startCreateTime: string;
  /** 创建时间止。 */
  endCreateTime: string;
  /** 状态筛选：'1' 启用 / '2' 禁用。空串 = 全部。 */
  state: string;
}

const EMPTY_FILTER: NodeFilterForm = {
  chainId: ALL_VALUE,
  nodeLocationId: ALL_VALUE,
  startCreateTime: '',
  endCreateTime: '',
  state: ALL_VALUE,
};

function formToFilters(f: NodeFilterForm): NodeListFilters {
  return {
    chainId: f.chainId !== ALL_VALUE ? f.chainId : undefined,
    nodeLocationId:
      f.nodeLocationId !== ALL_VALUE ? f.nodeLocationId : undefined,
    startCreateTime: f.startCreateTime
      ? startOfDay(parseISO(f.startCreateTime)).getTime()
      : undefined,
    endCreateTime: f.endCreateTime
      ? endOfDay(parseISO(f.endCreateTime)).getTime()
      : undefined,
    state: f.state !== ALL_VALUE ? f.state : undefined,
  };
}

/**
 * NodeListPage — 节点管理列表页（不含删除 Modal 实现，Modal 挂载点预留由 bc-10 填充）。
 *
 * 迁移自 td-manage src/pages/blockchain/node/index.tsx（336 行）。
 * useCustomTable → react-hook-form + DataTable。
 *
 * 4 个筛选条件：链（status===1 可选，否则 disabled）/ 节点位置 / 创建时间范围 / 状态（1/2）。
 *
 * 硬约束（本模块特有）：
 * - 列表请求体分页字段为 pageNum（非 page），对齐 RBAC/sys 域后端（文档 3.1）。
 * - URL 列用 CopyableEllipsisText（源 CustomCopy，url 为 string[] 数组，拼接展示 + 复制）。
 * - browserUrl 列为外链 `<a target="_blank">`。
 * - 状态列走 `common_task_status_color_${status}` + `node_status_${status}` 动态拼接（BlockchainStatusBadge kind="node"）。
 * - 行「禁用」仅在 status!==2 可用、「启用」仅在 status!==1 可用，点击调 updateState（state 1/2），window.confirm 确认。
 * - 行「删除」受 NODE_DELETE_BTN 控制，点击 setModalInfo.open=true（Modal 实现由 bc-10 的 NodeDeleteModal 填充挂载点）。
 * - 顶部「新增」按钮受 NODE_ADD_BTN 控制，跳 /blockchain/node/edit（无参）。
 * - 行「编辑」受 NODE_EDIT_BTN 控制，跳 /blockchain/node/edit?blockchainId=&nodeLocationId=。
 */
export function NodeListPage(): React.JSX.Element {
  const t = useTranslations('modules.blockchain');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<NodeFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<NodeFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // 删除 Modal 挂载点状态（由 bc-10 的 NodeDeleteModal 消费 / 填充 Modal 实现）。
  const [modalInfo, setModalInfo] =
    React.useState<NodeModalInfo>(INITIAL_MODAL_INFO);

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useNodeListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── 下拉数据源 ──
  const blockchainList = useBlockchainListQuery();
  const nodeLocationList = useNodeLocationListQuery();
  const updateStateMutation = useUpdateNodeStateMutation();

  const nodeLocationOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      // Array.isArray + filter：后端下拉接口可能返回非数组（{rows}）或含 null 项，
      // 且 SelectItem value 不能为空串（Radix 限制），故过滤 null + 空 key。
      ...(Array.isArray(nodeLocationList.data) ? nodeLocationList.data : [])
        .filter((nl) => nl != null && nl.key != null && nl.key !== '')
        .map((nl) => ({
          value: String(nl.key),
          label: nl.value ?? '',
        })),
    ],
    [t, nodeLocationList.data],
  );

  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...NODE_STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: t(o.labelKey),
      })),
    ],
    [t],
  );

  // 链选项：status!==1 的链单项 disabled（源码 options.disabled: el.status === 1 ? false : true）。
  // Array.isArray + filter null/空 key：防御后端返回异常 + 避免 SelectItem value 空串（Radix 限制）。
  const blockchainOptions = React.useMemo(
    () =>
      (Array.isArray(blockchainList.data) ? blockchainList.data : []).filter(
        (b) => b != null && b.key != null && b.key !== '',
      ),
    [blockchainList.data],
  );

  // ── 启停：window.confirm 确认 → updateState(state 1/2)（对齐 statements 模式）。──
  const handleToggleState = React.useCallback(
    (node: NodeItem, state: number) => {
      const confirmKey =
        state === NODE_STATE.DISABLE ? 'confirmDisable' : 'confirmEnable';
      const typeName = node.blockchainName ?? '';
      if (
        !window.confirm(t(confirmKey, { type: typeName }))
      ) {
        return;
      }
      updateStateMutation.mutate(
        {
          blockchainId: node.blockchainId ?? '',
          nodeLocationId: node.nodeLocationId ?? '',
          state,
        },
        {
          onSuccess: () => toast.success(t('saveSuccess')),
          onError: () => toast.error(t('saveSuccess')),
        },
      );
    },
    [updateStateMutation, t],
  );

  // ── 删除：仅 setModalInfo.open=true，Modal 实现 + updateState(state:3) 由 bc-10 填充。──
  const handleOpenDelete = React.useCallback((node: NodeItem) => {
    const urlArr = Array.isArray(node.url) ? node.url : [];
    setModalInfo({
      open: true,
      url: urlArr.join('\n'),
      blockchainId: node.blockchainId ?? '',
      nodeLocationId: node.nodeLocationId ?? '',
    });
  }, []);

  const columns = React.useMemo<ColumnDef<NodeItem>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>
            {(pagination.pageNum - 1) * pagination.pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.chainName'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'nodeLocationName',
        header: t('field.nodeLocation'),
        cell: ({ row }) => (
          <span>{row.original.nodeLocationName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'url',
        header: t('field.url'),
        cell: ({ row }) => {
          const arr = row.original.url;
          const joined = Array.isArray(arr) ? arr.join('\n') : '';
          return <CopyableEllipsisText value={joined} maxWidth={240} />;
        },
      },
      {
        accessorKey: 'browserUrl',
        header: t('field.browserUrl'),
        cell: ({ row }) => {
          const href = row.original.browserUrl;
          if (!href) return <span>{EMPTY_DISPLAY}</span>;
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {href}
            </a>
          );
        },
      },
      {
        accessorKey: 'createTime',
        header: t('field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <BlockchainStatusBadge kind="node" status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-3">
              <PermissionGuard permission={BLOCKCHAIN_PERMISSIONS.NODE_EDIT_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/blockchain/node/edit?blockchainId=${
                        r.blockchainId ?? ''
                      }&nodeLocationId=${r.nodeLocationId ?? ''}`,
                    )
                  }
                >
                  {t('action.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={BLOCKCHAIN_PERMISSIONS.NODE_DISABLE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={r.status === NODE_STATE.DISABLE}
                  onClick={() => handleToggleState(r, NODE_STATE.DISABLE)}
                >
                  {t('action.disable')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={BLOCKCHAIN_PERMISSIONS.NODE_ENABLE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={r.status === NODE_STATE.ENABLE}
                  onClick={() => handleToggleState(r, NODE_STATE.ENABLE)}
                >
                  {t('action.enable')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={BLOCKCHAIN_PERMISSIONS.NODE_DELETE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0 text-red-600"
                  onClick={() => handleOpenDelete(r)}
                >
                  {t('action.delete')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [
      t,
      router,
      pagination.pageNum,
      pagination.pageSize,
      handleToggleState,
      handleOpenDelete,
    ],
  );

  const onSubmit = React.useCallback((f: NodeFilterForm) => {
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
          {/*
            链下拉：status!==1 的链单项 disabled（源码 node/index.tsx
            options.disabled: el.status === 1 ? false : true）。
            FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem。
          */}
          <Controller
            control={control}
            name="chainId"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="select-chainId"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('field.chainName')}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="select-chainId">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filter.all')}</SelectItem>
                    {blockchainOptions.map((b) => (
                      <SelectItem
                        key={b.key}
                        value={String(b.key ?? '')}
                        disabled={b.status !== 1}
                      >
                        {b.value ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <FormSelect
            name="nodeLocationId"
            control={control}
            label={t('field.nodeLocation')}
            options={nodeLocationOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="startCreateTime"
            control={control}
            label={t('field.createTime')}
          />
          <FormDatePicker
            name="endCreateTime"
            control={control}
            label={t('field.createTime')}
          />
          <FormSelect
            name="state"
            control={control}
            label={t('field.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
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
          <div className="text-sm font-semibold">{t('node.title')}</div>
          <PermissionGuard permission={BLOCKCHAIN_PERMISSIONS.NODE_ADD_BTN}>
            <Button onClick={() => router.push('/blockchain/node/edit')}>
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

      {/* 删除确认 Modal：输入 URL 严格校验 + updateState(state:3)。 */}
      <NodeDeleteModal
        modalInfo={modalInfo}
        onClose={() => setModalInfo(INITIAL_MODAL_INFO)}
      />
    </div>
  );
}
