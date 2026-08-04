'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';

import {
  useCompletedListQuery,
  useCreateListQuery,
  useTodoListQuery,
  useWithdrawMutation,
  type ApprovalListFilters,
  type ApprovalListParams,
  type ApprovalTask,
} from '@myorg/modules/approval-manage/data-access';
import {
  APPROVAL_PERMISSIONS,
  APPROVAL_STATUS_COLOR,
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
} from '@myorg/modules/approval-manage/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * antd 色名 → Tailwind badge class（唯一取色真源）。
 *
 * 键覆盖源 antd Tag color 可能取到的色名：approvalStatus 硬编码
 * `{1:orange, 2:error, 3:success}` + `approval_task_status_color_${n}` 返回的
 * processing/gray/success；未知色名回落 default（gray）。结构与 blockchain
 * status-badge 一致（各模块自洽，不跨模块复用，见 Rule 8）。
 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

/** tone → Tailwind badge class。未知 tone 回落 default。 */
function toneClass(tone?: string): string {
  return (tone && TONE_CLASS[tone]) || TONE_CLASS.default;
}

/**
 * 已补全 i18n 词条的状态码集合（防御 next-intl 对缺失 key 抛错）。
 *
 * approvalStatus（Tab1/2）源硬编码 {1,2,3}；taskStatus（Tab3）照 common.json
 * 补全 11 个值。后端返回集合外状态码时回退占位（避免 MISSING_MESSAGE 抛错）。
 */
const APPROVAL_STATUS_VALUES = new Set([1, 2, 3]);
const TASK_STATUS_VALUES = new Set([
  1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45,
]);

/**
 * ApprovalManageListPage — 审批中心列表页（三 Tab + 撤回 Modal）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/index.tsx`（428 行）。
 * 三个 `useCustomTable` → 三个 TanStack Query（服务端分页 pageNum）+ shadcn Tabs +
 * shadcn DataTable。Tab1/2（待审批 / 已审批）用 `approvalStatus`（色名走
 * `APPROVAL_STATUS_COLOR` 硬编码 {1:orange,2:error,3:success}，文案 `common_approval_status_`）；
 * Tab3（我发起）用 `taskStatus`（色名 + 文案均走 i18n：`approval_task_status_color_` /
 * `common_task_status_`），行操作含 Withdraw（仅 `taskStatus===5 && withdrawType===1`）。
 *
 * **rowKey 差异**：Tab1/3 = taskId，Tab2 = detailId（data-access 已按此注入字符串 id）。
 * **序号列纠正**：源用 `businessName` 作序号 dataIndex（index.tsx:53/143/232，疑似 bug），
 * 迁移改为分页偏移 + index + 1（同 statements 模式）。
 * **Tab3 无 approvalTime 列**（源 index.tsx Tab3 columns 无该项）。
 *
 * **i18n namespace**：`common_approval_status_*` / `common_task_status_*` /
 * `approval_task_status_color_*` 词条已复制到 `modules.approval-manage` 命名空间
 * （扁平 key，同 blockchain 模式），避免 next-intl 对缺失 key 抛错。色名经 TONE_CLASS
 * 映射到 Tailwind class（呼应源 antd Tag）。
 */
