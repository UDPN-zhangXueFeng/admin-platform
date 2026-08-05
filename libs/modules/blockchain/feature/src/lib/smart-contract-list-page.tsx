'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { CircleHelp } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  DataTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useDownloadSmartContractMutation,
  useSmartContractListQuery,
  type SmartContractItem,
  type SmartContractListFilters,
} from '@myorg/modules/blockchain/data-access';
import {
  BLOCKCHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  DEPLOYMENT_TYPE_LABEL_KEY_PREFIX,
  EMPTY_DISPLAY,
} from '@myorg/modules/blockchain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * SmartContractListPage — 智能合约包列表页（含 blob 下载）。
 *
 * 迁移自 td-manage src/pages/blockchain/smart-contract/index.tsx（163 行）。
 * useCustomTable → react-hook-form + DataTable。
 *
 * 2 个筛选条件：包名（Input）/ 创建时间（RangePicker）。
 *
 * 硬约束（本模块特有）：
 * - 列表请求体分页字段为 pageNum（非 page），对齐 RBAC/sys 域后端（文档 3.1）。
 * - 序号列 `index + 1`（源码 `render: (text, record, index) => ${index + 1}`，本页 raw 行号，不分页累加）。
 * - type 列：`type === 1 ? t('type_1') : t('type_5')`（源码二分支，非查表）。
 * - 顶部「新增」按钮受 SC_ADD_BTN 权限码控制，**仅 Tooltip 提示（blockchain_0013），无 actionClick 跳转**
 *   （源码 actionClick 的 switch 无 'Add' 分支，照搬为信息按钮，见文档第 8 章「已知限制」）。
 * - 行「下载」受 SC_DOWNLOAD_BTN 控制，调 useDownloadSmartContractMutation：
 *   blob → 解析 content-disposition `utf-8''` 取文件名 → URL.createObjectURL + <a> 点击 → 成功 Toast。
 *   下载逻辑封装在 data-access 的 downloadSmartContract（bc-4 实现），mutation 成功后 invalidate smart-contract list。
 */
interface SmartContractFilterForm {
  /** 包名（模糊，对应后端 smartPackageName）。 */
  smartPackageName: string;
  /** 创建时间起。 */
  startCreateTime: string;
  /** 创建时间止。 */
  endCreateTime: string;
}

const EMPTY_FILTER: SmartContractFilterForm = {
  smartPackageName: '',
  startCreateTime: '',
  endCreateTime: '',
};

function formToFilters(f: SmartContractFilterForm): SmartContractListFilters {
  return {
    smartPackageName: f.smartPackageName || undefined,
    startCreateTime: f.startCreateTime
      ? startOfDay(parseISO(f.startCreateTime)).getTime()
      : undefined,
    endCreateTime: f.endCreateTime
      ? endOfDay(parseISO(f.endCreateTime)).getTime()
      : undefined,
  };
}

export function SmartContractListPage(): React.JSX.Element {
  const t = useTranslations('modules.blockchain');

  const { control, register, handleSubmit, reset } =
    useForm<SmartContractFilterForm>({
      defaultValues: EMPTY_FILTER,
    });
  const [queryValues, setQueryValues] =
    React.useState<SmartContractFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useSmartContractListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const downloadMutation = useDownloadSmartContractMutation();

  const handleDownload = React.useCallback(
    (row: SmartContractItem) => {
      downloadMutation.mutate(
        {
          busId: String(row.packageId ?? ''),
          busType: row.busType ?? '',
        },
        {
          onSuccess: () => toast.success(t('downloadSuccess')),
          onError: () => toast.error(t('downloadFailed')),
        },
      );
    },
    [downloadMutation, t],
  );

  const columns = React.useMemo<ColumnDef<SmartContractItem>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        // 源码 `${index + 1}`：raw 行号，不分页累加（与 deployment/node 分页累加序号不同）。
        cell: ({ row }) => <span>{row.index + 1}</span>,
      },
      {
        accessorKey: 'packageNameWithSuffix',
        header: t('field.smartContractName'),
        cell: ({ row }) => (
          <span>{row.original.packageNameWithSuffix || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'packageVersion',
        header: t('field.version'),
        cell: ({ row }) => (
          <span>{row.original.packageVersion || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('field.type'),
        // 源码二分支：type === 1 ? type_1 : type_5（非查表）。
        cell: ({ row }) => {
          const type = row.original.type;
          const key =
            type === 1
              ? `${DEPLOYMENT_TYPE_LABEL_KEY_PREFIX}1`
              : `${DEPLOYMENT_TYPE_LABEL_KEY_PREFIX}5`;
          return <span>{t(key)}</span>;
        },
      },
      {
        accessorKey: 'contractLanguage',
        header: t('field.language'),
        cell: ({ row }) => (
          <span>{row.original.contractLanguage || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.releaseDate'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard permission={BLOCKCHAIN_PERMISSIONS.SC_DOWNLOAD_BTN}>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => handleDownload(r)}
              >
                {t('action.download')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, handleDownload],
  );

  const onSubmit = React.useCallback((f: SmartContractFilterForm) => {
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
          <FormField
            name="smartPackageName"
            label={t('field.smartContractName')}
            register={register('smartPackageName')}
            placeholder={t('field.smartContractName')}
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
          <div className="text-sm font-semibold">
            {t('smartContract.title')}
          </div>
          {/*
            顶部「新增」按钮（SC_ADD_BTN）：
            源码 CustomTableTitle Add 分支有 limit + Tooltip（blockchain_0013），
            但 actionClick 的 switch 无 'Add' case → 点击无效果（信息按钮，照搬）。
            见迁移文档第 8 章「smart-contract 新增按钮无 actionClick」。
          */}
          <PermissionGuard permission={BLOCKCHAIN_PERMISSIONS.SC_ADD_BTN}>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="link" className="h-auto p-0">
                    <span className="flex items-center">
                      {t('action.add')}
                      <CircleHelp className="ml-2 h-4 w-4" aria-hidden="true" />
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('blockchain_0013')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
    </div>
  );
}
