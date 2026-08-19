'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';

import {
  Badge,
  Button,
  createActionColumn,
  type TableRowAction,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  BANK_BUSINESS_CODES,
  BANK_BUSINESS_LABEL,
  BANK_DETAIL_STATUS_LABEL,
  BANK_STATUS_OPTIONS,
  COMMON_STATUS_LABEL,
  CONNECTIVITY_STATUS_LABEL,
  CONNECTIVITY_STATUS_VARIANT,
  KISSEN_PROJECT_ID,
  bankDetailStatusVariant,
  bankKeys,
  bankStatusVariant,
  testBankGateway,
  useBankApprovalDetailQuery,
  useBankApprovalDoneQuery,
  useBankApprovalTodoQuery,
  useBankDetailQuery,
  useBankLimitChangeMutation,
  useBankListQuery,
  useBankGatewayInfoQuery,
  usePreviousStepBankApprovalMutation,
  useProcessBankApprovalMutation,
  useRegisterBankGatewayMutation,
  useSaveBankMutation,
  useSubmitBankOnboardMutation,
  useToggleBankFreezeMutation,
  useWithdrawBankApprovalMutation,
  useCurrencyEnabledQuery,
  type BankApprovalDoneRow,
  type BankApprovalPageReq,
  type BankApprovalTodoRow,
  type BankApproveButtonDTO,
  type BankGatewayFormValues,
  type BankListFilter,
  type BankRow,
  type BankSaveReq,
  type CurrencyRow,
} from '@myorg/modules/kissen-admin/data-access';

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const STATUS_ALL = 'all';

/* ================================================================== */
/* 共用展示 helper（源 views/approval/format.ts 移植，bank 域内使用）     */
/* ================================================================== */

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss（源 formatTime，手写不引 dayjs）。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 数字千分位（保留原小数位；源 formatMoney）。 */
function formatMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '--';
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

function parseBankId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ================================================================== */
/* 状态徽标（约定 §5：纯展示组件 co-locate）                            */
/* ================================================================== */

function BankStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={bankStatusVariant(status)}>
      {COMMON_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function ConnectivityBadge({ status }: { status: number }) {
  const s = status ?? 0;
  return (
    <Badge variant={CONNECTIVITY_STATUS_VARIANT[s] ?? 'secondary'}>
      {CONNECTIVITY_STATUS_LABEL[s] ?? 'Unknown'}
    </Badge>
  );
}

/* ================================================================== */
/* 银行审批详情字段映射 + 值格式化（源 field-maps.ts/format.ts bank 子集）*/
/* ================================================================== */

interface FieldDef {
  key: string;
  label: string;
}

/** 银行审批业务字段顺序（源 FIELD_MAPS 的 kissen_bank_onboard / kissen_limit_change）。 */
const BANK_FIELD_MAPS: Record<string, FieldDef[]> = {
  [BANK_BUSINESS_CODES.onboard]: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'bankCode', label: 'Bank Code' },
    { key: 'bic', label: 'SWIFT BIC' },
    { key: 'currencies', label: 'Supported Currencies' },
    { key: 'singleLimit', label: 'Single Limit' },
    { key: 'dailyLimit', label: 'Daily Cumulative Limit' },
    { key: 'accountConfig', label: 'Account Config' },
    { key: 'kycInfo', label: 'KYC Information' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Created At' },
  ],
  [BANK_BUSINESS_CODES.limitChange]: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'oldSingleLimit', label: 'Original Single Limit' },
    { key: 'oldDailyLimit', label: 'Original Daily Cumulative Limit' },
    { key: 'newSingleLimit', label: 'New Single Limit' },
    { key: 'newDailyLimit', label: 'New Daily Cumulative Limit' },
  ],
};

/** 字段名 → 中文标签兜底词典（源 LABEL_DICT 子集 + limit 字段）。 */
const FIELD_LABEL_DICT: Record<string, string> = {
  bankId: 'Bank ID',
  changeId: 'Limit Change ID',
  bankName: 'Bank Name',
  bankCode: 'Bank Code',
  bic: 'SWIFT BIC',
  singleLimit: 'Single Limit',
  dailyLimit: 'Daily Cumulative Limit',
  oldSingleLimit: 'Original Single Limit',
  oldDailyLimit: 'Original Daily Cumulative Limit',
  newSingleLimit: 'New Single Limit',
  newDailyLimit: 'New Daily Cumulative Limit',
  accountConfig: 'Account Config',
  status: 'Status',
  kycInfo: 'KYC Information',
  createTime: 'Created At',
  currencies: 'Supported Currencies',
};

function fieldLabelFor(busCode: string, key: string): string {
  const map = BANK_FIELD_MAPS[busCode];
  const hit = map?.find((f) => f.key === key);
  return hit?.label ?? FIELD_LABEL_DICT[key] ?? key;
}

interface NestedValue {
  kind: 'nested';
  title: string;
  entries: Array<[string, unknown]>;
}

/**
 * 通用值格式化（启发式，源 formatFieldValue）：
 * null→'--' | 时间戳 | 布尔 | status 码 | 金额 | JSON 字符串递归 | 其余原样。
 */