export function ApprovalManageListPage() {
  const t = useTranslations('modules.approval-manage');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开（同 wallet/posting-engine 模式）。 */
  const canView =
    authPermissions.size === 0 || authPermissions.has(APPROVAL_PERMISSIONS.View);
  const canWithdraw =
    authPermissions.size === 0 || authPermissions.has(APPROVAL_PERMISSIONS.Withdraw);

  // ── 三 Tab 各自分页（独立 pageNum，服务端分页） ─────────────────────────────
  const makeParams = React.useCallback(
    (pageNum: number, pageSize: number): ApprovalListParams<ApprovalListFilters> => ({
      pageNum,
      pageSize,
      filters: {},
    }),
    [],
  );

  const [todoPage, setTodoPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [completedPage, setCompletedPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [createdPage, setCreatedPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const todoResult = useTodoListQuery(makeParams(todoPage.pageNum, todoPage.pageSize));
  const completedResult = useCompletedListQuery(
    makeParams(completedPage.pageNum, completedPage.pageSize),
  );
  const createdResult = useCreateListQuery(
    makeParams(createdPage.pageNum, createdPage.pageSize),
  );

  // ── 撤回 Modal ───────────────────────────────────────────────────────────────
  const [withdrawTarget, setWithdrawTarget] = React.useState<{
    busCode: string;
    taskId: number;
  } | null>(null);
  const withdrawMutation = useWithdrawMutation();

  interface WithdrawForm {
    remarks: string;
  }
  const {
    register: registerRemarks,
    handleSubmit: handleWithdrawSubmit,
    reset: resetWithdraw,
    formState: { errors: remarksErrors },
  } = useForm<WithdrawForm>({ defaultValues: { remarks: '' } });

  const openWithdraw = React.useCallback(
    (row: ApprovalTask) => {
      setWithdrawTarget({
        busCode: String(row.businessCode ?? ''),
        taskId: Number(row.taskId ?? 0),
      });
      resetWithdraw({ remarks: '' });
    },
    [resetWithdraw],
  );

  const closeWithdraw = React.useCallback(() => {
    setWithdrawTarget(null);
    resetWithdraw({ remarks: '' });
  }, [resetWithdraw]);

  const onWithdrawSubmit = React.useCallback(
    (values: WithdrawForm) => {
      if (!withdrawTarget) return;
      withdrawMutation.mutate(
        {
          busCode: withdrawTarget.busCode,
          taskId: withdrawTarget.taskId,
          remarks: values.remarks,
        },
        {
          onSuccess: () => {
            toast.success(t('list.withdraw.success'));
            closeWithdraw();
          },
          onError: () => toast.error(t('list.withdraw.error')),
        },
      );
    },
    [withdrawTarget, withdrawMutation, t, closeWithdraw],
  );

  // ── 跳详情（源 actionClick View：id=taskId & busCode=businessCode） ────────────
  const goDetail = React.useCallback(
    (row: ApprovalTask) => {
      router.push(
        `/approval-manage/view?id=${row.taskId ?? ''}&busCode=${row.businessCode ?? ''}`,
      );
    },
    [router],
  );

  // ── Tab1/2 共用列工厂（approvalStatus 状态列，含 approvalTime） ────────────────
  const buildApprovalColumns = React.useCallback(
    (): ColumnDef<ApprovalTask>[] => [
      {
        accessorKey: 'businessName',
        header: t('list.field.type'),
        cell: ({ row }) => (
          <span>{row.original.businessName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'businessDesc',
        header: t('list.field.desc'),
        cell: ({ row }) => (
          <span>{row.original.businessDesc || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'createUserName',
        header: t('list.field.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUserName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('list.field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'approvalTime',
        header: t('list.field.approvalTime'),
        cell: ({ row }) => (
          <span>
            {row.original.approvalTime
              ? formatDate(row.original.approvalTime, DATETIME_FMT)
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'approvalStatus',
        header: t('list.field.status'),
        cell: ({ row }) => (
          <ApprovalStatusBadge status={row.original.approvalStatus} />
        ),
      },
    ],
    [t],
  );

  // ── Tab1 columns（序号 + approval 列 + Detail） ───────────────────────────────
  const todoColumns = React.useMemo<ColumnDef<ApprovalTask>[]>(
    () => [
      {
        id: 'index',
        header: t('list.field.index'),
        cell: ({ row }) => (
          <span>
            {(todoPage.pageNum - 1) * todoPage.pageSize + row.index + 1}
          </span>
        ),
      },
      ...buildApprovalColumns(),
      {
        id: 'actions',
        header: t('list.field.actions'),
        cell: ({ row }) =>
          canView ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => goDetail(row.original)}
            >
              {t('list.action.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>
          ),
      },
    ],
    [t, todoPage.pageNum, todoPage.pageSize, buildApprovalColumns, canView, goDetail],
  );

  // ── Tab2 columns（同 Tab1，序号偏移用 completedPage） ──────────────────────────
  const completedColumns = React.useMemo<ColumnDef<ApprovalTask>[]>(
    () => [
      {
        id: 'index',
        header: t('list.field.index'),
        cell: ({ row }) => (
          <span>
            {(completedPage.pageNum - 1) * completedPage.pageSize + row.index + 1}
          </span>
        ),
      },
      ...buildApprovalColumns(),
      {
        id: 'actions',
        header: t('list.field.actions'),
        cell: ({ row }) =>
          canView ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => goDetail(row.original)}
            >
              {t('list.action.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>
          ),
      },
    ],
    [
      t,
      completedPage.pageNum,
      completedPage.pageSize,
      buildApprovalColumns,
      canView,
      goDetail,
    ],
  );

  // ── Tab3 columns（无 approvalTime，状态用 taskStatus + Withdraw 操作） ──────────
  const createdColumns = React.useMemo<ColumnDef<ApprovalTask>[]>(
    () => [
      {
        id: 'index',
        header: t('list.field.index'),
        cell: ({ row }) => (
          <span>
            {(createdPage.pageNum - 1) * createdPage.pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'businessName',
        header: t('list.field.type'),
        cell: ({ row }) => (
          <span>{row.original.businessName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'businessDesc',
        header: t('list.field.desc'),
        cell: ({ row }) => (
          <span>{row.original.businessDesc || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'createUserName',
        header: t('list.field.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUserName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('list.field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'taskStatus',
        header: t('list.field.status'),
        cell: ({ row }) => (
          <TaskStatusBadge status={row.original.taskStatus} />
        ),
      },
      {
        id: 'actions',
        header: t('list.field.actions'),
        cell: ({ row }) => {
          // 源 disabled 条件：!(taskStatus===5 && withdrawType===1)。
          const canWithdrawRow =
            row.original.taskStatus === 5 && row.original.withdrawType === 1;
          return (
            <div className="flex gap-3">
              {canWithdraw && canWithdrawRow ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openWithdraw(row.original)}
                >
                  {t('list.action.withdraw')}
                </Button>
              ) : null}
              {canView ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => goDetail(row.original)}
                >
                  {t('list.action.detail')}
                </Button>
              ) : (
                <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>
              )}
            </div>
          );
        },
      },
    ],
    [
      t,
      createdPage.pageNum,
      createdPage.pageSize,
      canWithdraw,
      canView,
      openWithdraw,
      goDetail,
    ],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="todo">
        <TabsList>
          <TabsTrigger value="todo">{t('list.tab.todo')}</TabsTrigger>
          <TabsTrigger value="completed">{t('list.tab.completed')}</TabsTrigger>
          <TabsTrigger value="created">{t('list.tab.created')}</TabsTrigger>
        </TabsList>

        <TabsContent value="todo">
          <ApprovalTablePanel
            title={t('list.title')}
            columns={todoColumns}
            result={todoResult}
            emptyMessage={t('list.empty')}
            pageNum={todoPage.pageNum}
            pageSize={todoPage.pageSize}
            onPageChange={(page) =>
              setTodoPage((prev) => ({ ...prev, pageNum: page }))
            }
          />
        </TabsContent>

        <TabsContent value="completed">
          <ApprovalTablePanel
            title={t('list.title')}
            columns={completedColumns}
            result={completedResult}
            emptyMessage={t('list.empty')}
            pageNum={completedPage.pageNum}
            pageSize={completedPage.pageSize}
            onPageChange={(page) =>
              setCompletedPage((prev) => ({ ...prev, pageNum: page }))
            }
          />
        </TabsContent>

        <TabsContent value="created">
          <ApprovalTablePanel
            title={t('list.title')}
            columns={createdColumns}
            result={createdResult}
            emptyMessage={t('list.empty')}
            pageNum={createdPage.pageNum}
            pageSize={createdPage.pageSize}
            onPageChange={(page) =>
              setCreatedPage((prev) => ({ ...prev, pageNum: page }))
            }
          />
        </TabsContent>
      </Tabs>

      {/* 撤回 Modal：remarks 必填，成功 resetFields + close + invalidate(Tab3) */}
      <Dialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeWithdraw();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('list.withdraw.title')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleWithdrawSubmit(onWithdrawSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" htmlFor="withdraw-remarks">
                {t('list.withdraw.remarks')}
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Textarea
                id="withdraw-remarks"
                placeholder={t('list.withdraw.remarksPlaceholder')}
                {...registerRemarks('remarks', { required: true })}
              />
              {remarksErrors.remarks ? (
                <p className="text-sm text-destructive" role="alert">
                  {t('list.withdraw.remarksRequired')}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeWithdraw}>
                {t('list.withdraw.cancel')}
              </Button>
              <Button type="submit" disabled={withdrawMutation.isPending}>
                {t('list.withdraw.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 状态 badge ──────────────────────────────────────────────────────────────────

/**
 * Tab1/2 approvalStatus badge。源 antd Tag color 走 `APPROVAL_STATUS_COLOR`
 * 硬编码 `{1:orange, 2:error, 3:success}`（不走 i18n），文案 `common_approval_status_${n}`。
 */
function ApprovalStatusBadge({ status }: { status?: number }) {
  const t = useTranslations('modules.approval-manage');
  if (status == null) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }
  const color = APPROVAL_STATUS_COLOR[status];
  // 防御：approvalStatus 非预期值时回退占位，避免 next-intl 对缺失 key 抛错。
  if (!color || !APPROVAL_STATUS_VALUES.has(status)) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }
  const labelKey = `common_approval_status_${status}` as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(color)}`}
    >
      {t(labelKey)}
    </span>
  );
}

/**
 * Tab3 taskStatus badge。源色名走 i18n `approval_task_status_color_${n}`（返回 antd 色名），
 * 文案 `common_task_status_${n}`。色名经 TONE_CLASS 映射 Tailwind class（呼应源 Tag）。
 */
function TaskStatusBadge({ status }: { status?: number }) {
  const t = useTranslations('modules.approval-manage');
  if (status == null) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }
  const colorKey = `approval_task_status_color_${status}` as const;
  const labelKey = `common_task_status_${status}` as const;
  // 防御：taskStatus 非预期值时回退占位，避免 next-intl 对缺失 key 抛错。
  if (!TASK_STATUS_VALUES.has(status)) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }
  const color = t(colorKey);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(color)}`}
    >
      {t(labelKey)}
    </span>
  );
}

// ── 表格面板（标题 + DataTable + 服务端分页） ───────────────────────────────────

interface PanelProps {
  title: string;
  columns: ColumnDef<ApprovalTask>[];
  result: ReturnType<typeof useTodoListQuery>;
  emptyMessage: string;
  pageNum: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function ApprovalTablePanel({
  title,
  columns,
  result,
  emptyMessage,
  pageNum,
  pageSize,
  onPageChange,
}: PanelProps) {
  const rows = result.data?.rows ?? [];
  const total = result.data?.page?.total ?? 0;
  const isLoading = result.isLoading || result.isFetching;
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      <div className="p-4">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          pagination={{
            page: pageNum,
            pageSize,
            total,
            onPageChange,
          }}
        />
      </div>
    </div>
  );
}
