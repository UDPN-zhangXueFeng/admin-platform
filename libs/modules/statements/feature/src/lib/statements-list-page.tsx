'use client';

/* eslint-disable @nx/enforce-module-boundaries -- nx 误报 data-access lazy-loaded（同 detail-content），疑边界 case */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  Button,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useBlockchainListQuery,
  useCreateExportRuleMutation,
  useExportRuleListQuery,
  useOperateExportRuleMutation,
  usePermissionEmailsMutation,
  useStablecoinSearchesQuery,
  type ExportRule,
  type ExportRuleListFilters,
} from '@myorg/modules/statements/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  EXPORT_FREQUENCY_VALUES,
  NOTIFY_EMAIL_MAX_LENGTH,
  RULE_OPERATE_DELETE,
  RULE_OPERATE_DISABLE,
  RULE_OPERATE_ENABLE,
  RULE_STATE_ACTIVE,
  RULE_STATE_INACTIVE,
  RULE_STATUS_META,
  getTxTypesByIssueType,
  resolveFrequencyMessageKey,
  resolveTokenTypeMessageKey,
  statusToneClass,
  validateNotifyEmail,
} from '@myorg/modules/statements/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

interface RuleFilterForm {
  tokenId: string;
  blockchainId: string;
  exportStrategy: string;
  createTimeFrom: string;
  createTimeTo: string;
  lastExecutedFrom: string;
  lastExecutedTo: string;
  status: string;
}

const EMPTY_FILTER: RuleFilterForm = {
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  exportStrategy: ALL_VALUE,
  createTimeFrom: '',
  createTimeTo: '',
  lastExecutedFrom: '',
  lastExecutedTo: '',
  status: ALL_VALUE,
};

function formToFilters(f: RuleFilterForm): ExportRuleListFilters {
  return {
    tokenId: f.tokenId !== ALL_VALUE ? f.tokenId : undefined,
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    exportStrategy:
      f.exportStrategy !== ALL_VALUE ? Number(f.exportStrategy) : undefined,
    createStartTime: f.createTimeFrom
      ? startOfDay(parseISO(f.createTimeFrom)).getTime()
      : undefined,
    createEndTime: f.createTimeTo
      ? endOfDay(parseISO(f.createTimeTo)).getTime()
      : undefined,
    lastExecutedStartTime: f.lastExecutedFrom
      ? startOfDay(parseISO(f.lastExecutedFrom)).getTime()
      : undefined,
    lastExecutedEndTime: f.lastExecutedTo
      ? endOfDay(parseISO(f.lastExecutedTo)).getTime()
      : undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
  };
}

interface NewRuleForm {
  taskName: string;
  tokenId: string;
  tokenType: string;
  txTypes: number[];
  exportStrategy: number;
  notifyEmail: string;
  selectAllUsers: boolean;
}

const EMPTY_RULE: NewRuleForm = {
  taskName: '',
  tokenId: '',
  tokenType: '',
  txTypes: [],
  exportStrategy: 1,
  notifyEmail: '',
  selectAllUsers: false,
};

/**
 * StatementsListPage — 导出规则列表页 + New Drawer 新建规则表单。
 *
 * 迁移自 td-manage src/pages/financial/statements/index.tsx（583 行）。
 * useCustomTable → RHF + DataTable。Drawer 新建规则表单（taskId 联动 txTypes +
 * tokenType / txTypes 多选 / exportStrategy Radio / notifyEmail 邮箱校验 /
 * selectAllUsers 全选回填）。
 */
