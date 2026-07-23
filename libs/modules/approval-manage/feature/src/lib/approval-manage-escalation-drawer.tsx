'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@myorg/shared/ui';

import {
  useAddTaskApproveUserMutation,
  useWorkflowUserListQuery,
  type EscalationUser,
} from '@myorg/modules/approval-manage/data-access';
import { DEFAULT_PAGE_SIZE } from '@myorg/modules/approval-manage/util';

/**
 * ApprovalManageEscalationDrawer — 升级转办选人 Drawer。
 *
 * 迁移自 td-manage `src/pages/approval-manage/view.tsx` 的升级 Drawer（L865-1052）
 * + 升级相关逻辑（onFinishEscalation L243-270 / workflowUserList L441-454 /
 * 跨页选人 onChange/onSelect/onSelectAll L982-1010）。
 *
 * **45% 宽度（源 Drawer width='45%'）**：覆写 shadcn Drawer 默认 max-w-sm 为
 * `sm:w-[45vw] sm:max-w-[45vw]`（侧边抽屉，承载选人 Table）。
 *
 * **nodeOrderType Radio（源 L897-914）**：1=Before Current Node / 2=After Current Node，
 * 默认 '1'，必填。
 * **reason TextArea（源 L915-925）**：升级原因，必填。
 * **userName 查询（源 L928-961）**：Input + Query/Reset，触发 workflowUserList 重查。
 *
 * **选人 Table 跨页去重（源 L982-1010，核心竞态点）**：
 * 源用 `selectedRowKeys` state（跨页累积）+ `removeKeys.current` ref（本页取消项），
 * onChange 时 `Array.from(new Set([...rowKeys, ...keys])).filter(!removeKeys)`。
 *
 * 迁移用 `@tanstack/react-table` 的 **受控 rowSelection**（key=userId 字符串）实现
 * 跨页累积：state 由本组件持有（翻页不清空），`enableRowSelection` + 自定义
 * `onRowSelectionChange` 按「页内变更」做并集/差集（对应源 onChange），并用
 * `removeKeys` ref 兜底取消全选/单选的差集（对应源 onSelect/onSelectAll）。
 *
 * **过滤 userId 空项（运行时坑，计划 §8）**：workflowUserList 返回项可能 userId 为空，
 * dataSource 先 `filter(Boolean)`；提交时 approveUserIdList 仅保留非空。
 *
 * **提交 addTaskApproveUser（源 onFinishEscalation L243-269）**：
 * `{approveUserIdList, nodeOrderType:Number, reason, taskId}`；空选给出
 * `Please select user` 错误（源 setErrorMessage）；成功 close + onSuccess（刷详情/日志）。
 */

export interface ApprovalManageEscalationDrawerProps {
  open: boolean;
  taskId: number;
  busCode: string;
  /** tokenId 来自 approvedDetail.businessContent.tokenId（无则 0）。 */
  tokenId?: number;
  onClose: () => void;
  /** 提交成功回调（刷新详情 + 日志）。 */
  onSuccess?: () => void;
}

/** 升级表单值（源 form2：nodeOrderType + reason + userName 查询）。 */
interface EscalationFormValues {
  nodeOrderType: string;
  reason: string;
  userName: string;
}

/** rowKey = userId 字符串（源 Table rowKey="userId"）。 */
function userRowKey(user: EscalationUser): string {
  return user.userId === undefined || user.userId === null || user.userId === ''
    ? ''
    : String(user.userId);
}