function formatFieldValue(
  key: string,
  value: unknown,
): string | NestedValue {
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && !Array.isArray(value)) {
    return {
      kind: 'nested',
      title: key,
      entries: Object.entries(value as Record<string, unknown>),
    };
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const s = String(value);
    if (key === 'status' && /^\d+$/.test(s)) {
      const mapped = COMMON_STATUS_LABEL[Number(s)];
      if (mapped !== undefined) return mapped;
    }
    if (
      (/(time|date)/i.test(key) ||
        /^period/i.test(key) ||
        /(Start|End)$/.test(key)) &&
      /^\d{10,13}$/.test(s)
    ) {
      return formatTime(Number(s));
    }
    if (/(amount|limit|rate|total)/i.test(key) && /^-?\d+(\.\d+)?$/.test(s)) {
      return formatMoney(s);
    }
    const trimmed = s.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === 'object') {
          return {
            kind: 'nested',
            title: key,
            entries: Object.entries(parsed as Record<string, unknown>),
          };
        }
      } catch {
        /* 解析失败 → 原样显示 */
      }
    }
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

/** 审批业务内容条目（按字段映射顺序 + 额外字段）。 */
function buildContentEntries(
  busCode: string,
  content: Record<string, unknown> | undefined,
): Array<[string, string | NestedValue]> {
  const map = BANK_FIELD_MAPS[busCode];
  const src = content ?? {};
  const keys = map ? map.map((f) => f.key) : Object.keys(src);
  const keySet = new Set(keys);
  const extra = Object.keys(src).filter((k) => !keySet.has(k));
  return [...keys, ...extra].map(
    (k) => [k, formatFieldValue(k, src[k])] as [string, string | NestedValue],
  );
}

function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  return /^-?[\d,]+(\.\d+)?$/.test(v);
}

/* ================================================================== */
/* BankInfoListPage — 银行入网列表（源 onboard/bank/index.vue）          */
/* ================================================================== */

interface BankInfoFilterForm {
  bankName?: string;
  bankCode?: string;
  status?: string;
}
const EMPTY_BANK_FILTER: BankInfoFilterForm = {
  bankName: '',
  bankCode: '',
  status: STATUS_ALL,
};
function bankFormToParams(
  form: BankInfoFilterForm,
  pageNum: number,
  pageSize: number,
): { pageNum: number; pageSize: number; filter: BankListFilter } {
  const filter: BankListFilter = {};
  if (form.bankName) filter.bankName = form.bankName;
  if (form.bankCode) filter.bankCode = form.bankCode;
  if (form.status && form.status !== STATUS_ALL) filter.status = Number(form.status);
  return { pageNum, pageSize, filter };
}