export function StatementsListPage() {
  const t = useTranslations('modules.statements');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<RuleFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<RuleFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useExportRuleListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();
  const operateMutation = useOperateExportRuleMutation();
  const createMutation = useCreateExportRuleMutation();
  const permissionEmailsMutation = usePermissionEmailsMutation();

  // Drawer 表单
  const {
    control: ruleControl,
    register: ruleRegister,
    handleSubmit: ruleSubmit,
    reset: ruleReset,
    setValue: ruleSetValue,
    watch: ruleWatch,
    formState: ruleFormState,
  } = useForm<NewRuleForm>({ defaultValues: EMPTY_RULE });
  const [txTypeOptions, setTxTypeOptions] = React.useState<number[]>([]);

  const tokenNameOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: s.name ?? '',
      })),
    ],
    [t, stablecoinSearches.data],
  );
  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainList.data ?? []).map((b) => ({
        value: String(b.key ?? ''),
        label: b.value ?? '',
      })),
    ],
    [t, blockchainList.data],
  );
  const frequencyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...EXPORT_FREQUENCY_VALUES.map((v) => ({
        value: String(v),
        label: t(`frequency.${v}`),
      })),
    ],
    [t],
  );
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: String(RULE_STATE_ACTIVE), label: t('status.active') },
      { value: String(RULE_STATE_INACTIVE), label: t('status.inactive') },
    ],
    [t],
  );

  const handleOperate = React.useCallback(
    (rule: ExportRule, state: number, confirmKey: string) => {
      if (!window.confirm(t(confirmKey, { taskName: rule.taskName ?? '' })))
        return;
      operateMutation.mutate(
        { exportRuleId: rule.exportRuleId ?? 0, state },
        {
          onSuccess: () => toast.success(t('operateSuccess')),
          onError: () => toast.error(t('operateSuccess')),
        },
      );
    },
    [operateMutation, t],
  );

  const columns = React.useMemo<ColumnDef<ExportRule>[]>(
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
        accessorKey: 'taskName',
        header: t('field.taskName'),
        cell: ({ row }) => (
          <span>{row.original.taskName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenName',
        header: t('field.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const k = resolveTokenTypeMessageKey(row.original.tokenType);
          return <span>{k ? t(k) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'exportStrategy',
        header: t('field.exportStrategy'),
        cell: ({ row }) => {
          const k = resolveFrequencyMessageKey(row.original.exportStrategy);
          return <span>{k ? t(k) : EMPTY_DISPLAY}</span>;
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
        accessorKey: 'lastExecutedTime',
        header: t('field.lastExecutedTime'),
        cell: ({ row }) => (
          <span>
            {row.original.lastExecutedTime
              ? formatDate(row.original.lastExecutedTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const meta = RULE_STATUS_META[row.original.status ?? 0];
          return meta ? (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
                meta.tone,
              )}`}
            >
              {t(meta.labelKey)}
            </span>
          ) : (
            <span>{EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-3">
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/statements/view?id=${r.exportRuleId}`)
                }
              >
                {t('action.view')}
              </Button>
              {r.status === RULE_STATE_ACTIVE ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    handleOperate(r, RULE_OPERATE_DISABLE, 'confirmDisable')
                  }
                >
                  {t('action.disable')}
                </Button>
              ) : null}
              {r.status === RULE_STATE_INACTIVE ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    handleOperate(r, RULE_OPERATE_ENABLE, 'confirmEnable')
                  }
                >
                  {t('action.enable')}
                </Button>
              ) : null}
              {r.status === RULE_STATE_INACTIVE ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-red-600"
                  onClick={() =>
                    handleOperate(r, RULE_OPERATE_DELETE, 'confirmDelete')
                  }
                >
                  {t('action.delete')}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, router, pagination.pageNum, pagination.pageSize, handleOperate],
  );

  const onSubmit = React.useCallback((f: RuleFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  // Drawer
  const openDrawer = () => {
    ruleReset(EMPTY_RULE);
    setTxTypeOptions([]);
    setDrawerOpen(true);
  };
  const onTokenChange = (value: string) => {
    const opt = stablecoinSearches.data?.find(
      (s) => String(s.stablecoinId) === value,
    );
    setTxTypeOptions([...getTxTypesByIssueType(opt?.issueType)]);
    ruleSetValue('txTypes', []);
    ruleSetValue(
      'tokenType',
      opt ? t(`tokenType.${opt.issueType}`) : '',
    );
  };
  const onRuleSubmit = (v: NewRuleForm) => {
    createMutation.mutate(
      {
        exportStrategy: v.exportStrategy,
        taskName: v.taskName,
        tokenId: v.tokenId,
        txTypes: v.txTypes,
        notifyEmail: v.notifyEmail || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('createSuccess'));
          setDrawerOpen(false);
        },
        onError: () => toast.error(t('createSuccess')),
      },
    );
  };
  const onSelectAllUsers = (checked: boolean) => {
    ruleSetValue('selectAllUsers', checked);
    if (checked) {
      permissionEmailsMutation.mutate(2, {
        onSuccess: (emails) => ruleSetValue('notifyEmail', emails.join(', ')),
      });
    } else {
      ruleSetValue('notifyEmail', '');
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="tokenId"
            control={control}
            label={t('field.tokenName')}
            options={tokenNameOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('field.blockchain')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="exportStrategy"
            control={control}
            label={t('field.exportStrategy')}
            options={frequencyOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createTimeFrom"
            control={control}
            label={t('field.createTimeFrom')}
          />
          <FormDatePicker
            name="createTimeTo"
            control={control}
            label={t('field.createTimeTo')}
          />
          <FormDatePicker
            name="lastExecutedFrom"
            control={control}
            label={t('field.lastExecutedFrom')}
          />
          <FormDatePicker
            name="lastExecutedTo"
            control={control}
            label={t('field.lastExecutedTo')}
          />
          <FormSelect
            name="status"
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
          <div className="text-sm font-semibold">{t('list.title')}</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/statements/export')}
            >
              {t('action.export')}
            </Button>
            <Button onClick={openDrawer}>{t('action.new')}</Button>
          </div>
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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('newRule')}</DrawerTitle>
          </DrawerHeader>
          <form
            onSubmit={ruleSubmit(onRuleSubmit)}
            className="space-y-4 px-6 pb-8"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.taskName')}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                {...ruleRegister('taskName', { required: true, maxLength: 50 })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.tokenName')}
                <span className="text-red-500">*</span>
              </label>
              <Controller
                control={ruleControl}
                name="tokenId"
                rules={{ required: true }}
                render={({ field }) => (
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      onTokenChange(e.target.value);
                    }}
                  >
                    <option value="">{t('filter.all')}</option>
                    {(stablecoinSearches.data ?? []).map((s) => (
                      <option
                        key={s.stablecoinId}
                        value={String(s.stablecoinId)}
                      >
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.tokenType')}
              </label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                disabled
                value={ruleWatch('tokenType')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.txTypes')}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {txTypeOptions.map((tx) => (
                  <label
                    key={tx}
                    className="flex items-center gap-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={ruleWatch('txTypes').includes(tx)}
                      onChange={(e) => {
                        const cur = ruleWatch('txTypes');
                        ruleSetValue(
                          'txTypes',
                          e.target.checked
                            ? [...cur, tx]
                            : cur.filter((x) => x !== tx),
                        );
                      }}
                    />
                    {t(`txType.${tx}`)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.exportType')}
              </label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                disabled
                value="Excel"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.exportStrategy')}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {EXPORT_FREQUENCY_VALUES.map((f) => (
                  <label
                    key={f}
                    className="flex items-center gap-1 text-sm"
                  >
                    <input
                      type="radio"
                      value={f}
                      {...ruleRegister('exportStrategy')}
                    />
                    {t(`frequency.${f}`)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.notifyEmail')}
              </label>
              <textarea
                className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                maxLength={NOTIFY_EMAIL_MAX_LENGTH}
                {...ruleRegister('notifyEmail', {
                  validate: (v) => validateNotifyEmail(v) ?? true,
                })}
              />
              {ruleFormState.errors.notifyEmail ? (
                <p className="text-xs text-red-500">
                  {t(`email.${ruleFormState.errors.notifyEmail.message}`)}
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleWatch('selectAllUsers')}
                onChange={(e) => onSelectAllUsers(e.target.checked)}
              />
              {t('field.selectAllUsers')}
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDrawerOpen(false)}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {t('action.submit')}
              </Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