export function ApprovalManageEscalationDrawer({
  open,
  taskId,
  busCode,
  tokenId,
  onClose,
  onSuccess,
}: ApprovalManageEscalationDrawerProps): React.JSX.Element {
  const t = useTranslations('modules.approval-manage');

  // ── 分页 + 查询参数（源 param state L117-123 / workflowUserList L441-454） ─────
  const [page, setPage] = React.useState({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [userName, setUserName] = React.useState('');

  const userListQuery = useWorkflowUserListQuery(
    {
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      businessCode: busCode,
      tokenId: tokenId ?? 0,
      userName,
    },
    open, // 仅 Drawer 打开时查询（源 useEffect[param]）。
  );

  // dataSource：过滤 userId 空项（运行时坑 §8），注入稳定 id（react-table 要求）。
  const rows = React.useMemo<EscalationUser[]>(
    () =>
      (userListQuery.data?.rows ?? [])
        .filter((u) => userRowKey(u) !== '')
        .map((u) => ({ ...u, id: userRowKey(u) })) as EscalationUser[],
    [userListQuery.data],
  );

  // ── 跨页选择状态（源 selectedRowKeys state + removeKeys ref） ─────────────────
  // selectedKeys：跨页累积的已选 userId（字符串）。removeKeys：本页待移除项（ref 兜底）。
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const removeKeysRef = React.useRef<string[]>([]);
  const [errorMessage, setErrorMessage] = React.useState('');

  // ── 表单（源 form2：nodeOrderType 默认 '1'，reason/userName） ─────────────────
  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EscalationFormValues>({
    defaultValues: { nodeOrderType: '1', reason: '', userName: '' },
  });

  // Drawer 打开时重置选择 + 表单 + 分页（源 open 按钮 L670-688）。
  React.useEffect(() => {
    if (open) {
      setErrorMessage('');
      setSelectedKeys([]);
      removeKeysRef.current = [];
      reset({ nodeOrderType: '1', reason: '', userName: '' });
      setPage({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
      setUserName('');
    }
  }, [open, reset]);

  // ── 选人 Table（受控 rowSelection，跨页累积） ─────────────────────────────────
  // rowSelection: { [userId]: boolean }，由本页可见行驱动勾选回显。
  const rowSelection = React.useMemo<RowSelectionState>(() => {
    const map: RowSelectionState = {};
    for (const r of rows) {
      const key = userRowKey(r);
      if (key && selectedKeys.includes(key)) map[key] = true;
    }
    return map;
  }, [rows, selectedKeys]);

  // 源 onChange（L985-997）：Array.from(new Set([...rowKeys, ...keys])).filter(!removeKeys)。
  // 此处按「页内勾选集 keys」与「累积集」求并集，再减去 removeKeys。
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = React.useCallback(
    (updater) => {
      const prev = rowSelection;
      const nextRowSel =
        typeof updater === 'function' ? updater(prev) : updater;
      // 本页已勾选的 userId（keys truthy）。
      const pageChecked = Object.keys(nextRowSel).filter((k) => nextRowSel[k]);
      const pageUnchecked = Object.keys(nextRowSel).filter((k) => !nextRowSel[k]);
      setSelectedKeys((prevKeys) => {
        // 并集（累积 + 本页新勾）。
        const merged = Array.from(new Set([...prevKeys, ...pageChecked]));
        // 差集（移除本页取消 + removeKeys.current 兜底，如取消全选）。
        const removeSet = new Set([...pageUnchecked, ...removeKeysRef.current]);
        removeKeysRef.current = [];
        return merged.filter((k) => !removeSet.has(k));
      });
      // 源 L992-996：空选给出 select 错误。
      const nextCheckedCount =
        pageChecked.length + (selectedKeys.length - pageUnchecked.length);
      setErrorMessage(
        nextCheckedCount <= 0
          ? t('PUB_Select', { field: t('approval_manage_0034') })
          : '',
      );
    },
    [rowSelection, selectedKeys.length, t],
  );

  const columns = React.useMemo<ColumnDef<EscalationUser>[]>(() => {
    // 角色列（源 L976-980 roles.join('、')）。
    const roleCell = (roles?: EscalationUser['roles']): string =>
      Array.isArray(roles) && roles.length > 0
        ? roles.map((r) => r?.roleName ?? '').filter(Boolean).join('、')
        : '';
    return [
      {
        accessorKey: 'userName',
        header: t('approval_manage_0026'),
        cell: ({ row }) => (
          <span>{row.original.userName || ''}</span>
        ),
      },
      {
        id: 'roles',
        header: t('approval_manage_0027'),
        cell: ({ row }) => <span>{roleCell(row.original.roles)}</span>,
      },
    ];
  }, [t]);

  const table = useReactTable<EscalationUser>({
    data: rows,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange,
    getRowId: (row) => userRowKey(row),
    getCoreRowModel: getCoreRowModel(),
  });

  // 单行取消勾选（源 onSelect L998-1002）：记录到 removeKeys。
  // react-table 的 onRowSelectionChange 已能捕获单行取消，但源对 onSelect 单选
  // 取消走 removeKeys 兜底，此处保留同等语义：勾选框 change 时若取消即记录。
  const handleRowCheckbox = React.useCallback(
    (row: Row<EscalationUser>, checked: boolean) => {
      if (!checked) {
        removeKeysRef.current = [userRowKey(row.original)];
      }
      row.toggleSelected(checked);
    },
    [],
  );

  // 全选/取消全选（源 onSelectAll L1003-1009）：取消时 removeKeys = 本页所有 userId。
  const allChecked =
    rows.length > 0 && rows.every((r) => selectedKeys.includes(userRowKey(r)));
  const handleToggleAll = React.useCallback(
    (checked: boolean) => {
      if (!checked) {
        removeKeysRef.current = rows.map((r) => userRowKey(r));
      }
      table.toggleAllRowsSelected(checked);
    },
    [rows, table],
  );

  // ── 提交（源 onFinishEscalation L243-269） ───────────────────────────────────
  const addMutation = useAddTaskApproveUserMutation();

  const onSubmit = handleSubmit((values) => {
    if (selectedKeys.length === 0) {
      // 源 L244-249：空选阻止提交。
      setErrorMessage(t('PUB_Select', { field: t('approval_manage_0034') }));
      return;
    }
    setErrorMessage('');
    addMutation.mutate(
      {
        approveUserIdList: selectedKeys,
        nodeOrderType: Number(values.nodeOrderType),
        reason: values.reason,
        taskId,
      },
      {
        onSuccess: () => {
          toast.success(t('escalation.success'));
          onSuccess?.();
          onClose();
        },
        onError: () => toast.error(t('escalation.error')),
      },
    );
  });

  const total = userListQuery.data?.page?.total ?? 0;
  const pageNum = page.pageNum;
  const pageSize = page.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent className="sm:w-[45vw] sm:max-w-[45vw]">
        <DrawerHeader>
          <DrawerTitle>{t('approval_manage_0022')}</DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 px-6 pb-6 pt-2"
          aria-label={t('approval_manage_0022')}
        >
          {/* nodeOrderType Radio（源 L897-914）：1=Before / 2=After Current Node。 */}
          <Controller
            control={control}
            name="nodeOrderType"
            rules={{ required: t('escalation.nodeTypeRequired') }}
            render={({ field }) => (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('approval_manage_0024')}
                  <span className="ml-0.5 text-destructive">*</span>
                </span>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="1" />
                    {t('workflow_node_type_1')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="2" />
                    {t('workflow_node_type_2')}
                  </label>
                </RadioGroup>
              </div>
            )}
          />

          {/* reason TextArea（源 L915-925）：升级原因，必填。 */}
          <Controller
            control={control}
            name="reason"
            rules={{ required: t('approval_manage_0028') }}
            render={({ field }) => (
              <div>
                <label
                  htmlFor="escalation-reason"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('approval_manage_0028')}
                  <span className="ml-0.5 text-destructive">*</span>
                </label>
                <Textarea
                  id="escalation-reason"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={!!errors.reason}
                />
                {errors.reason ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('escalation.reasonRequired')}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* userName 查询（源 L926-962）。 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="escalation-username"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('approval_manage_0025')}
              </label>
              <Input
                id="escalation-username"
                placeholder={t('approval_manage_0025')}
                {...register('userName')}
              />
              {errorMessage ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setUserName(getValues('userName') ?? '');
                  setPage((prev) => ({ ...prev, pageNum: 1 }));
                }}
              >
                {t('PUB_Query')}
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 underline"
                onClick={() => {
                  setValue('userName', '');
                  setUserName('');
                  setPage((prev) => ({ ...prev, pageNum: 1 }));
                }}
              >
                {t('PUB_Reset')}
              </Button>
            </div>
          </div>

          {/* 选人 Table（跨页去重，受控 rowSelection）。 */}
          <div className="overflow-hidden rounded-md border">
            <table className="w-full caption-bottom text-sm">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    <th
                      scope="col"
                      className="h-10 w-10 px-4 text-left align-middle font-medium text-muted-foreground"
                    >
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(v) => handleToggleAll(v === true)}
                        aria-label="Select all"
                      />
                    </th>
                    {headerGroup.headers
                      .filter((h) => h.column.id !== 'select')
                      .map((header) => (
                        <th
                          key={header.id}
                          scope="col"
                          className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </th>
                      ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {t('escalation.empty')}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t transition-colors hover:bg-muted/50"
                    >
                      <td className="px-4 py-2 align-middle">
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(v) =>
                            handleRowCheckbox(row, v === true)
                          }
                          aria-label={`Select ${row.original.userName ?? ''}`}
                        />
                      </td>
                      {row
                        .getVisibleCells()
                        .filter((c) => c.column.id !== 'select')
                        .map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-2 align-middle"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页（源 L1011-1018）。 */}
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum <= 1}
              onClick={() => setPage((prev) => ({ ...prev, pageNum: 1 }))}
            >
              {'«'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum <= 1}
              onClick={() =>
                setPage((prev) => ({ ...prev, pageNum: prev.pageNum - 1 }))
              }
            >
              {'‹'}
            </Button>
            <span>
              {pageNum} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum >= totalPages}
              onClick={() =>
                setPage((prev) => ({ ...prev, pageNum: prev.pageNum + 1 }))
              }
            >
              {'›'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum >= totalPages}
              onClick={() =>
                setPage((prev) => ({ ...prev, pageNum: totalPages }))
              }
            >
              {'»'}
            </Button>
          </div>

          {/* 升级提示（源 L1021-1035）。 */}
          <div className="flex text-primary">
            <div className="flex-1 text-xs text-muted-foreground">
              {t('approval_manage_0023')}
              <span className="cursor-pointer">
                {t('approval_manage_0032')}
              </span>
            </div>
          </div>

          {/* 操作按钮（源 L1036-1048）。 */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {t('PUB_Submit')}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

export default ApprovalManageEscalationDrawer;