export function BankInfoListPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, control } = useForm<BankInfoFilterForm>({
    defaultValues: EMPTY_BANK_FILTER,
  });
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [params, setParams] = React.useState(() =>
    bankFormToParams(EMPTY_BANK_FILTER, 1, PAGE_SIZE_DEFAULT),
  );


  const { data, isLoading } = useBankListQuery(KISSEN_PROJECT_ID, params);
  const submitMutation = useSubmitBankOnboardMutation(KISSEN_PROJECT_ID);
  const freezeMutation = useToggleBankFreezeMutation(KISSEN_PROJECT_ID);

  // 内联弹窗状态（源 index.vue 的三个 dialog）。
  const [limitChangeRow, setLimitChangeRow] = React.useState<BankRow | null>(null);
  const [gatewayRow, setGatewayRow] = React.useState<BankRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: BankInfoFilterForm) => {
      setParams(bankFormToParams(form, 1, pageSize));
    },
    [pageSize],
  );

  const onReset = React.useCallback(() => {
    reset(EMPTY_BANK_FILTER);
    setParams(bankFormToParams(EMPTY_BANK_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  const refreshList = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: bankKeys.lists(KISSEN_PROJECT_ID) });
  }, [queryClient]);

  /** 提交入网申请（草稿/被拒 → status 5 待审核）。源 submitOnboard。 */
  const onSubmitOnboard = React.useCallback(
    (row: BankRow) => {
      if (
        !window.confirm(`Confirm submitting the onboarding application for "${row.bankName}"? It will enter the approval center as a pending task after submission.`)
      )
        return;
      submitMutation.mutate(row.bankId, {
        onSuccess: () => toast.success('Onboarding application submitted'),
        onError: (e) => toast.error((e as Error).message),
      });
    },
    [submitMutation, toast],
  );

  /** 冻结（status 20→50，立即生效不走审批）。源 onFreeze。 */
  const onFreeze = React.useCallback(
    (row: BankRow) => {
      if (
        !window.confirm(
          `Confirm freezing bank "${row.bankName}"? Once frozen, the bank immediately exits quoting and matching, and its status becomes Disabled.`,
        )
      )
        return;
      freezeMutation.mutate(
        { bankId: row.bankId, freeze: true },
        {
          onSuccess: () => toast.success('Frozen'),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [freezeMutation, toast],
  );

  /** 解冻（status 50→20）。源 onUnfreeze。 */
  const onUnfreeze = React.useCallback(
    (row: BankRow) => {
      if (
        !window.confirm(
          `Confirm unfreezing bank "${row.bankName}"? Once unfrozen, the bank returns to Enabled and rejoins quoting and matching.`,
        )
      )
        return;
      freezeMutation.mutate(
        { bankId: row.bankId, freeze: false },
        {
          onSuccess: () => toast.success('Unfrozen'),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [freezeMutation, toast],
  );

  const columns = React.useMemo<ColumnDef<BankRow & { id: string }>[]>(() => {
    return [
      { accessorKey: 'bankName', header: 'Bank Name' },
      { accessorKey: 'bankCode', header: 'Bank Code' },
      {
        accessorKey: 'bic',
        header: 'SWIFT BIC',
        cell: ({ row }) => <span>{row.original.bic || '--'}</span>,
      },
      {
        accessorKey: 'currencies',
        header: 'Supported Currencies',
        cell: ({ row }) => (
          <span>{row.original.currencies?.length ? row.original.currencies.join(', ') : '--'}</span>
        ),
      },
      {
        id: 'connectivity',
        header: 'Connectivity',
        cell: ({ row }) => (
          <ConnectivityBadge status={row.original.connectivityStatus} />
        ),
      },
      {
        accessorKey: 'singleLimit',
        header: 'Single Limit',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {formatMoney(row.original.singleLimit)}
          </span>
        ),
      },
      {
        accessorKey: 'dailyLimit',
        header: 'Daily Cumulative Limit',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {formatMoney(row.original.dailyLimit)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <BankStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      createActionColumn<BankRow & { id: string }>((item) => {
        const s = item.status;
        const canEdit = s === 1 || s === 15;
        const actions: TableRowAction<BankRow & { id: string }>[] = [
          { label: 'View', onClick: () => router.push(`/bank-info/detail?id=${item.bankId}`) },
        ];
        if (canEdit) {
          actions.push(
            { label: 'Edit', onClick: () => router.push(`/bank-info/edit?id=${item.bankId}`) },
            { label: 'Submit Onboarding Application', onClick: () => onSubmitOnboard(item) },
          );
        }
        if (s === 20) {
          actions.push(
            // 源为禁用按钮 + Tooltip 说明文案；共享动作列无 tooltip 槽位，保留禁用语义。
            { label: 'Edit', disabled: true, onClick: () => router.push(`/bank-info/edit?id=${item.bankId}`) },
            { label: 'Freeze', destructive: true, onClick: () => onFreeze(item) },
            { label: 'Limit Change', onClick: () => setLimitChangeRow(item) },
            { label: 'Connection Info', onClick: () => setGatewayRow(item) },
          );
        }
        if (s === 50) {
          actions.push({ label: 'Unfreeze', onClick: () => onUnfreeze(item) });
        }
        return actions;
      }),
    ];
  }, [router, onSubmitOnboard, onFreeze, onUnfreeze]);

  const tableData = React.useMemo(
    () => rows.map((r: BankRow) => ({ ...r, id: String(r.bankId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="bankName"
            label="Bank Name"
            placeholder="Fuzzy match"
            register={register('bankName')}
          />
          <FormField
            name="bankCode"
            label="Bank Code"
            placeholder="Fuzzy match"
            register={register('bankCode')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Status
            </label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value || STATUS_ALL}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>All</SelectItem>
                    {BANK_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Bank List</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/bank-info/create')}
          >
            Create Bank
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>

      {/* 限额变更弹窗（仅 status=20；源 limit-change-dialog）。 */}
      {limitChangeRow && (
        <LimitChangeDialog
          row={limitChangeRow}
          onClose={() => {
            setLimitChangeRow(null);
            refreshList();
          }}
        />
      )}

      {/* 连接信息弹窗（仅 status=20；源 gateway-dialog）。 */}
      {gatewayRow && (
        <GatewayConnectionDialog
          row={gatewayRow}
          onClose={() => {
            setGatewayRow(null);
            refreshList();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/* LimitChangeDialog — 限额变更（源 limit-change-dialog.vue，内联弹窗）  */
/* ================================================================== */

interface LimitChangeForm {
  singleLimit: string;
  dailyLimit: string;
}

function LimitChangeDialog({
  row,
  onClose,
}: {
  row: BankRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const mutation = useBankLimitChangeMutation(KISSEN_PROJECT_ID);
  const { register, handleSubmit, formState } = useForm<LimitChangeForm>({
    defaultValues: { singleLimit: '', dailyLimit: '' },
  });

  const onSubmit = handleSubmit((v) => {
    mutation.mutate(
      {
        bankId: row.bankId,
        singleLimit: Number(v.singleLimit),
        dailyLimit: Number(v.dailyLimit),
      },
      {
        onSuccess: () => {
          toast.success('Limit change approval submitted');
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bank Limit Change</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bank</label>
            <div className="text-sm">{row.bankName}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Single Limit</label>
            <div className="font-mono tabular-nums text-sm">
              {formatMoney(row.singleLimit)}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Daily Cumulative Limit</label>
            <div className="font-mono tabular-nums text-sm">
              {formatMoney(row.dailyLimit)}
            </div>
          </div>
          <FormField
            name="singleLimit"
            label="New Single Limit"
            required
            type="number"
            step="any"
            error={formState.errors.singleLimit ? 'Please enter the new single limit' : undefined}
            register={register('singleLimit', {
              required: true,
              validate: (v) => v !== '' && Number(v) >= 0,
            })}
          />
          <FormField
            name="dailyLimit"
            label="New Daily Cumulative Limit"
            required
            type="number"
            step="any"
            error={formState.errors.dailyLimit ? 'Please enter the new daily cumulative limit' : undefined}
            register={register('dailyLimit', {
              required: true,
              validate: (v) => v !== '' && Number(v) >= 0,
            })}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Submit for Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* GatewayConnectionPanel — 网关连接信息 + 注册 + 测试（源 gateway-dialog）*/
/* 复用于 BankInfoListPage 内联弹窗与 GatewayRegisterFormPage 路由页。   */
/* ================================================================== */

function GatewayConnectionPanel({
  bankId,
  onSaved,
}: {
  bankId: number;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const infoQuery = useBankGatewayInfoQuery(KISSEN_PROJECT_ID, bankId);
  const info = infoQuery.data;
  const registerMutation = useRegisterBankGatewayMutation(KISSEN_PROJECT_ID);
  const [testing, setTesting] = React.useState(false);

  const { register, handleSubmit, reset, formState } =
    useForm<BankGatewayFormValues>({
      defaultValues: { endpointUrl: '', keyFingerprint: '' },
    });

  // 回填 endpointUrl（keyFingerprint 始终留空 = 保持原值）。
  React.useEffect(() => {
    if (info) {
      reset({ endpointUrl: info.endpointUrl ?? '', keyFingerprint: '' });
    }
  }, [info, reset]);

  const notRegistered = (info?.endpointUrl ?? '') === '';
  const connectivity = info?.connectivityStatus ?? 0;

  const onSave = handleSubmit((v) => {
    if (notRegistered && !v.keyFingerprint.trim()) {
      toast.error('Please enter the key fingerprint for first-time registration');
      return;
    }
    registerMutation.mutate(
      {
        bankId,
        endpointUrl: v.endpointUrl,
        keyFingerprint: v.keyFingerprint || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Connection info saved');
          onSaved?.();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  /** 测试连接：结果以后端回写的连通性为准，刷新 info 后判定（源 onTest）。 */
  const onTest = async () => {
    if (notRegistered) return;
    setTesting(true);
    try {
      await testBankGateway(bankId);
      const fresh = await infoQuery.refetch();
      if (fresh.data?.connectivityStatus === 1) toast.success('Connection normal');
      else toast.warning('Connection failed: gateway endpoint unreachable');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 连接状态 */}
      <section className="space-y-3">
        <div className="text-sm font-semibold">Connectivity</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DetailField label="Connectivity">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <ConnectivityBadge status={connectivity} />
            )}
          </DetailField>
          <DetailField label="Last Heartbeat">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{formatTime(info?.lastHeartbeatTime)}</span>
            )}
          </DetailField>
          <DetailField label="Current Key Fingerprint">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span>{info?.keyFingerprintMasked || '--'}</span>
            )}
          </DetailField>
          <DetailField label="Registration Status">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : info?.registered ? (
              <Badge variant="default">Registered</Badge>
            ) : (
              <Badge variant="outline">Not Registered</Badge>
            )}
          </DetailField>
        </div>
      </section>

      {/* 连接设置 */}
      <form onSubmit={onSave} className="space-y-4">
        <div className="text-sm font-semibold">Connection Settings</div>
        <FormField
          name="endpointUrl"
          label="Gateway Endpoint URL"
          required
          placeholder="Please enter the gateway endpoint URL"
          maxLength={200}
          error={formState.errors.endpointUrl ? 'Please enter the gateway endpoint URL' : undefined}
          register={register('endpointUrl', { required: true, maxLength: 200 })}
        />
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Key Fingerprint</label>
          <Input
            maxLength={128}
            placeholder={notRegistered ? 'Please enter the key fingerprint' : 'Leave blank to keep the current value'}
            {...register('keyFingerprint')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={notRegistered || testing}
            onClick={onTest}
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button type="submit" disabled={registerMutation.isPending}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

function GatewayConnectionDialog({
  row,
  onClose,
}: {
  row: BankRow;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Bank Connection Info</DialogTitle>
          <DialogDescription>{row.bankName}</DialogDescription>
        </DialogHeader>
        <GatewayConnectionPanel bankId={row.bankId} onSaved={onClose} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* BankInfoFormPage — 新建/编辑银行（源 bank-dialog create/edit）         */
/* ================================================================== */

interface BankInfoFormValues {
  bankName: string;
  bankCode: string;
  bic: string;
  currencies: string[];
  singleLimit: string;
  dailyLimit: string;
  accountConfig: string;
  kycInfo: string;
}

function mapDetailToForm(d: BankRow): BankInfoFormValues {
  return {
    bankName: d.bankName ?? '',
    bankCode: d.bankCode ?? '',
    bic: d.bic ?? '',
    currencies: d.currencies ?? [],
    singleLimit: d.singleLimit === 0 || d.singleLimit == null ? '' : String(d.singleLimit),
    dailyLimit: d.dailyLimit === 0 || d.dailyLimit == null ? '' : String(d.dailyLimit),
    accountConfig: d.accountConfig ?? '',
    kycInfo: d.kycInfo ?? '',
  };
}

export function BankInfoFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));
  const isEdit = bankId != null;

  const { data: detail } = useBankDetailQuery(KISSEN_PROJECT_ID, bankId);
  const { data: currencyList } = useCurrencyEnabledQuery(KISSEN_PROJECT_ID);
  const saveMutation = useSaveBankMutation(KISSEN_PROJECT_ID);

  const { control, register, handleSubmit, reset, formState } =
    useForm<BankInfoFormValues>({
      defaultValues: {
        bankName: '',
        bankCode: '',
        bic: '',
        currencies: [],
        singleLimit: '',
        dailyLimit: '',
        accountConfig: '',
        kycInfo: '',
      },
    });

  // 编辑态回填。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset(mapDetailToForm(detail));
  }, [detail, isEdit, reset]);

  const onSubmit = handleSubmit((v) => {
    const payload: BankSaveReq = {
      bankId: isEdit ? bankId : undefined,
      bankName: v.bankName,
      bankCode: v.bankCode,
      bic: v.bic || undefined,
      currencies: v.currencies,
      singleLimit: v.singleLimit,
      dailyLimit: v.dailyLimit,
      accountConfig: v.accountConfig || undefined,
      kycInfo: v.kycInfo || undefined,
    };
    saveMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Draft)');
        router.push('/bank-info');
      },
      onError: (e) => toast.error((e as Error).message),
    });
  });

  const submitting = saveMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit Bank' : 'Create Bank'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            name="bankName"
            label="Bank Name"
            required
            error={formState.errors.bankName ? 'Please enter the bank name' : undefined}
            register={register('bankName', { required: true, maxLength: 64 })}
          />
          <FormField
            name="bankCode"
            label="Bank Code"
            required
            error={formState.errors.bankCode ? 'Please enter the bank code' : undefined}
            register={register('bankCode', { required: true, maxLength: 32 })}
          />
          <FormField
            name="bic"
            label="SWIFT BIC"
            register={register('bic', { maxLength: 16 })}
          />
          <FormField
            name="singleLimit"
            label="Single Limit"
            required
            type="number"
            step="any"
            error={formState.errors.singleLimit ? 'Please enter the single limit' : undefined}
            register={register('singleLimit', {
              required: true,
              validate: (v) => v !== '' && Number(v) > 0,
            })}
          />
          <FormField
            name="dailyLimit"
            label="Daily Cumulative Limit"
            required
            type="number"
            placeholder="Greater than 0"
            step="any"
            error={formState.errors.dailyLimit ? 'Please enter the daily cumulative limit' : undefined}
            register={register('dailyLimit', {
              required: true,
              validate: (v) => v !== '' && Number(v) > 0,
            })}
          />
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Account Config</label>
            <Textarea
              rows={3}
              placeholder="JSON, optional"
              {...register('accountConfig')}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">KYC Information</label>
            <Textarea
              rows={3}
              placeholder="Qualification materials, optional"
              {...register('kycInfo')}
            />
          </div>
        </div>
      </section>

      {/* 支持币种多选（数据源 currencyEnabledList；源 bank-dialog currencies）。 */}
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4 text-sm font-semibold">
          Supported Currencies
          <span className="ml-0.5 text-destructive">*</span>
        </div>
        <Controller
          control={control}
          name="currencies"
          rules={{
            validate: (v) =>
              (Array.isArray(v) && v.length > 0) || 'Please select at least one supported currency',
          }}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              {currencyList?.length ? (
                <div className="flex flex-wrap gap-4">
                  {currencyList.map((c: CurrencyRow) => {
                    const checked = field.value?.includes(c.currencyCode) ?? false;
                    return (
                      <label
                        key={c.currencyId}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(ck) => {
                            const next = ck
                              ? [...(field.value ?? []), c.currencyCode]
                              : (field.value ?? []).filter(
                                  (x) => x !== c.currencyCode,
                                );
                            field.onChange(next);
                          }}
                        />
                        {c.currencyCode}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No currencies available</p>
              )}
              <p className="text-xs text-muted-foreground">
                Data source: enabled currency master data
              </p>
              {fieldState.error && (
                <p className="text-sm text-destructive">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/bank-info')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Save
        </Button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* BankInfoDetailPage — 银行详情只读（源 bank-dialog view）              */
/* ================================================================== */

export function BankInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));

  const { data: detail, isLoading } = useBankDetailQuery(
    KISSEN_PROJECT_ID,
    bankId,
  );

  if (!bankId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">Missing bank ID</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/bank-info')}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">Bank Details</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailField label="Bank Name">
            {isLoading ? <Skeleton className="h-4 w-32" /> : detail?.bankName || '--'}
          </DetailField>
          <DetailField label="Bank Code">
            {isLoading ? <Skeleton className="h-4 w-32" /> : detail?.bankCode || '--'}
          </DetailField>
          <DetailField label="SWIFT BIC">
            {isLoading ? <Skeleton className="h-4 w-32" /> : detail?.bic || '--'}
          </DetailField>
          <DetailField label="Supported Currencies">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : detail?.currencies?.length ? (
              detail.currencies.join(', ')
            ) : (
              '--'
            )}
          </DetailField>
          <DetailField label="Single Limit">
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="font-mono tabular-nums">
                {formatMoney(detail?.singleLimit)}
              </span>
            )}
          </DetailField>
          <DetailField label="Daily Cumulative Limit">
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="font-mono tabular-nums">
                {formatMoney(detail?.dailyLimit)}
              </span>
            )}
          </DetailField>
          <DetailField label="Connectivity">
            {isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <ConnectivityBadge status={detail?.connectivityStatus ?? 0} />
            )}
          </DetailField>
          <DetailField label="Status">
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : detail ? (
              <BankStatusBadge status={detail.status} />
            ) : (
              '--'
            )}
          </DetailField>
          <DetailField label="Created At">
            {isLoading ? <Skeleton className="h-4 w-40" /> : formatTime(detail?.createTime)}
          </DetailField>
          <DetailField label="Account Config">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span className="whitespace-pre-wrap break-all">
                {detail?.accountConfig || '--'}
              </span>
            )}
          </DetailField>
          <DetailField label="KYC Information">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span className="whitespace-pre-wrap break-all">
                {detail?.kycInfo || '--'}
              </span>
            )}
          </DetailField>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/bank-info')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* BankApprovalListPage — 银行审批中心（源 approval/index.vue，bank 限定）*/
/* ================================================================== */

type ApprovalTab = 'todo' | 'done';

interface BankApprovalFilterForm {
  businessCode: string;
  keyword: string;
  status: string;
}

const BANK_APPROVAL_BUSINESS_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: STATUS_ALL },
  { label: BANK_BUSINESS_LABEL[BANK_BUSINESS_CODES.onboard], value: BANK_BUSINESS_CODES.onboard },
  { label: BANK_BUSINESS_LABEL[BANK_BUSINESS_CODES.limitChange], value: BANK_BUSINESS_CODES.limitChange },
];

/** 把列表行编码进详情路由 searchParams（详情页无单行查询端点，靠列表行透传）。 */
function buildApprovalDetailHref(
  row: BankApprovalTodoRow | BankApprovalDoneRow,
  tab: ApprovalTab,
): string {
  const p = new URLSearchParams({
    taskId: String(row.taskId),
    busCode: row.businessCode,
    applyCode: row.applyCode,
    busDesc: row.busDesc,
    stepName: row.stepName,
    reviewerStatus: String(row.reviewerStatus),
    createTime: String(row.createTime),
    tab,
  });
  const done = row as BankApprovalDoneRow;
  if (tab === 'done' && done.detailReviewerStatus !== undefined) {
    p.set('reviewerTime', String(done.reviewerTime));
    p.set('reviewerRemarks', done.reviewerRemarks ?? '');
    p.set('detailReviewerStatus', String(done.detailReviewerStatus));
  }
  return `/bank-approval/detail?${p.toString()}`;
}

export function BankApprovalListPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<ApprovalTab>('todo');
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { register, handleSubmit, reset, control } = useForm<BankApprovalFilterForm>({
    defaultValues: {
      businessCode: STATUS_ALL,
      keyword: '',
      status: '',
    },
  });
  const [filter, setFilter] = React.useState<BankApprovalPageReq>({});

  const todoQuery = useBankApprovalTodoQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, data: filter },
    tab === 'todo',
  );
  const doneQuery = useBankApprovalDoneQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, data: filter },
    tab === 'done',
  );
  const activeQuery = tab === 'todo' ? todoQuery : doneQuery;
  const rows: Array<BankApprovalTodoRow | BankApprovalDoneRow> =
    activeQuery.data?.data ?? [];
  const paginationMeta = activeQuery.data?.pagination;

  const onSearch = React.useCallback(
    (form: BankApprovalFilterForm) => {
      const next: BankApprovalPageReq = {};
      if (form.businessCode && form.businessCode !== STATUS_ALL)
        next.businessCode = form.businessCode;
      if (form.keyword) next.keyword = form.keyword;
      if (tab === 'done' && form.status && form.status !== STATUS_ALL)
        next.status = Number(form.status);
      setFilter(next);
      setPageNum(1);
    },
    [tab],
  );

  const onReset = React.useCallback(() => {
    reset({
      businessCode: STATUS_ALL,
      keyword: '',
      status: '',
    });
    setFilter({});
    setPageNum(1);
  }, [reset]);

  const onTabChange = (next: string) => {
    if (next === 'todo' || next === 'done') {
      setTab(next);
      setPageNum(1);
    }
  };

  const columns = React.useMemo<
    ColumnDef<(BankApprovalTodoRow | BankApprovalDoneRow) & { id: string }>[]
  >(() => {
    const base: ColumnDef<(BankApprovalTodoRow | BankApprovalDoneRow) & { id: string }>[] = [
      { accessorKey: 'applyCode', header: 'Approval No.' },
      {
        accessorKey: 'businessCode',
        header: 'Business Type',
        cell: ({ row }) => (
          <span>{BANK_BUSINESS_LABEL[row.original.businessCode] ?? row.original.businessCode}</span>
        ),
      },
      { accessorKey: 'busDesc', header: 'Business Description' },
      { accessorKey: 'stepName', header: 'Current Step' },
      { accessorKey: 'createUserName', header: 'Applicant' },
      {
        accessorKey: 'createTime',
        header: 'Application Time',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          if (tab === 'todo') {
            return <BankStatusBadge status={row.original.reviewerStatus} />;
          }
          const done = row.original as BankApprovalDoneRow;
          return (
            <Badge variant={bankDetailStatusVariant(done.detailReviewerStatus)}>
              {BANK_DETAIL_STATUS_LABEL[done.detailReviewerStatus] ?? done.detailReviewerStatus}
            </Badge>
          );
        },
      },
    ];
    base.push(
      {
        accessorKey: 'reviewerTime',
        header: 'Processed At',
        cell: ({ row }) => (
          <span>{formatTime((row.original as BankApprovalDoneRow).reviewerTime)}</span>
        ),
      },
      {
        accessorKey: 'reviewerRemarks',
        header: 'My Remarks',
        cell: ({ row }) => (
          <span>{(row.original as BankApprovalDoneRow).reviewerRemarks || '--'}</span>
        ),
      },
    );
    base.push(
      createActionColumn<(BankApprovalTodoRow | BankApprovalDoneRow) & { id: string }>((item) => [
        {
          label: tab === 'todo' ? 'Process' : 'View',
          onClick: () => router.push(buildApprovalDetailHref(item, tab)),
        },
      ]),
    );
    return base;
  }, [router, tab]);

  const tableData = React.useMemo(
    () => rows.map((r: BankApprovalTodoRow | BankApprovalDoneRow) => ({ ...r, id: String(r.taskId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Business Type
            </label>
            <Controller
              control={control}
              name="businessCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_APPROVAL_BUSINESS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <FormField
            name="keyword"
            label="Keyword"
            placeholder="Approval No. / Business Description"
            register={register('keyword')}
          />
          {tab === 'done' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Result
              </label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value || STATUS_ALL}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>All</SelectItem>
                      <SelectItem value="3">Approved</SelectItem>
                      <SelectItem value="2">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="rounded-lg border-border/60 bg-card shadow-float">
          <div className="border-b px-6 pt-4">
            <TabsList>
              <TabsTrigger value="todo">To Do</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="todo" className="mt-0">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={todoQuery.isLoading}
              emptyMessage="No data"
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: setPageNum,
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          </TabsContent>
          <TabsContent value="done" className="mt-0">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={doneQuery.isLoading}
              emptyMessage="No data"
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: setPageNum,
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ================================================================== */
/* BankApprovalDetailPage — 银行审批详情 + 操作（源 detail-drawer 路由化）*/
/* ================================================================== */

export function BankApprovalDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();

  const taskId = parseBankId(sp.get('taskId'));
  const busCode = sp.get('busCode') ?? undefined;
  const isDone = sp.get('tab') === 'done';

  const applyCode = sp.get('applyCode') ?? '';
  const busDesc = sp.get('busDesc') ?? '';
  const stepName = sp.get('stepName') ?? '';
  const reviewerStatusRaw = Number(sp.get('reviewerStatus'));
  const reviewerStatus = Number.isFinite(reviewerStatusRaw) ? reviewerStatusRaw : 0;
  const createTime = Number(sp.get('createTime')) || 0;
  const reviewerTime = Number(sp.get('reviewerTime')) || 0;
  const reviewerRemarks = sp.get('reviewerRemarks') ?? '';
  const detailReviewerStatusRaw = Number(sp.get('detailReviewerStatus'));
  const detailReviewerStatus = Number.isFinite(detailReviewerStatusRaw)
    ? detailReviewerStatusRaw
    : undefined;

  const { data: detail, isLoading } = useBankApprovalDetailQuery(
    KISSEN_PROJECT_ID,
    busCode,
    taskId,
  );
  const processMutation = useProcessBankApprovalMutation(KISSEN_PROJECT_ID);
  const previousMutation = usePreviousStepBankApprovalMutation(KISSEN_PROJECT_ID);
  const withdrawMutation = useWithdrawBankApprovalMutation(KISSEN_PROJECT_ID);

  const [remarks, setRemarks] = React.useState('');

  const buttons: BankApproveButtonDTO = detail?.approveButtonDTO ?? {};
  const isTodo = !isDone;
  const hasApprove = (buttons.approveType ?? 0) !== 0;
  const hasBack = (buttons.previousStepType ?? 0) !== 0;
  const hasWithdraw = (buttons.withdrawType ?? 0) !== 0;
  const canOperate = isTodo && (hasApprove || hasBack || hasWithdraw);
  const submitting =
    processMutation.isPending || previousMutation.isPending || withdrawMutation.isPending;

  const back = () => router.push('/bank-approval');

  const onApprove = (approve: 3 | 2) => {
    if (approve === 2 && !remarks.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }
    if (!busCode || !taskId) return;
    if (!window.confirm(approve === 3 ? 'Confirm approving this request?' : 'Confirm rejecting this request?')) return;
    processMutation.mutate(
      { busCode, taskId, approve, remarks: remarks.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(approve === 3 ? 'Approved' : 'Rejected');
          back();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onPreviousStep = () => {
    if (!remarks.trim()) {
      toast.warning('A return reason is required to send back to the previous step');
      return;
    }
    if (!busCode || !taskId) return;
    if (!window.confirm('Confirm sending back to the previous step? Approval remarks for this node will be discarded.')) return;
    previousMutation.mutate(
      { busCode, taskId, remarks: remarks.trim() },
      {
        onSuccess: () => {
          toast.success('Sent back to the previous step');
          back();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onWithdraw = () => {
    if (!busCode || !taskId) return;
    if (!window.confirm('After withdrawal, the application will return to the re-initiation state. Confirm withdrawal?')) return;
    withdrawMutation.mutate(
      { busCode, taskId, remarks: remarks.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Withdrawn');
          back();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  if (!busCode || !taskId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">Missing approval task parameters</p>
        <Button variant="outline" className="mt-4" onClick={back}>
          Back
        </Button>
      </div>
    );
  }

  const contentEntries = buildContentEntries(busCode, detail?.businessContent);
  const flatEntries = contentEntries.filter(
    ([, f]) => typeof f === 'string',
  ) as Array<[string, string]>;
  const nestedEntries = contentEntries.filter(
    ([, f]) => typeof f !== 'string',
  ) as Array<[string, NestedValue]>;

  return (
    <div className="space-y-4">
      {/* 头部信息块 */}
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {BANK_BUSINESS_LABEL[busCode] ?? busCode} - Details
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailField label="Approval No.">{applyCode || '--'}</DetailField>
          <DetailField label="Business Type">
            {BANK_BUSINESS_LABEL[busCode] ?? busCode}
          </DetailField>
          <DetailField label="Business Description">{busDesc || '--'}</DetailField>
          <DetailField label="Current Step">{stepName || '--'}</DetailField>
          <DetailField label="Status">
            {isLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <BankStatusBadge status={reviewerStatus} />
            )}
          </DetailField>
          <DetailField label="Application Time">{formatTime(createTime)}</DetailField>
          {isDone && (
            <>
              <DetailField label="Approval Result">
                {detailReviewerStatus !== undefined ? (
                  <Badge variant={bankDetailStatusVariant(detailReviewerStatus)}>
                    {BANK_DETAIL_STATUS_LABEL[detailReviewerStatus] ?? detailReviewerStatus}
                  </Badge>
                ) : (
                  '--'
                )}
              </DetailField>
              <DetailField label="Processed At">{formatTime(reviewerTime)}</DetailField>
              <DetailField label="My Remarks">{reviewerRemarks || '--'}</DetailField>
            </>
          )}
        </div>
      </section>

      {/* 业务内容 */}
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4 text-base font-semibold">Business Content</div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {flatEntries.map(([key, text]) => (
                <DetailField key={key} label={fieldLabelFor(busCode, key)}>
                  <span className={isNumericValue(text) ? 'font-mono tabular-nums' : ''}>
                    {text}
                  </span>
                </DetailField>
              ))}
            </div>
            {nestedEntries.map(([key, nested]) => (
              <div key={key} className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-semibold">
                  {fieldLabelFor(busCode, key)}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {nested.entries.map(([k, v]) => {
                    const fv = formatFieldValue(k, v);
                    const text = typeof fv === 'string' ? fv : JSON.stringify(v);
                    return (
                      <DetailField key={k} label={fieldLabelFor(busCode, k)}>
                        <span className={isNumericValue(text) ? 'font-mono tabular-nums' : ''}>
                          {text}
                        </span>
                      </DetailField>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 审批操作 */}
      {canOperate && (
        <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <div className="mb-4 text-base font-semibold">Approval Actions</div>
          <Textarea
            rows={3}
            maxLength={200}
            placeholder="Approval remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <div className="text-right text-xs text-muted-foreground">
            {remarks.length}/200
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={submitting}
              onClick={() => onApprove(3)}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => onApprove(2)}
            >
              Reject
            </Button>
            {hasBack && (
              <Button
                variant="outline"
                disabled={submitting}
                onClick={onPreviousStep}
              >
                Send Back to Previous Step
              </Button>
            )}
            {hasWithdraw && (
              <Button
                variant="secondary"
                disabled={submitting}
                onClick={onWithdraw}
              >
                Withdraw
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* GatewayRegisterListPage — 网关连接维度列表（已启用银行 + 连通性）      */
/* ================================================================== */

export function GatewayRegisterListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset } = useForm<{ bankName?: string }>({
    defaultValues: { bankName: '' },
  });
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [params, setParams] = React.useState(() => ({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    filter: { status: 20 } as BankListFilter,
  }));

  // 网关连接维度只列已启用（status=20）银行。
  const { data, isLoading } = useBankListQuery(KISSEN_PROJECT_ID, params);
  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: { bankName?: string }) => {
      const filter: BankListFilter = { status: 20 };
      if (form.bankName) filter.bankName = form.bankName;
      setParams({ pageNum: 1, pageSize, filter });
    },
    [pageSize],
  );

  const onReset = React.useCallback(() => {
    reset({ bankName: '' });
    setParams({ pageNum: 1, pageSize, filter: { status: 20 } });
  }, [reset, pageSize]);

  const columns = React.useMemo<ColumnDef<BankRow & { id: string }>[]>(() => {
    return [
      { accessorKey: 'bankName', header: 'Bank Name' },
      { accessorKey: 'bankCode', header: 'Bank Code' },
      {
        id: 'connectivity',
        header: 'Connectivity',
        cell: ({ row }) => (
          <ConnectivityBadge status={row.original.connectivityStatus} />
        ),
      },
      createActionColumn<BankRow & { id: string }>((item) => [
        { label: 'Configure', onClick: () => router.push(`/gateway-register/edit?id=${item.bankId}`) },
        { label: 'Details', onClick: () => router.push(`/gateway-register/detail?id=${item.bankId}`) },
      ]),
    ];
  }, [router]);

  const tableData = React.useMemo(
    () => rows.map((r: BankRow) => ({ ...r, id: String(r.bankId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="bankName"
            label="Bank Name"
            placeholder="Fuzzy match"
            register={register('bankName')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">Gateway Connection List</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/* GatewayRegisterFormPage — 网关连接配置（路由化承载源 gateway-dialog）  */
/* ================================================================== */

export function GatewayRegisterFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));

  if (!bankId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">
          Please select a bank from the gateway connection list before configuring.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/gateway-register')}
        >
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">Gateway Connection Config</div>
        <GatewayConnectionPanel
          bankId={bankId}
          onSaved={() => router.push('/gateway-register')}
        />
      </section>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/gateway-register')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* GatewayRegisterDetailPage — 网关连接信息只读 + 测试连接               */
/* ================================================================== */

export function GatewayRegisterDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));

  const infoQuery = useBankGatewayInfoQuery(KISSEN_PROJECT_ID, bankId);
  const info = infoQuery.data;
  const [testing, setTesting] = React.useState(false);

  const onTest = async () => {
    if (!bankId) return;
    if ((info?.endpointUrl ?? '') === '') {
      toast.warning('Please save the connection info first');
      return;
    }
    setTesting(true);
    try {
      await testBankGateway(bankId);
      const fresh = await infoQuery.refetch();
      if (fresh.data?.connectivityStatus === 1) toast.success('Connection normal');
      else toast.warning('Connection failed: gateway endpoint unreachable');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (!bankId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">Missing bank ID</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/gateway-register')}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">Gateway Connection Info</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailField label="Registration Status">
            {infoQuery.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : info?.registered ? (
              <Badge variant="default">Registered</Badge>
            ) : (
              <Badge variant="outline">Not Registered</Badge>
            )}
          </DetailField>
          <DetailField label="Connectivity">
            {infoQuery.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <ConnectivityBadge status={info?.connectivityStatus ?? 0} />
            )}
          </DetailField>
          <DetailField label="Gateway Endpoint URL">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <span className="break-all">{info?.endpointUrl || '--'}</span>
            )}
          </DetailField>
          <DetailField label="Current Key Fingerprint">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span>{info?.keyFingerprintMasked || '--'}</span>
            )}
          </DetailField>
          <DetailField label="Last Heartbeat">
            {infoQuery.isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              formatTime(info?.lastHeartbeatTime)
            )}
          </DetailField>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/gateway-register')}>
          Back
        </Button>
        <Button
          variant="outline"
          disabled={testing || (info?.endpointUrl ?? '') === ''}
          onClick={onTest}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
        <Button onClick={() => router.push(`/gateway-register/edit?id=${bankId}`)}>
          Edit
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 通用只读字段组件                                                     */
/* ================================================================== */

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
